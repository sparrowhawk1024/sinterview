"""
Unit Tests for Deterministic Claim Verifier, Window-to-Concept Mapping,
Speaker Baseline Z-Scores, and Quality Gate.
"""

import unittest
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "local_speech_model")))

from config import CONFIG
from word_features import (
    WordFeature,
    check_quality_gate,
    extract_word_features_from_asr,
    reconcile_and_build_word_features,
    estimate_snr_db
)
from hesitation import (
    compute_delivery_hesitation_index,
    detect_hesitation_windows,
    extract_concept_spans,
    map_hesitation_to_concepts
)
from speaker_baseline import (
    calibrate_speaker_baseline,
    compute_baseline_deviations,
    compute_adaptive_turn_silence_timeout,
    check_semantic_completeness_heuristic
)
from claim_verifier import (
    StructuredClaimInput,
    verify_claims_deterministically
)


class TestUpgradeModules(unittest.TestCase):

    def setUp(self):
        # Sample simulated words with timestamps
        self.words = [
            WordFeature(idx=0, text="In", start=0.0, end=0.2, is_filler=False),
            WordFeature(idx=1, text="production", start=0.25, end=0.8, is_filler=False),
            WordFeature(idx=2, text="we", start=0.85, end=1.0, is_filler=False),
            WordFeature(idx=3, text="use", start=1.05, end=1.3, is_filler=False),
            WordFeature(idx=4, text="virtual", start=1.35, end=1.8, is_filler=False),
            WordFeature(idx=5, text="DOM", start=1.85, end=2.3, is_filler=False),
            WordFeature(idx=6, text="um", start=2.4, end=2.7, is_filler=True),  # filler
            WordFeature(idx=7, text="uh", start=2.75, end=3.1, is_filler=True), # filler
            WordFeature(idx=8, text="caching", start=4.5, end=5.0, is_filler=False), # pause gap 1.4s
            WordFeature(idx=9, text="layers", start=5.05, end=5.5, is_filler=False),
        ]
        self.transcript = "In production we use virtual DOM um uh caching layers."

    # -------------------------------------------------------------
    # 1. Quality Gate Tests
    # -------------------------------------------------------------
    def test_quality_gate_snr_and_confidence(self):
        """Low SNR audio or low ASR confidence must fail the quality gate with gated metrics."""
        sr = 16000
        # Clean audio simulation (2s tone + 0.5s pause/noise + 1s tone -> natural speech structure)
        t1 = np.linspace(0, 1.5, int(1.5 * sr), endpoint=False)
        tone1 = 0.5 * np.sin(2 * np.pi * 440 * t1).astype(np.float32)
        noise = 0.002 * np.random.randn(int(0.5 * sr)).astype(np.float32)
        t2 = np.linspace(0, 1.0, int(1.0 * sr), endpoint=False)
        tone2 = 0.5 * np.sin(2 * np.pi * 440 * t2).astype(np.float32)
        clean_audio = np.concatenate([tone1, noise, tone2]).astype(np.float32)

        gate_pass = check_quality_gate(audio=clean_audio, sr=sr, words=self.words)
        self.assertTrue(gate_pass.passed)
        self.assertEqual(len(gate_pass.gated_metrics), 0)

        # Pure white noise -> SNR near 0 dB -> fails gate
        noise_audio = np.random.randn(3 * sr).astype(np.float32) * 0.2
        gate_fail = check_quality_gate(audio=noise_audio, sr=sr, words=self.words)
        self.assertFalse(gate_fail.passed)
        self.assertIn("delivery_score", gate_fail.gated_metrics)

        # Degraded ASR confidence words
        low_conf_words = [
            WordFeature(idx=0, text="hello", start=0.0, end=0.5, asr_conf=0.25),
            WordFeature(idx=1, text="world", start=0.6, end=1.0, asr_conf=0.30)
        ]
        gate_conf_fail = check_quality_gate(audio=clean_audio, sr=sr, words=low_conf_words)
        self.assertFalse(gate_conf_fail.passed)
        self.assertIn("filler_rate", gate_conf_fail.gated_metrics)

    # -------------------------------------------------------------
    # 2. Window-to-Concept Mapping Tests
    # -------------------------------------------------------------
    def test_window_to_concept_targeting(self):
        """Hesitation windows around 'virtual DOM' and 'caching layers' must map to these concepts."""
        result = map_hesitation_to_concepts(
            words=self.words,
            rubric_scores={"technical_depth": {"score": 2.5}}
        )
        self.assertIsNotNone(result.target_concept)
        self.assertIn(result.target_concept, ["virtual dom", "caching layers", "production", "virtual"])
        self.assertGreater(result.hesitation_windows_count, 0)
        self.assertGreater(result.priority_score, 0.0)
        self.assertTrue("load" in result.selection_reason)

    # -------------------------------------------------------------
    # 3. Speaker Baseline Z-Scores Tests
    # -------------------------------------------------------------
    def test_speaker_baseline_calibration_and_z_scores(self):
        """Calibrates baseline on warm-up and computes normalized deviation without false flags."""
        warmup_words = [
            WordFeature(idx=i, text=f"word{i}", start=i * 0.36, end=(i + 1) * 0.36, is_filler=False)
            for i in range(25)
        ]
        duration_s = 25 * 0.36  # ~9.0s -> ~166 WPM
        baseline = calibrate_speaker_baseline(warmup_words, duration_s=duration_s, question_id="q_warmup")

        self.assertTrue(baseline.is_calibrated)
        self.assertAlmostEqual(baseline.baseline_wpm_mean, 166.7, delta=5.0)

        # On next answer with 165 WPM: deviation should be near 0 and marked natural
        dev_normal = compute_baseline_deviations(wpm=165.0, mean_pause_s=0.5, baseline=baseline)
        self.assertTrue(dev_normal.is_calibrated)
        self.assertLess(abs(dev_normal.z_score_wpm), 1.5)
        self.assertIn("Natural pace for this speaker", dev_normal.normalized_pace_flag)

        # On answer with 225 WPM: deviation should be positive (>1.5)
        dev_fast = compute_baseline_deviations(wpm=225.0, mean_pause_s=0.5, baseline=baseline)
        self.assertGreater(dev_fast.z_score_wpm, 1.5)
        self.assertIn("faster than personal baseline", dev_fast.normalized_pace_flag)

    # -------------------------------------------------------------
    # 4. Adaptive Turn-Taking Tests
    # -------------------------------------------------------------
    def test_adaptive_turn_taking(self):
        """Tests quick silence on complete sentence and extended silence on mid-thought."""
        # Complete sentence with terminal period
        turn_complete = compute_adaptive_turn_silence_timeout(
            transcript="I deployed the service to Kubernetes.",
            words=[
                WordFeature(idx=0, text="I", start=0.0, end=0.2),
                WordFeature(idx=1, text="deployed", start=0.25, end=0.7),
                WordFeature(idx=2, text="the", start=0.75, end=0.9),
                WordFeature(idx=3, text="service", start=0.95, end=1.4),
                WordFeature(idx=4, text="to", start=1.45, end=1.6),
                WordFeature(idx=5, text="Kubernetes.", start=1.65, end=2.2)
            ]
        )
        self.assertTrue(turn_complete.is_semantically_complete)
        self.assertEqual(turn_complete.adaptive_silence_timeout_s, CONFIG.turn_taking.quick_silence_timeout_s)

        # Incomplete sentence ending with dangling conjunction 'because...'
        turn_incomplete = compute_adaptive_turn_silence_timeout(
            transcript="We couldn't scale the database because",
            words=[
                WordFeature(idx=0, text="We", start=0.0, end=0.2),
                WordFeature(idx=1, text="couldn't", start=0.25, end=0.7),
                WordFeature(idx=2, text="scale", start=0.75, end=1.1),
                WordFeature(idx=3, text="the", start=1.15, end=1.3),
                WordFeature(idx=4, text="database", start=1.35, end=1.8),
                WordFeature(idx=5, text="because", start=1.85, end=2.2)
            ]
        )
        self.assertFalse(turn_incomplete.is_semantically_complete)
        self.assertEqual(turn_incomplete.adaptive_silence_timeout_s, CONFIG.turn_taking.extended_silence_timeout_s)

    # -------------------------------------------------------------
    # 5. Deterministic Claim Verifier Tests
    # -------------------------------------------------------------
    def test_claim_verifier_retains_valid_and_drops_unsupported(self):
        """Verifier must accept claims grounded in transcript/metrics and drop hallucinated claims."""
        raw_claims = [
            # 1. Valid claim with matching quote
            {
                "claim": 'Candidate clearly stated "virtual DOM" in their solution.',
                "type": "strength",
                "quoted_text": "virtual DOM",
                "word_range": [4, 5]
            },
            # 2. Valid metric claim (2 fillers were spoken)
            {
                "claim": "Candidate kept filler words low during the opening statement.",
                "type": "metric_observation",
                "metric_id": "filler_count_low"
            },
            # 3. Hallucinated quote NOT in transcript -> MUST BE DROPPED
            {
                "claim": 'Candidate discussed "eventual consistency" in distributed systems.',
                "type": "strength",
                "quoted_text": "eventual consistency"
            },
            # 4. Contradictory metric claim (claiming 166 WPM is slow) -> MUST BE DROPPED
            {
                "claim": "Candidate exhibited excessively slow speaking pace.",
                "type": "improvement",
                "metric_id": "wpm_slow"
            }
        ]

        metrics_ctx = {
            "speech_rate_wpm": 166.0,
            "filler_word_count": 2,
            "long_pause_count": 1,
            "hesitation_index": 0.25
        }

        res = verify_claims_deterministically(
            raw_claims=raw_claims,
            words=self.words,
            transcript=self.transcript,
            metrics_context=metrics_ctx
        )

        self.assertEqual(res.total_claims_evaluated, 4)
        self.assertEqual(len(res.verified_claims), 2)
        self.assertEqual(len(res.dropped_claims), 2)
        self.assertEqual(res.unsupported_claim_rate, 0.5)

        # Verified claims must have timestamps
        first_verified = res.verified_claims[0]
        self.assertIsNotNone(first_verified.start_time_s)
        self.assertIsNotNone(first_verified.end_time_s)
        self.assertAlmostEqual(first_verified.start_time_s, 1.35, delta=0.01)

        # Dropped claims contain reasons
        dropped_quotes = [d["claim"] for d in res.dropped_claims]
        self.assertTrue(any("eventual consistency" in c for c in dropped_quotes))
        self.assertTrue(any("slow speaking pace" in c for c in dropped_quotes))


if __name__ == "__main__":
    unittest.main()

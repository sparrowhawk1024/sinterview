"""
Unit Tests for Visual Telemetry and Multimodal Late Fusion Modules
(tests/test_visual_and_fusion.py)
"""

import unittest
from services.local_speech_model.visual import (
    VisualFrame,
    VisualTelemetryAggregate,
    aggregate_visual_frames,
    align_visual_windows_to_words
)
from services.local_speech_model.late_fusion import compute_late_fusion
from services.local_speech_model.word_features import WordFeature


class TestVisualAndFusion(unittest.TestCase):

    def test_visual_aggregation_valid_frames(self):
        """Verifies aggregation of valid 5 fps frames with high detection rate and proper exposure."""
        frames = [
            VisualFrame(
                timestamp_s=i * 0.2,
                face_detected=True,
                head_yaw=2.0,
                head_pitch=1.0,
                head_roll=0.5,
                gaze_proxy_ratio=0.52,
                shoulder_tilt=1.0,
                torso_lean=0.5,
                movement_energy=0.02,
                frame_brightness=135.0
            )
            for i in range(10)
        ]
        agg = aggregate_visual_frames(frames, expected_duration_s=2.0)
        self.assertTrue(agg.is_valid)
        self.assertGreaterEqual(agg.q_v, 0.50)
        self.assertEqual(agg.label, "camera-based indicator")
        self.assertIsNotNone(agg.sub_score)
        self.assertGreaterEqual(agg.sub_score, 1.0)
        self.assertLessEqual(agg.sub_score, 5.0)
        self.assertEqual(agg.face_in_frame_ratio, 1.0)

    def test_visual_aggregation_low_quality_abstention(self):
        """Verifies abstention when face is not detected or brightness is severely degraded."""
        # Low detection rate
        dark_frames = [
            VisualFrame(
                timestamp_s=i * 0.2,
                face_detected=False,
                frame_brightness=10.0 # severely dark
            )
            for i in range(10)
        ]
        agg = aggregate_visual_frames(dark_frames, expected_duration_s=2.0)
        self.assertFalse(agg.is_valid)
        self.assertLess(agg.q_v, 0.50)
        self.assertIsNone(agg.sub_score)
        self.assertIn("insufficient evidence", agg.quality_alert)

    def test_align_visual_windows_to_words(self):
        """Verifies alignment of timestamped visual frames to word timestamp intervals."""
        words = [
            WordFeature(idx=0, text="Hello", start=0.0, end=0.5, asr_conf=0.98),
            WordFeature(idx=1, text="world", start=0.6, end=1.0, asr_conf=0.95),
        ]
        frames = [
            VisualFrame(timestamp_s=0.1, movement_energy=0.05, gaze_proxy_ratio=0.6),
            VisualFrame(timestamp_s=0.3, movement_energy=0.07, gaze_proxy_ratio=0.7),
            VisualFrame(timestamp_s=0.8, movement_energy=0.02, gaze_proxy_ratio=0.5),
        ]
        alignment = align_visual_windows_to_words(frames, words)
        self.assertEqual(alignment["aligned_word_count"], 2)
        per_word = alignment["per_word_visual"]
        self.assertEqual(len(per_word), 2)
        # Word 0 covered frames at 0.1 and 0.3 -> avg energy (0.05 + 0.07)/2 = 0.06
        self.assertAlmostEqual(per_word[0]["visual_energy"], 0.06, places=2)
        # Word 1 covered frame at 0.8 -> energy 0.02
        self.assertAlmostEqual(per_word[1]["visual_energy"], 0.02, places=2)

    def test_late_fusion_formula_and_weights(self):
        """Verifies Eq. (7) computation: s = sum(alpha_m * q_m * s_m) / sum(alpha_m * q_m)."""
        # alpha_speech = 0.35, alpha_lang = 0.45, alpha_visual = 0.20
        # Speech: score 4.0, q 1.0 -> 0.35 * 4.0 = 1.40
        # Language: score 3.0, q 1.0 -> 0.45 * 3.0 = 1.35
        # Visual: score 5.0, q 1.0 -> 0.20 * 5.0 = 1.00
        # sum = 3.75, quality_sum = 1.00 -> fused = 3.75
        res = compute_late_fusion(
            speech_score=4.0,
            speech_quality=1.0,
            language_score=3.0,
            language_quality=1.0,
            visual_score=5.0,
            visual_quality=1.0
        )
        self.assertEqual(res.status, "success")
        self.assertAlmostEqual(res.fused_score, 3.75, places=2)
        self.assertEqual(res.total_effective_quality, 1.0)
        self.assertIn("speech", res.sub_scores)
        self.assertIn("language", res.sub_scores)
        self.assertIn("visual", res.sub_scores)

    def test_late_fusion_quality_gate_abstention(self):
        """Verifies that if total effective quality is below 0.40, no fused score is produced."""
        # Quality sums: 0.35*0.2 + 0.45*0.2 + 0.20*0.2 = 0.07 + 0.09 + 0.04 = 0.20 < 0.40
        res = compute_late_fusion(
            speech_score=4.0,
            speech_quality=0.2,
            language_score=3.0,
            language_quality=0.2,
            visual_score=5.0,
            visual_quality=0.2
        )
        self.assertEqual(res.status, "insufficient_quality")
        self.assertIsNone(res.fused_score)
        self.assertLess(res.total_effective_quality, 0.40)
        self.assertIn("abstains", res.explanation.lower())

    def test_late_fusion_ablation(self):
        """Verifies --ablate visual removes the visual modality and re-normalizes weights."""
        # Speech: score 4.0, q 1.0 (weight 0.35) -> 1.40
        # Language: score 3.0, q 1.0 (weight 0.45) -> 1.35
        # Visual ablated (weight 0.0)
        # Quality sum = 0.35 + 0.45 = 0.80
        # Fused = (1.40 + 1.35) / 0.80 = 2.75 / 0.80 = 3.4375 -> 3.44
        res = compute_late_fusion(
            speech_score=4.0,
            speech_quality=1.0,
            language_score=3.0,
            language_quality=1.0,
            visual_score=5.0,
            visual_quality=1.0,
            ablate_modality="visual"
        )
        self.assertEqual(res.status, "ablated_visual")
        self.assertEqual(res.ablated_modality, "visual")
        self.assertAlmostEqual(res.fused_score, 3.44, places=2)
        self.assertEqual(res.weights["visual"], 0.0)


if __name__ == "__main__":
    unittest.main()

"""
Unit Tests for Pure Acoustic Feature Extractor (services/local_speech_model/acoustic.py)
========================================================================================
Tests with synthetic waveforms:
1. Sine tone with known silence gaps -> pause_ratio and longest_pause within tolerance.
2. Flat-pitch tone vs frequency-modulated tone -> pitch_std_semitones clearly different.
3. Amplitude-decaying signal -> trailing-off flag is True.
4. Short/silent/corrupt audio -> reliability 'low' with reasons, never crashes.
5. Text-only fallback -> clean analysis_label 'Text-only analysis'.
"""

import unittest
import numpy as np
import sys
import os

# Add services/local_speech_model to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "local_speech_model")))

from acoustic import (
    compute_pauses,
    compute_pitch_semitones,
    compute_energy,
    compute_reliability,
    extract_features,
    extract_filler_words_from_text,
    score_delivery
)


class TestAcousticFeatures(unittest.TestCase):

    def setUp(self):
        self.sr = 16000

    def test_pauses_synthetic_tone(self):
        """
        Synthesize 2 seconds of 440 Hz tone, then 1.5 seconds of silence, then 2 seconds of tone.
        Total = 5.5s.
        Expected:
        - Longest pause ~ 1.5s
        - Long pause count = 1 (>1.2s)
        - Pause ratio ~ 1.5 / 5.5 = ~0.27
        """
        sr = self.sr
        t_tone = np.linspace(0, 2.0, int(2.0 * sr), endpoint=False)
        tone = 0.5 * np.sin(2 * np.pi * 440 * t_tone).astype(np.float32)
        silence = np.zeros(int(1.5 * sr), dtype=np.float32)

        audio = np.concatenate([tone, silence, tone])
        res = compute_pauses(audio, sr=sr, top_db=25.0)

        self.assertAlmostEqual(res["longest_pause_s"], 1.5, delta=0.25)
        self.assertEqual(res["long_pause_count"], 1)
        self.assertAlmostEqual(res["pause_ratio"], 0.27, delta=0.08)

    def test_flat_vs_modulated_pitch_semitones(self):
        """
        Flat tone (constant 220 Hz) should have near-zero pitch_std_semitones.
        Frequency-modulated tone (vibrato/pitch inflection 180 Hz to 260 Hz)
        should have pitch_std_semitones clearly > 1.0.
        """
        sr = self.sr
        duration = 3.0
        t = np.linspace(0, duration, int(duration * sr), endpoint=False)

        # 1. Flat 220 Hz
        flat = 0.5 * np.sin(2 * np.pi * 220 * t).astype(np.float32)
        res_flat = compute_pitch_semitones(flat, sr=sr)

        # 2. Modulated 220 Hz with 4 Hz vibrato of depth 30 Hz (190 - 250 Hz)
        freq_mod = 220 + 30 * np.sin(2 * np.pi * 4 * t)
        phase = 2 * np.pi * np.cumsum(freq_mod) / sr
        modulated = 0.5 * np.sin(phase).astype(np.float32)
        res_mod = compute_pitch_semitones(modulated, sr=sr)

        # Modulated should have significantly higher semitone std than flat
        self.assertLessEqual(res_flat["pitch_std_semitones"], 0.5)
        self.assertGreaterEqual(res_mod["pitch_std_semitones"], 1.0)
        self.assertGreater(res_mod["pitch_std_semitones"], res_flat["pitch_std_semitones"])

    def test_amplitude_decay_trailing_off(self):
        """
        Synthesize signal where amplitude exponentially decays in the last 20%.
        Should set is_trailing_off = True.
        """
        sr = self.sr
        duration = 5.0
        t = np.linspace(0, duration, int(duration * sr), endpoint=False)
        base_signal = 0.5 * np.sin(2 * np.pi * 300 * t).astype(np.float32)

        # Apply decay to the last 20%
        envelope = np.ones_like(base_signal)
        split_idx = int(0.8 * len(envelope))
        decay_len = len(envelope) - split_idx
        envelope[split_idx:] = np.linspace(1.0, 0.05, decay_len) # Drops by >20 dB

        decaying_audio = base_signal * envelope
        res = compute_energy(decaying_audio, sr=sr)

        self.assertTrue(res["is_trailing_off"], "Expected trailing_off to be True for decaying signal")
        self.assertLess(res["trailing_off_delta_db"], -5.5)

    def test_short_and_silent_audio_reliability(self):
        """
        Audio under 4s or almost completely silent must be flagged reliability='low'.
        """
        sr = self.sr
        # 1. Short audio (2.0s)
        short_audio = np.random.randn(int(2.0 * sr)).astype(np.float32) * 0.1
        status, reasons = compute_reliability(
            short_audio,
            duration_s=2.0,
            voiced_duration_s=1.8,
            rms_mean_db=-20.0,
            has_audio=True
        )
        self.assertEqual(status, "low")
        self.assertTrue(any("short_audio" in r for r in reasons))

        # 2. Silent audio (5.0s of zeros)
        silent_audio = np.zeros(int(5.0 * sr), dtype=np.float32)
        status_silence, reasons_silence = compute_reliability(
            silent_audio,
            duration_s=5.0,
            voiced_duration_s=0.0,
            rms_mean_db=-60.0,
            has_audio=True
        )
        self.assertEqual(status_silence, "low")
        self.assertTrue(any("silent" in r for r in reasons_silence))

    def test_text_only_fallback(self):
        """
        When audio is None, extract_features produces a valid text-only analysis
        without crashing and without inventing acoustic numbers.
        """
        transcript = "I built the system using React and basically optimized the renders."
        res = extract_features(audio=None, sr=16000, transcript=transcript, duration_s=15.0)

        self.assertEqual(res["analysis_label"], "Text-only analysis")
        self.assertEqual(res["reliability"], "low")
        self.assertEqual(res["sources"]["word_count"], "text")
        self.assertEqual(res["sources"]["filler_words"], "text")
        self.assertEqual(res["filler_word_count"], 1)
        self.assertIn("basically", res["filler_words"])
        self.assertGreater(res["delivery_score"], 0.0)
        self.assertGreater(res["clarity_score"], 0.0)

    def test_filler_words_extraction(self):
        transcript = "Um, like, basically we used Redux, you know, to manage the state."
        count, fillers = extract_filler_words_from_text(transcript)
        self.assertGreaterEqual(count, 4)
        self.assertIn("um", fillers)
        self.assertIn("like", fillers)
        self.assertIn("basically", fillers)
        self.assertIn("you know", fillers)


if __name__ == "__main__":
    unittest.main()

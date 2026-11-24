import unittest
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.local_speech_model.transcribe_service import (
    transcribe_audio_bytes,
    get_whisper_model,
)

class TestWhisperASR(unittest.TestCase):
    def test_whisper_model_singleton(self):
        """Whisper model singleton should load and be cached."""
        model = get_whisper_model()
        self.assertIsNotNone(model)

    def test_empty_transcription_request(self):
        """Empty audio bytes should return empty transcript gracefully."""
        res = transcribe_audio_bytes(b"")
        self.assertEqual(res["transcript"], "")
        self.assertEqual(res["duration_seconds"], 0.0)
        self.assertEqual(res["segments"], [])

    def test_short_invalid_bytes(self):
        """Insufficient audio bytes (< 100 bytes) should return empty transcript."""
        res = transcribe_audio_bytes(b"short bytes")
        self.assertEqual(res["transcript"], "")
        self.assertEqual(res["duration_seconds"], 0.0)

    @patch("services.local_speech_model.transcribe_service.get_whisper_model")
    def test_transcribe_audio_bytes_mocked(self, mock_get_model):
        """Verifies transcription result transformation and segment parsing."""
        mock_model = MagicMock()
        mock_model.transcribe.return_value = {
            "text": "I used React hooks and Memoization to prevent unnecessary re-renders.",
            "segments": [
                {"start": 0.0, "end": 2.1, "text": "I used React hooks"},
                {"start": 2.1, "end": 4.8, "text": "and Memoization to prevent unnecessary re-renders."}
            ]
        }
        mock_get_model.return_value = mock_model

        dummy_audio = b"RIFF" + b"\x00" * 300
        res = transcribe_audio_bytes(dummy_audio, language="en")
        self.assertEqual(res["transcript"], "I used React hooks and Memoization to prevent unnecessary re-renders.")
        self.assertEqual(res["duration_seconds"], 4.8)
        self.assertEqual(len(res["segments"]), 2)
        self.assertEqual(res["segments"][0]["text"], "I used React hooks")

if __name__ == "__main__":
    unittest.main()

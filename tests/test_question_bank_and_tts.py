"""
Unit Tests for Question Bank and TTS Service (tests/test_question_bank_and_tts.py)
"""

import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.local_speech_model.question_bank import (
    QUESTION_BANK,
    get_fallback_questions,
    get_bank_metadata,
)
from services.local_speech_model.tts_service import generate_speech_audio


class TestQuestionBankAndTTS(unittest.TestCase):

    def test_bank_metadata_catalog(self):
        """Verifies Question Bank structure and metadata extraction."""
        meta = get_bank_metadata()
        self.assertIn("roles", meta)
        self.assertIn("Software Engineer", meta["roles"])
        self.assertIn("Frontend Developer", meta["roles"])
        self.assertIn("Backend Developer", meta["roles"])
        self.assertIn("Data Scientist", meta["roles"])
        self.assertIn("Product Manager", meta["roles"])
        self.assertIn("DevOps Engineer", meta["roles"])
        self.assertIn("difficulties", meta)
        self.assertIn("interview_types", meta)

    def test_select_questions_from_bank(self):
        """Verifies question selection by role, difficulty, and type."""
        # Test Frontend Developer Technical questions
        fe_questions = get_fallback_questions(
            role="Frontend Developer",
            difficulty="Easy",
            interview_type="Technical",
            count=3
        )
        self.assertEqual(len(fe_questions), 3)
        self.assertTrue(all("text" in q and "category" in q for q in fe_questions))

        # Test Software Engineer System Design / Hard questions
        se_questions = get_fallback_questions(
            role="Software Engineer",
            difficulty="Hard",
            interview_type="Technical",
            count=2
        )
        self.assertEqual(len(se_questions), 2)

    def test_tts_service_graceful_fallback(self):
        """Verifies TTS returns None without crashing when cloud keys are absent."""
        res = generate_speech_audio(
            text="Hello, welcome to your interview.",
            gender="female",
            accent="us"
        )
        # When cloud API keys are absent, returns None so frontend speaks via Web Speech API
        self.assertIsNone(res)


if __name__ == "__main__":
    unittest.main()

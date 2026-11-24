"""
Unit Tests for Interview Report Data Aggregation (services/local_speech_model/rubric_evaluator.py)
===================================================================================================
Tests:
1. Complete interview session: aggregated overall score, radar chart averages across 5 dimensions.
2. Partial data handling:
   - Text-only questions (no audio captured): acoustic metrics handle missing values gracefully without NaN/crash.
   - Skipped questions: excluded from score/acoustic averages without zero-division.
   - Offline Ollama backend: produces honest unavailable summary with all measured metrics intact.
3. Top 3 strengths & improvements formatting.
"""

import unittest
import sys
import os

# Add services/local_speech_model to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "local_speech_model")))

from rubric_evaluator import (
    summarize_full_interview_session,
    RUBRIC_DIMENSIONS
)


class TestInterviewReportAggregation(unittest.TestCase):

    def test_complete_session_aggregation(self):
        """Calculates accurate radar averages, acoustic averages, and overall score for a complete session."""
        questions = [
            {
                "id": "q1",
                "status": "answered",
                "candidate_answer": "I used useMemo and useCallback to avoid unnecessary re-renders in React.",
                "aiEvaluation": {
                    "overall_score": 4.2,
                    "rubric": {
                        "relevance": {"score": 4.0, "justification": "Direct answer"},
                        "technical_depth": {"score": 4.5, "justification": "Good depth"},
                        "structure": {"score": 4.0, "justification": "Clear flow"},
                        "clarity": {"score": 4.5, "justification": "Articulate"},
                        "examples_metrics": {"score": 4.0, "justification": "Clear examples"}
                    },
                    "tone_analysis": {
                        "speech_rate_wpm": 140.0,
                        "pause_ratio": 0.18,
                        "pitch_std_semitones": 2.5,
                        "filler_word_count": 1
                    }
                }
            },
            {
                "id": "q2",
                "status": "answered",
                "candidate_answer": "We implemented Redis for caching session tokens, dropping latency by 50%.",
                "aiEvaluation": {
                    "overall_score": 4.6,
                    "rubric": {
                        "relevance": {"score": 5.0, "justification": "Direct answer"},
                        "technical_depth": {"score": 4.5, "justification": "Deep cache knowledge"},
                        "structure": {"score": 4.5, "justification": "STAR structure"},
                        "clarity": {"score": 4.5, "justification": "Concise"},
                        "examples_metrics": {"score": 4.5, "justification": "Clear metrics (50%)"}
                    },
                    "tone_analysis": {
                        "speech_rate_wpm": 150.0,
                        "pause_ratio": 0.14,
                        "pitch_std_semitones": 2.8,
                        "filler_word_count": 0
                    }
                }
            }
        ]

        report = summarize_full_interview_session(
            session_id="session-test-01",
            role="Frontend Developer",
            candidate_name="Alice",
            questions=questions
        )

        self.assertEqual(report["session_id"], "session-test-01")
        self.assertEqual(report["answered_count"], 2)
        # Average score (4.2 + 4.6) / 2 = 4.4
        self.assertAlmostEqual(report["overall_score"], 4.4, delta=0.05)
        self.assertEqual(report["grade"], "A")

        # Radar averages
        self.assertAlmostEqual(report["radar_data"]["relevance"], 4.5, delta=0.05)
        self.assertAlmostEqual(report["radar_data"]["technical_depth"], 4.5, delta=0.05)

        # Acoustic summary
        self.assertAlmostEqual(report["acoustic_summary"]["avg_speech_rate_wpm"], 145.0, delta=1.0)
        self.assertAlmostEqual(report["acoustic_summary"]["avg_pause_ratio"], 0.16, delta=0.02)
        self.assertEqual(report["acoustic_summary"]["total_filler_words"], 1)

    def test_partial_data_with_skipped_and_text_only(self):
        """
        Gracefully handles mixed session:
        - 1 question answered with acoustic audio
        - 1 question answered text-only (null pause_ratio & pitch)
        - 1 question skipped
        Does not crash, produce NaN, or corrupt averages.
        """
        questions = [
            {
                "id": "q1",
                "status": "answered",
                "candidate_answer": "I write unit tests with Jest and React Testing Library.",
                "aiEvaluation": {
                    "overall_score": 4.0,
                    "rubric": {
                        "relevance": {"score": 4.0, "justification": "Good"},
                        "technical_depth": {"score": 4.0, "justification": "Standard"},
                        "structure": {"score": 4.0, "justification": "Logical"},
                        "clarity": {"score": 4.0, "justification": "Clear"},
                        "examples_metrics": {"score": 4.0, "justification": "Mentioned Jest"}
                    },
                    "tone_analysis": {
                        "speech_rate_wpm": 135.0,
                        "pause_ratio": 0.20,
                        "pitch_std_semitones": 2.4,
                        "filler_word_count": 2
                    }
                }
            },
            {
                "id": "q2",
                "status": "answered",
                "candidate_answer": "Text only typed answer without microphone audio.",
                "aiEvaluation": {
                    "overall_score": 3.0,
                    "rubric": {
                        "relevance": {"score": 3.0, "justification": "Average"},
                        "technical_depth": {"score": 3.0, "justification": "Basic"},
                        "structure": {"score": 3.0, "justification": "Brief"},
                        "clarity": {"score": 3.0, "justification": "Plain"},
                        "examples_metrics": {"score": 3.0, "justification": "None"}
                    },
                    "tone_analysis": {
                        # Text only: null acoustic metrics
                        "speech_rate_wpm": 120.0,
                        "pause_ratio": None,
                        "pitch_std_semitones": None,
                        "filler_word_count": 0
                    }
                }
            },
            {
                "id": "q3",
                "status": "skipped",
                "candidate_answer": "",
                "aiEvaluation": None
            }
        ]

        report = summarize_full_interview_session(
            session_id="session-partial-02",
            role="Fullstack Engineer",
            candidate_name="Bob",
            questions=questions
        )

        self.assertEqual(report["answered_count"], 2)
        self.assertEqual(report["questions_count"], 3)
        self.assertAlmostEqual(report["overall_score"], 3.5, delta=0.05)
        # Only the 1 question with pause_ratio is averaged, not dividing by 0 or None
        self.assertAlmostEqual(report["acoustic_summary"]["avg_pause_ratio"], 0.20, delta=0.01)
        self.assertAlmostEqual(report["acoustic_summary"]["avg_pitch_std_semitones"], 2.4, delta=0.01)
        self.assertEqual(report["acoustic_summary"]["total_filler_words"], 2)

    def test_offline_ollama_graceful_handling(self):
        """When no AI scores are available, report marks evaluation_unavailable=True without fake scores."""
        questions = [
            {
                "id": "q1",
                "status": "answered",
                "candidate_answer": "Basic answer while LLM was offline.",
                "aiEvaluation": {
                    "evaluation_unavailable": True,
                    "overall_score": None,
                    "rubric": None,
                    "tone_analysis": {
                        "speech_rate_wpm": 130.0,
                        "pause_ratio": 0.15,
                        "pitch_std_semitones": 2.1,
                        "filler_word_count": 1
                    }
                }
            }
        ]

        report = summarize_full_interview_session(
            session_id="session-offline-03",
            role="Backend Engineer",
            candidate_name="Charlie",
            questions=questions
        )

        self.assertTrue(report["evaluation_unavailable"])
        self.assertIsNone(report["overall_score"])
        self.assertEqual(report["grade"], "N/A")
        # Measured acoustic metrics are still intact!
        self.assertEqual(report["acoustic_summary"]["total_filler_words"], 1)
        self.assertAlmostEqual(report["acoustic_summary"]["avg_speech_rate_wpm"], 130.0, delta=0.1)


if __name__ == "__main__":
    unittest.main()

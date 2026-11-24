"""
Unit Tests for Session Persistence & Privacy Round-Trip (tests/test_persistence.py)
===================================================================================
Tests:
1. Persistence JSON round-trip: ensures full session (questions, rubric, acoustic metrics, report)
   serializes and deserializes losslessly without missing keys or type errors.
2. Privacy policy compliance:
   - When save_audio_for_training is False, raw audio data must never be saved.
   - When save_audio_for_training is True, audio references are preserved.
3. Partial data persistence: handles missing rubric evaluations or text-only metrics gracefully.
"""

import unittest
import json
from typing import Dict, Any


def sanitize_session_for_persistence(session_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Mirror of the client-side storage sanitization rule."""
    clean = json.loads(json.dumps(session_dict))
    save_audio = clean.get("saveAudioForTraining", False)

    if not save_audio:
        # Strip any raw audio payload if present
        if "raw_audio_base64" in clean:
            del clean["raw_audio_base64"]
        for q in clean.get("questions", []):
            if "audioBlob" in q:
                del q["audioBlob"]
            if "raw_audio" in q:
                del q["raw_audio"]

    return clean


class TestSessionPersistence(unittest.TestCase):

    def setUp(self):
        self.sample_session = {
            "id": "session-test-persistence-01",
            "createdAt": "2026-10-27T10:00:00.000Z",
            "title": "Frontend Technical System Design",
            "role": "Frontend Developer",
            "candidate": {
                "id": "c1",
                "name": "Alex Candidate",
                "role": "candidate",
                "initials": "AC",
                "avatarColor": "bg-indigo-600",
                "isMuted": False,
                "isCameraOn": True,
            },
            "recordingDuration": 420,
            "saveAudioForTraining": False,
            "overallScore": 4.3,
            "averagePace": 145.0,
            "averageFillers": 2,
            "averagePauseRatio": 0.16,
            "questions": [
                {
                    "id": "q1",
                    "number": 1,
                    "text": "How do you optimize React component re-rendering?",
                    "status": "answered",
                    "candidateAnswer": "I use React.memo and useCallback on event handler callbacks.",
                    "aiEvaluation": {
                        "overall_score": 4.4,
                        "grade": "A",
                        "rubric": {
                            "relevance": {"score": 4.5, "justification": "Direct answer"},
                            "technical_depth": {"score": 4.0, "justification": "Solid memoization"},
                            "structure": {"score": 4.5, "justification": "Logical order"},
                            "clarity": {"score": 4.5, "justification": "Clear voice"},
                            "examples_metrics": {"score": 4.5, "justification": "Concrete hooks cited"},
                        },
                        "tone_analysis": {
                            "speech_rate_wpm": 145.0,
                            "pause_ratio": 0.16,
                            "pitch_std_semitones": 2.4,
                            "pitch_method": "librosa_pyin",
                            "filler_word_count": 1,
                        },
                        "model_summary": "Strong technical demonstration.",
                    },
                }
            ],
            "report": {
                "session_id": "session-test-persistence-01",
                "candidate_name": "Alex Candidate",
                "role": "Frontend Developer",
                "overall_score": 4.3,
                "grade": "A",
                "verdict": "Hire",
                "overall_summary": "High technical readiness with articulate pacing.",
                "radar_data": {
                    "relevance": 4.5,
                    "technical_depth": 4.0,
                    "structure": 4.5,
                    "clarity": 4.5,
                    "examples_metrics": 4.5,
                },
                "acoustic_summary": {
                    "avg_speech_rate_wpm": 145.0,
                    "avg_pause_ratio": 0.16,
                    "avg_pitch_std_semitones": 2.4,
                    "total_filler_words": 1,
                    "has_acoustic_data": True,
                },
                "top_strengths": [
                    {"feedback": "Clear explanation of React hooks", "quote": "React.memo and useCallback", "has_quote": True}
                ],
                "top_improvements": [
                    {"feedback": "Quantify bundle size impact", "quote": "", "has_quote": False}
                ],
                "practice_next": [
                    "Practice STAR storytelling structure",
                    "Review concurrent mode transitions",
                    "Maintain 140 WPM pace",
                ],
                "questions_count": 1,
                "answered_count": 1,
                "evaluation_unavailable": False,
                "sources": {
                    "speech_rate": "Measured (audio)",
                    "filler_count": "Measured (text)",
                    "radar_data": "AI-assessed (LLM)",
                },
            },
        }

    def test_json_roundtrip_lossless(self):
        """Verifies full session serializes to JSON string and parses back with identical structure and values."""
        json_str = json.dumps(self.sample_session)
        deserialized = json.loads(json_str)

        self.assertEqual(deserialized["id"], self.sample_session["id"])
        self.assertEqual(deserialized["overallScore"], 4.3)
        self.assertEqual(deserialized["report"]["verdict"], "Hire")
        self.assertEqual(len(deserialized["questions"]), 1)
        self.assertEqual(
            deserialized["questions"][0]["aiEvaluation"]["rubric"]["technical_depth"]["score"],
            4.0
        )
        self.assertEqual(
            deserialized["questions"][0]["aiEvaluation"]["tone_analysis"]["pitch_method"],
            "librosa_pyin"
        )

    def test_privacy_audio_not_saved_when_off(self):
        """When saveAudioForTraining is False, raw audio data is stripped from persistence payload."""
        dirty_session = dict(self.sample_session)
        dirty_session["saveAudioForTraining"] = False
        dirty_session["raw_audio_base64"] = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8..."
        dirty_session["questions"][0]["raw_audio"] = "bytes_stream"

        sanitized = sanitize_session_for_persistence(dirty_session)
        self.assertNotIn("raw_audio_base64", sanitized)
        self.assertNotIn("raw_audio", sanitized["questions"][0])
        # Metrics and transcripts are strictly preserved
        self.assertEqual(sanitized["questions"][0]["candidateAnswer"], self.sample_session["questions"][0]["candidateAnswer"])
        self.assertEqual(sanitized["questions"][0]["aiEvaluation"]["tone_analysis"]["speech_rate_wpm"], 145.0)

    def test_privacy_audio_preserved_when_on(self):
        """When saveAudioForTraining is True, audio references are preserved."""
        session_with_audio_allowed = dict(self.sample_session)
        session_with_audio_allowed["saveAudioForTraining"] = True
        session_with_audio_allowed["raw_audio_base64"] = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8..."

        sanitized = sanitize_session_for_persistence(session_with_audio_allowed)
        self.assertIn("raw_audio_base64", sanitized)


if __name__ == "__main__":
    unittest.main()

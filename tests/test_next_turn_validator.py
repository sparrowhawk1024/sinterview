"""
Unit tests for next_turn validator and repair logic.
Validates:
1. Long reaction (> 25 words) -> reaction cleared to ""
2. Score pattern in reaction (e.g. 8/10, score, grade) -> reaction cleared to ""
3. Content word overlap: reaction mentioning non-existent concepts -> reaction cleared to ""
4. Content word overlap: reaction referencing candidate's specific words -> reaction preserved
5. Server-side follow-up cap: follow_ups_used >= 1 forces follow_up = False
6. Malformed/null next_question -> restored to next_planned_question
7. Clean end of interview: null next_planned_question and 0 remaining questions -> next_question is None
"""

import unittest
import sys
import os

# Add services/local_speech_model to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "local_speech_model")))

from main import validate_and_repair_next_turn, extract_content_words

class TestNextTurnValidator(unittest.TestCase):

    def test_long_reaction_rejection(self):
        # Over 25 words reaction
        long_reaction = " ".join(["word"] * 26)
        raw = {
            "reaction": long_reaction,
            "next_question": "What about Redux?",
            "follow_up": False
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="I use React and Redux in production.",
            next_planned_question="What about Redux?",
            questions_remaining=2,
            follow_ups_used=0
        )
        self.assertEqual(res.reaction, "", "Reactions over 25 words must be cleared to empty string")
        self.assertEqual(res.next_question, "What about Redux?")

    def test_score_pattern_rejection(self):
        # Reaction containing digit score
        for score_text in [
            "Good job, that is an 8/10 answer on Redux.",
            "I would give that response a score of 9.",
            "That was an A grade explanation of caching."
        ]:
            raw = {
                "reaction": score_text,
                "next_question": "Next question.",
                "follow_up": False
            }
            res = validate_and_repair_next_turn(
                raw,
                candidate_answer="I used Redux and caching for state.",
                next_planned_question="Next question.",
                questions_remaining=1,
                follow_ups_used=0
            )
            self.assertEqual(res.reaction, "", f"Score pattern in '{score_text}' must be rejected")

    def test_no_overlap_rejection(self):
        # Candidate talked about React hooks, but reaction hallucinated Docker and Kubernetes
        raw = {
            "reaction": "Docker and Kubernetes orchestration solves that nicely.",
            "next_question": "How do you scale containers?",
            "follow_up": False
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="I memoized my components with useMemo and useCallback to avoid re-renders.",
            next_planned_question="Next planned question.",
            questions_remaining=2,
            follow_ups_used=0
        )
        self.assertEqual(res.reaction, "", "Reaction with zero content-word overlap must be cleared to empty string")

    def test_valid_overlap_accepted(self):
        # Candidate mentioned memoization and render trees, reaction acknowledges memoization
        raw = {
            "reaction": "Memoization helps prevent those expensive tree renders.",
            "next_question": "How do you profile rendering?",
            "follow_up": False
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="I use memoization to prevent rendering bottlenecks across the component tree.",
            next_planned_question="How do you profile rendering?",
            questions_remaining=2,
            follow_ups_used=0
        )
        self.assertEqual(res.reaction, "Memoization helps prevent those expensive tree renders.")
        self.assertEqual(res.next_question, "How do you profile rendering?")

    def test_follow_up_cap_enforced(self):
        # Model tried to set follow_up=True when follow_ups_used >= 1
        raw = {
            "reaction": "That clarifies the memoization strategy.",
            "next_question": "Can you dig deeper into profiling?",
            "follow_up": True
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="I use memoization.",
            next_planned_question="Next planned question.",
            questions_remaining=2,
            follow_ups_used=1 # Cap reached!
        )
        self.assertFalse(res.follow_up, "Server must enforce follow_up cap (max 1 per question)")

    def test_null_next_question_fallback(self):
        # Model returned null next_question when questions remain
        raw = {
            "reaction": "Got it, memoization is key.",
            "next_question": None,
            "follow_up": False
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="We applied memoization.",
            next_planned_question="Tell me about server-side rendering.",
            questions_remaining=1,
            follow_ups_used=0
        )
        self.assertEqual(res.next_question, "Tell me about server-side rendering.")

    def test_interview_completion(self):
        # End of planned questions
        raw = {
            "reaction": "That covers our memoization discussion.",
            "next_question": None,
            "follow_up": False
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="We applied memoization across all routes.",
            next_planned_question=None,
            questions_remaining=0,
            follow_ups_used=0
        )
        self.assertIsNone(res.next_question, "At interview end, next_question must be None")

    def test_stemming_overlap(self):
        # Candidate says "optimizing", reaction says "optimization"
        # 5-char stem "optim" matches both
        raw = {
            "reaction": "Database optimization definitely reduced latency.",
            "next_question": "How did you measure the latency?",
            "follow_up": False
        }
        res = validate_and_repair_next_turn(
            raw,
            candidate_answer="We focused on optimizing database queries and indexes.",
            next_planned_question="Next question.",
            questions_remaining=2,
            follow_ups_used=0
        )
        self.assertEqual(res.reaction, "Database optimization definitely reduced latency.")
        self.assertEqual(res.next_question, "How did you measure the latency?")

    def test_chained_followup_cap_keyed_to_root(self):
        # Step 1: Root question turn, follow_ups_used = 0 -> follow-up permitted
        first_turn_raw = {
            "reaction": "Indexes make a big difference.",
            "next_question": "Can you explain the index type you used?",
            "follow_up": True
        }
        first_res = validate_and_repair_next_turn(
            first_turn_raw,
            candidate_answer="We indexed the users table.",
            next_planned_question="How do you handle migrations?",
            questions_remaining=2,
            follow_ups_used=0
        )
        self.assertTrue(first_res.follow_up, "First follow-up should be allowed")
        self.assertEqual(first_res.next_question, "Can you explain the index type you used?")

        # Step 2: Chained turn on the follow-up, root question ID has follow_ups_used = 1 -> model attempts second follow-up
        second_turn_raw = {
            "reaction": "B-trees are indeed standard.",
            "next_question": "What about hash indexes?",
            "follow_up": True # Chained follow-up attempt
        }
        second_res = validate_and_repair_next_turn(
            second_turn_raw,
            candidate_answer="We selected B-tree indexes for range queries.",
            next_planned_question="How do you handle migrations?",
            questions_remaining=2,
            follow_ups_used=1 # Follow-up cap reached for this root question
        )
        self.assertFalse(second_res.follow_up, "Chained follow-up must be blocked by follow_up cap")
        self.assertEqual(second_res.next_question, "How do you handle migrations?", "Must fall back to next planned question")

if __name__ == "__main__":
    unittest.main()


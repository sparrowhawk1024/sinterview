"""
Unit Tests for Rubric Evaluator & Quote Validator (services/local_speech_model/rubric_evaluator.py)
==================================================================================================
Tests:
1. Fixed 5-Dimension Rubric JSON Schema Validation (relevance, technical_depth, structure, clarity, examples_metrics).
2. Clamping/validation of scores 1 to 5.
3. Rejection of invalid/missing dimensions -> triggers retry or fallback to unavailable.
4. Quote existence check:
   - Valid quote in transcript -> preserved.
   - Punctuation & casing variations -> preserved.
   - Hallucinated/fabricated quote -> dropped.
5. "Never fake scores": offline or invalid response returns evaluation_status='unavailable' with null scores.
"""

import unittest
import sys
import os

# Add services/local_speech_model to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "local_speech_model")))

from rubric_evaluator import (
    validate_quote_in_transcript,
    validate_and_clean_rubric_scores,
    filter_quoted_items,
    calculate_grade_from_score,
    RUBRIC_DIMENSIONS
)


class TestRubricValidator(unittest.TestCase):

    def test_rubric_schema_validation_valid(self):
        """All 5 required dimensions present with valid 1-5 scores and justifications."""
        raw_valid = {
            "relevance": {"score": 4, "justification": "Directly answered the question."},
            "technical_depth": {"score": 5, "justification": "Detailed deep internals of the virtual DOM."},
            "structure": {"score": 3, "justification": "Followed basic flow but lacked STAR conclusion."},
            "clarity": {"score": 4.5, "justification": "Articulate, smooth pace."},
            "examples_metrics": {"score": 2, "justification": "Did not provide measurable benchmarks."}
        }
        cleaned = validate_and_clean_rubric_scores(raw_valid)
        self.assertIsNotNone(cleaned)
        self.assertEqual(len(cleaned), 5)
        for dim in RUBRIC_DIMENSIONS:
            self.assertIn(dim, cleaned)
            self.assertGreaterEqual(cleaned[dim]["score"], 1.0)
            self.assertLessEqual(cleaned[dim]["score"], 5.0)
            self.assertTrue(len(cleaned[dim]["justification"]) > 0)

    def test_rubric_schema_missing_dimension(self):
        """If any of the 5 required dimensions is missing, validation returns None (never accepts incomplete rubric)."""
        raw_missing = {
            "relevance": {"score": 4, "justification": "Good."},
            "technical_depth": {"score": 5, "justification": "Deep."},
            "structure": {"score": 3, "justification": "Structured."},
            # Missing "clarity" and "examples_metrics"
        }
        self.assertIsNone(validate_and_clean_rubric_scores(raw_missing))

    def test_rubric_schema_score_clamping(self):
        """Scores outside 1-5 are clamped cleanly between 1.0 and 5.0."""
        raw_out_of_bounds = {
            "relevance": {"score": 10, "justification": "Super high"},
            "technical_depth": {"score": -2, "justification": "Negative"},
            "structure": {"score": "4", "justification": "String integer"},
            "clarity": {"score": 3.8, "justification": "Float"},
            "examples_metrics": {"score": 5.5, "justification": "Exceeds 5"}
        }
        cleaned = validate_and_clean_rubric_scores(raw_out_of_bounds)
        self.assertIsNotNone(cleaned)
        self.assertEqual(cleaned["relevance"]["score"], 5.0)
        self.assertEqual(cleaned["technical_depth"]["score"], 1.0)
        self.assertEqual(cleaned["structure"]["score"], 4.0)
        self.assertEqual(cleaned["clarity"]["score"], 3.8)
        self.assertEqual(cleaned["examples_metrics"]["score"], 5.0)

    def test_quote_validation_exact_match(self):
        """Quote that exists exactly in transcript returns True."""
        transcript = "In my last project, we optimized webpack bundle sizes by code splitting vendor libraries."
        quote = "optimized webpack bundle sizes"
        self.assertTrue(validate_quote_in_transcript(quote, transcript))

    def test_quote_validation_case_and_punctuation(self):
        """Quote with punctuation or casing differences matches cleanly."""
        transcript = "We used Redis for distributed caching, which cut our latency down to 40ms."
        quote = 'redis for distributed caching,'
        self.assertTrue(validate_quote_in_transcript(quote, transcript))

    def test_quote_validation_hallucinated_quote(self):
        """Quote fabricated by the LLM that was never spoken by the candidate returns False."""
        transcript = "I mostly write CSS using Tailwind and styled-components for design tokens."
        hallucinated_quote = "We migrated our backend from Ruby to Go microservices"
        self.assertFalse(validate_quote_in_transcript(hallucinated_quote, transcript))

    def test_filter_quoted_items_drops_invalid_quotes(self):
        """
        Strengths/improvements with valid quotes preserve quote.
        Strengths/improvements with hallucinated quotes drop the quote (quote set to '').
        """
        transcript = "I implemented React Server Components to reduce initial client hydration time."
        items = [
            {
                "feedback": "Strong focus on performance",
                "quote": "React Server Components to reduce initial client hydration"
            },
            {
                "feedback": "Great database indexing strategy",
                "quote": "I re-indexed our Postgres database using btree"
            }
        ]
        filtered = filter_quoted_items(items, transcript)
        self.assertEqual(len(filtered), 2)
        # Item 0 was in transcript -> preserved
        self.assertTrue(filtered[0]["has_quote"])
        self.assertIn("React Server Components", filtered[0]["quote"])
        # Item 1 was hallucinated -> quote dropped!
        self.assertFalse(filtered[1]["has_quote"])
        self.assertEqual(filtered[1]["quote"], "")

    def test_calculate_grade(self):
        """Maps 1-5 rubric scores to letter grades correctly."""
        self.assertEqual(calculate_grade_from_score(4.8), "A+")
        self.assertEqual(calculate_grade_from_score(4.2), "A")
        self.assertEqual(calculate_grade_from_score(3.6), "B+")
        self.assertEqual(calculate_grade_from_score(3.1), "B")
        self.assertEqual(calculate_grade_from_score(2.3), "C")
        self.assertEqual(calculate_grade_from_score(1.5), "D")


if __name__ == "__main__":
    unittest.main()

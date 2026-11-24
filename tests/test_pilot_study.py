"""
Unit Tests for Pilot Study Exporter & Analysis (tests/test_pilot_study.py)
"""

import unittest
import os
import shutil
import tempfile
import numpy as np
from scripts.eval.export_pilot_sessions import (
    generate_synthetic_pilot_cohort,
    extract_session_metrics,
    export_pilot_sessions
)
from scripts.eval.analyze_pilot_study import (
    bootstrap_cohens_d,
    analyze_pilot_study
)


class TestPilotStudy(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.sessions_dir = os.path.join(self.test_dir, "sessions")
        self.output_csv = os.path.join(self.test_dir, "pilot_export.csv")
        self.output_json = os.path.join(self.test_dir, "pilot_analysis.json")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_synthetic_cohort_generation_and_export(self):
        """Verifies synthetic cohort generation and CSV export."""
        files = generate_synthetic_pilot_cohort(self.sessions_dir, num_participants=3)
        self.assertEqual(len(files), 12) # 3 participants * 4 stages

        records = export_pilot_sessions(self.sessions_dir, self.output_csv)
        self.assertEqual(len(records), 12)
        self.assertTrue(os.path.exists(self.output_csv))

        sample = records[0]
        self.assertIn("participant_id", sample)
        self.assertIn("session_index", sample)
        self.assertIn("wpm", sample)
        self.assertIn("filler_rate", sample)
        self.assertIn("hesitation_index", sample)
        self.assertIn("rubric_overall", sample)

    def test_bootstrap_cohens_d(self):
        """Verifies paired Cohen's d computation and bootstrap confidence bounds."""
        diffs = np.array([1.0, 1.2, 0.8, 1.1, 0.9])
        d_z, ci_low, ci_high = bootstrap_cohens_d(diffs, num_bootstrap=500)
        self.assertGreater(d_z, 0.0)
        self.assertLessEqual(ci_low, d_z)
        self.assertGreaterEqual(ci_high, d_z)

    def test_paired_analysis_execution(self):
        """Verifies end-to-end paired pilot study analysis."""
        generate_synthetic_pilot_cohort(self.sessions_dir, num_participants=3)
        export_pilot_sessions(self.sessions_dir, self.output_csv)
        results = analyze_pilot_study(self.output_csv, self.output_json)

        self.assertEqual(results["status"], "success")
        self.assertEqual(results["paired_participants_count"], 3)
        self.assertIn("wpm", results["metrics"])
        self.assertIn("rubric_overall", results["metrics"])
        self.assertIn("disclaimer", results)
        self.assertTrue(os.path.exists(self.output_json))


if __name__ == "__main__":
    unittest.main()

"""
Pilot Study Analysis Module (scripts/eval/analyze_pilot_study.py)
================================================================
Performs paired pre/post descriptive evaluation of mock interview practice.

Rules & Integrity Constraints:
1. Requires paired baseline and post sessions per participant.
2. Computes paired differences (Post - Baseline), Cohen's d_z effect size, and 95% bootstrap CIs.
3. Explicitly labels results as descriptive pilot trends, NOT confirmatory population significance claims.
4. Outputs structured JSON to data/eval/results/pilot_study_analysis.json.
"""

import os
import sys
import csv
import json
import argparse
import numpy as np
from typing import Dict, Any, List, Tuple


METRIC_DIRECTIONS = {
    "wpm": "Speech Rate (WPM, normative target ~130-160)",
    "filler_rate": "Filler Rate (fillers/response, lower is clearer)",
    "long_pause_ratio": "Long Pause Ratio (>2.0s, lower indicates smoother pacing)",
    "hesitation_index": "Delivery Hesitation Index (0-1, lower is smoother)",
    "rubric_overall": "Overall Rubric Score (1-5, higher is stronger)",
    "technical_depth": "Technical Depth Score (1-5, higher is stronger)",
    "clarity": "Verbal Clarity Score (1-5, higher is stronger)",
}


def bootstrap_cohens_d(differences: np.ndarray, num_bootstrap: int = 1000, ci: float = 0.95) -> Tuple[float, float, float]:
    """
    Computes Cohen's d_z and bootstrap percentile confidence interval.
    d_z = mean(diff) / std(diff, ddof=1)
    """
    n = len(differences)
    if n < 2:
        return 0.0, 0.0, 0.0

    mean_diff = float(np.mean(differences))
    std_diff = float(np.std(differences, ddof=1))
    point_d = round(mean_diff / std_diff, 3) if std_diff > 1e-6 else 0.0

    rng = np.random.RandomState(42)
    boot_estimates = []
    for _ in range(num_bootstrap):
        resample = rng.choice(differences, size=n, replace=True)
        m = np.mean(resample)
        s = np.std(resample, ddof=1)
        if s > 1e-6:
            boot_estimates.append(m / s)
        else:
            boot_estimates.append(0.0)

    lower_p = (1.0 - ci) / 2.0 * 100.0
    upper_p = (1.0 + ci) / 2.0 * 100.0
    ci_lower = round(float(np.percentile(boot_estimates, lower_p)), 3)
    ci_upper = round(float(np.percentile(boot_estimates, upper_p)), 3)

    return point_d, ci_lower, ci_upper


def analyze_pilot_study(csv_path: str, output_json: str) -> Dict[str, Any]:
    """
    Loads exported session CSV, pairs baseline and post by participant, and computes metrics.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Pilot sessions CSV not found at {csv_path}")

    # Load rows
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Group by participant
    by_pid: Dict[str, Dict[str, Dict[str, float]]] = {}
    for r in rows:
        pid = r["participant_id"]
        stage = r["session_index"]
        if pid not in by_pid:
            by_pid[pid] = {}
        by_pid[pid][stage] = {
            m: float(r[m]) for m in METRIC_DIRECTIONS.keys() if m in r and r[m] != ""
        }

    # Filter to paired participants with both 'baseline' and 'post'
    paired_pids = [pid for pid, stages in by_pid.items() if "baseline" in stages and "post" in stages]
    n_paired = len(paired_pids)

    warning_text = (
        f"[PILOT STUDY WARNING] Descriptive analysis on small pilot sample (n = {n_paired}). "
        f"These figures reflect exploratory trends within the pilot cohort and must NOT be cited "
        f"as confirmatory statistical significance claims or generalized to broader populations."
    )
    print("\n" + "="*80)
    print(warning_text)
    print("="*80 + "\n")

    if n_paired == 0:
        return {
            "status": "insufficient_data",
            "paired_participants_count": 0,
            "warning": warning_text,
            "metrics": {}
        }

    results: Dict[str, Any] = {
        "status": "success",
        "paired_participants_count": n_paired,
        "participant_ids": sorted(paired_pids),
        "disclaimer": warning_text,
        "metrics": {}
    }

    markdown_rows = []

    for metric, desc in METRIC_DIRECTIONS.items():
        base_vals = np.array([by_pid[p]["baseline"][metric] for p in paired_pids])
        post_vals = np.array([by_pid[p]["post"][metric] for p in paired_pids])
        diffs = post_vals - base_vals

        mean_base = round(float(np.mean(base_vals)), 2)
        std_base = round(float(np.std(base_vals, ddof=1)), 2)
        mean_post = round(float(np.mean(post_vals)), 2)
        std_post = round(float(np.std(post_vals, ddof=1)), 2)
        mean_diff = round(float(np.mean(diffs)), 2)
        std_diff = round(float(np.std(diffs, ddof=1)), 2)

        point_d, ci_low, ci_high = bootstrap_cohens_d(diffs, num_bootstrap=1000)

        results["metrics"][metric] = {
            "description": desc,
            "baseline_mean": mean_base,
            "baseline_std": std_base,
            "post_mean": mean_post,
            "post_std": std_post,
            "mean_difference": mean_diff,
            "std_difference": std_diff,
            "cohens_d_z": point_d,
            "bootstrap_95_ci": [ci_low, ci_high]
        }

        markdown_rows.append(
            f"| {metric} | {mean_base:.2f} ± {std_base:.2f} | {mean_post:.2f} ± {std_post:.2f} | "
            f"{mean_diff:+.2f} | {point_d:.2f} [{ci_low:.2f}, {ci_high:.2f}] |"
        )

    # Print clean Markdown summary table
    print("### Pilot Cohort Descriptive Differences (Pre vs Post Practice)")
    print("| Metric | Baseline (Mean ± SD) | Post (Mean ± SD) | Delta (Post - Base) | Cohen's d_z [95% CI] |")
    print("|:---|:---:|:---:|:---:|:---:|")
    for row in markdown_rows:
        print(row)
    print("\n*Note: Sample size n=" + str(n_paired) + ". Purely descriptive; no hypothesis test p-values are claimed.*\n")

    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"[SUCCESS] Saved pilot analysis report to {output_json}")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze paired pilot study interview metrics")
    parser.add_argument("--csv", default="data/eval/results/pilot_sessions_export.csv", help="Input pilot sessions CSV")
    parser.add_argument("--output-json", default="data/eval/results/pilot_study_analysis.json", help="Output JSON analysis summary")
    args = parser.parse_args()

    analyze_pilot_study(args.csv, args.output_json)

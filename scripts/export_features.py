"""
Synterview Feature Dataset Export Script
========================================
Exports or rebuilds data/training/answers.csv from session logs or acoustic extractions.

Usage:
    python scripts/export_features.py [--output data/training/answers.csv]
"""

import os
import csv
import json
import argparse
from datetime import datetime
from typing import Dict, Any, Optional

TRAINING_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "training"))
DEFAULT_CSV_PATH = os.path.join(TRAINING_DIR, "answers.csv")

CSV_COLUMNS = [
    "answer_id",
    "timestamp",
    "persona",
    "transcript_length",
    "word_count",
    "duration_seconds",
    "voiced_duration_seconds",
    "speech_rate_wpm",
    "pause_ratio",
    "mean_pause_s",
    "longest_pause_s",
    "pause_count",
    "long_pause_count",
    "pitch_std_semitones",
    "pitch_range_semitones",
    "pitch_median_hz",
    "rms_mean_db",
    "rms_cv",
    "trailing_off_delta_db",
    "is_trailing_off",
    "filler_word_count",
    "delivery_score",
    "clarity_score",
    "self_rating",
    "reliability",
    "analysis_label",
    # Note: NO raw audio or transcript text stored here to respect privacy defaults.
]


def append_answer_features_to_csv(
    features: Dict[str, Any],
    persona: str = "friendly",
    self_rating: Optional[int] = None,
    csv_path: str = DEFAULT_CSV_PATH,
    answer_id: Optional[str] = None
) -> str:
    """Appends a single answer extraction record to the training dataset."""
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    file_exists = os.path.isfile(csv_path)

    row = {
        "answer_id": answer_id or f"ans_{int(datetime.now().timestamp() * 1000)}",
        "timestamp": datetime.utcnow().isoformat(),
        "persona": persona,
        "transcript_length": len(features.get("transcript", "")),
        "word_count": features.get("word_count", 0),
        "duration_seconds": features.get("duration_seconds", 0.0),
        "voiced_duration_seconds": features.get("voiced_duration_seconds", 0.0),
        "speech_rate_wpm": features.get("speech_rate_wpm", 0.0),
        "pause_ratio": features.get("pause_ratio", 0.0),
        "mean_pause_s": features.get("mean_pause_s", 0.0),
        "longest_pause_s": features.get("longest_pause_s", 0.0),
        "pause_count": features.get("pause_count", 0),
        "long_pause_count": features.get("long_pause_count", 0),
        "pitch_std_semitones": features.get("pitch_std_semitones", 0.0),
        "pitch_range_semitones": features.get("pitch_range_semitones", 0.0),
        "pitch_median_hz": features.get("pitch_median_hz", 0.0),
        "rms_mean_db": features.get("rms_mean_db", -60.0),
        "rms_cv": features.get("rms_cv", 0.0),
        "trailing_off_delta_db": features.get("trailing_off_delta_db", 0.0),
        "is_trailing_off": features.get("is_trailing_off", False),
        "filler_word_count": features.get("filler_word_count", 0),
        "delivery_score": features.get("delivery_score", 0.0),
        "clarity_score": features.get("clarity_score", 0.0),
        "self_rating": self_rating if self_rating is not None else "",
        "reliability": features.get("reliability", "low"),
        "analysis_label": features.get("analysis_label", "Text-only analysis"),
    }

    with open(csv_path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    return row["answer_id"]


def main():
    parser = argparse.ArgumentParser(description="Export and verify Synterview training features dataset")
    parser.add_argument("--output", default=DEFAULT_CSV_PATH, help="Path to output answers.csv")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    if not os.path.exists(args.output):
        with open(args.output, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
            writer.writeheader()
        print(f"Initialized training features dataset with headers at: {args.output}")
    else:
        with open(args.output, mode="r", encoding="utf-8") as f:
            reader = csv.reader(f)
            row_count = sum(1 for _ in reader) - 1
        print(f"Training features dataset exists at: {args.output} ({max(0, row_count)} records)")


if __name__ == "__main__":
    main()

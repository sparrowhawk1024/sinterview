"""
Visual Branch Module (services/local_speech_model/visual.py)
============================================================
Implements:
1. Visual Telemetry Aggregation & Alignment:
   - Receives client-side frame aggregates computed in the browser via MediaPipe.
   - Evaluates quality indicator q_v based on face detection rate and brightness/contrast.
   - Strictly labels all outputs as 'camera-based indicator', never attention or confidence.
   - If q_v < threshold (default 0.50), returns 'insufficient evidence' with score = None.
   - Aligns visual frame metrics with word indexes for multimodal concept targeting.
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field

try:
    from services.local_speech_model.config import CONFIG
    from services.local_speech_model.word_features import WordFeature
except ImportError:
    from config import CONFIG
    from word_features import WordFeature


class VisualFrame(BaseModel):
    timestamp_s: float
    face_detected: bool = True
    head_yaw: float = 0.0      # degrees (-left, +right)
    head_pitch: float = 0.0    # degrees (-down, +up)
    head_roll: float = 0.0     # degrees
    gaze_proxy_ratio: float = 0.5 # 0.0 to 1.0 (iris relative to eye bounds)
    shoulder_tilt: float = 0.0 # degrees
    torso_lean: float = 0.0    # degrees
    movement_energy: float = 0.0 # landmark displacement delta
    frame_brightness: Optional[float] = 128.0 # 0 to 255


class VisualTelemetryAggregate(BaseModel):
    face_in_frame_ratio: float = 0.0
    head_yaw_mean: float = 0.0
    head_yaw_std: float = 0.0
    head_pitch_mean: float = 0.0
    head_pitch_std: float = 0.0
    head_roll_mean: float = 0.0
    head_roll_std: float = 0.0
    gaze_proxy_ratio: float = 0.0
    shoulder_tilt_mean: float = 0.0
    torso_lean_mean: float = 0.0
    movement_energy: float = 0.0
    q_v: float = 0.0  # Quality indicator in [0, 1]
    label: str = "camera-based indicator"
    is_valid: bool = False
    quality_alert: Optional[str] = None
    sub_score: Optional[float] = None  # Scaled 1.0 to 5.0 (None if insufficient evidence)


def aggregate_visual_frames(
    frames: List[VisualFrame],
    expected_duration_s: float = 0.0
) -> VisualTelemetryAggregate:
    """
    Aggregates timestamped client-side MediaPipe frames into response-level telemetry.
    Computes quality indicator q_v based on detection consistency and brightness.
    """
    cfg = CONFIG.visual
    if not frames:
        return VisualTelemetryAggregate(
            face_in_frame_ratio=0.0,
            q_v=0.0,
            is_valid=False,
            quality_alert="No visual frames captured",
            sub_score=None
        )

    n = len(frames)
    detected_count = sum(1 for f in frames if f.face_detected)
    face_ratio = detected_count / max(1, n)

    # Frame brightness factor: penalize severe under/over-exposure (<40 or >220 on 0-255)
    brightness_vals = [f.frame_brightness for f in frames if f.frame_brightness is not None]
    mean_bright = float(np.mean(brightness_vals)) if brightness_vals else 128.0
    if 50.0 <= mean_bright <= 210.0:
        brightness_factor = 1.0
    elif 30.0 <= mean_bright < 50.0 or 210.0 < mean_bright <= 235.0:
        brightness_factor = 0.65
    else:
        brightness_factor = 0.25

    # Duration sampling consistency factor
    expected_frames = max(1.0, expected_duration_s * cfg.fps_sample_rate)
    frame_coverage = min(1.0, n / expected_frames) if expected_duration_s > 0 else 1.0

    # Composite visual quality q_v in [0, 1]
    q_v = round(float(np.clip(face_ratio * brightness_factor * frame_coverage, 0.0, 1.0)), 3)

    # Pose and gaze aggregates
    detected_frames = [f for f in frames if f.face_detected]
    if detected_frames:
        yaws = [f.head_yaw for f in detected_frames]
        pitches = [f.head_pitch for f in detected_frames]
        rolls = [f.head_roll for f in detected_frames]
        gazes = [f.gaze_proxy_ratio for f in detected_frames]
        tilts = [f.shoulder_tilt for f in detected_frames]
        leans = [f.torso_lean for f in detected_frames]
        energies = [f.movement_energy for f in detected_frames]

        yaw_m, yaw_s = float(np.mean(yaws)), float(np.std(yaws))
        pitch_m, pitch_s = float(np.mean(pitches)), float(np.std(pitches))
        roll_m, roll_s = float(np.mean(rolls)), float(np.std(rolls))
        gaze_ratio = float(np.mean(gazes))
        tilt_m = float(np.mean(tilts))
        lean_m = float(np.mean(leans))
        energy = float(np.mean(energies))
    else:
        yaw_m, yaw_s = 0.0, 0.0
        pitch_m, pitch_s = 0.0, 0.0
        roll_m, roll_s = 0.0, 0.0
        gaze_ratio = 0.0
        tilt_m = 0.0
        lean_m = 0.0
        energy = 0.0

    # Quality Gate Check
    if q_v < cfg.min_quality_qv:
        return VisualTelemetryAggregate(
            face_in_frame_ratio=round(face_ratio, 3),
            head_yaw_mean=round(yaw_m, 2),
            head_yaw_std=round(yaw_s, 2),
            head_pitch_mean=round(pitch_m, 2),
            head_pitch_std=round(pitch_s, 2),
            head_roll_mean=round(roll_m, 2),
            head_roll_std=round(roll_s, 2),
            gaze_proxy_ratio=round(gaze_ratio, 3),
            shoulder_tilt_mean=round(tilt_m, 2),
            torso_lean_mean=round(lean_m, 2),
            movement_energy=round(energy, 4),
            q_v=q_v,
            label=cfg.indicator_label,
            is_valid=False,
            quality_alert=f"Visual quality q_v ({q_v:.2f}) below threshold ({cfg.min_quality_qv:.2f}): insufficient evidence",
            sub_score=None
        )

    # Interpretable camera-based physical stability score (1.0 to 5.0 scale)
    # Evaluates face centering, upright posture, and moderate movement
    yaw_penalty = min(1.5, abs(yaw_m) / 20.0)
    pitch_penalty = min(1.5, abs(pitch_m) / 18.0)
    tilt_penalty = min(1.0, abs(tilt_m) / 12.0)
    energy_penalty = min(1.0, energy * 5.0)

    raw_score = 5.0 - (yaw_penalty + pitch_penalty + tilt_penalty + energy_penalty)
    sub_score = round(float(np.clip(raw_score, 1.0, 5.0)), 2)

    return VisualTelemetryAggregate(
        face_in_frame_ratio=round(face_ratio, 3),
        head_yaw_mean=round(yaw_m, 2),
        head_yaw_std=round(yaw_s, 2),
        head_pitch_mean=round(pitch_m, 2),
        head_pitch_std=round(pitch_s, 2),
        head_roll_mean=round(roll_m, 2),
        head_roll_std=round(roll_s, 2),
        gaze_proxy_ratio=round(gaze_ratio, 3),
        shoulder_tilt_mean=round(tilt_m, 2),
        torso_lean_mean=round(lean_m, 2),
        movement_energy=round(energy, 4),
        q_v=q_v,
        label=cfg.indicator_label,
        is_valid=True,
        quality_alert=None,
        sub_score=sub_score
    )


def align_visual_windows_to_words(
    frames: List[VisualFrame],
    words: List[WordFeature]
) -> Dict[str, Any]:
    """
    Aligns timestamped visual frames to word timestamps.
    Computes visual movement energy and gaze stability for each word index.
    """
    if not words or not frames:
        return {"aligned_word_count": 0, "per_word_visual": []}

    per_word = []
    for w in words:
        # Match frames falling inside the word interval [start, end]
        matched_frames = [f for f in frames if w.start <= f.timestamp_s <= w.end]
        if matched_frames:
            energies = [f.movement_energy for f in matched_frames]
            gazes = [f.gaze_proxy_ratio for f in matched_frames]
            avg_energy = float(np.mean(energies))
            avg_gaze = float(np.mean(gazes))
        else:
            avg_energy = 0.0
            avg_gaze = 0.5

        per_word.append({
            "word_idx": w.idx,
            "word_text": w.text,
            "start": w.start,
            "end": w.end,
            "visual_energy": round(avg_energy, 4),
            "gaze_proxy": round(avg_gaze, 3)
        })

    return {
        "aligned_word_count": len(words),
        "per_word_visual": per_word
    }

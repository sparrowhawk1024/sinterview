"""
Acoustic and Vocal Feature Extraction Service for Synterview
============================================================
Pure, explainable, and unit-tested feature extractor for spoken candidate answers.

Key Principles:
1. PURE: No side-effects, no global mutable state, fully unit-testable with synthetic arrays.
2. HONEST: Never fabricates confidence or acoustic metrics. If audio is missing, corrupt,
   silent, or short (<4s), marks reliability="low" with exact reasons, or produces
   a clean text-only analysis.
3. GENDER-NEUTRAL PITCH: Pitches measured in SEMITONES relative to candidate's own median,
   avoiding male/female fundamental frequency bias.
4. EXPLAINABLE RULES: "delivery_score" (0.0 to 1.0) and "clarity_score" (0.0 to 1.0)
   accompanied by exact rule contributions.
"""

import os
import re
import shutil
import subprocess
import math
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

# Optional imports: librosa and soundfile are loaded if present.
# If missing, graceful pure-numpy fallbacks operate without crashing.
try:
    import soundfile as sf
    HAVE_SOUNDFILE = True
except ImportError:
    sf = None
    HAVE_SOUNDFILE = False

try:
    import librosa
    HAVE_LIBROSA = True
except ImportError:
    librosa = None
    HAVE_LIBROSA = False


FILLER_WORDS = {
    "um", "uh", "like", "basically", "actually", "literally",
    "sorta", "kinda", "you know", "i mean", "right", "so yeah"
}


def check_ffmpeg_installed() -> bool:
    """Check if ffmpeg binary exists in PATH."""
    return shutil.which("ffmpeg") is not None


def decode_audio_bytes(audio_bytes: bytes, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
    """
    Decodes arbitrary audio bytes (e.g. WebM Opus, OGG, WAV) using an ffmpeg subprocess
    to 16 kHz mono float32.

    Raises:
        RuntimeError: If ffmpeg is not found or fails to decode the stream.
    """
    if not check_ffmpeg_installed():
        raise RuntimeError("ffmpeg executable not found in PATH. Install ffmpeg to enable acoustic decoding.")

    cmd = [
        "ffmpeg",
        "-nostdin",
        "-threads", "1",
        "-i", "pipe:0",
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ar", str(target_sr),
        "-ac", "1",
        "pipe:1"
    ]

    process = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    out, err = process.communicate(input=audio_bytes)
    if process.returncode != 0:
        raise RuntimeError(f"ffmpeg decoding failed (exit code {process.returncode}): {err.decode('utf-8', errors='ignore')[:300]}")

    audio_array = np.frombuffer(out, dtype=np.float32)
    return audio_array, target_sr


def extract_filler_words_from_text(transcript: str) -> Tuple[int, List[str]]:
    """Extract filler words from text transcript."""
    words = re.findall(r"\b[a-zA-Z']+\b", transcript.lower())
    found: List[str] = []
    
    # Check 1-word fillers
    for w in words:
        if w in FILLER_WORDS:
            found.append(w)
            
    # Check 2-word phrases ("you know", "i mean", "so yeah")
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        if bigram in FILLER_WORDS:
            found.append(bigram)

    return len(found), list(set(found))


def compute_pauses(
    audio: np.ndarray,
    sr: int = 16000,
    top_db: float = 30.0,
    frame_length: int = 1024,
    hop_length: int = 256
) -> Dict[str, Any]:
    """
    Computes voiced duration and pause statistics.
    Uses librosa.effects.split if available, else RMS-based thresholding.
    """
    total_duration_s = float(len(audio)) / float(sr) if sr > 0 else 0.0
    if total_duration_s <= 0.0 or len(audio) == 0:
        return {
            "voiced_duration_s": 0.0,
            "pause_ratio": 1.0,
            "mean_pause_s": 0.0,
            "longest_pause_s": 0.0,
            "pause_count": 0,
            "long_pause_count": 0,
        }

    intervals = []
    use_librosa_split = os.getenv("SYNTERVIEW_ENABLE_LIBROSA_SPLIT", "0") == "1"
    if HAVE_LIBROSA and use_librosa_split:
        try:
            intervals = librosa.effects.split(
                audio,
                top_db=top_db,
                frame_length=frame_length,
                hop_length=hop_length
            )
        except Exception:
            intervals = []

    # Pure numpy energy thresholding (fast, deterministic, zero-dependency)
    if len(intervals) == 0:
        # Compute short-time energy
        num_frames = (len(audio) - frame_length) // hop_length + 1
        if num_frames > 0:
            frames = np.lib.stride_tricks.as_strided(
                audio,
                shape=(num_frames, frame_length),
                strides=(audio.strides[0] * hop_length, audio.strides[0])
            )
            energy = np.mean(frames ** 2, axis=1)
            max_energy = np.max(energy) if len(energy) > 0 else 0.0
            if max_energy > 1e-12:
                db = 10 * np.log10(np.maximum(energy, 1e-12) / max_energy)
                voiced = db > -top_db
                # Find continuous segments of voiced frames
                diffs = np.diff(voiced.astype(int))
                starts = np.where(diffs == 1)[0] + 1
                ends = np.where(diffs == -1)[0] + 1
                if voiced[0]:
                    starts = np.r_[0, starts]
                if voiced[-1]:
                    ends = np.r_[ends, len(voiced)]
                intervals = [(s * hop_length, min(e * hop_length, len(audio))) for s, e in zip(starts, ends) if e > s]

    if len(intervals) == 0:
        return {
            "voiced_duration_s": 0.0,
            "pause_ratio": 1.0,
            "mean_pause_s": total_duration_s,
            "longest_pause_s": total_duration_s,
            "pause_count": 1,
            "long_pause_count": 1 if total_duration_s > 1.2 else 0,
        }

    # Sum of voiced frames
    voiced_samples = sum(end - start for start, end in intervals)
    voiced_duration_s = float(voiced_samples) / float(sr)
    pause_duration_s = max(0.0, total_duration_s - voiced_duration_s)
    pause_ratio = pause_duration_s / total_duration_s if total_duration_s > 0 else 0.0

    # Calculate pause intervals between voiced regions
    pause_durations = []
    # Leading silence
    if intervals[0][0] > 0:
        pause_durations.append(float(intervals[0][0]) / float(sr))
    # Internal gaps
    for i in range(len(intervals) - 1):
        gap = intervals[i + 1][0] - intervals[i][1]
        if gap > 0:
            pause_durations.append(float(gap) / float(sr))
    # Trailing silence
    if intervals[-1][1] < len(audio):
        pause_durations.append(float(len(audio) - intervals[-1][1]) / float(sr))

    pause_count = len(pause_durations)
    mean_pause_s = float(np.mean(pause_durations)) if pause_durations else 0.0
    longest_pause_s = float(np.max(pause_durations)) if pause_durations else 0.0
    long_pause_count = sum(1 for p in pause_durations if p > 1.2)

    return {
        "voiced_duration_s": round(voiced_duration_s, 2),
        "pause_ratio": round(pause_ratio, 3),
        "mean_pause_s": round(mean_pause_s, 2),
        "longest_pause_s": round(longest_pause_s, 2),
        "pause_count": pause_count,
        "long_pause_count": long_pause_count,
    }


def compute_pitch_semitones(
    audio: np.ndarray,
    sr: int = 16000,
    fmin_hz: float = 65.4,   # C2
    fmax_hz: float = 1046.5  # C6
) -> Dict[str, Any]:
    """
    Computes pitch variation in SEMITONES relative to the speaker's own median fundamental frequency.
    Prevents gender/voice-pitch bias (women naturally ~200Hz, men ~110Hz).
    """
    if len(audio) < sr * 0.5:
        return {
            "pitch_std_semitones": 0.0,
            "pitch_range_semitones": 0.0,
            "pitch_median_hz": 0.0,
            "f0_voiced_fraction": 0.0,
            "pitch_method": "none"
        }

    f0_valid = np.array([], dtype=np.float32)
    pitch_method = "none"

    use_pyin = os.getenv("SYNTERVIEW_ENABLE_PYIN", "0") == "1"

    if HAVE_LIBROSA and use_pyin:
        try:
            # Run pyin on 16kHz audio with hop_length=512 for optimal speed and responsiveness
            f0, _, _ = librosa.pyin(
                audio,
                fmin=fmin_hz,
                fmax=fmax_hz,
                sr=sr,
                frame_length=1024,
                hop_length=512
            )
            f0_valid = f0[~np.isnan(f0) & (f0 > 0)]
            if len(f0_valid) >= 5:
                pitch_method = "librosa_pyin"
        except Exception:
            f0_valid = np.array([], dtype=np.float32)

    # Pure numpy autocorrelation fallback (fast, deterministic, zero-dependency)
    if len(f0_valid) == 0:
        # Autocorrelation based pitch estimation
        frame_size = 1024
        hop_size = 512
        min_lag = int(sr / fmax_hz)
        max_lag = int(sr / fmin_hz)
        f0_list = []

        for i in range(0, len(audio) - frame_size, hop_size):
            frame = audio[i:i + frame_size]
            if np.std(frame) < 1e-4:
                continue
            corr = np.correlate(frame, frame, mode='full')
            corr = corr[len(frame) - 1:]
            if max_lag < len(corr):
                peak_idx = min_lag + np.argmax(corr[min_lag:max_lag])
                if corr[peak_idx] > 0.4 * corr[0]:
                    freq = sr / peak_idx
                    f0_list.append(freq)
        f0_valid = np.array(f0_list, dtype=np.float32)
        if len(f0_valid) >= 5:
            pitch_method = "numpy_autocorrelation"

    if len(f0_valid) < 5:
        return {
            "pitch_std_semitones": 0.0,
            "pitch_range_semitones": 0.0,
            "pitch_median_hz": 0.0,
            "f0_voiced_fraction": 0.0,
            "pitch_method": pitch_method if pitch_method != "none" else "insufficient_voiced_frames"
        }

    median_hz = float(np.median(f0_valid))
    if median_hz <= 0:
        return {
            "pitch_std_semitones": 0.0,
            "pitch_range_semitones": 0.0,
            "pitch_median_hz": 0.0,
            "f0_voiced_fraction": 0.0,
            "pitch_method": pitch_method
        }

    # Semitones relative to median: 12 * log2(f0 / median)
    semitones = 12.0 * np.log2(f0_valid / median_hz)
    pitch_std = float(np.std(semitones))
    # Robust range: 95th percentile - 5th percentile
    p95, p5 = np.percentile(semitones, [95, 5])
    pitch_range = float(p95 - p5)

    return {
        "pitch_std_semitones": round(pitch_std, 2),
        "pitch_range_semitones": round(pitch_range, 2),
        "pitch_median_hz": round(median_hz, 1),
        "f0_voiced_fraction": round(len(f0_valid) / (len(audio) / 512), 2),
        "pitch_method": pitch_method
    }


def compute_energy(audio: np.ndarray, sr: int = 16000) -> Dict[str, Any]:
    """
    Computes RMS energy in dB and vocal projection / trailing-off metric.
    """
    if len(audio) == 0:
        return {
            "rms_mean_db": -60.0,
            "rms_cv": 0.0,
            "trailing_off_delta_db": 0.0,
            "is_trailing_off": False
        }

    # 50ms frames
    frame_len = int(sr * 0.05)
    if frame_len <= 0 or len(audio) < frame_len:
        frame_len = len(audio)

    num_frames = max(1, len(audio) // frame_len)
    audio_trimmed = audio[:num_frames * frame_len]
    frames = audio_trimmed.reshape(num_frames, frame_len)
    rms_per_frame = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)

    mean_rms = float(np.mean(rms_per_frame))
    rms_mean_db = float(20.0 * np.log10(max(mean_rms, 1e-9)))
    rms_cv = float(np.std(rms_per_frame) / (mean_rms + 1e-9))

    # Trailing off: energy of last 20% vs first 80%
    split_idx = int(num_frames * 0.8)
    if split_idx > 0 and split_idx < num_frames:
        first_80_rms = np.mean(rms_per_frame[:split_idx])
        last_20_rms = np.mean(rms_per_frame[split_idx:])
        first_80_db = 20.0 * np.log10(max(first_80_rms, 1e-9))
        last_20_db = 20.0 * np.log10(max(last_20_rms, 1e-9))
        trailing_off_delta_db = float(last_20_db - first_80_db)
    else:
        trailing_off_delta_db = 0.0

    # True if the energy dropped by more than 5.5 dB at the end
    is_trailing_off = trailing_off_delta_db < -5.5

    return {
        "rms_mean_db": round(rms_mean_db, 1),
        "rms_cv": round(rms_cv, 3),
        "trailing_off_delta_db": round(trailing_off_delta_db, 1),
        "is_trailing_off": is_trailing_off
    }


def compute_reliability(
    audio: Optional[np.ndarray],
    duration_s: float,
    voiced_duration_s: float,
    rms_mean_db: float,
    has_audio: bool
) -> Tuple[str, List[str]]:
    """
    Evaluates reliability ('high' | 'low') with explicit, transparent reasons.
    """
    if not has_audio or audio is None or len(audio) == 0:
        return "low", ["text_only_analysis_no_audio_captured"]

    reasons: List[str] = []
    if duration_s < 4.0:
        reasons.append(f"short_audio_duration_{duration_s:.1f}s_below_4s_minimum")

    if voiced_duration_s < 1.0:
        reasons.append(f"predominantly_silent_audio_{voiced_duration_s:.1f}s_voiced")

    # Clipping detection: sample >= 0.999
    clip_ratio = np.mean(np.abs(audio) >= 0.99)
    if clip_ratio > 0.02:
        reasons.append(f"severe_microphone_clipping_{clip_ratio*100:.1f}pct")

    # Noise floor / very low signal
    if rms_mean_db < -45.0:
        reasons.append(f"very_low_input_signal_{rms_mean_db:.1f}db")

    status = "low" if len(reasons) > 0 else "high"
    return status, reasons


def score_delivery(
    speech_rate_wpm: float,
    pause_ratio: float,
    long_pause_count: int,
    pitch_std_semitones: float,
    is_trailing_off: bool,
    filler_count: int,
    is_acoustic: bool
) -> Tuple[float, List[str]]:
    """
    Explainable delivery score (0.0 to 1.0).
    Measures pace, pauses, vocal variation and projection. NOT feelings or emotions.
    """
    score = 0.70 # Baseline neutral
    contributions: List[str] = []

    # 1. Pace (WPM)
    if 125 <= speech_rate_wpm <= 165:
        score += 0.15
        contributions.append(f"+0.15: Natural conversational pace ({int(speech_rate_wpm)} WPM)")
    elif 100 <= speech_rate_wpm < 125:
        score += 0.05
        contributions.append(f"+0.05: Deliberate, steady pace ({int(speech_rate_wpm)} WPM)")
    elif speech_rate_wpm > 185:
        score -= 0.15
        contributions.append(f"-0.15: Rushed cadence ({int(speech_rate_wpm)} WPM)")
    elif speech_rate_wpm < 85 and speech_rate_wpm > 0:
        score -= 0.15
        contributions.append(f"-0.15: Noticeably hesitant pace ({int(speech_rate_wpm)} WPM)")

    # 2. Pauses & Flow
    if is_acoustic:
        if 0.15 <= pause_ratio <= 0.35:
            score += 0.10
            contributions.append(f"+0.10: Well-balanced pause ratio ({int(pause_ratio*100)}%)")
        elif pause_ratio > 0.45:
            score -= 0.10
            contributions.append(f"-0.10: Extended silent pauses ({int(pause_ratio*100)}%)")

        if long_pause_count > 0:
            penalty = min(0.15, long_pause_count * 0.05)
            score -= penalty
            contributions.append(f"-{penalty:.2f}: {long_pause_count} awkward pause(s) exceeding 1.2s")

        # 3. Vocal Pitch Variation (semitones)
        if 1.5 <= pitch_std_semitones <= 3.5:
            score += 0.10
            contributions.append(f"+0.10: Dynamic pitch modulation ({pitch_std_semitones:.1f} semitones)")
        elif pitch_std_semitones < 1.0 and pitch_std_semitones > 0:
            score -= 0.10
            contributions.append(f"-0.10: Flat monotone delivery ({pitch_std_semitones:.1f} semitones)")

        # 4. Energy Projection
        if is_trailing_off:
            score -= 0.08
            contributions.append("-0.08: Trailing off volume toward conclusion of answer")
        else:
            score += 0.05
            contributions.append("+0.05: Consistent vocal projection throughout answer")

    # 5. Filler words
    if filler_count == 0:
        score += 0.05
        contributions.append("+0.05: Zero filler words detected")
    elif filler_count > 3:
        penalty = min(0.15, filler_count * 0.03)
        score -= penalty
        contributions.append(f"-{penalty:.2f}: Frequent filler words ({filler_count} detected)")

    final_score = max(0.20, min(1.0, score))
    return round(final_score, 2), contributions


def score_clarity(
    filler_count: int,
    word_count: int,
    pause_ratio: float,
    is_acoustic: bool
) -> Tuple[float, List[str]]:
    """Explainable clarity score (0.0 to 1.0)."""
    score = 0.85
    contributions: List[str] = []

    filler_density = (filler_count / max(1, word_count))
    if filler_density > 0.08:
        score -= 0.20
        contributions.append(f"-0.20: High filler word density ({filler_density*100:.1f}%)")
    elif filler_density > 0.03:
        score -= 0.10
        contributions.append(f"-0.10: Moderate filler word density ({filler_density*100:.1f}%)")
    else:
        score += 0.05
        contributions.append("+0.05: Crisp articulation with low filler density")

    if is_acoustic and pause_ratio > 0.50:
        score -= 0.15
        contributions.append("-0.15: Fragmented speech flow with heavy silence")

    final_score = max(0.30, min(1.0, score))
    return round(final_score, 2), contributions


def extract_features(
    audio: Optional[np.ndarray],
    sr: int,
    transcript: str,
    duration_s: float
) -> Dict[str, Any]:
    """
    Pure feature extraction orchestrator.
    Returns complete feature dictionary with explicit metric source tagging and explainability.
    """
    has_audio = audio is not None and len(audio) > 0
    words = re.findall(r"\b[a-zA-Z']+\b", transcript)
    word_count = len(words)
    filler_count, filler_list = extract_filler_words_from_text(transcript)

    sources: Dict[str, str] = {
        "word_count": "text",
        "filler_words": "text",
        "filler_word_count": "text",
    }

    if has_audio:
        actual_duration = float(len(audio)) / float(sr)
        pauses = compute_pauses(audio, sr=sr)
        pitch = compute_pitch_semitones(audio, sr=sr)
        energy = compute_energy(audio, sr=sr)

        voiced_min = pauses["voiced_duration_s"] / 60.0
        # Speech rate is calculated over VOICED minutes, not total duration
        speech_rate_wpm = (float(word_count) / voiced_min) if voiced_min > 0.02 else 0.0

        sources.update({
            "voiced_duration_s": "acoustic",
            "speech_rate_wpm": "acoustic",
            "pause_ratio": "acoustic",
            "mean_pause_s": "acoustic",
            "longest_pause_s": "acoustic",
            "pause_count": "acoustic",
            "long_pause_count": "acoustic",
            "pitch_std_semitones": "acoustic",
            "pitch_range_semitones": "acoustic",
            "pitch_median_hz": "acoustic",
            "rms_mean_db": "acoustic",
            "rms_cv": "acoustic",
            "trailing_off_delta_db": "acoustic",
            "is_trailing_off": "acoustic",
        })

        reliability, reliability_reasons = compute_reliability(
            audio=audio,
            duration_s=actual_duration,
            voiced_duration_s=pauses["voiced_duration_s"],
            rms_mean_db=energy["rms_mean_db"],
            has_audio=True
        )

        delivery_score, delivery_reasons = score_delivery(
            speech_rate_wpm=speech_rate_wpm,
            pause_ratio=pauses["pause_ratio"],
            long_pause_count=pauses["long_pause_count"],
            pitch_std_semitones=pitch["pitch_std_semitones"],
            is_trailing_off=energy["is_trailing_off"],
            filler_count=filler_count,
            is_acoustic=True
        )

        clarity_score, clarity_reasons = score_clarity(
            filler_count=filler_count,
            word_count=word_count,
            pause_ratio=pauses["pause_ratio"],
            is_acoustic=True
        )

        analysis_label = "Acoustic + text analysis"
    else:
        # Clean text-only fallback
        actual_duration = max(1.0, duration_s)
        total_min = actual_duration / 60.0
        speech_rate_wpm = float(word_count) / total_min if total_min > 0 else 0.0

        sources.update({
            "speech_rate_wpm": "text",
        })

        pauses = {
            "voiced_duration_s": 0.0,
            "pause_ratio": 0.0,
            "mean_pause_s": 0.0,
            "longest_pause_s": 0.0,
            "pause_count": 0,
            "long_pause_count": 0,
        }
        pitch = {
            "pitch_std_semitones": 0.0,
            "pitch_range_semitones": 0.0,
            "pitch_median_hz": 0.0,
            "pitch_method": "none",
        }
        energy = {
            "rms_mean_db": -60.0,
            "rms_cv": 0.0,
            "trailing_off_delta_db": 0.0,
            "is_trailing_off": False
        }

        reliability, reliability_reasons = "low", ["text_only_analysis_no_audio_captured"]

        delivery_score, delivery_reasons = score_delivery(
            speech_rate_wpm=speech_rate_wpm,
            pause_ratio=0.0,
            long_pause_count=0,
            pitch_std_semitones=0.0,
            is_trailing_off=False,
            filler_count=filler_count,
            is_acoustic=False
        )

        clarity_score, clarity_reasons = score_clarity(
            filler_count=filler_count,
            word_count=word_count,
            pause_ratio=0.0,
            is_acoustic=False
        )

        analysis_label = "Text-only analysis"

    return {
        "analysis_label": analysis_label,
        "reliability": reliability,
        "reliability_reasons": reliability_reasons,
        "delivery_score": delivery_score,
        "delivery_reasons": delivery_reasons,
        "clarity_score": clarity_score,
        "clarity_reasons": clarity_reasons,
        # Feature values
        "word_count": word_count,
        "duration_seconds": round(actual_duration, 2),
        "voiced_duration_seconds": pauses["voiced_duration_s"],
        "speech_rate_wpm": round(speech_rate_wpm, 1),
        "pause_ratio": pauses["pause_ratio"],
        "mean_pause_s": pauses["mean_pause_s"],
        "longest_pause_s": pauses["longest_pause_s"],
        "pause_count": pauses["pause_count"],
        "long_pause_count": pauses["long_pause_count"],
        "pitch_std_semitones": pitch["pitch_std_semitones"],
        "pitch_range_semitones": pitch["pitch_range_semitones"],
        "pitch_median_hz": pitch["pitch_median_hz"],
        "pitch_method": pitch.get("pitch_method", "none"),
        "rms_mean_db": energy["rms_mean_db"],
        "rms_cv": energy["rms_cv"],
        "trailing_off_delta_db": energy["trailing_off_delta_db"],
        "is_trailing_off": energy["is_trailing_off"],
        "filler_words": filler_list,
        "filler_word_count": filler_count,
        "sources": sources,
    }

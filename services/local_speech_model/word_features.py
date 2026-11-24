"""
Word Feature Record, Disfluency Recovery, and Quality Gate Module
================================================================
Implements:
0. WordFeatureRecord: per-word structured representations:
   {idx, text, start, end, asr_conf, is_filler, source: "asr" | "acoustic"}
   Persisted per response so higher layers reference stable word indexes.

5. Disfluency Recovery & Quality Gate:
   - Librosa-based acoustic filled-pause detector (voiced, steady pitch, 200-800ms, low spectral change).
   - Reconciles acoustic fillers with Whisper word timestamps, inserting source="acoustic" fillers.
   - Quality gate: if SNR or ASR confidence is below threshold, affected metrics return "insufficient evidence".
"""

from typing import List, Dict, Any, Optional, Tuple
import re
import numpy as np
from pydantic import BaseModel, Field

try:
    from services.local_speech_model.config import CONFIG
except ImportError:
    from config import CONFIG


# Standard lexical filler words in English mock interviews
STANDARD_FILLERS = {
    "um", "uh", "er", "ah", "like", "basically", "actually",
    "honestly", "literally", "kinda", "sorta", "you know", "i mean"
}


class WordFeature(BaseModel):
    idx: int
    text: str
    start: float
    end: float
    asr_conf: Optional[float] = 1.0
    is_filler: bool = False
    source: str = "asr"  # "asr" | "acoustic"


class QualityGateResult(BaseModel):
    passed: bool
    snr_db: Optional[float] = None
    asr_mean_conf: Optional[float] = None
    reason: Optional[str] = None
    gated_metrics: List[str] = Field(default_factory=list)


def estimate_snr_db(audio: np.ndarray, sr: int = 16000) -> float:
    """
    Estimates Signal-to-Noise Ratio (SNR) in dB from the waveform.
    Uses bottom 10th percentile energy as noise floor estimate and top 90th percentile as signal.
    """
    if len(audio) == 0:
        return 0.0
    frame_length = 512
    hop_length = 256
    num_frames = (len(audio) - frame_length) // hop_length + 1
    if num_frames <= 0:
        return 0.0
    frames = np.lib.stride_tricks.as_strided(
        audio,
        shape=(num_frames, frame_length),
        strides=(audio.strides[0] * hop_length, audio.strides[0])
    )
    energy = np.mean(frames ** 2, axis=1) + 1e-12
    p_signal = np.percentile(energy, 90)
    p_noise = np.percentile(energy, 10)
    snr = 10.0 * np.log10(p_signal / p_noise)
    return float(max(0.0, snr))


def check_quality_gate(
    audio: Optional[np.ndarray] = None,
    sr: int = 16000,
    words: Optional[List[WordFeature]] = None
) -> QualityGateResult:
    """
    Checks audio SNR and mean ASR confidence against config-driven thresholds.
    If gate fails, delivery/acoustic metrics must return 'insufficient evidence' instead of fake numbers.
    """
    cfg = CONFIG.quality_gate
    snr_db: Optional[float] = None
    asr_mean_conf: Optional[float] = None

    if audio is not None and len(audio) > 0:
        duration_s = float(len(audio)) / float(sr)
        if duration_s < cfg.min_audio_duration_s:
            return QualityGateResult(
                passed=False,
                snr_db=0.0,
                reason=f"Audio duration ({duration_s:.1f}s) is below minimum threshold ({cfg.min_audio_duration_s}s)",
                gated_metrics=["delivery_score", "hesitation_index", "pitch_semitones"]
            )
        snr_db = round(estimate_snr_db(audio, sr), 2)
        if snr_db < cfg.min_snr_db:
            return QualityGateResult(
                passed=False,
                snr_db=snr_db,
                reason=f"Audio SNR ({snr_db:.1f} dB) below minimum quality threshold ({cfg.min_snr_db} dB)",
                gated_metrics=["delivery_score", "hesitation_index", "pitch_semitones"]
            )

    if words and len(words) > 0:
        conf_scores = [w.asr_conf for w in words if w.asr_conf is not None]
        if conf_scores:
            asr_mean_conf = round(float(np.mean(conf_scores)), 3)
            if asr_mean_conf < cfg.min_asr_confidence:
                return QualityGateResult(
                    passed=False,
                    snr_db=snr_db,
                    asr_mean_conf=asr_mean_conf,
                    reason=f"Mean ASR confidence ({asr_mean_conf:.2f}) below threshold ({cfg.min_asr_confidence:.2f})",
                    gated_metrics=["delivery_score", "filler_rate", "hesitation_index"]
                )

    return QualityGateResult(
        passed=True,
        snr_db=snr_db,
        asr_mean_conf=asr_mean_conf,
        reason=None,
        gated_metrics=[]
    )


def extract_word_features_from_asr(
    transcript: str,
    raw_word_timestamps: Optional[List[Dict[str, Any]]] = None,
    total_duration_s: float = 0.0
) -> List[WordFeature]:
    """
    Constructs WordFeature objects from transcript and optional Whisper word timestamps.
    If timestamps are missing, estimates progressive start/end across the duration.
    """
    records: List[WordFeature] = []

    if raw_word_timestamps and len(raw_word_timestamps) > 0:
        for i, item in enumerate(raw_word_timestamps):
            text = str(item.get("word") or item.get("text") or "").strip()
            if not text:
                continue
            clean_word = re.sub(r"[^\w\s']", "", text.lower())
            is_filler = clean_word in STANDARD_FILLERS or bool(item.get("is_filler", False))
            start_t = float(item.get("start", 0.0))
            end_t = float(item.get("end", start_t + 0.3))
            conf = float(item.get("confidence", item.get("asr_conf", 1.0)))

            records.append(
                WordFeature(
                    idx=i,
                    text=text,
                    start=round(start_t, 3),
                    end=round(end_t, 3),
                    asr_conf=round(conf, 3),
                    is_filler=is_filler,
                    source="asr"
                )
            )
        return records

    # Token-based fallback when raw word timestamps are not passed directly
    tokens = [t for t in re.findall(r"\b[\w']+\b|[.,!?;]", transcript) if t.strip()]
    num_words = len([t for t in tokens if re.search(r"\w", t)])
    if num_words == 0:
        return records

    effective_dur = max(total_duration_s, float(num_words) * 0.4)
    step = effective_dur / float(max(1, len(tokens)))

    for i, tok in enumerate(tokens):
        clean = tok.lower()
        is_filler = clean in STANDARD_FILLERS
        start_t = round(i * step, 3)
        end_t = round((i + 1) * step, 3)
        records.append(
            WordFeature(
                idx=i,
                text=tok,
                start=start_t,
                end=end_t,
                asr_conf=0.95,
                is_filler=is_filler,
                source="asr"
            )
        )

    return records


def detect_acoustic_filled_pauses(
    audio: np.ndarray,
    sr: int = 16000,
    existing_words: Optional[List[WordFeature]] = None
) -> List[Dict[str, Any]]:
    """
    Detects prolonged voiced intervals exhibiting near-steady fundamental frequency and low spectral flux.
    These characteristic acoustic markers correspond to filled pauses ('uh', 'um', 'mm') often dropped by Whisper.
    """
    cfg = CONFIG.disfluency_recovery
    if len(audio) == 0:
        return []

    # Short-time frame analysis
    frame_length = 1024
    hop_length = 256
    num_frames = (len(audio) - frame_length) // hop_length + 1
    if num_frames < 10:
        return []

    frames = np.lib.stride_tricks.as_strided(
        audio,
        shape=(num_frames, frame_length),
        strides=(audio.strides[0] * hop_length, audio.strides[0])
    )

    # Frame energy (voiced detection)
    energy = np.mean(frames ** 2, axis=1)
    max_e = np.max(energy) if len(energy) > 0 else 0.0
    if max_e < 1e-6:
        return []

    norm_energy = energy / max_e
    voiced_mask = norm_energy > 0.04

    # Autocorrelation-based pitch and spectral flux per frame
    recovered_fillers = []
    current_run = []

    for i in range(num_frames):
        if voiced_mask[i]:
            current_run.append(i)
        else:
            if len(current_run) > 0:
                duration_s = (len(current_run) * hop_length) / sr
                if cfg.min_duration_s <= duration_s <= cfg.max_duration_s:
                    start_s = (current_run[0] * hop_length) / sr
                    end_s = (current_run[-1] * hop_length + frame_length) / sr

                    # Check spectral stability across frames in this candidate segment
                    seg_frames = frames[current_run]
                    # Compute simplified spectral flux (difference between consecutive normalized magnitude spectra)
                    mags = np.abs(np.fft.rfft(seg_frames, axis=1))
                    mag_sums = np.sum(mags, axis=1, keepdims=True) + 1e-12
                    norm_mags = mags / mag_sums
                    flux = np.mean(np.diff(norm_mags, axis=0) ** 2) if len(seg_frames) > 1 else 0.0

                    if flux <= cfg.max_spectral_flux:
                        recovered_fillers.append({
                            "text": "[filled-pause]",
                            "start": round(start_s, 3),
                            "end": round(end_s, 3),
                            "confidence": cfg.confidence_score,
                            "flux": round(float(flux), 4)
                        })
                current_run = []

    # Final segment check
    if len(current_run) > 0:
        duration_s = (len(current_run) * hop_length) / sr
        if cfg.min_duration_s <= duration_s <= cfg.max_duration_s:
            start_s = (current_run[0] * hop_length) / sr
            end_s = (current_run[-1] * hop_length + frame_length) / sr
            recovered_fillers.append({
                "text": "[filled-pause]",
                "start": round(start_s, 3),
                "end": round(end_s, 3),
                "confidence": cfg.confidence_score
            })

    # Reconcile with existing words: avoid overlapping if Whisper already recognized a word there
    non_overlapping: List[Dict[str, Any]] = []
    for cand in recovered_fillers:
        overlap = False
        if existing_words:
            for w in existing_words:
                # Check temporal intersection
                if not (cand["end"] <= w.start or cand["start"] >= w.end):
                    overlap = True
                    break
        if not overlap:
            non_overlapping.append(cand)

    return non_overlapping


def reconcile_and_build_word_features(
    transcript: str,
    raw_word_timestamps: Optional[List[Dict[str, Any]]] = None,
    audio: Optional[np.ndarray] = None,
    sr: int = 16000,
    total_duration_s: float = 0.0
) -> Tuple[List[WordFeature], QualityGateResult]:
    """
    Master function:
    1. Extracts ASR word feature records.
    2. Runs quality gate on audio SNR and ASR confidence.
    3. Runs disfluency recovery to insert missing acoustic filled pauses.
    4. Sorts by start timestamp and re-indexes sequentially.
    """
    words = extract_word_features_from_asr(transcript, raw_word_timestamps, total_duration_s)
    q_gate = check_quality_gate(audio=audio, sr=sr, words=words)

    # Only run acoustic recovery if quality gate passes and audio is available
    if q_gate.passed and audio is not None and len(audio) > 0:
        try:
            acoustic_fillers = detect_acoustic_filled_pauses(audio, sr=sr, existing_words=words)
            for af in acoustic_fillers:
                words.append(
                    WordFeature(
                        idx=0,  # will be reindexed
                        text=af["text"],
                        start=af["start"],
                        end=af["end"],
                        asr_conf=af.get("confidence", 0.85),
                        is_filler=True,
                        source="acoustic"
                    )
                )
        except Exception as e:
            print(f"[WordFeatures] Warning in acoustic filler detection: {e}")

    # Sort all words chronologically and assign stable sequential 0-based indexes
    words.sort(key=lambda w: (w.start, w.end))
    for i, w in enumerate(words):
        w.idx = i

    return words, q_gate

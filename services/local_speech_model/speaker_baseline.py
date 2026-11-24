"""
Speaker Baseline and Adaptive Turn-Taking Module
================================================
Implements:
2. Speaker Baseline + Adaptive Turn-Taking (inspired by CN 121212135 B):
   - Establishes candidate-specific speech rate and pause-length baseline on warm-up question.
   - Computes z-score deviations from personal baseline to normalize delivery feedback flags.
     (e.g., avoids labeling 166 WPM as 'rushed' if that matches the candidate's natural baseline).
   - Computes adaptive end-of-turn silence timeout:
     * Extended timeout when speaker pause pattern indicates cognitive processing/thinking.
     * Accelerated timeout when syntactic/semantic completeness heuristics indicate turn completion.
"""

from typing import List, Dict, Any, Optional, Tuple
import re
import numpy as np
from pydantic import BaseModel, Field

try:
    from services.local_speech_model.config import CONFIG
    from services.local_speech_model.word_features import WordFeature
except ImportError:
    from config import CONFIG
    from word_features import WordFeature


class SpeakerBaseline(BaseModel):
    is_calibrated: bool = False
    warmup_question_id: Optional[str] = None
    baseline_wpm_mean: float
    baseline_wpm_std: float
    baseline_pause_mean_s: float
    baseline_pause_std_s: float
    sample_word_count: int = 0
    sample_duration_s: float = 0.0


class BaselineDeviationResult(BaseModel):
    is_calibrated: bool
    z_score_wpm: float
    z_score_pause: float
    normalized_pace_flag: str
    normalized_pause_flag: str
    personal_baseline_summary: str


class TurnTakingDecision(BaseModel):
    adaptive_silence_timeout_s: float
    reason: str
    is_semantically_complete: bool
    is_thinking_state: bool


def calibrate_speaker_baseline(
    words: List[WordFeature],
    duration_s: float,
    question_id: str = "warmup_q1"
) -> SpeakerBaseline:
    """
    Calibrates baseline metrics from candidate's warm-up question response.
    Requires minimum words to avoid degenerate statistics.
    """
    cfg = CONFIG.baseline
    content_words = [w for w in words if not w.is_filler or w.source == "asr"]
    word_count = len(content_words)

    if word_count < cfg.min_words_for_baseline or duration_s <= 0.0:
        return SpeakerBaseline(
            is_calibrated=False,
            warmup_question_id=question_id,
            baseline_wpm_mean=cfg.default_wpm_mean,
            baseline_wpm_std=cfg.default_wpm_std,
            baseline_pause_mean_s=cfg.default_pause_mean_s,
            baseline_pause_std_s=cfg.default_pause_std_s,
            sample_word_count=word_count,
            sample_duration_s=duration_s
        )

    # Compute observed warm-up WPM
    wpm = word_count / (duration_s / 60.0)

    # Compute pause durations
    pauses: List[float] = []
    for i in range(len(words) - 1):
        gap = words[i + 1].start - words[i].end
        if gap >= CONFIG.hesitation.pause_threshold_s:
            pauses.append(gap)

    pause_mean = float(np.mean(pauses)) if pauses else cfg.default_pause_mean_s
    pause_std = float(np.std(pauses)) if len(pauses) > 1 else cfg.default_pause_std_s
    pause_std = max(0.15, pause_std)

    # Standard error margin for WPM variation based on length
    wpm_std = max(12.0, wpm * 0.14)

    return SpeakerBaseline(
        is_calibrated=True,
        warmup_question_id=question_id,
        baseline_wpm_mean=round(float(wpm), 1),
        baseline_wpm_std=round(float(wpm_std), 1),
        baseline_pause_mean_s=round(float(pause_mean), 2),
        baseline_pause_std_s=round(float(pause_std), 2),
        sample_word_count=word_count,
        sample_duration_s=round(duration_s, 2)
    )


def compute_baseline_deviations(
    wpm: float,
    mean_pause_s: float,
    baseline: Optional[SpeakerBaseline] = None
) -> BaselineDeviationResult:
    """
    Computes candidate-specific z-score deviations against their personal baseline.
    Normalizes flags: e.g. 166 WPM is flagged as normal if |z| <= 1.5.
    """
    cfg = CONFIG.baseline
    thresh = cfg.z_score_deviation_threshold

    if baseline and baseline.is_calibrated:
        z_wpm = (wpm - baseline.baseline_wpm_mean) / max(1.0, baseline.baseline_wpm_std)
        z_pause = (mean_pause_s - baseline.baseline_pause_mean_s) / max(0.05, baseline.baseline_pause_std_s)
        calibrated = True
        summary = (
            f"Personal baseline: {baseline.baseline_wpm_mean:.0f} WPM "
            f"(±{baseline.baseline_wpm_std:.0f}), pause mean: {baseline.baseline_pause_mean_s:.2f}s"
        )
    else:
        z_wpm = (wpm - cfg.default_wpm_mean) / cfg.default_wpm_std
        z_pause = (mean_pause_s - cfg.default_pause_mean_s) / cfg.default_pause_std_s
        calibrated = False
        summary = (
            f"Population baseline fallback: {cfg.default_wpm_mean:.0f} WPM, "
            f"pause mean: {cfg.default_pause_mean_s:.2f}s"
        )

    z_wpm = round(float(z_wpm), 2)
    z_pause = round(float(z_pause), 2)

    # Normalized pace flag
    if abs(z_wpm) <= thresh:
        pace_flag = "Natural pace for this speaker" if calibrated else "Normal conversational pace"
    elif z_wpm > thresh:
        pace_flag = f"Significantly faster than personal baseline (+{z_wpm:.1f}σ)" if calibrated else "Fast conversational pace"
    else:
        pace_flag = f"Significantly slower than personal baseline ({z_wpm:.1f}σ)" if calibrated else "Deliberate / slow conversational pace"

    # Normalized pause flag
    if abs(z_pause) <= thresh:
        pause_flag = "Normal pause intervals for this speaker" if calibrated else "Standard pause pattern"
    elif z_pause > thresh:
        pause_flag = f"Prolonged hesitation pauses relative to baseline (+{z_pause:.1f}σ)" if calibrated else "Elevated pause duration"
    else:
        pause_flag = "Rapid continuous delivery"

    return BaselineDeviationResult(
        is_calibrated=calibrated,
        z_score_wpm=z_wpm,
        z_score_pause=z_pause,
        normalized_pace_flag=pace_flag,
        normalized_pause_flag=pause_flag,
        personal_baseline_summary=summary
    )


def check_semantic_completeness_heuristic(transcript: str) -> bool:
    """
    Evaluates syntactic and semantic termination heuristics:
    1. Ends with terminal punctuation (. ? !).
    2. Does NOT end with dangling conjunctions (and, but, so, because, etc.).
    3. Has minimum word count (>4 words).
    """
    cfg = CONFIG.turn_taking
    text = transcript.strip()
    if not text:
        return False

    tokens = [t.lower() for t in re.findall(r"\b[\w']+\b|[.,!?;]", text) if t.strip()]
    if len(tokens) < 4:
        return False

    # Check terminal mark
    has_terminal_punct = text.endswith(cfg.sentence_terminal_punctuation)

    # Check dangling continuation
    last_word = tokens[-1] if tokens[-1] not in cfg.sentence_terminal_punctuation else (tokens[-2] if len(tokens) > 1 else "")
    is_dangling = last_word in cfg.continuation_conjunctions or last_word in ("um", "uh", "like")

    return has_terminal_punct and not is_dangling


def compute_adaptive_turn_silence_timeout(
    transcript: str,
    words: List[WordFeature],
    baseline: Optional[SpeakerBaseline] = None
) -> TurnTakingDecision:
    """
    Computes the adaptive end-of-turn silence timeout:
    - If speaker is in a 'thinking state' (recent hesitation, trailing silence, or unclosed syntax),
      extends the silence timeout (e.g. 3.8s) to prevent the AI from interrupting candidate.
    - If speaker has reached clean terminal completeness, applies quick turn-taking timeout (1.3s).
    - Otherwise applies base timeout (2.0s).
    """
    cfg = CONFIG.turn_taking
    is_complete = check_semantic_completeness_heuristic(transcript)

    # Determine if speaker is in an active thinking state
    is_thinking = False
    if words and len(words) > 0:
        last_word = words[-1]
        # Recent filler word
        if last_word.is_filler:
            is_thinking = True
        # Recent prolonged gap between last two words (>1.2s)
        if len(words) > 1:
            recent_gap = last_word.start - words[-2].end
            if recent_gap > 1.2:
                is_thinking = True

    if not is_complete and (is_thinking or len(words) < 8):
        timeout = cfg.extended_silence_timeout_s
        reason = "Extended silence timeout: speaker pause/continuation indicates active thought formulation."
    elif is_complete and not is_thinking:
        timeout = cfg.quick_silence_timeout_s
        reason = "Quick silence timeout: candidate answer exhibits terminal syntactic and semantic completeness."
    else:
        timeout = cfg.base_silence_timeout_s
        reason = "Standard baseline silence timeout applied."

    return TurnTakingDecision(
        adaptive_silence_timeout_s=timeout,
        reason=reason,
        is_semantically_complete=is_complete,
        is_thinking_state=is_thinking
    )

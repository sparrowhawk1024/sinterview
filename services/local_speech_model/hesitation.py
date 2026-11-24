"""
Delivery Hesitation Index and Hesitation-to-Concept Targeting Module
====================================================================
Implements:
1. Delivery Hesitation Index:
   - 0.0 to 1.0 composite acoustic delivery observable derived from pause frequency,
     long-pause ratio, and filler-word rate.
   - Explicitly documented and labeled as a DELIVERY SIGNAL, not psychological confidence.
   - Outputs the exact formula, input components, and normalized values.

3. Hesitation-to-Concept Targeting:
   - Identifies hesitation windows (pause clusters, filler bursts, local rate drops) from word timestamps.
   - Extracts technical concept spans from candidate transcript with word index ranges.
   - Maps hesitation windows to concept spans by word index overlap.
   - Computes per-concept hesitation load combined with rubric deficiency.
   - Identifies and logs the top concept to target in the next-turn follow-up question.
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


class HesitationIndexResult(BaseModel):
    hesitation_index: float
    signal_type: str = "delivery signal (observable acoustic/timing metric, not psychological confidence)"
    formula: str
    inputs: Dict[str, Any]
    interpretation: str


class HesitationWindow(BaseModel):
    window_id: str
    start_word_idx: int
    end_word_idx: int
    start_time_s: float
    end_time_s: float
    trigger_type: str  # "pause_cluster" | "filler_burst" | "rate_drop"
    severity: float    # 0.0 to 1.0


class ConceptSpan(BaseModel):
    concept: str
    start_word_idx: int
    end_word_idx: int
    matched_text: str


class TargetedConceptResult(BaseModel):
    target_concept: Optional[str] = None
    target_concept_span: Optional[Tuple[int, int]] = None
    hesitation_load: float = 0.0
    rubric_gap: float = 0.0
    priority_score: float = 0.0
    selection_reason: str = "No significant hesitation or concept detected"
    all_concept_loads: Dict[str, float] = Field(default_factory=dict)
    hesitation_windows_count: int = 0


def compute_delivery_hesitation_index(
    words: List[WordFeature],
    duration_s: float,
    pause_threshold_s: Optional[float] = None,
    long_pause_threshold_s: Optional[float] = None
) -> HesitationIndexResult:
    """
    Computes 0-1 Delivery Hesitation Index strictly from observable temporal and lexical features.
    """
    cfg = CONFIG.hesitation
    p_thresh = pause_threshold_s or cfg.pause_threshold_s
    lp_thresh = long_pause_threshold_s or cfg.long_pause_threshold_s

    total_words = len([w for w in words if not w.is_filler or w.source == "asr"])
    filler_count = sum(1 for w in words if w.is_filler)
    duration_min = max(0.05, duration_s / 60.0)

    # Detect inter-word pauses from word timestamps
    pauses: List[float] = []
    for i in range(len(words) - 1):
        gap = words[i + 1].start - words[i].end
        if gap >= p_thresh:
            pauses.append(gap)

    pause_count = len(pauses)
    long_pause_count = sum(1 for p in pauses if p >= lp_thresh)

    # Component metrics
    pause_freq_per_min = pause_count / duration_min
    pause_freq_norm = min(1.0, pause_freq_per_min / cfg.max_normal_pause_freq_per_min)

    long_pause_ratio = (long_pause_count / max(1, pause_count)) if pause_count > 0 else 0.0

    filler_rate = (filler_count / max(1, total_words + filler_count)) if (total_words + filler_count) > 0 else 0.0
    filler_rate_norm = min(1.0, filler_rate / cfg.max_normal_filler_rate)

    # Weighted formulation
    w_pf = cfg.pause_frequency_weight
    w_lp = cfg.long_pause_ratio_weight
    w_fr = cfg.filler_rate_weight

    score = (w_pf * pause_freq_norm) + (w_lp * long_pause_ratio) + (w_fr * filler_rate_norm)
    hesitation_index = float(round(np.clip(score, 0.0, 1.0), 3))

    interpretation = (
        "low delivery hesitation" if hesitation_index < 0.35
        else "moderate delivery hesitation" if hesitation_index < 0.65
        else "high delivery hesitation"
    )

    formula_str = (
        f"{w_pf:.2f} * pause_freq_norm({pause_freq_norm:.2f}) + "
        f"{w_lp:.2f} * long_pause_ratio({long_pause_ratio:.2f}) + "
        f"{w_fr:.2f} * filler_rate_norm({filler_rate_norm:.2f})"
    )

    inputs_dict = {
        "duration_seconds": round(duration_s, 2),
        "total_words": total_words,
        "pause_count": pause_count,
        "pause_frequency_per_min": round(pause_freq_per_min, 2),
        "pause_freq_norm": round(pause_freq_norm, 3),
        "long_pause_count": long_pause_count,
        "long_pause_ratio": round(long_pause_ratio, 3),
        "filler_count": filler_count,
        "filler_rate": round(filler_rate, 4),
        "filler_rate_norm": round(filler_rate_norm, 3),
    }

    return HesitationIndexResult(
        hesitation_index=hesitation_index,
        signal_type="delivery signal (observable acoustic/timing metric, not psychological confidence)",
        formula=formula_str,
        inputs=inputs_dict,
        interpretation=interpretation
    )


def detect_hesitation_windows(words: List[WordFeature]) -> List[HesitationWindow]:
    """
    Scans word feature sequence to detect localized hesitation windows:
    - Large pause gaps between words
    - Filler word occurrences or bursts
    - Unusually prolonged word durations (rate drops)
    """
    cfg = CONFIG.concept_targeting
    radius = cfg.window_word_radius
    windows: List[HesitationWindow] = []

    if not words:
        return windows

    durations = [w.end - w.start for w in words if w.end > w.start]
    median_dur = float(np.median(durations)) if durations else 0.3

    for i in range(len(words)):
        w = words[i]
        trigger = None
        severity = 0.0

        # 1. Filler burst trigger
        if w.is_filler:
            trigger = "filler_burst"
            severity = 0.6
            # Higher severity if two consecutive fillers
            if (i > 0 and words[i - 1].is_filler) or (i < len(words) - 1 and words[i + 1].is_filler):
                severity = 0.9

        # 2. Prolonged pause trigger after word
        if i < len(words) - 1:
            gap = words[i + 1].start - w.end
            if gap >= cfg.pause_trigger_threshold_s:
                if severity < 0.8:
                    trigger = "pause_cluster"
                    severity = min(1.0, 0.5 + (gap / 3.0))

        # 3. Rate drop (prolonged single word duration > 2.5x median)
        word_dur = w.end - w.start
        if word_dur > max(0.8, 2.5 * median_dur) and not w.is_filler:
            if severity < 0.5:
                trigger = "rate_drop"
                severity = min(0.8, 0.4 + (word_dur / 2.0))

        if trigger:
            start_idx = max(0, i - radius)
            end_idx = min(len(words) - 1, i + radius)
            win_id = f"win_{start_idx}_{end_idx}_{trigger}"
            windows.append(
                HesitationWindow(
                    window_id=win_id,
                    start_word_idx=start_idx,
                    end_word_idx=end_idx,
                    start_time_s=words[start_idx].start,
                    end_time_s=words[end_idx].end,
                    trigger_type=trigger,
                    severity=round(severity, 2)
                )
            )

    return windows


# Common technical interview stop words that should not be extracted as isolated concepts
STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "with", "about", "against", "between", "into", "through", "during",
    "before", "after", "above", "below", "from", "up", "down", "of",
    "off", "over", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "can", "will",
    "just", "don", "should", "now", "i", "we", "you", "my", "our", "it",
    "is", "was", "are", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "use", "used", "using", "work", "worked", "working",
    "think", "well", "like", "actually", "basically", "so", "yeah", "yes", "no"
}


def extract_concept_spans(words: List[WordFeature]) -> List[ConceptSpan]:
    """
    Extracts multi-word and technical candidate concept spans with start/end word indexes.
    Captures bigrams, trigrams, and key content nouns/adjectives.
    """
    spans: List[ConceptSpan] = []
    n = len(words)
    if n == 0:
        return spans

    clean_words = [re.sub(r"[^\w']", "", w.text.lower()) for w in words]

    # 1. Multi-word technical spans (bigrams and trigrams)
    for length in (3, 2):
        for i in range(n - length + 1):
            gram = clean_words[i:i + length]
            # Avoid spans starting or ending with stop words or fillers
            if gram[0] in STOP_WORDS or gram[-1] in STOP_WORDS:
                continue
            if any(words[j].is_filler for j in range(i, i + length)):
                continue
            phrase = " ".join(gram)
            # Accept if at least one word is substantive (>3 chars)
            if any(len(w) > 3 for w in gram):
                spans.append(
                    ConceptSpan(
                        concept=phrase,
                        start_word_idx=i,
                        end_word_idx=i + length - 1,
                        matched_text=" ".join(words[j].text for j in range(i, i + length))
                    )
                )

    # 2. Distinctive single-word technical nouns / identifiers (>4 chars, non-stopwords)
    for i, w in enumerate(words):
        clean = clean_words[i]
        if len(clean) > 4 and clean not in STOP_WORDS and not w.is_filler:
            # Avoid duplicating an existing span
            if not any(s.start_word_idx <= i <= s.end_word_idx for s in spans):
                spans.append(
                    ConceptSpan(
                        concept=clean,
                        start_word_idx=i,
                        end_word_idx=i,
                        matched_text=w.text
                    )
                )

    return spans


def map_hesitation_to_concepts(
    words: List[WordFeature],
    rubric_scores: Optional[Dict[str, Any]] = None
) -> TargetedConceptResult:
    """
    Main contribution:
    1. Detects hesitation windows across the word feature stream.
    2. Extracts candidate concept spans with word index boundaries.
    3. Calculates overlap/proximity between hesitation windows and concepts.
    4. Computes combined hesitation load + rubric deficiency priority.
    5. Selects top concept and logs rationale.
    """
    cfg = CONFIG.concept_targeting
    windows = detect_hesitation_windows(words)
    spans = extract_concept_spans(words)

    if not spans:
        return TargetedConceptResult(
            target_concept=None,
            selection_reason="No distinct technical concept spans identified in candidate answer.",
            hesitation_windows_count=len(windows)
        )

    # Calculate hesitation load per concept
    concept_loads: Dict[str, float] = {s.concept: 0.0 for s in spans}
    concept_spans_map: Dict[str, Tuple[int, int]] = {s.concept: (s.start_word_idx, s.end_word_idx) for s in spans}

    for span in spans:
        for win in windows:
            # Check overlap or adjacency (within 2 words)
            overlap = not (win.end_word_idx < span.start_word_idx - 2 or win.start_word_idx > span.end_word_idx + 2)
            if overlap:
                # Direct intersection gets full severity; proximity gets 0.6x
                direct_intersection = not (win.end_word_idx < span.start_word_idx or win.start_word_idx > span.end_word_idx)
                weight = 1.0 if direct_intersection else 0.6
                concept_loads[span.concept] += win.severity * weight

    # Average technical depth / clarity score to assess rubric gap
    tech_depth = 3.5
    if rubric_scores and "technical_depth" in rubric_scores:
        val = rubric_scores["technical_depth"].get("score", 3.5) if isinstance(rubric_scores["technical_depth"], dict) else 3.5
        tech_depth = float(val)

    rubric_deficiency = max(0.0, (5.0 - tech_depth) / 4.0)  # Normalized 0.0 to 1.0

    # Score each concept
    max_load = max(concept_loads.values()) if concept_loads and max(concept_loads.values()) > 0 else 1.0
    scored_candidates = []

    for concept, raw_load in concept_loads.items():
        norm_load = raw_load / max_load if max_load > 0 else 0.0
        priority = (cfg.hesitation_weight * norm_load) + (cfg.rubric_gap_weight * rubric_deficiency)
        scored_candidates.append({
            "concept": concept,
            "span": concept_spans_map[concept],
            "load": round(raw_load, 2),
            "priority": round(priority, 3),
        })

    # Sort descending by priority, then load
    scored_candidates.sort(key=lambda x: (x["priority"], x["load"]), reverse=True)
    top = scored_candidates[0]

    if top["load"] > 0.0:
        reason = (
            f"Concept '{top['concept']}' mapped to hesitation window (load: {top['load']:.2f}, "
            f"rubric deficiency: {rubric_deficiency:.2f}, priority: {top['priority']:.3f})"
        )
    else:
        reason = (
            f"No direct hesitation overlap; concept '{top['concept']}' selected based on technical prominence and depth rubric."
        )

    print(f"[ConceptTargeting] Selected '{top['concept']}' | Priority: {top['priority']} | Windows: {len(windows)}")

    return TargetedConceptResult(
        target_concept=top["concept"],
        target_concept_span=top["span"],
        hesitation_load=top["load"],
        rubric_gap=round(rubric_deficiency, 3),
        priority_score=top["priority"],
        selection_reason=reason,
        all_concept_loads={c["concept"]: c["load"] for c in scored_candidates[:5]},
        hesitation_windows_count=len(windows)
    )

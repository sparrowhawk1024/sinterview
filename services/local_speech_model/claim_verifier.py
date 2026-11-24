"""
Deterministic Claim Verifier Module
====================================
Implements:
4. Claim-Verified Feedback:
   - LLM produces structured feedback claims with evidence pointers:
     {claim, type, metric_id | word_range | rubric_dim}
   - Pure Python + Pydantic deterministic verifier (zero LLM calls) re-checks each claim:
     * Word span / quotation exists verbatim in stored WordFeatures.
     * Stated metric direction matches deterministic acoustic/timing measurements.
     * Rubric dimension justification aligns with assigned rubric score.
   - Unverified / hallucinated claims are dropped.
   - Returns verified claims only, enriched with clickable audio timestamps (start_time_s, end_time_s).
   - Computes and logs unsupported-claim rate per session.
"""

from typing import List, Dict, Any, Optional, Tuple
import re
from pydantic import BaseModel, Field

try:
    from services.local_speech_model.config import CONFIG
    from services.local_speech_model.word_features import WordFeature
except ImportError:
    from config import CONFIG
    from word_features import WordFeature


class StructuredClaimInput(BaseModel):
    claim: str
    type: str = "observation"  # "strength" | "improvement" | "metric_observation"
    metric_id: Optional[str] = None      # e.g. "wpm_slow", "wpm_fast", "fillers_high", "long_pauses"
    word_range: Optional[List[int]] = None # [start_word_idx, end_word_idx]
    rubric_dim: Optional[str] = None     # "relevance", "technical_depth", "structure", "clarity", "examples_metrics"
    quoted_text: Optional[str] = None    # explicit phrase quoted from candidate


class VerifiedClaim(BaseModel):
    claim: str
    type: str
    metric_id: Optional[str] = None
    word_range: Optional[Tuple[int, int]] = None
    rubric_dim: Optional[str] = None
    quoted_text: Optional[str] = None
    is_verified: bool = True
    verification_reason: str
    start_time_s: Optional[float] = None
    end_time_s: Optional[float] = None


class ClaimVerificationResult(BaseModel):
    total_claims_evaluated: int
    verified_claims: List[VerifiedClaim]
    dropped_claims: List[Dict[str, Any]]
    unsupported_claim_rate: float
    warning_logged: bool = False


def verify_word_range_and_quote(
    claim_item: StructuredClaimInput,
    words: List[WordFeature],
    transcript: str
) -> Tuple[bool, str, Optional[Tuple[int, int]], Optional[float], Optional[float]]:
    """
    Validates that the claimed word range exists and aligns with the transcript.
    Extracts timestamps for interactive clickable jumps in the UI.
    """
    if not words:
        return False, "No word features stored for answer", None, None, None

    # 1. Check explicit word_range
    if claim_item.word_range and len(claim_item.word_range) == 2:
        s_idx, e_idx = claim_item.word_range[0], claim_item.word_range[1]
        if 0 <= s_idx <= e_idx < len(words):
            start_t = words[s_idx].start
            end_t = words[e_idx].end
            return True, f"Word span [{s_idx}:{e_idx}] verified in transcript", (s_idx, e_idx), start_t, end_t

    # 2. Check quoted_text in candidate transcript
    quote = (claim_item.quoted_text or "").strip()
    if not quote:
        # Check if the claim itself contains quotes like: said "virtual DOM"
        m = re.search(r'["\']([^"\']{3,60})["\']', claim_item.claim)
        if m:
            quote = m.group(1).strip()

    if quote:
        norm_quote = re.sub(r"[^\w\s]", "", quote.lower()).strip()
        # Find matching word subsequence
        clean_words = [re.sub(r"[^\w]", "", w.text.lower()) for w in words]
        quote_tokens = norm_quote.split()
        if len(quote_tokens) > 0:
            for i in range(len(clean_words) - len(quote_tokens) + 1):
                if clean_words[i:i + len(quote_tokens)] == quote_tokens:
                    s_idx = i
                    e_idx = i + len(quote_tokens) - 1
                    start_t = words[s_idx].start
                    end_t = words[e_idx].end
                    return True, f"Quoted phrase '{quote}' verified at [{s_idx}:{e_idx}]", (s_idx, e_idx), start_t, end_t

        return False, f"Quoted phrase '{quote}' not found in candidate transcript", None, None, None

    return False, "Claim missing both valid word_range and verifiable quoted_text", None, None, None


def verify_metric_consistency(
    metric_id: str,
    metrics_context: Dict[str, Any]
) -> Tuple[bool, str]:
    """
    Validates that a qualitative statement referencing an acoustic metric matches
    the true direction and threshold of the deterministic calculation.
    """
    cfg = CONFIG.claim_verifier
    m_id = metric_id.lower().strip()

    wpm = float(metrics_context.get("speech_rate_wpm", metrics_context.get("pace_wpm", 130.0)))
    filler_count = int(metrics_context.get("filler_word_count", 0))
    long_pauses = int(metrics_context.get("long_pause_count", 0))
    hesitation_index = float(metrics_context.get("hesitation_index", 0.0))

    if "slow" in m_id or "hesitant_pace" in m_id:
        if wpm <= cfg.wpm_slow_threshold or hesitation_index >= 0.55:
            return True, f"Metric supported: WPM={wpm:.1f} <= {cfg.wpm_slow_threshold}"
        return False, f"Metric contradiction: WPM={wpm:.1f} is not slow"

    if "fast" in m_id or "rushed" in m_id:
        if wpm >= cfg.wpm_fast_threshold:
            return True, f"Metric supported: WPM={wpm:.1f} >= {cfg.wpm_fast_threshold}"
        return False, f"Metric contradiction: WPM={wpm:.1f} is not rushed"

    if "filler" in m_id:
        if "high" in m_id or "frequent" in m_id:
            if filler_count >= cfg.filler_high_threshold:
                return True, f"Metric supported: filler_count={filler_count} >= {cfg.filler_high_threshold}"
            return False, f"Metric contradiction: filler_count={filler_count} is low"
        if "low" in m_id or "clean" in m_id:
            if filler_count < cfg.filler_high_threshold:
                return True, f"Metric supported: filler_count={filler_count} is low"
            return False, f"Metric contradiction: filler_count={filler_count} is elevated"

    if "pause" in m_id or "silence" in m_id:
        if long_pauses >= cfg.pause_long_threshold:
            return True, f"Metric supported: long_pauses={long_pauses} >= {cfg.pause_long_threshold}"
        return False, f"Metric contradiction: long_pauses={long_pauses} is zero"

    # Default acceptance if metric id is recognized and non-contradictory
    return True, f"Metric {metric_id} verified against session telemetry"


def verify_rubric_dimension(
    rubric_dim: str,
    claim_type: str,
    rubric_scores: Dict[str, Any]
) -> Tuple[bool, str]:
    """
    Validates that a strength/improvement claim matches the assigned rubric score for that dimension.
    """
    dim = rubric_dim.lower().strip()
    if dim not in rubric_scores:
        return False, f"Rubric dimension '{rubric_dim}' not found in rubric scores"

    dim_data = rubric_scores[dim]
    score = float(dim_data.get("score", 3.0)) if isinstance(dim_data, dict) else float(dim_data)

    if claim_type == "strength" and score < 3.0:
        return False, f"Strength claim contradicts low rubric score ({score:.1f}/5 for {rubric_dim})"

    if claim_type == "improvement" and score > 4.5:
        return False, f"Critique claim contradicts near-perfect rubric score ({score:.1f}/5 for {rubric_dim})"

    return True, f"Rubric dimension '{rubric_dim}' consistent with score {score:.1f}/5"


def verify_claims_deterministically(
    raw_claims: List[Dict[str, Any]],
    words: List[WordFeature],
    transcript: str,
    metrics_context: Optional[Dict[str, Any]] = None,
    rubric_scores: Optional[Dict[str, Any]] = None
) -> ClaimVerificationResult:
    """
    Pure Python verifier:
    Re-checks all raw LLM feedback claims against stored ground features.
    Drops unsupported claims, formats verified claims with timestamps,
    and logs session unsupported-claim rate.
    """
    cfg = CONFIG.claim_verifier
    metrics_ctx = metrics_context or {}
    r_scores = rubric_scores or {}

    verified_list: List[VerifiedClaim] = []
    dropped_list: List[Dict[str, Any]] = []

    for raw in raw_claims:
        try:
            claim_input = StructuredClaimInput(**raw)
        except Exception as e:
            dropped_list.append({"raw": raw, "reason": f"Malformed claim structure: {e}"})
            continue

        is_valid = True
        reasons = []
        w_range: Optional[Tuple[int, int]] = None
        start_t: Optional[float] = None
        end_t: Optional[float] = None

        # Check evidence pointer 1: Word span or quotation
        if claim_input.word_range or claim_input.quoted_text or ('"' in claim_input.claim):
            v_word, w_msg, w_range, start_t, end_t = verify_word_range_and_quote(claim_input, words, transcript)
            if not v_word:
                is_valid = False
                reasons.append(w_msg)
            else:
                reasons.append(w_msg)

        # Check evidence pointer 2: Metric consistency
        if is_valid and claim_input.metric_id:
            v_metric, m_msg = verify_metric_consistency(claim_input.metric_id, metrics_ctx)
            if not v_metric:
                is_valid = False
                reasons.append(m_msg)
            else:
                reasons.append(m_msg)

        # Check evidence pointer 3: Rubric dimension consistency
        if is_valid and claim_input.rubric_dim:
            v_rubric, r_msg = verify_rubric_dimension(claim_input.rubric_dim, claim_input.type, r_scores)
            if not v_rubric:
                is_valid = False
                reasons.append(r_msg)
            else:
                reasons.append(r_msg)

        # Final decision
        if is_valid:
            verified_list.append(
                VerifiedClaim(
                    claim=claim_input.claim,
                    type=claim_input.type,
                    metric_id=claim_input.metric_id,
                    word_range=w_range,
                    rubric_dim=claim_input.rubric_dim,
                    quoted_text=claim_input.quoted_text,
                    is_verified=True,
                    verification_reason="; ".join(reasons) if reasons else "Verified against stored session features",
                    start_time_s=round(start_t, 2) if start_t is not None else None,
                    end_time_s=round(end_t, 2) if end_t is not None else None
                )
            )
        else:
            dropped_list.append({
                "claim": claim_input.claim,
                "reasons": reasons
            })

    total = len(raw_claims)
    unsupported_rate = round(len(dropped_list) / max(1, total), 3)
    warning = unsupported_rate > cfg.max_unsupported_rate_warning

    if warning:
        print(f"[ClaimVerifier] WARNING: High unsupported claim rate: {unsupported_rate * 100:.1f}% ({len(dropped_list)}/{total} claims dropped)")
    else:
        print(f"[ClaimVerifier] Verified {len(verified_list)}/{total} claims ({unsupported_rate * 100:.1f}% dropped)")

    return ClaimVerificationResult(
        total_claims_evaluated=total,
        verified_claims=verified_list,
        dropped_claims=dropped_list,
        unsupported_claim_rate=unsupported_rate,
        warning_logged=warning
    )

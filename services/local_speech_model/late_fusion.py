"""
Multimodal Late Fusion Module (services/local_speech_model/late_fusion.py)
==========================================================================
Implements Eq. (7) from the project specification:
    s = sum(alpha_m * q_m * s_m) / sum(alpha_m * q_m)
across:
- Speech (delivery hesitation / acoustic pacing)
- Language (5-dimension structured rubric assessment)
- Visual (camera-based physical indicators via MediaPipe)

Rules:
1. Each modality outputs an interpretable sub-score s_m (1.0 to 5.0 scale) and quality q_m in [0, 1].
2. Config-driven weights alpha_m (Speech: 0.35, Language: 0.45, Visual: 0.20).
3. Quality gating: if sum(alpha_m * q_m) < min_total_quality (0.40), produce NO fused score.
4. Transparency: always return individual sub-scores and quality factors alongside the fused score.
5. Ablation testing: supports ablating any single modality (setting alpha_m = 0) and measuring delta.
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

try:
    from services.local_speech_model.config import CONFIG
except ImportError:
    from config import CONFIG


class ModalityOutput(BaseModel):
    name: str
    sub_score: Optional[float] = None # 1.0 to 5.0 scale (None if quality insufficient)
    quality_q: float = 1.0            # 0.0 to 1.0
    weight_alpha: float               # Configured weight
    is_available: bool = True
    alert: Optional[str] = None


class LateFusionResult(BaseModel):
    fused_score: Optional[float] = None
    scale: str = "1.0 to 5.0 scale"
    formula: str = "s = sum(alpha_m * q_m * s_m) / sum(alpha_m * q_m)"
    total_effective_quality: float
    min_quality_threshold: float
    status: str  # "success" | "insufficient_quality" | "ablated"
    ablated_modality: Optional[str] = None
    sub_scores: Dict[str, Optional[float]]
    quality_indicators: Dict[str, float]
    weights: Dict[str, float]
    explanation: str


def compute_late_fusion(
    speech_score: Optional[float],
    speech_quality: float,
    language_score: Optional[float],
    language_quality: float,
    visual_score: Optional[float] = None,
    visual_quality: float = 0.0,
    ablate_modality: Optional[str] = None
) -> LateFusionResult:
    """
    Computes quality-weighted late fusion over available modalities according to Eq. (7).
    """
    cfg = CONFIG.late_fusion

    # Retrieve base weights
    alphas = {
        "speech": cfg.alpha_speech,
        "language": cfg.alpha_language,
        "visual": cfg.alpha_visual,
    }

    # Handle ablation if requested
    ablated = None
    if ablate_modality and ablate_modality.lower() in alphas:
        ablated = ablate_modality.lower()
        alphas[ablated] = 0.0

    modalities: Dict[str, ModalityOutput] = {
        "speech": ModalityOutput(
            name="speech",
            sub_score=speech_score,
            quality_q=max(0.0, min(1.0, speech_quality)),
            weight_alpha=alphas["speech"],
            is_available=speech_score is not None and alphas["speech"] > 0
        ),
        "language": ModalityOutput(
            name="language",
            sub_score=language_score,
            quality_q=max(0.0, min(1.0, language_quality)),
            weight_alpha=alphas["language"],
            is_available=language_score is not None and alphas["language"] > 0
        ),
        "visual": ModalityOutput(
            name="visual",
            sub_score=visual_score,
            quality_q=max(0.0, min(1.0, visual_quality)),
            weight_alpha=alphas["visual"],
            is_available=visual_score is not None and alphas["visual"] > 0
        ),
    }

    # Calculate sum(alpha_m * q_m * s_m) and sum(alpha_m * q_m)
    weighted_sum = 0.0
    quality_sum = 0.0

    for name, m in modalities.items():
        if m.is_available and m.sub_score is not None:
            eff_weight = m.weight_alpha * m.quality_q
            weighted_sum += eff_weight * m.sub_score
            quality_sum += eff_weight

    total_effective_quality = round(quality_sum, 3)

    sub_scores_dict = {name: m.sub_score for name, m in modalities.items()}
    quality_dict = {name: round(m.quality_q, 3) for name, m in modalities.items()}
    weights_dict = {name: m.weight_alpha for name, m in modalities.items()}

    # Quality Gate Check
    if total_effective_quality < cfg.min_total_quality or quality_sum <= 0.0:
        return LateFusionResult(
            fused_score=None,
            total_effective_quality=total_effective_quality,
            min_quality_threshold=cfg.min_total_quality,
            status="insufficient_quality",
            ablated_modality=ablated,
            sub_scores=sub_scores_dict,
            quality_indicators=quality_dict,
            weights=weights_dict,
            explanation=(
                f"Total effective quality ({total_effective_quality:.2f}) is below minimum threshold "
                f"({cfg.min_total_quality:.2f}). System abstains from producing a composite score."
            )
        )

    fused_score = round(weighted_sum / quality_sum, 2)
    status_label = f"ablated_{ablated}" if ablated else "success"

    explanation = (
        f"Fused score {fused_score:.2f}/5.0 computed via Eq. (7) with total quality {total_effective_quality:.2f}. "
        f"Sub-scores: Speech={sub_scores_dict['speech']}, Language={sub_scores_dict['language']}, Visual={sub_scores_dict['visual']}."
    )

    return LateFusionResult(
        fused_score=fused_score,
        total_effective_quality=total_effective_quality,
        min_quality_threshold=cfg.min_total_quality,
        status=status_label,
        ablated_modality=ablated,
        sub_scores=sub_scores_dict,
        quality_indicators=quality_dict,
        weights=weights_dict,
        explanation=explanation
    )

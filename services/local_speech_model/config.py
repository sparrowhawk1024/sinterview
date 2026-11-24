"""
Synterview Config-Driven Thresholds and Parameters
=================================================
Central configuration file for all deterministic speech analysis,
hesitation modeling, speaker baselining, turn-taking, concept targeting,
claim verification, disfluency recovery, and quality gating.

All thresholds are config-driven and centralized here.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Tuple


class QualityGateConfig(BaseModel):
    """Quality gate thresholds to prevent fabricated metrics on degraded audio/ASR."""
    min_snr_db: float = Field(default=8.0, description="Minimum Signal-to-Noise Ratio (dB) required for acoustic delivery metrics.")
    min_audio_duration_s: float = Field(default=1.5, description="Minimum audio duration in seconds required for acoustic analysis.")
    min_voiced_ratio: float = Field(default=0.08, description="Minimum fraction of voiced audio required.")
    min_asr_confidence: float = Field(default=0.50, description="Minimum ASR word confidence before gating metrics as 'insufficient evidence'.")
    insufficient_evidence_label: str = Field(default="insufficient evidence", description="Explicit label returned when quality gate triggers.")


class HesitationIndexConfig(BaseModel):
    """
    Delivery Hesitation Index Configuration.
    Inspired by acoustic delivery modeling (US 10339923).
    Strictly labelled as a delivery signal, NOT psychological confidence.
    """
    pause_frequency_weight: float = Field(default=0.40, description="Weight for pause frequency (pauses per minute).")
    long_pause_ratio_weight: float = Field(default=0.35, description="Weight for long pause ratio (long pauses / total pauses).")
    filler_rate_weight: float = Field(default=0.25, description="Weight for filler word rate (filler words / total words).")
    pause_threshold_s: float = Field(default=0.50, description="Silence threshold in seconds to register a pause event (tau).")
    long_pause_threshold_s: float = Field(default=1.20, description="Silence threshold in seconds to classify a pause as a 'long pause'.")
    max_normal_pause_freq_per_min: float = Field(default=12.0, description="Normalizing ceiling for pause frequency per minute.")
    max_normal_filler_rate: float = Field(default=0.10, description="Normalizing ceiling for filler rate (10%).")


class SpeakerBaselineConfig(BaseModel):
    """
    Speaker Baseline Configuration.
    Inspired by candidate-specific baseline adaptation (CN 121212135 B).
    Uses warm-up response to normalize subsequent speech rate and pause metrics.
    """
    warmup_question_index: int = Field(default=0, description="0-based index of warm-up question used for baseline.")
    min_words_for_baseline: int = Field(default=10, description="Minimum word count in warm-up answer to establish a valid baseline.")
    z_score_deviation_threshold: float = Field(default=1.50, description="Z-score deviation threshold to trigger fast/slow/hesitant flags.")
    default_wpm_mean: float = Field(default=135.0, description="Fallback population mean speech rate in WPM if baseline unavailable.")
    default_wpm_std: float = Field(default=22.0, description="Fallback population std speech rate in WPM if baseline unavailable.")
    default_pause_mean_s: float = Field(default=0.65, description="Fallback population mean pause duration in seconds.")
    default_pause_std_s: float = Field(default=0.30, description="Fallback population std pause duration in seconds.")


class TurnTakingConfig(BaseModel):
    """
    Adaptive Turn-Taking Configuration.
    Adjusts end-of-turn silence timeout based on baseline pause pattern and semantic completeness.
    """
    base_silence_timeout_s: float = Field(default=2.0, description="Standard silence duration in seconds before taking turn.")
    extended_silence_timeout_s: float = Field(default=3.8, description="Extended silence timeout when speaker is in a thinking/hesitant state.")
    quick_silence_timeout_s: float = Field(default=1.3, description="Quick silence timeout when response exhibits terminal sentence completeness.")
    sentence_terminal_punctuation: Tuple[str, ...] = ('.', '?', '!')
    continuation_conjunctions: Tuple[str, ...] = (
        'and', 'or', 'but', 'because', 'so', 'although', 'though',
        'while', 'whereas', 'which', 'that', 'if', 'since', 'as'
    )


class HesitationToConceptConfig(BaseModel):
    """
    Hesitation-to-Concept Targeting Configuration.
    Maps acoustic/lexical hesitation windows to key technical concepts for targeted follow-up.
    """
    window_word_radius: int = Field(default=3, description="Radius in words surrounding a hesitation trigger (pause or filler) to define window.")
    pause_trigger_threshold_s: float = Field(default=1.0, description="Pause duration in seconds that triggers a hesitation window.")
    hesitation_weight: float = Field(default=0.60, description="Weight of hesitation density when ranking target concepts.")
    rubric_gap_weight: float = Field(default=0.40, description="Weight of rubric deficiency when ranking target concepts.")


class ClaimVerifierConfig(BaseModel):
    """
    Deterministic Claim Verification Configuration.
    Re-checks LLM qualitative statements against extracted features without LLM calls.
    """
    max_unsupported_rate_warning: float = Field(default=0.33, description="Threshold above which session logs a high unsupported-claim warning.")
    wpm_slow_threshold: float = Field(default=105.0, description="WPM below which 'slow delivery' or 'hesitant pace' claim is supported.")
    wpm_fast_threshold: float = Field(default=170.0, description="WPM above which 'rushed delivery' claim is supported.")
    filler_high_threshold: int = Field(default=3, description="Filler count at or above which 'frequent fillers' claim is supported.")
    pause_long_threshold: int = Field(default=1, description="Long pause count at or above which 'hesitation/pause' claim is supported.")


class DisfluencyRecoveryConfig(BaseModel):
    """
    Librosa-Based Acoustic Filled-Pause Detection Configuration.
    Detects voiced, steady-pitch, low-spectral-flux disfluencies (e.g. 'uh', 'um') dropped by Whisper.
    """
    min_duration_s: float = Field(default=0.18, description="Minimum duration (180ms) for an acoustic filled pause.")
    max_duration_s: float = Field(default=0.85, description="Maximum duration (850ms) for an acoustic filled pause.")
    pitch_fmin_hz: float = Field(default=75.0, description="Minimum expected fundamental frequency for voice.")
    pitch_fmax_hz: float = Field(default=340.0, description="Maximum expected fundamental frequency for voice.")
    max_pitch_semitone_std: float = Field(default=1.40, description="Maximum pitch variation (semitones) for a monotone filled pause.")
    max_spectral_flux: float = Field(default=0.22, description="Maximum normalized spectral flux / change across frames.")
    confidence_score: float = Field(default=0.85, description="Confidence assigned to acoustically recovered filler.")


class VisualTelemetryConfig(BaseModel):
    """
    Client-Side Visual Telemetry Configuration (MediaPipe).
    Operates strictly on camera-based physical observables (never psychological attention/confidence).
    """
    min_quality_qv: float = Field(default=0.50, description="Minimum visual quality indicator q_v required to compute score.")
    min_face_in_frame_ratio: float = Field(default=0.60, description="Minimum proportion of frames where face is detected.")
    gaze_frontal_tolerance: float = Field(default=0.35, description="Ratio threshold to classify gaze towards camera proxy.")
    fps_sample_rate: float = Field(default=5.0, description="Webcam sampling rate in frames per second.")
    indicator_label: str = Field(default="camera-based indicator", description="Mandatory objective label for visual metrics.")


class LateFusionConfig(BaseModel):
    """
    Multimodal Late Fusion Configuration (Eq. 7):
    s = sum(alpha_m * q_m * s_m) / sum(alpha_m * q_m) over speech, language, and visual.
    """
    alpha_speech: float = Field(default=0.35, description="Fusion weight for speech delivery modality.")
    alpha_language: float = Field(default=0.45, description="Fusion weight for language rubric evaluation modality.")
    alpha_visual: float = Field(default=0.20, description="Fusion weight for visual camera-based observable modality.")
    min_total_quality: float = Field(default=0.40, description="Minimum composite quality sum(alpha_m * q_m) required to produce a fused score.")


class DatasetToolingConfig(BaseModel):
    """Configuration for Evaluation Harness and Dataset Manifest Ingestion."""
    min_accent_samples: int = Field(default=3, description="Minimum samples in accent group to report group-level metrics.")
    bootstrap_iterations: int = Field(default=1000, description="Number of bootstrap resamples for 95% confidence intervals.")
    confidence_level: float = Field(default=0.95, description="Confidence level for bootstrap intervals.")
    small_sample_warning_threshold: int = Field(default=5, description="Threshold below which small-sample warning is printed.")


class SynterviewConfig(BaseModel):
    quality_gate: QualityGateConfig = Field(default_factory=QualityGateConfig)
    hesitation: HesitationIndexConfig = Field(default_factory=HesitationIndexConfig)
    baseline: SpeakerBaselineConfig = Field(default_factory=SpeakerBaselineConfig)
    turn_taking: TurnTakingConfig = Field(default_factory=TurnTakingConfig)
    concept_targeting: HesitationToConceptConfig = Field(default_factory=HesitationToConceptConfig)
    claim_verifier: ClaimVerifierConfig = Field(default_factory=ClaimVerifierConfig)
    disfluency_recovery: DisfluencyRecoveryConfig = Field(default_factory=DisfluencyRecoveryConfig)
    visual: VisualTelemetryConfig = Field(default_factory=VisualTelemetryConfig)
    late_fusion: LateFusionConfig = Field(default_factory=LateFusionConfig)
    dataset: DatasetToolingConfig = Field(default_factory=DatasetToolingConfig)


# Global singleton instance
CONFIG = SynterviewConfig()

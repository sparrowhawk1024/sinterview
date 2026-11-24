export interface Participant {
  id: string;
  name: string;
  role: "interviewer" | "candidate";
  initials: string;
  avatarColor: string; // Tailwind bg color class
  isMuted: boolean;
  isCameraOn: boolean;
}

export type QuestionStatus = "pending" | "answered" | "skipped";

export interface ModelToneAnalysis {
  confidence_score: number;
  pace_wpm: number;
  clarity_score: number;
  tone_emotion: string;
  filler_word_count: number;
  filler_words: string[];
  feedback_notes: string[];

  // Phase 4 Acoustic & Explainability metrics
  delivery_score?: number;
  delivery_reasons?: string[];
  clarity_reasons?: string[];
  analysis_label?: "Acoustic + text analysis" | "Text-only analysis" | string;
  reliability?: "high" | "low";
  reliability_reasons?: string[];
  pitch_std_semitones?: number;
  pitch_range_semitones?: number;
  pitch_median_hz?: number;
  pitch_method?: "librosa_pyin" | "numpy_autocorrelation" | "none" | string;
  pause_ratio?: number;
  longest_pause_s?: number;
  long_pause_count?: number;
  voiced_duration_seconds?: number;
  speech_rate_wpm?: number;
  trailing_off_delta_db?: number;
  is_trailing_off?: boolean;
  sources?: Record<string, "acoustic" | "text">;

  // Hesitation, Baseline, and Concept Targeting Metrics
  hesitation_index?: number;
  hesitation_interpretation?: string;
  hesitation_formula?: string;
  hesitation_inputs?: Record<string, any>;
  target_concept?: string;
  target_concept_reason?: string;
  speaker_baseline_calibrated?: boolean;
  normalized_pace_flag?: string;
  normalized_pause_flag?: string;
  adaptive_silence_timeout_s?: number;
  word_features?: WordFeature[];
  quality_gate_passed?: boolean;
  quality_gate_reason?: string;
  verified_claims?: VerifiedClaim[];
  unsupported_claim_rate?: number;
}

export interface WordFeature {
  idx: number;
  text: string;
  start: number;
  end: number;
  asr_conf?: number;
  is_filler: boolean;
  source: "asr" | "acoustic";
}

export interface VerifiedClaim {
  claim: string;
  type: string;
  metric_id?: string;
  word_range?: [number, number];
  rubric_dim?: string;
  quoted_text?: string;
  is_verified: boolean;
  verification_reason?: string;
  start_time_s?: number;
  end_time_s?: number;
}

export interface RubricDimensionScore {
  score: number;
  justification: string;
}

export interface QuotedFeedbackItem {
  feedback: string;
  quote?: string;
  has_quote?: boolean;
}

export interface ModelEvaluationResult {
  question_id?: string;
  score?: number | null;            // 1.0 to 10.0 scale (or null if unavailable)
  overall_score?: number | null;    // 1.0 to 5.0 scale (or null if unavailable)
  grade: string;
  tone_analysis: ModelToneAnalysis;
  model_summary: string;
  strengths: string[];
  improvements: string[];
  rubric?: Record<string, RubricDimensionScore>;
  quoted_strengths?: QuotedFeedbackItem[];
  quoted_improvements?: QuotedFeedbackItem[];
  evaluation_status?: "success" | "unavailable" | "skipped" | string;
  evaluation_unavailable?: boolean;
  target_concept?: string;
  target_concept_reason?: string;
  verified_claims?: VerifiedClaim[];
  unsupported_claim_rate?: number;
  visual_telemetry?: Record<string, any> | null;
  late_fusion?: {
    fused_score?: number | null;
    scale?: string;
    total_effective_quality: number;
    min_quality_threshold: number;
    status: string;
    sub_scores: Record<string, number | null>;
    quality_indicators: Record<string, number>;
    weights: Record<string, number>;
    explanation: string;
  } | null;
}

export interface InterviewReportSummary {
  session_id: string;
  candidate_name: string;
  role: string;
  overall_score: number | null;
  grade: string;
  verdict: string;
  overall_summary: string;
  radar_data: Record<string, number>;
  acoustic_summary: {
    avg_speech_rate_wpm: number;
    avg_pause_ratio: number;
    avg_pitch_std_semitones: number;
    total_filler_words: number;
    has_acoustic_data: boolean;
  };
  visual_summary?: {
    camera_enabled: boolean;
    face_in_frame_ratio: number;
    average_posture_score: number | null;
    average_eye_contact_score: number | null;
    posture_interpretation: string;
    eye_contact_interpretation: string;
    visual_quality_qv: number;
    is_valid: boolean;
    status_label: string;
    head_yaw_mean?: number;
    head_pitch_mean?: number;
    head_roll_mean?: number;
    movement_energy?: number;
  } | null;
  top_strengths: QuotedFeedbackItem[];
  top_improvements: QuotedFeedbackItem[];
  practice_next: string[];
  questions_count: number;
  answered_count: number;
  evaluation_unavailable: boolean;
  sources: Record<string, string>;
}

export interface PersistedInterviewSession {
  id: string;
  createdAt: string;
  title: string;
  role: string;
  candidate: Participant;
  interviewer?: Participant;
  questions: InterviewQuestion[];
  report: InterviewReportSummary;
  recordingDuration: number;
  saveAudioForTraining: boolean;
  participant_id?: string; // Pseudonymised identifier, e.g. "P001"
  session_index?: "baseline" | "practice_1" | "practice_2" | "post" | string;
  overallScore: number | null;
  averagePace: number;
  averageFillers: number;
  averagePauseRatio: number;
}

export type InterviewerPersona = "friendly" | "neutral" | "tough";

export interface InterviewQuestion {
  id: string;
  number: number;
  text: string;
  category?: string;
  difficulty?: string;
  idealAnswerPoints?: string[];
  candidateAnswer?: string; // Short mock answer text shown in preview
  status: QuestionStatus;
  isSelected: boolean;
  aiEvaluation?: ModelEvaluationResult;
  isFollowUp?: boolean;
  parentQuestionId?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string; // e.g. "00:04:32"
  label: string;
  type: "question" | "note" | "highlight";
}

export interface MeetingNote {
  id: string;
  date: string;
  category: string;
  participants: string[];
  aiSummary: string;
}

export interface InterviewSession {
  id: string;
  title: string;
  subtitle: string;
  isLive: boolean;
  isRecording: boolean;
  recordingDuration: number; // seconds
  interviewer: Participant;
  candidate: Participant;
  questions: InterviewQuestion[];
  timeline: TimelineEvent[];
  meetingNote: MeetingNote;
  persona?: InterviewerPersona;
  participant_id?: string;
  session_index?: "baseline" | "practice_1" | "practice_2" | "post" | string;
}

export interface NextTurnHistoryItem {
  question: string;
  answer: string;
}

export interface NextTurnRequest {
  role: string;
  difficulty: string;
  persona: InterviewerPersona;
  history: NextTurnHistoryItem[];
  current_question: string;
  candidate_answer: string;
  next_planned_question: string | null;
  questions_remaining: number;
  follow_ups_used_for_this_question: number;
  root_question_id?: string;
}

export interface NextTurnResponse {
  reaction: string;
  next_question: string | null;
  follow_up: boolean;
  degraded?: boolean;
  target_concept?: string;
  target_concept_reason?: string;
}

export interface OllamaStatus {
  online: boolean;
  models: string[];
  defaultModel?: string;
}

export interface OllamaGenerateRequest {
  topic: string;
  role?: string;
  difficulty?: "Junior" | "Mid-Level" | "Senior" | "Lead";
  count?: number;
  model?: string;
}

export interface GeneratedQuestionItem {
  number: number;
  text: string;
  category?: string;
  difficulty?: string;
  candidate_answer_sample?: string;
  ideal_answer_points?: string[];
}

export interface OllamaGenerateResponse {
  success: boolean;
  topic: string;
  model_used: string;
  questions: GeneratedQuestionItem[];
}

export interface CosyVoiceStatus {
  online: boolean;
  serverUrl: string;
  engine: "cosyvoice2" | "web_speech_fallback";
}

export interface CosyVoiceTTSRequest {
  text: string;
  speaker?: string;
  speed?: number;
  server_url?: string;
}

export interface CosyVoiceTTSResponse {
  status: "success" | "fallback" | "error";
  engine: string;
  audio_base64?: string;
  message?: string;
  text: string;
}

/** Thrown when the FastAPI model service (port 8000) is unreachable or returns a non-OK response. */
export class ModelUnavailableError extends Error {
  constructor(message = "Model service is unavailable") {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

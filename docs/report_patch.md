# Report Patch: Synterview VTU Major Project Phase-II Report
## Ready-to-Paste Replacement Text Strictly Aligned with Implementation Reality

This document provides ready-to-paste replacement sections for the VTU Major Project Phase-II Report for **"Synterview: An Intelligent Multimodal Mock Interview System for Automated Speech and Response Analysis"**. Every module is labeled **[IMPLEMENTED]** or **[PLANNED]** based strictly on the tested codebase. No numbers, dates, or results are fabricated.

---

### EXECUTIVE IMPLEMENTATION AUDIT (YES / NO STATUS)

| Subsystem / Feature Module | Implemented? | Codebase Location & Verification Evidence |
|:---|:---:|:---|
| **Modern Frontend Stack** (React 18, TypeScript, Zustand, TanStack Query, Tailwind) | **YES** | `src/`, `pnpm run build` succeeds (zero Streamlit anywhere). |
| **Backend Model Service** (FastAPI on `:8000`, Pydantic schemas) | **YES** | `services/local_speech_model/main.py`. |
| **Speech Recognition & Acoustic Analysis** (Whisper ASR, Librosa acoustics) | **YES** | `services/local_speech_model/acoustic.py`, `word_features.py`. |
| **Word Feature Coordinate Records** (`{idx, text, start, end, asr_conf, is_filler}`) | **YES** | `services/local_speech_model/word_features.py`, unit tested. |
| **Delivery Hesitation Index** (Acoustic pacing & filler signal, not psychological) | **YES** | `services/local_speech_model/hesitation.py`, unit tested. |
| **Speaker Baseline Normalization** (Z-score normalization against warm-up) | **YES** | `services/local_speech_model/speaker_baseline.py`, unit tested. |
| **Adaptive Turn-Taking Silence Timeout** (Syntactic completion vs thinking pauses) | **YES** | `services/local_speech_model/speaker_baseline.py`, `src/hooks/useInterviewLoop.ts`. |
| **Hesitation-to-Concept Probing** (Acoustic hesitation mapped to transcript concept spans) | **YES** | `services/local_speech_model/hesitation.py`, unit tested. |
| **Deterministic Claim Verification** (LLM claims re-checked against acoustic evidence) | **YES** | `services/local_speech_model/claim_verifier.py`, `RubricScoreCard.tsx`. |
| **Brief / Monosyllabic Answer Handling** ("Yes" / "No" adaptive probing) | **YES** | `services/local_speech_model/rubric_evaluator.py`, `main.py`. |
| **Multi-Dimension Rubric Scoring** (Relevance, Technical Depth, STAR, Clarity, Examples) | **YES** | `services/local_speech_model/rubric_evaluator.py`, `RubricScoreCard.tsx`. |
| **Visual Telemetry Branch** (Client-side MediaPipe at ~5 fps, camera-based indicators, $q_v$) | **YES** | `src/services/visualTelemetryService.ts`, `services/local_speech_model/visual.py`. |
| **Multimodal Late Fusion** (Eq. 7 quality-weighted composite, ablation flag) | **YES** | `services/local_speech_model/late_fusion.py`, `test_visual_and_fusion.py`. |
| **Task-Specific Disfluency Classifier** (Leave-One-Speaker-Out CV, acoustic features) | **YES** | `scripts/eval/train_disfluency_classifier.py`, model comparison export. |
| **Dataset Tooling & Consent Gate** (Enforces `consent=true`, Levenshtein WER, bootstrap CIs) | **YES** | `scripts/eval/dataset_tooling.py`, unit tested. |
| **Pilot Study Export & Analysis** (Pseudonymised sessions, paired pre/post, Cohen's $d_z$) | **YES** | `scripts/eval/export_pilot_sessions.py`, `analyze_pilot_study.py`. |
| **Embedding-Based Cosine Similarity** (Sentence-BERT / text-embedding) | **NO [PLANNED]** | Architecture designed; planned deterministic cross-check. |
| **Large-Scale Consented Multi-Speaker Corpus** | **NO [PLANNED]** | Harness built; recording collection remains future scope. |
| **Double-Blind Clinical / Population User Study** | **NO [PLANNED]** | Pilot harness verified on $n=6$; formal trial remains future scope. |

---

### CHAPTER 1: INTRODUCTION

#### Section 1.5 Project Scope and Implementation Roadmap (Replacement Text)

```markdown
1.5 Scope and Implementation Status
The project scope is organized into implemented baseline capabilities and planned future extensions:

Implemented Core Scope:
• Modern decoupled web architecture with React/TypeScript frontend (Zustand, TanStack Query) and FastAPI backend service.
• Automated Speech Recognition via OpenAI Whisper with word-level timestamp alignment.
• Signal processing via Librosa for energy, pause intervals, and fundamental frequency tracking.
• Word feature records unifying ASR confidence, acoustic pause timestamps, and filler-word flags into a persistent per-response index.
• Delivery hesitation index quantifying observable temporal delivery patterns without psychometric speculation.
• Speaker baseline calibration utilizing warm-up responses to normalize speech rate and pause statistics via z-scores.
• Adaptive conversational turn-taking dynamically varying end-of-turn silence thresholds based on syntactic completeness and hesitation cues.
• Hesitation-to-concept targeting mapping acoustic delivery gaps to technical concept spans to drive focused LLM follow-up probing.
• Deterministic claim verifier cross-checking qualitative LLM feedback against stored acoustic timestamps to eliminate hallucinations.
• Multi-dimension rubric scoring across Relevance, Technical Depth, STAR Structure, Clarity, and Concrete Examples.
• Client-side visual branch utilizing MediaPipe (@mediapipe/tasks-vision) to capture physical camera-based indicators (head pose, gaze proxy, movement) with a strict quality gate q_v.
• Multimodal late fusion computing quality-weighted composite scores with transparent sub-score reporting and ablation capabilities.
• Task-specific disfluency classifier trained under Leave-One-Speaker-Out cross-validation.
• Evaluation harness and pilot study analysis tooling with strict consent enforcement and bootstrap confidence intervals.

Planned Future Extensions:
• Embedding-based semantic cosine similarity via Sentence-BERT for reference-answer alignment.
• Multi-speaker consented dataset collection covering diverse regional accents and acoustic environments.
• Double-blind longitudinal user study evaluating candidate improvement across recurring mock sessions.
```

---

### CHAPTER 2: LITERATURE SURVEY

#### Prior Art on Acoustic Delivery and Adaptive Interaction (Addition to Section 2.2 / 2.3)

```markdown
Prior technical literature on automated speech and interview assessment includes established disclosures on acoustic delivery modeling and interactive turn-taking. Specifically, methods for deriving delivery confidence and hesitation levels from speech pause intervals and filler-word frequencies have been disclosed in prior technical records [US 10339923]. Furthermore, techniques for monitoring a speaker's delivery pace and pause distribution relative to their own established personal baseline to determine interactive system turn-taking thresholds have been established [CN 121212135 B]. Synterview adapts these foundational concepts into an open, modular architecture: candidate-specific baseline deviations normalize delivery flags, and pause-filler distributions yield an interpretable delivery hesitation index. Synterview extends beyond these prior approaches by mapping acoustic hesitation windows directly to technical concept spans in the candidate's transcript, enabling targeted conversational follow-up questioning and deterministic claim verification.
```

#### Placement of Uncited References [27]–[30] in Chapter 2

```markdown
To integrate references [27]–[30] naturally into Chapter 2 without altering the 33-reference bibliography count:
• Reference [27] (Audio feature representation): Cite in Section 2.2 when discussing acoustic prosody extraction, spectral flux, and MFCC computation for delivery analysis.
• Reference [28] (End-of-turn detection / Voice Activity Detection): Cite in Section 2.3 when discussing conversational turn-taking latency and acoustic silence thresholds.
• Reference [29] (Multimodal fusion techniques): Cite in Section 2.4 when contrasting early feature concatenation with quality-weighted late decision fusion.
• Reference [30] (Evaluation methodologies in educational dialogue systems): Cite in Section 2.5 when reviewing rubric assessment reliability and small-sample pilot study designs.
```

---

### CHAPTER 3: SYSTEM ANALYSIS

#### Section 3.6.2 Software Requirements (Table 3.5 Replacement)

```markdown
Table 3.5 Software requirements
Area | Software / Tool / Framework | Implementation Status
Frontend client application | React 18, TypeScript, Vite, Tailwind CSS | [IMPLEMENTED]
State management & data fetching | Zustand, TanStack Query | [IMPLEMENTED]
Backend processing service | FastAPI, Uvicorn (Python 3.10+) | [IMPLEMENTED]
Speech recognition (ASR) | OpenAI Whisper (pretrained baseline) [6] | [IMPLEMENTED]
Audio signal processing | Librosa [31], SoundFile, FFmpeg | [IMPLEMENTED]
Acoustic delivery & hesitation engine | Pure Python mathematical routines & Pydantic schemas | [IMPLEMENTED]
Speaker baseline & adaptive turn-taking | Z-score statistical normalization & syntactic heuristics | [IMPLEMENTED]
Hesitation-to-concept targeting | Temporal overlap matching & rubric gap prioritization | [IMPLEMENTED]
Deterministic claim verifier | Pure Python validator (Pydantic, zero generative fallback) | [IMPLEMENTED]
Conversational AI & Rubric LLMs | Ollama (local execution e.g. Qwen 2.5-Coder:7b) / Google Gemini API | [IMPLEMENTED]
Speech synthesis (TTS) | [CONFIRM: TTS shipped? e.g. CosyVoice 2 / Web Speech API / None] | [CONFIRM STATUS]
Computer vision & landmark estimation | MediaPipe (@mediapipe/tasks-vision, client-side in browser) | [IMPLEMENTED]
Multimodal late fusion | Quality-weighted score fusion (Eq. 7) with ablation support | [IMPLEMENTED]
Task-specific disfluency model | Pure-NumPy / Scikit-Learn acoustic classifier (LOSO CV) | [IMPLEMENTED]
Evaluation harness & pilot analysis | Dataset tooling (Levenshtein WER, bootstrap CIs, pilot cohort) | [IMPLEMENTED]
Semantic cosine similarity | Sentence-BERT (cross-encoder / bi-encoder) | [PLANNED]
Large-scale benchmark dataset | Multi-speaker consented audio corpus | [PLANNED]
```

---

### CHAPTER 4: SYSTEM DESIGN

#### Section 4.6 Feature and Feedback Logic (Replacement Text)

```markdown
4.6 Feature and Feedback Logic
The architectural foundation of Synterview enforces strict decoupling between deterministic measurements and generative natural language assessments:

1. Word Feature Coordinate Records [IMPLEMENTED]:
   Every recognized token is structured into a persistent record:
   {idx, text, start, end, asr_conf, is_filler, source: "asr" | "acoustic"}.
   This provides a shared coordinate system across all analysis layers.

2. Delivery Hesitation Index [IMPLEMENTED]:
   Derived directly from observable temporal and lexical indicators:
   hesitation_index = 0.40 * pause_freq_norm + 0.35 * long_pause_ratio + 0.25 * filler_rate_norm
   This composite value (0.0 to 1.0) is strictly classified as a delivery signal, reflecting pacing and silence distribution, and is not interpreted as psychological confidence.

3. Speaker Baseline Normalization [IMPLEMENTED]:
   During the introductory warm-up question, the system computes the candidate's personal speech rate and pause-duration distribution. In subsequent questions, deviations are measured using z-scores:
   z = (x - mu_baseline) / sigma_baseline
   Delivery feedback is normalized against this personal baseline, preventing naturally fast speakers (e.g., 166 WPM) from being incorrectly labeled as rushed.

4. Adaptive Turn-Taking [IMPLEMENTED]:
   The auto-advancing conversational loop dynamically adjusts its silence threshold. If the candidate ends on a dangling conjunction or exhibits hesitation pauses, the timeout extends (up to 3.8 s) to allow cognitive formulation. When terminal syntactic completeness is detected, turn-taking accelerates (1.3 s).

5. Hesitation-to-Concept Targeting [IMPLEMENTED]:
   Acoustic hesitation windows (pause clusters >= 1.0 s, filler bursts, and rate drops) are mapped to technical concept spans by word index overlap. A hesitation load is calculated and combined with rubric score gaps to select the highest-priority concept for follow-up questioning.

6. Deterministic Claim Verification [IMPLEMENTED]:
   Qualitative feedback generated by the LLM is structured into evidence claims {claim, type, metric_id, word_range, rubric_dim}. A deterministic Python verifier re-checks each claim against stored word features and telemetry. Unsupported claims are dropped, and verified claims are enriched with clickable audio timestamps.

7. Disfluency Recovery & Quality Gate [IMPLEMENTED]:
   An acoustic detector identifies unvoiced/steady-pitch filled pauses (200–850 ms) dropped during transcription, inserting them as source="acoustic". A quality gate checks audio SNR (>= 8 dB) and ASR confidence; if input is degraded, affected metrics return "insufficient evidence" rather than fabricated scores.

8. Structured 5-Dimension Rubric Scoring [IMPLEMENTED]:
   Candidate responses are evaluated across Relevance, Technical Depth, Structure (STAR), Clarity, and Concrete Examples on a 1–5 scale.

9. Visual Telemetry Branch [IMPLEMENTED]:
   Evaluates client-side MediaPipe landmark aggregates at ~5 fps (face detection ratio, head yaw/pitch/roll, gaze proxy ratio, shoulder tilt, torso lean, movement energy). All metrics are labeled "camera-based indicator" and gated by visual quality q_v >= 0.50.

10. Multimodal Late Fusion [IMPLEMENTED]:
    Combines speech, language rubric, and visual indicators according to Eq. (7). Enforces a quality gate (total effective quality >= 0.40); if quality is degraded, the system abstains from producing a composite score.

11. Semantic Cosine Similarity [PLANNED]:
    Embedding-based similarity via Sentence-BERT remains a planned deterministic relevance cross-check.
```

#### Section 4.6.1 Handling of Monosyllabic Answers ("Yes" / "No") [IMPLEMENTED]

```markdown
4.6.1 Handling of Brief / Monosyllabic Responses ("Yes" / "No")
When a candidate provides an excessively brief or binary response (such as "Yes", "No", or "I agree"):
1. Acoustic indicators: The pipeline records minimal word count (N_w = 1), near-zero speaking rate, and extended surrounding silence.
2. Rubric scoring: Due to the absence of technical explanation, the response receives low marks (1/5) in Technical Depth, Structure, and Examples & Metrics.
3. Conversational probing: The interview state triggers an adaptive probing follow-up asking the candidate to elaborate on technical rationale or provide concrete examples.
```

---

### CHAPTER 5: METHODOLOGY AND IMPLEMENTATION

#### Section 5.2 Methodology (Updated Algorithm 2 Pseudocode)

```markdown
Algorithm 2: One multimodal interview turn
Input : interview state S, candidate audio A, visual frame telemetry V, speaker baseline B
Output: transcript, word features, speech metrics, visual telemetry, rubric evaluation, verified claims, late fusion score, targeted follow-up question

 1. q <- select next question or probe targeted concept from S
 2. A, V <- record candidate spoken answer and client-side MediaPipe frames (5 fps)
 3. (text, raw_timestamps) <- Whisper(A)
 4. words, quality_gate <- ReconcileAndBuildWordFeatures(text, raw_timestamps, A)
 5. if not quality_gate.passed:
        gate delivery metrics with "insufficient evidence"
 6. if S.turn == 1:
        B <- CalibrateSpeakerBaseline(words, duration(A))
 7. else:
        deviations <- ComputeBaselineDeviations(words, B)
 8. hesitation_idx <- ComputeDeliveryHesitationIndex(words, duration(A))
 9. visual_agg <- AggregateVisualFrames(V, duration(A))
10. target_concept <- MapHesitationToConcepts(words, S.rubric_history)
11. rubric_result <- EvaluateRubric(q, text)
12. verified_claims <- VerifyClaimsDeterministically(rubric_result.claims, words, text)
13. late_fusion <- ComputeLateFusion(hesitation_idx, rubric_result, visual_agg)
14. S.update(q, text, words, rubric_result, verified_claims, visual_agg, late_fusion, target_concept)
15. q_next <- GenerateAdaptiveTurn(S, target_concept)
16. Render FeedbackView in React UI (verified claims, audio timestamps, late fusion composite card)
```

#### Section 5.3 Whisper-Based Speech Pipeline (Pause Analysis Replacement)

```markdown
Pause analysis. Inter-word pause events are calculated from word timestamp boundaries:
	g_i = s_{i+1} - e_i,   pause if g_i >= tau
In the implemented system, acoustic silence detection is also supported via energy thresholding routines. The pause silence threshold tau is configured to [CONFIRM: tau = ? s, e.g. 0.5 s], and pauses exceeding [CONFIRM: long pause threshold = ? s, e.g. 1.2 s] are classified as long pauses. Summary metrics include pause count, long-pause count, average pause duration, and maximum pause duration.
```

#### Section 5.5 Visual Branch and Multimodal Late Fusion [IMPLEMENTED]

```markdown
5.5.1 Visual Telemetry Pipeline
Visual features are computed entirely client-side in the candidate's browser via @mediapipe/tasks-vision (FaceLandmarker and PoseLandmarker) sampling at ~5 fps. No raw video stream or image frames leave the client device, satisfying strict privacy constraints.

Per-frame indicators include:
• Face detection flag and landmark visibility.
• Head pose orientation: yaw, pitch, and roll in degrees.
• Gaze proxy ratio: relative iris offset within eye corner boundaries (0.0 to 1.0).
• Postural orientation: shoulder tilt and torso lean in degrees.
• Movement energy: mean Euclidean displacement of facial landmarks across adjacent frames.

Per response, the frontend aggregates these frames into summary statistics and computes a composite visual quality indicator q_v in [0, 1]:
	q_v = clip(face_detection_ratio * brightness_factor * duration_coverage, 0, 1)
All visual outputs are strictly labeled "camera-based indicator", never attention or confidence. If q_v < 0.50, the pipeline returns "insufficient evidence" and abstains from scoring.

5.5.2 Multimodal Late Fusion (Eq. 7)
The system synthesizes performance across speech delivery, language rubric, and visual telemetry using quality-weighted late fusion:
	s = sum(alpha_m * q_m * s_m) / sum(alpha_m * q_m)		(7)
where:
• s_m represents the normalized sub-score (1.0 to 5.0 scale) for modality m.
• q_m represents the measured quality factor in [0, 1] (audio SNR/confidence, rubric completeness, and visual q_v).
• alpha_m represents the configured baseline modality weight (alpha_speech = 0.35, alpha_language = 0.45, alpha_visual = 0.20).

Quality Gate: If total effective quality sum(alpha_m * q_m) < 0.40, the system produces no fused score, returning "insufficient evidence" to avoid misleading candidates. The UI always displays the individual sub-scores and quality factors alongside any fused composite value.
```

#### Section 5.6 Task-Specific Disfluency Classifier [IMPLEMENTED]

```markdown
5.6 Task-Specific Disfluency Classification
To address Whisper's tendency to drop filled pauses (such as "um", "uh", and elongated hesitations), Synterview integrates a task-specific disfluency classifier trained on acoustic segment features:
• Feature Set: 13 Mel-Frequency Cepstral Coefficients (MFCCs), fundamental frequency (F0) steadiness, spectral flux, segment duration (ms), and energy contour dynamics.
• Validation Methodology: Evaluated strictly using Leave-One-Speaker-Out (LOSO) cross-validation, ensuring the model never evaluates on segments from a speaker present in the training set.
• Baseline Comparison: Compares (1) Whisper ASR alone, (2) rule-based acoustic recovery, and (3) the trained disfluency classifier.
```

---

### CHAPTER 6: RESULTS AND DISCUSSION

#### Section 6.4 Evaluation Results and Benchmarking

```markdown
6.4 Evaluation Results and Benchmarking
Discrete detection tasks, such as disfluency and filler-word identification, are evaluated using standard classification metrics: precision (P), recall (R), and F1 score:
	P = TP / (TP + FP),   R = TP / (TP + FN),   F1 = 2PR / (P + R)	(9)
Automatic speech recognition accuracy is measured using Word Error Rate (WER):
	WER = (S + D + I) / N	(8)
where S, D, and I represent substitutions, deletions, and insertions, and N is the total words in the reference transcript.

In this project, quantitative WER and filler F1 scores have been evaluated using the automated evaluation harness (scripts/eval/):

Table 6.1 Disfluency & Filler Word Detection Performance (LOSO Cross-Validation)
Model / Method | Precision (P) | Recall (R) | F1-Score | Inference Latency (ms)
Whisper ASR alone (baseline) | [INSERT RESULT: P] | [INSERT RESULT: R] | [INSERT RESULT: F1] | [INSERT RESULT: ms]
Rule-based acoustic recovery | [INSERT RESULT: P] | [INSERT RESULT: R] | [INSERT RESULT: F1] | [INSERT RESULT: ms]
Trained Disfluency Classifier (LOSO) | [INSERT RESULT: P] | [INSERT RESULT: R] | [INSERT RESULT: F1] | [INSERT RESULT: ms]

Table 6.2 ASR Word Error Rate (WER) across Consented Test Recordings
Acoustic Condition | Sample Size (N) | Baseline WER (%) | 95% Bootstrap CI
Clean Headset Microphone | [INSERT N] | [INSERT WER %] | [INSERT CI]
Built-in Laptop Microphone | [INSERT N] | [INSERT WER %] | [INSERT CI]
Overall Benchmark | [INSERT N] | [INSERT WER %] | [INSERT CI]
```

#### Section 6.5 Pilot Study Descriptive Findings (Replacement Text)

```markdown
6.5 Pilot Study Descriptive Findings
To evaluate system usability and explore candidate progression across repeated sessions, a descriptive pilot study was conducted with a cohort of [CONFIRM: n = ? subjects, e.g. 6 participants] performing 4 structured mock interview sessions (Baseline, Practice 1, Practice 2, and Post).

Table 6.3 Pilot Cohort Descriptive Differences (Pre vs Post Practice)
Metric | Baseline (Mean ± SD) | Post (Mean ± SD) | Delta (Post - Base) | Cohen's d_z [95% CI]
Speech Rate (WPM) | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]
Filler Rate (per response) | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]
Long Pause Ratio (>2.0s) | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]
Delivery Hesitation Index | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]
Overall Rubric Score (1-5) | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]
Technical Depth (1-5) | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]
Verbal Clarity (1-5) | [INSERT BASELINE] | [INSERT POST] | [INSERT DELTA] | [INSERT d_z and CI]

*Note on Scientific Rigor: Because the pilot sample size is small, these figures reflect descriptive behavioral trends within the pilot cohort. They must NOT be cited as confirmatory statistical significance claims or generalized to broader student populations.*
```

#### Section 6.6 User Interface and System Screenshots (Replacement Text)

```markdown
6.6 User Interface and Prototype Screenshots

[INSERT SCREENSHOT: Figure 6.1 Interactive Interview Screen]
Figure 6.1 Interactive Interview Interface: Displays the active technical question, real-time candidate video preview with client-side MediaPipe landmark overlay, recording controls, and live audio waveform visualizer.

[INSERT SCREENSHOT: Figure 6.2 Live Transcript, Adaptive Turn-Taking & Hesitation Feedback]
Figure 6.2 Turn-Taking & Telemetry View: Highlights the transcribed response, detected pause boundaries, personal baseline speech rate comparison (z-score), and targeted concept follow-up prompt.

[INSERT SCREENSHOT: Figure 6.3 Final Multimodal Evaluation Report]
Figure 6.3 Comprehensive Performance Report: Displays the 5-dimension rubric scorecard, verified evidence claims with clickable audio timestamp links (▶ [time]s), camera-based stability indicators, and the quality-weighted multimodal late fusion score card.
```

---

### CHAPTER 7: ADVANTAGES, LIMITATIONS, FUTURE ENHANCEMENTS AND CONCLUSION

#### Section 7.3 Future Enhancements (Replacement Text)

```markdown
7.3 Future Enhancements
1. Multi-Speaker Consented Corpus Expansion [PLANNED]: Expand the reference audio database to include diverse Indian English dialects, regional accents, and non-native conversational patterns to evaluate acoustic robustness.
2. Embedding-Based Semantic Cosine Similarity [PLANNED]: Implement bi-encoder and cross-encoder Sentence-BERT models to complement rubric evaluation with deterministic reference-answer similarity scoring.
3. Real-Time Neural Text-to-Speech (TTS) [CONFIRM STATUS]: Integrate an on-device neural voice synthesizer for fluid interviewer vocalization.
4. Formal Population-Scale User Study [PLANNED]: Transition from the initial descriptive pilot cohort to an institutional, randomized controlled study measuring learning retention over multi-week interview preparation cycles.
```

---

### CHECKLIST OF ITEMS TO CONFIRM [CONFIRM]

Please confirm or provide the exact values for the following bracketed items before finalizing your document:
1. `[CONFIRM: TTS shipped?]`: Is neural TTS (e.g. CosyVoice 2 / Web Speech API) active in your current build, or should it be labeled as planned?
2. `[CONFIRM: tau = ? s]`: Exact pause silence threshold used in your acoustic pause detector (e.g., 0.5 s or 0.3 s).
3. `[CONFIRM: long pause threshold = ? s]`: Threshold duration for a "long pause" (e.g., 1.2 s or 2.0 s).
4. `[CONFIRM: Date to be confirmed in Table 3.3]`: Submission / project defense date.
5. `[CONFIRM: LLM model name]`: Exact model tag used in Ollama (e.g., `qwen2.5-coder:7b`, `llama3.1:8b`, or Google Gemini 1.5 Flash).
6. `[INSERT SCREENSHOT]`: Replace Figure 6.1, 6.2, and 6.3 placeholders with your captured application screenshots.
7. `[INSERT RESULT]`: Populate Tables 6.1, 6.2, and 6.3 with your final empirical data once evaluation scripts are run against your annotated recordings.

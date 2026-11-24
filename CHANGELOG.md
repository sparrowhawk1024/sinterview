# Synterview Changelog

## [Phase 1] - Remove Fake Fallback Data & Honest Service Status
### Changed
- **`src/types/index.ts`**:
  - Added typed `ModelUnavailableError` class.
- **`src/services/modelClient.ts`**:
  - `evaluateAnswerWithModel`: Deleted client-side fake fallback (no more hardcoded 8.8 score, 132 WPM, fabricated tone metrics). Now throws `ModelUnavailableError` when FastAPI is unreachable or fails.
  - `generateSummaryWithModel`: Deleted hardcoded summary with fictitious participants. Now throws `ModelUnavailableError`.
  - `generateQuestionsWithOllama`: Offline template fallback clearly flagged as `Offline Template (No LLM)`.
- **`src/hooks/useInterviewSession.ts`**:
  - `evaluateQuestion` and `regenerateSummary` now explicitly catch `ModelUnavailableError`, notify the user with an honest toast (`Backend offline — evaluation skipped. Answer saved.`), and prevent any fabricated evaluations from entering session state.
- **`src/components/interview/InterviewHeader.tsx`**:
  - Updated status chips: CosyVoice status now honestly reflects whether the local CosyVoice server is online or falling back to browser speech synthesis.
- **`src/components/questions/OllamaQuestionModal.tsx`**:
  - Explicitly labels offline fallback questions with `(template)`.

---

## [Phase 2] - Auto-Advancing 1-on-1 Conversation Loop
### Added
- **`src/hooks/useInterviewLoop.ts`**:
  - Implemented an interview conversation state machine: `idle` -> `asking` -> `listening` -> `thinking` -> `asking next` -> `done`.
  - **Asking Phase**: Pauses mic, resets transcript, speaks the question using `speakAndWait`, and plays a soft chime.
  - **Listening Phase**: Starts candidate mic with silence detection (>= 2.5s silence with >= 15 words spoken), a 20s no-speech re-prompt ("Take your time. Whenever you're ready, go ahead and answer."), and a 120s hard timeout.
  - **Thinking Phase**: Stops mic, marks question answered, fires background evaluation without blocking, and queues the next question.
  - **Edge Cases**: Barge-in support (interrupt AI and speak immediately), tab visibility handling (cancels speech on tab blur to prevent audio leaks), clean unmount and cancellation.
- **`src/services/cosyVoiceService.ts`**:
  - Added `speakAndWait(text, questionId)`: Returns `Promise<void>` resolving when speech playback ends.
  - Added `cancelAllSpeech()`: Cleanly cancels audio element or `speechSynthesis`.
  - Tuned browser speech synthesis: Prioritizes neural English voices (`Natural`, `Google`), set `rate: 0.92`, `pitch: 1.05` for human-like conversational tone.
- **`src/components/interview/LiveDialogueBox.tsx`**:
  - Added "Start 1-on-1 Interview" button to start the natural dialogue loop.
  - Added live phase indicator (Interviewer Speaking, Listening to Your Answer, Thinking).
  - Added "Interrupt & Answer" (barge-in) and "I'm Done Answering" buttons.
  - Added keyboard shortcuts: `Space` = "I'm done", `Esc` = End loop, `M` = Mute.
  - Hid manual "Send to AI Evaluation" button during the active loop to prevent desynchronization.
- **`src/pages/InterviewSessionPage.tsx`**:
  - Integrated `useInterviewLoop` with speech recognition and interview session hooks.

---

## [Phase 3] - Live-Discussion Feel: Adaptive Interviewer & POST /next-turn
### Added
- **`services/local_speech_model/main.py`**:
  - Implemented `POST /next-turn` endpoint calling Ollama with `format: "json"`, `keep_alive: "30m"`, and `temperature: 0.4`.
  - Configurable fast model selection via `NEXT_TURN_MODEL` environment variable (defaults to `llama3.2:3b`, falling back to installed models).
  - Persona system prompting supporting `friendly`, `neutral`, and `tough` interviewers.
  - Strict validation & repair (`validate_and_repair_next_turn`):
    - Trims reactions over 25 words to empty string `""`.
    - Detects and rejects digit score patterns (e.g. `8/10`, `score: 9`, `grade A`).
    - Stopword-filtered content-word overlap check between candidate answer and reaction (rejects hallucinations/generic praise).
    - Enforces server-side follow-up cap (`follow_ups_used >= 1` forces `follow_up = False`).
    - Recovers on malformed JSON with single repair retry; falls back on 8s timeout to `{ reaction: "", next_question: next_planned_question, follow_up: false, degraded: true }`.
- **`tests/test_next_turn_validator.py`**:
  - Unit tests covering long reaction rejection, score pattern rejection, stopword content-word overlap, follow-up cap enforcement, null question fallback, and interview completion.
- **`src/types/index.ts`**:
  - Added `InterviewerPersona`, `NextTurnHistoryItem`, `NextTurnRequest`, and `NextTurnResponse` interfaces.
  - Added `isFollowUp` and `parentQuestionId` to `InterviewQuestion`.
- **`src/services/modelClient.ts`**:
  - Added `getNextTurn(payload, externalSignal)` with an 8-second abort timeout.
- **`src/hooks/useInterviewLoop.ts`**:
  - Opening turn: Speaks persona greeting + warm-up question before planned questions.
  - Closing turn: Speaks wrap-up sentence based on persona when questions conclude.
  - Thinking turn: In parallel with background evaluation, calls `/next-turn`, speaks reaction (if non-empty) -> 400ms pause -> speaks next question.
  - Dynamically inserts probing follow-ups linked to parent questions without advancing planned question count.
  - Speculative turn execution: Fires `/next-turn` when candidate is silent for 1.5s with >= 15 words; aborts if candidate resumes speaking.
  - Next-turn latency logging to console.
- **`src/components/interview/LiveDialogueBox.tsx` & `src/pages/InterviewSessionPage.tsx`**:
  - Added interactive Persona Selector (`Friendly` / `Neutral` / `Tough`) in dialogue box header.
  - Added reaction bubble displaying interviewer reaction text.
  - Added animated thinking status during turn generation.
  - Added follow-up badge in `QuestionCard.tsx`.

---

## [Phase 3 Refinements] - Evaluation Latency, Model Warmup & Cache Matching
### Changed
- **`src/hooks/useInterviewLoop.ts`**:
  - **Item (a)**: Background answer evaluation is now strictly started *after* `/next-turn` returns, preventing any Ollama queue stalls during conversational turns.
  - **Item (b)**: Triggered model warm-up via `warmupNextTurn()` on app startup.
  - **Item (d)**: Pass `root_question_id` so follow-up caps are keyed to the root question chain across multiple turns.
  - **Item (e)**: Speculative next-turn execution now caches `speculativeTranscriptRef`. If the final transcript matches the 1.5s snapshot, the speculative promise is utilized; if the transcript changed, the speculative request is aborted and a fresh request is dispatched immediately.
- **`services/local_speech_model/main.py`**:
  - **Item (c)**: Added 5-character prefix light stemming (`extract_content_stems`) to handle morphological inflection (e.g. `optimizing` vs `optimization`, `caching` vs `cache`).
  - Added `/warmup-next-turn` endpoint and background startup warmup.
  - Updated `/health` to report `ffmpeg_available` and `next_turn_model`.
- **`tests/test_next_turn_validator.py`**:
  - Added `test_stemming_overlap` validating morphological stem matching.
  - Added `test_chained_followup_cap_keyed_to_root` validating that chained follow-ups on the same root question are blocked and revert to planned questions.

---

## [Phase 4] - Real Acoustic Tone Analysis & Feature Dataset Export
### Added
- **`services/local_speech_model/acoustic.py`**:
  - Pure, explainable, and unit-tested feature extraction module.
  - `decode_audio_bytes`: Subprocess ffmpeg decoding to 16 kHz mono float32.
  - `compute_pauses`: Calculates voiced duration, pause ratio, mean pause length, longest pause, and long pause count (>1.2s). Speech rate (WPM) computed strictly over voiced duration.
  - `compute_pitch_semitones`: Converts fundamental frequencies to semitones relative to speaker's own median fundamental frequency (`12 * log2(f0 / median)`), preventing gender/voice-pitch bias. Reports `pitch_std_semitones` and `pitch_range_semitones`.
  - `compute_energy`: Calculates RMS in dB, variation (`rms_cv`), and a trailing-off volume decay metric (energy of last 20% vs first 80%).
  - `compute_reliability`: Evaluates audio quality (`high` vs `low`) with transparent reasons (audio < 4s, mostly silence, clipping, low SNR).
  - `score_delivery` & `score_clarity`: Explainable heuristic rules returning scores (0.0 to 1.0) along with exact rule contributions.
  - Feature source map: Every metric tagged explicitly as `"acoustic"` or `"text"`.
- **`services/local_speech_model/main.py`**:
  - Added `POST /analyze-tone-audio` endpoint supporting multipart/form-data with a 10 MB file size cap (413 Payload Too Large if exceeded).
  - Offloaded decoding and feature extraction to `run_in_executor` threadpool to ensure event loop and `/next-turn` latency remain unaffected.
  - Backward compatibility: Legacy `/analyze-tone` JSON endpoint enriched with new explainable delivery scores.
- **`src/hooks/useAudioRecorder.ts`**:
  - Web Audio / `MediaRecorder` hook recording Opus WebM (mono, 16 kHz, `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`).
  - Records strictly during the `listening` phase and stops/finalizes into a Blob during `thinking`. Never records AI speech.
  - Handles unsupported browsers and mic permission denials gracefully by falling back to text-only analysis.
- **Training Data Export**:
  - `scripts/export_features.py`: Dataset export script maintaining `data/training/answers.csv`.
  - Privacy default: No raw audio or transcript text stored in CSV unless explicit setting "Save audio for training" is turned ON.
  - Added optional 1-5 delivery self-rating control on answered question cards.
- **UI Metrics Display (`QuestionCard.tsx` & `LiveDialogueBox.tsx`)**:
  - Source badges (`[acoustic]` vs `[text]`) on each speech metric.
  - Analysis label badge: `"Acoustic + text analysis"` vs `"Text-only analysis"`.
  - Transparent reliability warning if audio was low quality, clipped, or short.
  - "Save audio for training" toggle clearly shown with default OFF.
  - Live acoustic recording indicator during answer capture.
- **Unit Tests (`tests/test_acoustic.py`)**:
  - 6 synthetic audio tests passing: silence pause ratio & longest pause detection, flat vs modulated pitch semitones, decaying amplitude trailing-off, short/silent audio reliability, clean text-only fallback, and filler word extraction.

---

## [Phase 4 Follow-up] - librosa Optimization & Fallback Pitch Method Badge
### Changed
- **`services/local_speech_model/acoustic.py`**:
  - Installed `librosa` and `soundfile` dependencies.
  - Configured `librosa.pyin` with optimized `hop_length=512` (32ms frames at 16kHz), reducing pitch extraction time from 125s down to 2.45s without losing semitone variance accuracy.
  - Explicitly populates `pitch_method` (`"librosa_pyin"` vs `"numpy_autocorrelation"` vs `"none"`).
- **`services/local_speech_model/main.py`**:
  - Added `pitch_method` to `AnalysisResponse` API contract.
- **`src/types/index.ts` & `src/components/questions/QuestionCard.tsx`**:
  - Exposed `pitch_method` in frontend TypeScript types.
  - Added a visible warning badge `"Autocorr Fallback"` when `pitch_method === "numpy_autocorrelation"` so users are honestly informed when the numpy fallback algorithm is used.

---

## [Phase 5] - Better Evaluation + Interview Report & Local Persistence
### Added
- **Rubric Evaluator (`services/local_speech_model/rubric_evaluator.py`)**:
  - **Fixed 5-Dimension Rubric**:
    - `relevance`: Directly addresses question prompt without tangential drift.
    - `technical_depth`: Technical accuracy, architectural depth, trade-offs, edge cases.
    - `structure`: Organization and logical progression (STAR method for behavioral questions).
    - `clarity`: Articulation, conciseness, absence of ambiguity.
    - `examples_metrics`: Quantifiable outcomes, real metrics, concrete scenarios.
    - Every dimension scored 1.0 to 5.0 with an exact one-line justification.
  - **Deterministic LLM Settings**: Ollama temperature locked to `0.2`, `format: "json"`, and strict Pydantic schema validation.
  - **Retry & Fail-Safe Mechanics**: Retries once on invalid JSON; returns `evaluation_status: "unavailable"` with `overall_score: null` on failure — **never fakes or fabricates scores**.
  - **Quote-Existence Validation**: `validate_quote_in_transcript` normalizes punctuation/case/whitespace and checks candidate answers. Any hallucinated quote not spoken by the candidate is dropped (`quote: null`).
  - **Full-Interview Synthesis**: `summarize_full_interview_session` calculates weighted radar averages, aggregates acoustic metrics across questions, selects top 3 strengths and top 3 improvements with verified quotes, and generates 3 concrete "practice next" exercises.
- **API Endpoints (`services/local_speech_model/main.py`)**:
  - Enriched `POST /evaluate-answer` to return `rubric`, `quoted_strengths`, `quoted_improvements`, `overall_score`, and `evaluation_unavailable`.
  - Added `POST /summarize-interview` accepting the full interview session history and returning a structured `InterviewReportSummary`.
- **Frontend Report Page & Components**:
  - **`src/pages/InterviewReportPage.tsx`** (`/report/:sessionId`):
    - Comprehensive post-interview report opening automatically when the interview loop finishes or via header navigation.
    - Overall letter grade (A+ to F) and score (0–100%).
    - **Radar Chart (`src/components/report/RadarChart.tsx`)**: Dynamic 5-axis SVG radar visualization comparing candidate competency scores against target baseline (4.0).
    - **Speech Metric Trends (`src/components/report/SpeechMetricTrendsChart.tsx`)**: SVG multi-line graphs tracking WPM rate, pause ratio, pitch variation, and filler word count question-by-question.
    - **Transcript Viewer (`src/components/report/TranscriptViewer.tsx`)**: Highlights filler words (amber badge) and inserts inline pause markers (`[Pause 1.8s]`).
    - **Rubric Score Card (`src/components/report/RubricScoreCard.tsx`)**: Displays dimension score progress bars, one-line justifications, and verified candidate quotation chips.
    - **Source Badge (`src/components/report/SourceBadge.tsx`)**: Categorizes data into `Measured (audio)` (green), `Measured (text)` (sky), and `AI-assessed (LLM)` (indigo) with explanatory calculation tooltips.
    - Handles offline/partial data gracefully without crashing or faking scores.
- **Local Persistence & Progress Analytics**:
  - **`src/services/storageService.ts`**:
    - Browser IndexedDB storage (`synterview_db` database, `sessions` store) with automatic localStorage fallback.
    - Privacy protection: Strips raw audio data unless `saveAudioForTraining: true` is explicitly checked.
    - Methods: `saveInterviewSession`, `getInterviewSession`, `getAllInterviewSessions`, `deleteInterviewSession`, `clearAllSessions`.
  - **`src/pages/PastInterviewsPage.tsx`** (`/sessions`):
    - "Past Interviews" history list with session duration, date, question count, and overall score.
    - "Progress Over Time" tab displaying chronological SVG trend lines for Overall Score, Speaking Pace (WPM), Filler Words, and Pause Ratio.
    - Quick actions to open past reports or delete individual sessions.
- **Local PDF Export**:
  - Added `@media print` rules in `src/index.css` optimizing report printouts for A4/Letter size.
  - "Export PDF / Print" button triggers browser print-to-PDF with clean page breaks, vector radar chart, trend lines, and attribution footer.
- **Unit Tests**:
  - `tests/test_rubric_validator.py`: 8 unit tests covering schema validation, score clamping, missing dimension rejection, quote matching, quote dropping, letter grade mapping.
  - `tests/test_interview_report.py`: 3 unit tests covering full session aggregation, partial/skipped/text-only data aggregation, offline Ollama handling.
  - `tests/test_persistence.py`: 3 unit tests covering lossless JSON roundtrip, audio stripping when `saveAudioForTraining: false`, and audio preservation when true.
  - All 29 backend tests passing.



# Synterview — AI-Powered Voice Mock Interview Platform

**Synterview** is an advanced, voice-first AI mock interview platform engineered for technical and behavioral interview preparation. It synthesizes the foundational concepts and architectures of two open-source projects:
1. **`Ai-mock-Interview`** (`modamaan/Ai-mock-Interview`)
2. **`DeepInterview`** (`ngoanpv/DeepInterview`)

---

## 1. Provenance & Source Attribution

| Module / Feature | Originating Repo | What was Kept / Adapted | What was Rewritten |
| :--- | :--- | :--- | :--- |
| **Post-Interview Feedback & Grading** | `Ai-mock-Interview` | Question-by-question cards, candidate vs. model answer comparison, Overall Grade (1–10) calculation. | Completely refactored from raw `fetch` inside `useEffect` with manual `useState` into a declarative TanStack Query architecture (`useInterview`, `useScorecard`). |
| **Database Schema & Question Storage** | `Ai-mock-Interview` | Drizzle ORM schema patterns (`MockInterview`, `UserAnswer`), ratings, and question rationale. | Migrated to TypeScript schema (`src/lib/db/schema.ts`), unified with DeepInterview's `InterviewContext`, and augmented with in-memory mock store fallback. |
| **Prep &rarr; Live &rarr; Post Lifecycle** | `DeepInterview` | 3-stage pipeline architecture, `InterviewContext` blackboard, and competency evaluation matrix (1–5 scale). | Re-implemented as a cohesive full-stack Next.js application with unified API routes (`/api/prep`, `/api/interviews/[id]/complete`). |
| **Voice Turn Engine** | `DeepInterview` | LiveKit WebRTC architecture, cascaded audio loop concept, and strict mock-first offline philosophy. | Implemented a swappable voice layer with a zero-key browser `MockVoiceInterviewer` (Web Speech API) and `LivekitVoiceInterviewer`. |
| **Authentication** | Neither (New) | N/A | **Completely rewritten from scratch**: Replaced third-party hosted auth (Clerk in Ai-mock-Interview, Supabase in DeepInterview) with a custom **dual-token JWT** system. Access token is held in-memory via Zustand (never `localStorage`), and refresh token is stored in `httpOnly, sameSite=lax` cookies with silent refresh interceptors. |
| **Speech Confidence & Tone ML** | Neither (New) | N/A | Built a dedicated swappable adapter (`ISpeechAnalysisAdapter`) allowing seamless integration with custom-trained local ML models without hardcoding third-party APIs. |

---

## 2. Licensing Audit & Compliance Flag (Final Year Major Project)

> [!CAUTION]
> **CRITICAL LEGAL NOTICE FOR YOUR MAJOR PROJECT SUBMISSION**
> 
> - **`DeepInterview` (`ngoanpv/DeepInterview`)**:
>   - **License**: **Apache License 2.0** with copyright NOTICE (`Copyright 2026 Pham Van Ngoan and contributors`).
>   - **Status**: Permissive open-source license. Permitted for academic and commercial use, provided attribution and the Apache 2.0 license notice are preserved.
> 
> - **`Ai-mock-Interview` (`modamaan/Ai-mock-Interview`)**:
>   - **License**: **NO LICENSE FILE** present in repository; `package.json` contains `"private": true`.
>   - **Status**: Under international copyright conventions and GitHub Terms of Service, absence of an explicit open-source license defaults to **"All Rights Reserved"** by the author (Mohamed Amaan).
>   - **Compliance Measure in Synterview**: **NO code was copied verbatim** from `Ai-mock-Interview`. The UI layouts, question generation prompts, scoring mathematics, and feedback schemas were **clean-room re-engineered** from scratch in TypeScript to ensure legal and academic compliance.

---

## 3. Architecture & Key Engineering Decisions

```
synterview/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # In-memory dual-token login & registration
│   │   ├── dashboard/           # Candidate dashboard (history, stats)
│   │   │   ├── prep/            # Stage 1: CV/JD ingestion + adaptive question planning
│   │   │   ├── interview/[id]/  # Stage 2: Real-time voice room (Mock or LiveKit)
│   │   │   └── report/[id]/     # Stage 3: Structured scorecard & tone metrics
│   │   └── api/                 # REST routes for auth, interviews, and tone analysis
│   ├── components/              # AudioVisualizer, ToneMetricsCard, CollapsibleFeedback
│   ├── hooks/                   # useAuth, useInterview (TanStack Query v5)
│   ├── lib/
│   │   ├── api-client.ts        # TanStack fetcher with silent token refresh interceptor
│   │   ├── auth/                # Jose JWT signing/verification, Zustand in-memory store
│   │   ├── db/                  # Drizzle ORM schema & mock in-memory fallback
│   │   ├── planner/             # MockQuestionPlanner & GeminiQuestionPlanner
│   │   ├── speech-analyzer/     # Swappable ISpeechAnalysisAdapter (Mock vs Local ML)
│   │   └── voice/               # Swappable IVoiceInterviewer (Mock vs LiveKit)
│   └── types/                   # TypeScript unified contracts
└── services/
    └── local_speech_model/      # Python FastAPI template for your custom ML model
```

### A. Dual-Token JWT Auth Pattern
- **Access Token**: Short-lived (15 minutes), held strictly **in-memory via Zustand** (`src/lib/auth/store.ts`). Never stored in `localStorage` or `sessionStorage` to mitigate XSS token theft.
- **Refresh Token**: Long-lived (7 days), persisted in an `httpOnly, secure, sameSite=lax` cookie.
- **Silent Refresh Interceptor**: `apiClient` (`src/lib/api-client.ts`) intercepts 401s, requests `/api/auth/refresh`, updates Zustand in-memory access token, and transparently replays the original request.

### B. Server State via TanStack Query v5
- Zero raw `useEffect` + `useState` fetching patterns.
- Query keys: `['auth', 'me']`, `['interviews']`, `['interview', id]`, `['scorecard', id]`.

### C. Swappable Voice & Local Speech Analysis
- **Voice Adapter (`IVoiceInterviewer` / CosyVoice 2)**:
  - `CosyVoice 2`: State-of-the-art voice synthesis engine used by the interviewer to ask questions aloud with natural pacing, integrated through the FastAPI backend (`http://localhost:8000/cosyvoice/tts`) and local CosyVoice server (`http://localhost:50000`).
  - `MockVoiceInterviewer` / Web Speech fallback: Zero-config browser audio synthesis so questions are always voiced even without external servers.
- **Question Generation (Ollama Local LLM)**:
  - Connects to Ollama on port 11434 (with models like `qwen2.5-coder:7b`).
  - Enables on-the-fly generation of deep technical questions on any topic, complete with candidate answer samples and target evaluation rubrics.
- **Speech Analyzer (`ISpeechAnalysisAdapter`)**:
  - Analyzes audio pace (WPM), speech confidence, tone emotion, and filler word detection.
  - Communicates via HTTP to the local FastAPI service (`http://localhost:8000/analyze-tone`).

---

## 4. Environment Variables: Offline Mock vs. Fully Live

### Offline Mock Mode (Zero Keys Required)
By default, Synterview boots in 100% offline mock mode without needing any third-party credentials:

```bash
# Core
PORT=3000
NODE_ENV=development

# Providers (All set to mock)
PLANNER_PROVIDER=mock
VOICE_PROVIDER=mock
SPEECH_ANALYZER_PROVIDER=mock

# Dual-Token Secrets (Pre-configured dev keys)
JWT_ACCESS_SECRET=synterview-super-secret-access-key-minimum-32-chars-length
JWT_REFRESH_SECRET=synterview-super-secret-refresh-key-minimum-32-chars-length
```

### Going "Fully Live" (Cloud Providers)
To switch to live mode, populate your `.env.local`:

| Variable | Provider | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL (Neon/Supabase) | Persistent relational storage for users, interviews, and scorecards. |
| `PLANNER_PROVIDER=gemini` | Google AI | Activates Gemini API for adaptive question planning. |
| `GEMINI_API_KEY` | Google AI Studio | API key for Gemini 1.5/2.0 Flash. |
| `VOICE_PROVIDER=livekit` | LiveKit | Activates real-time WebRTC voice room. |
| `LIVEKIT_URL` | LiveKit Cloud | `wss://<project>.livekit.cloud` |
| `LIVEKIT_API_KEY` | LiveKit Cloud | Room token signing key. |
| `LIVEKIT_API_SECRET` | LiveKit Cloud | Room token signing secret. |
| `SPEECH_ANALYZER_PROVIDER=local` | Local PyTorch Model | Routes speech analysis to your local laptop model. |
| `LOCAL_SPEECH_MODEL_URL` | Local Model Server | `http://localhost:8000/analyze-tone` |

---

## 5. Quick Start Guide

### 1. Install Dependencies
```bash
pnpm install
# or
npm install
```

### 2. Run Development Server
```bash
pnpm run dev
# or
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 3. Demo Credentials (Offline Mock Mode)
- **Email**: `demo@synterview.local`
- **Password**: `password123`
*(Or click "Register" to create any local candidate account).*

### 4. Running Your Custom Local Speech ML Model
If you want to test your custom PyTorch speech confidence model:
```bash
cd services/local_speech_model
pip install fastapi uvicorn pydantic
python main.py
```
Then set in `.env.local`:
```bash
SPEECH_ANALYZER_PROVIDER=local
LOCAL_SPEECH_MODEL_URL=http://localhost:8000/analyze-tone
```

---

## 6. Current Implementation Status & Stubs

- [x] **Dual-token JWT Auth System**: Complete (`tokens.ts`, `cookies.ts`, `store.ts`, route handlers, silent refresh).
- [x] **TanStack Query v5 Server State**: Complete (`apiClient`, `useAuth`, `useInterview`).
- [x] **Drizzle ORM Schema**: Complete (`users`, `interviewSessions`, `interviewAnswers`, `interviewScorecards` + mock fallback).
- [x] **Stage 1 (Prep)**: Complete (`/dashboard/prep`, `IQuestionPlanner`, `MockQuestionPlanner`, `GeminiQuestionPlanner`).
- [x] **Stage 2 (Live)**: Complete (`/dashboard/interview/[id]`, `AudioVisualizer`, `MockVoiceInterviewer`, `LiveKit` token route).
- [x] **Stage 3 (Post)**: Complete (`/dashboard/report/[id]`, overall grade, competency rubrics, strengths/growth, actionable tips).
- [x] **Local Speech Model Interface**: Complete (`ISpeechAnalysisAdapter`, `MockSpeechAnalysisAdapter`, `LocalModelSpeechAdapter`, FastAPI server template).
- [x] **Phase 4: Real Acoustic Feature Extraction**: Complete (librosa pYIN with fast 512 hop-length, numpy autocorrelation fallback, volume decay, pause ratio, pitch std/range semitones, transparent audio reliability).
- [x] **Phase 5: Rubric Evaluation & Interview Report**: Complete (5-dimension rubric, low-temp JSON Ollama evaluation, quote validation against transcript, 5-axis SVG radar chart, multi-question acoustic metric trend charts, inline pause and filler highlighted transcripts, local IndexedDB persistence, progress trends, local PDF export).
- [ ] **Stub / Future Enhancements**:
  - LiveKit Python Worker daemon (mirrored from DeepInterview `apps/agent/worker.py` for advanced server-side VAD turn detection if self-hosting LiveKit agents).
  - Video avatar canvas rendering (from DeepInterview `apps/web/components/avatar`).

---

## 7. Phase 5 Architecture: Rubric Evaluation & Interview Report

Synterview Phase 5 introduces a grounded, multi-modal interview evaluation and reporting engine engineered for zero hallucination, honest scoring, and transparent provenance:

### A. Fixed 5-Dimension Rubric
Every answer is evaluated across 5 core competency dimensions:
1. **Relevance**: Direct alignment with the prompt; no rambling or off-topic drift.
2. **Technical Depth**: Accurate domain mechanics, trade-offs, edge-cases, system constraints.
3. **Structure**: Coherent narrative flow (strictly enforcing the **STAR** method for behavioral questions).
4. **Clarity**: Articulation, precision, conciseness, absence of ambiguity.
5. **Examples & Metrics**: Concrete production scenarios, quantifiable results, benchmarks.

Each dimension is scored on a **1.0 to 5.0 scale** accompanied by an exact one-line justification.

### B. Deterministic Evaluation & "Never Fake Scores" Rule
- **Low Temperature (0.2)**: Ollama calls use temperature 0.2 with `format: "json"` and strict Pydantic validation.
- **Fail-Safe Mechanism**: The evaluator retries once on malformed JSON or schema violation. If the model is offline or unrecoverable, Synterview marks the evaluation as `unavailable` with `overall_score: null`. **It never fakes or fabricates scores.**
- **Quote-Existence Verification**: Any strength or improvement identified by the AI must cite a short phrase from the candidate's actual answer. Synterview normalizes punctuation, casing, and whitespace to verify that the quote genuinely exists in the transcript; any hallucinated or fabricated quote is stripped (`quote: null`).

### C. Three-Way Source Separation
Every metric, card, and chart in the interview report clearly badges its exact data provenance:
- **Measured (audio)** (Green): Objective physical acoustics computed directly from candidate audio via `librosa`/`numpy` (WPM, pause ratio, pitch variation, volume decay).
- **Measured (text)** (Sky): Objective textual statistics calculated deterministically from the speech transcript (word count, duration, filler count).
- **AI-assessed (LLM)** (Indigo): Subjective qualitative scores synthesized by the local LLM (`qwen2.5-coder:7b` / `llama3.2:3b`) via structured prompt evaluation.

Interactive tooltips explain exactly how each metric was computed.

### D. Visualizations & Interactive Report Page (`/report/:sessionId`)
- **5-Axis Vector Radar Chart**: SVG radar visualization plotting candidate scores against a 4.0 target competency baseline.
- **Multi-Question Metric Trends**: Chronological SVG charts tracking WPM pace, pause ratio, pitch semitone variation, and filler word frequency across each question turn.
- **Transcript Viewer**: Highlights filler words in amber and displays long pauses (>1.2s) inline (e.g. `[Pause 1.8s]`).
- **Synthesis Section**: Top 3 candidate strengths, top 3 targeted growth areas (with verified candidate quotes), and 3 concrete "Practice Next" exercises.
- **PDF Export**: Print-ready stylesheet (`@media print`) and button to produce a clean, vector-rendered PDF locally without third-party cloud APIs.

### E. Local Persistence & Privacy
- **100% Local Storage**: Interview sessions and reports are stored inside the candidate's browser via **IndexedDB** (`synterview_db` / `sessions` store) with a localStorage fallback. No session data is transmitted to the cloud.
- **Progress View (`/sessions`)**: Candidates can review past interviews, view progress trend lines over time (score, pace, filler frequency, pause ratio), and delete historical sessions.
- **Vocal Privacy**: In strict compliance with the "Save audio for training" setting, raw audio blobs are stripped before persistence unless the candidate has explicitly enabled audio training data capture.

---

## 8. Assumptions & Environment Dependencies

1. **Local LLM Endpoint**: Assumes Ollama is running locally at `http://127.0.0.1:11434` with an installed model (`qwen2.5-coder:7b`, `llama3.2:3b`, or similar). If Ollama is offline, question generation falls back to clean templates and answer evaluation gracefully degrades with clear "evaluation unavailable" notices.
2. **Local FastAPI Speech Service**: Operates on `http://127.0.0.1:8000`. If unavailable, the browser handles text-only scoring and local fallback synthesis.
3. **Audio Capture**: Candidate mic audio is captured via Web Audio `MediaRecorder` in `audio/webm;codecs=opus` at 16 kHz mono. Decoded on the backend with `ffmpeg` or `soundfile`.
4. **librosa Optimization**: Uses `librosa.pyin` with `hop_length=512` (32ms windows) for sub-3-second acoustic pitch tracking. If `librosa` or `soundfile` is missing, the backend automatically falls back to numpy-based autocorrelation and displays an `"Autocorr Fallback"` badge.
5. **Print-to-PDF**: Relies on browser-native `@media print` capabilities to render vector SVGs, scorecards, and attribution footers directly into PDF format.


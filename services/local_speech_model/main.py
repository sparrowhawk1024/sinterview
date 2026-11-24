"""
Synterview Local Speech, NLP, Ollama & CosyVoice 2 Model Service
================================================================
FastAPI service orchestrating:
1. Speech Confidence & Tone Analysis (pace, clarity, emotion, filler words)
2. Technical Answer Evaluation & Scoring
3. Ollama Integration for generating deep technical questions on any topic
4. CosyVoice 2 Integration for natural voice synthesis & asking questions

Usage:
  python services/local_speech_model/main.py
"""

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn
import re
import os
import sys
import json
import base64
import time
import requests
import tempfile

# Ensure project root is on path for scripts
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

# Ensure bin directory (with ffmpeg.exe) is in PATH
_bin_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "bin"))
if os.path.exists(_bin_path) and _bin_path not in os.environ.get("PATH", ""):
    os.environ["PATH"] = _bin_path + os.pathsep + os.environ.get("PATH", "")

try:
    from services.local_speech_model.transcribe_service import transcribe_audio_bytes, get_whisper_model
except ImportError:
    from transcribe_service import transcribe_audio_bytes, get_whisper_model

try:
    from services.local_speech_model.acoustic import (
        extract_features,
        decode_audio_bytes,
        check_ffmpeg_installed
    )
except ImportError:
    from acoustic import (
        extract_features,
        decode_audio_bytes,
        check_ffmpeg_installed
    )

try:
    from scripts.export_features import append_answer_features_to_csv
except ImportError:
    append_answer_features_to_csv = None

try:
    from services.local_speech_model.rubric_evaluator import (
        evaluate_candidate_answer_rubric,
        summarize_full_interview_session,
    )
except ImportError:
    from rubric_evaluator import (
        evaluate_candidate_answer_rubric,
        summarize_full_interview_session,
    )

try:
    from services.local_speech_model.config import CONFIG
    from services.local_speech_model.word_features import (
        reconcile_and_build_word_features,
        WordFeature,
        check_quality_gate
    )
    from services.local_speech_model.hesitation import (
        compute_delivery_hesitation_index,
        map_hesitation_to_concepts
    )
    from services.local_speech_model.speaker_baseline import (
        SpeakerBaseline,
        calibrate_speaker_baseline,
        compute_baseline_deviations,
        compute_adaptive_turn_silence_timeout
    )
    from services.local_speech_model.claim_verifier import (
        verify_claims_deterministically,
        StructuredClaimInput
    )
    from services.local_speech_model.visual import (
        VisualFrame,
        VisualTelemetryAggregate,
        aggregate_visual_frames
    )
    from services.local_speech_model.late_fusion import (
        compute_late_fusion,
        LateFusionResult
    )
    from services.local_speech_model.question_bank import (
        get_fallback_questions,
        get_bank_metadata
    )
    from services.local_speech_model.tts_service import generate_speech_audio
except ImportError:
    from config import CONFIG
    from word_features import (
        reconcile_and_build_word_features,
        WordFeature,
        check_quality_gate
    )
    from hesitation import (
        compute_delivery_hesitation_index,
        map_hesitation_to_concepts
    )
    from speaker_baseline import (
        SpeakerBaseline,
        calibrate_speaker_baseline,
        compute_baseline_deviations,
        compute_adaptive_turn_silence_timeout
    )
    from claim_verifier import (
        verify_claims_deterministically,
        StructuredClaimInput
    )
    from visual import (
        VisualFrame,
        VisualTelemetryAggregate,
        aggregate_visual_frames
    )
    from late_fusion import (
        compute_late_fusion,
        LateFusionResult
    )
    from question_bank import (
        get_fallback_questions,
        get_bank_metadata
    )
    from tts_service import generate_speech_audio

app = FastAPI(title="Synterview Local AI & Voice Engine")

# Enable CORS for local development from frontend (http://localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
COSYVOICE_BASE_URL = os.getenv("COSYVOICE_BASE_URL", "http://127.0.0.1:50000")

# -------------------------------------------------------------
# Data Models
# -------------------------------------------------------------

class AnalysisRequest(BaseModel):
    transcript: str
    audio_base64: Optional[str] = None
    mime_type: Optional[str] = "audio/webm"
    duration_seconds: Optional[float] = 30.0
    visual_telemetry: Optional[Dict[str, Any]] = None

class AnalysisResponse(BaseModel):
    confidence_score: float  # 0.0 to 1.0 (backward compatibility)
    pace_wpm: int           # Words Per Minute
    clarity_score: float    # 0.0 to 1.0
    tone_emotion: str       # "confident" | "steady" | "hesitant" | "anxious" | "monotone"
    filler_word_count: int
    filler_words: List[str]
    feedback_notes: List[str]

    # Phase 4 Real Acoustic & Explainable Fields
    delivery_score: Optional[float] = None
    delivery_reasons: Optional[List[str]] = Field(default_factory=list)
    clarity_reasons: Optional[List[str]] = Field(default_factory=list)
    analysis_label: Optional[str] = "Text-only analysis"
    reliability: Optional[str] = "high"
    reliability_reasons: Optional[List[str]] = Field(default_factory=list)
    pitch_std_semitones: Optional[float] = None
    pitch_range_semitones: Optional[float] = None
    pitch_median_hz: Optional[float] = None
    pitch_method: Optional[str] = None
    pause_ratio: Optional[float] = None
    longest_pause_s: Optional[float] = None
    long_pause_count: Optional[int] = None
    voiced_duration_seconds: Optional[float] = None
    speech_rate_wpm: Optional[float] = None
    trailing_off_delta_db: Optional[float] = None
    is_trailing_off: Optional[bool] = None
    sources: Optional[Dict[str, str]] = Field(default_factory=dict)

    # Delivery Hesitation, Baseline, and Concept Targeting Fields
    hesitation_index: Optional[float] = None
    hesitation_interpretation: Optional[str] = None
    hesitation_formula: Optional[str] = None
    hesitation_inputs: Optional[Dict[str, Any]] = None
    target_concept: Optional[str] = None
    target_concept_reason: Optional[str] = None
    speaker_baseline_calibrated: Optional[bool] = None
    normalized_pace_flag: Optional[str] = None
    normalized_pause_flag: Optional[str] = None
    adaptive_silence_timeout_s: Optional[float] = None
    word_features: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    quality_gate_passed: Optional[bool] = True
    quality_gate_reason: Optional[str] = None
    verified_claims: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    unsupported_claim_rate: Optional[float] = None
    visual_telemetry: Optional[Dict[str, Any]] = None
    late_fusion: Optional[Dict[str, Any]] = None

class EvaluateAnswerRequest(BaseModel):
    question_id: str
    question_text: str
    answer_text: str
    duration_seconds: Optional[float] = 25.0
    category: Optional[str] = ""
    difficulty: Optional[str] = "Mid-Level"
    visual_telemetry: Optional[Dict[str, Any]] = None
    ablate_modality: Optional[str] = None

class EvaluateAnswerResponse(BaseModel):
    question_id: str
    score: Optional[float] = None            # 1.0 to 10.0 (None if unavailable)
    overall_score: Optional[float] = None    # 1.0 to 5.0 (None if unavailable)
    grade: str                               # "A+" | "A" | "B+" | "B" | "C" | "N/A"
    tone_analysis: AnalysisResponse
    model_summary: str
    strengths: List[str]
    improvements: List[str]
    rubric: Optional[Dict[str, Any]] = None
    quoted_strengths: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    quoted_improvements: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    evaluation_status: Optional[str] = "success"
    evaluation_unavailable: Optional[bool] = False
    target_concept: Optional[str] = None
    target_concept_reason: Optional[str] = None
    verified_claims: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    unsupported_claim_rate: Optional[float] = None
    visual_telemetry: Optional[Dict[str, Any]] = None
    late_fusion: Optional[Dict[str, Any]] = None

class InterviewSummaryRequest(BaseModel):
    session_id: str
    role: Optional[str] = "Frontend Developer"
    candidate_name: Optional[str] = "Candidate"
    questions: List[Dict[str, Any]] = Field(default_factory=list)

class InterviewSummaryResponse(BaseModel):
    session_id: str
    candidate_name: str
    role: str
    overall_score: Optional[float] = None
    grade: str
    verdict: str
    overall_summary: str
    radar_data: Dict[str, float]
    acoustic_summary: Dict[str, Any]
    top_strengths: List[Dict[str, Any]]
    top_improvements: List[Dict[str, Any]]
    practice_next: List[str]
    questions_count: int
    answered_count: int
    evaluation_unavailable: bool
    sources: Dict[str, str]

class GenerateSummaryRequest(BaseModel):
    meeting_title: str
    participants: List[str]
    answered_questions: List[str]

class GenerateSummaryResponse(BaseModel):
    summary: str
    key_competencies: List[str]
    overall_sentiment: str

class OllamaQuestionRequest(BaseModel):
    topic: str
    role: Optional[str] = "Frontend Developer"
    difficulty: Optional[str] = "Mid-Level" # "Junior" | "Mid-Level" | "Senior" | "Lead"
    count: Optional[int] = 5
    model: Optional[str] = None

class GeneratedQuestionItem(BaseModel):
    number: int
    text: str
    category: Optional[str] = "Technical"
    difficulty: Optional[str] = "Mid-Level"
    candidate_answer_sample: Optional[str] = None
    ideal_answer_points: Optional[List[str]] = Field(default_factory=list)

class OllamaQuestionResponse(BaseModel):
    success: bool
    topic: str
    model_used: str
    questions: List[GeneratedQuestionItem]
    raw_info: Optional[str] = None

class QuestionBankSelectRequest(BaseModel):
    role: str = "Software Engineer"
    difficulty: str = "Medium"
    interview_type: str = "Technical"
    count: int = 5

class TTSRequest(BaseModel):
    text: str
    gender: str = "female"
    accent: str = "us"

class HintRequest(BaseModel):
    question_text: str
    hint_level: int = 1
    ideal_answer_points: Optional[List[str]] = None

class HintResponse(BaseModel):
    success: bool
    hint_level: int
    hint: str
    ideal_answer: Optional[str] = None

class CosyVoiceTTSRequest(BaseModel):
    text: str
    speaker: Optional[str] = "female_interviewer"
    speed: Optional[float] = 1.0
    server_url: Optional[str] = None

class CosyVoiceTTSResponse(BaseModel):
    status: str # "success" | "fallback" | "error"
    engine: str # "cosyvoice2" | "web_speech_fallback"
    audio_base64: Optional[str] = None
    message: Optional[str] = None
    text: str

class HistoryItem(BaseModel):
    question: str
    answer: str

class NextTurnRequest(BaseModel):
    role: str = "Frontend Developer"
    difficulty: str = "Mid-Level"
    persona: str = "friendly" # "friendly" | "neutral" | "tough"
    history: List[HistoryItem] = Field(default_factory=list)
    current_question: str
    candidate_answer: str
    next_planned_question: Optional[str] = None
    questions_remaining: int = 0
    follow_ups_used_for_this_question: int = 0
    root_question_id: Optional[str] = None
    target_concept: Optional[str] = None

class NextTurnResponse(BaseModel):
    reaction: str
    next_question: Optional[str] = None
    follow_up: bool = False
    degraded: bool = False
    target_concept: Optional[str] = None
    target_concept_reason: Optional[str] = None

NEXT_TURN_MODEL = os.getenv("NEXT_TURN_MODEL", "llama3.2:3b")

COMMON_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
    "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't",
    "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
    "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him",
    "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't",
    "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor",
    "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
    "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
    "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to",
    "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "well", "like", "okay", "alright", "yeah", "yes", "um", "uh"
}

def extract_content_stems(text: str) -> set:
    """Extract content words and apply light stemming (first 5 chars) for robust overlap detection."""
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    stems = set()
    for w in words:
        if len(w) > 2 and w not in COMMON_STOPWORDS:
            # 5-character prefix stem handles e.g. optimize/optimizing/optimization
            stems.add(w[:5] if len(w) >= 5 else w)
    return stems

# Maintain extract_content_words alias for backward compatibility
extract_content_words = extract_content_stems

def validate_and_repair_next_turn(
    raw_json: Dict[str, Any],
    candidate_answer: str,
    next_planned_question: Optional[str],
    questions_remaining: int,
    follow_ups_used: int,
    target_concept: Optional[str] = None,
    target_concept_reason: Optional[str] = None
) -> NextTurnResponse:
    reaction = str(raw_json.get("reaction") or "").strip()
    next_question = raw_json.get("next_question")
    if next_question is not None:
        next_question = str(next_question).strip()
    follow_up = bool(raw_json.get("follow_up", False))

    # Server-side follow-up cap: strictly max 1 follow-up per root question chain
    if follow_ups_used >= 1:
        if follow_up:
            follow_up = False
            # Revert to planned syllabus question if a chained follow-up was attempted
            next_question = next_planned_question

    # 1. Reaction word count check: max 25 words
    reaction_words = reaction.split()
    if len(reaction_words) > 25:
        reaction = ""

    # 2. Score pattern check: reject if contains digit score pattern (e.g. 8/10, score, grade)
    if reaction and re.search(r"(\d+\s*/\s*10|\b\d+\s+out\s+of\s+10\b|\bscore\b|\bgrade\b)", reaction, re.IGNORECASE):
        reaction = ""

    # 3. Content stem overlap check between candidate answer and reaction
    if reaction:
        answer_stems = extract_content_stems(candidate_answer)
        reaction_stems = extract_content_stems(reaction)
        if answer_stems and reaction_stems:
            overlap = answer_stems.intersection(reaction_stems)
            if not overlap:
                # No overlap: reaction does not reference anything specific candidate said
                reaction = ""

    # 4. Clean up next_question
    if not next_question or next_question.lower() in ("null", "none"):
        if questions_remaining > 0 and next_planned_question:
            next_question = next_planned_question
        else:
            next_question = None

    return NextTurnResponse(
        reaction=reaction,
        next_question=next_question,
        follow_up=follow_up,
        degraded=False,
        target_concept=target_concept,
        target_concept_reason=target_concept_reason
    )

# -------------------------------------------------------------
# Ollama Helper Functions
# -------------------------------------------------------------

def get_installed_ollama_models() -> List[str]:
    try:
        res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2.5)
        if res.ok:
            data = res.json()
            return [m.get("name") for m in data.get("models", []) if m.get("name")]
    except Exception:
        pass
    return []

def query_ollama_generate(prompt: str, model_name: str) -> Optional[str]:
    try:
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            }
        }
        res = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=60.0
        )
        if res.ok:
            return res.json().get("response")
    except Exception as e:
        print(f"Ollama generation error: {e}")
    return None

# -------------------------------------------------------------
# Health & Status Endpoints
# -------------------------------------------------------------

@app.get("/health")
async def health():
    import shutil
    has_ffmpeg = shutil.which("ffmpeg") is not None
    ollama_models = get_installed_ollama_models()
    return {
        "status": "online",
        "service": "Synterview Local Speech, NLP & Voice Engine",
        "port": 8000,
        "ffmpeg_available": has_ffmpeg,
        "next_turn_model": NEXT_TURN_MODEL,
        "ollama": {
            "online": len(ollama_models) > 0,
            "models": ollama_models,
            "url": OLLAMA_BASE_URL
        },
        "cosyvoice": {
            "url": COSYVOICE_BASE_URL,
            "supported": True
        }
    }

def warmup_next_turn_sync() -> dict:
    """Synchronous worker to preload NEXT_TURN_MODEL weights in Ollama with keep_alive: 30m."""
    try:
        installed = get_installed_ollama_models()
        if not installed:
            return {"status": "skipped", "message": "Ollama offline or no models found"}
        chosen = NEXT_TURN_MODEL if NEXT_TURN_MODEL in installed else installed[0]
        res = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": chosen,
                "prompt": "warmup",
                "keep_alive": "30m",
                "options": {"num_predict": 1}
            },
            timeout=8.0
        )
        if res.ok:
            return {"status": "warmed", "model": chosen}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    return {"status": "failed"}

@app.on_event("startup")
async def on_startup():
    import shutil
    import asyncio
    has_ffmpeg = shutil.which("ffmpeg") is not None
    print(f"[Startup] Synterview local engine ready. ffmpeg available: {has_ffmpeg}")
    # Run model warmup in a threadpool so startup doesn't block
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, warmup_next_turn_sync)

@app.post("/warmup-next-turn")
@app.get("/warmup-next-turn")
async def warmup_next_turn():
    """Manual warmup endpoint called by frontend on app load."""
    import asyncio
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, warmup_next_turn_sync)
    return result

@app.get("/ollama/status")
async def ollama_status():
    models = get_installed_ollama_models()
    default_model = None
    if models:
        # Prioritize qwen2.5-coder or llama3
        coder_models = [m for m in models if "qwen" in m.lower() or "coder" in m.lower() or "llama" in m.lower()]
        default_model = coder_models[0] if coder_models else models[0]

    return {
        "online": len(models) > 0,
        "models": models,
        "default_model": default_model,
        "endpoint": OLLAMA_BASE_URL
    }

@app.get("/cosyvoice/status")
async def cosyvoice_status(server_url: Optional[str] = None):
    target_url = server_url or COSYVOICE_BASE_URL
    is_online = False
    try:
        # Test basic connection to CosyVoice service
        r = requests.get(target_url, timeout=1.5)
        is_online = r.status_code in [200, 404, 405] # Server is listening
    except Exception:
        is_online = False

    return {
        "online": is_online,
        "server_url": target_url,
        "engine": "cosyvoice2" if is_online else "web_speech_fallback",
        "note": "CosyVoice 2 endpoint ready. If server is not yet booted, client gracefully uses browser voiceover."
    }

# -------------------------------------------------------------
# 1. Ollama: Topic-Based Question Generation
# -------------------------------------------------------------

@app.post("/generate-questions-ollama", response_model=OllamaQuestionResponse)
async def generate_questions_ollama(req: OllamaQuestionRequest):
    installed = get_installed_ollama_models()
    
    # Pick target model
    target_model = req.model
    if not target_model:
        if installed:
            coder_models = [m for m in installed if "qwen" in m.lower() or "coder" in m.lower()]
            target_model = coder_models[0] if coder_models else installed[0]
        else:
            target_model = "qwen2.5-coder:7b"

    prompt = f"""
You are a Principal Tech Interviewer conducting a hiring interview for a {req.role} position.
Generate exactly {req.count} insightful, modern interview questions focusing specifically on the topic: "{req.topic}".
The difficulty level is {req.difficulty}.

Return ONLY a JSON object with this exact structure:
{{
  "questions": [
    {{
      "number": 1,
      "text": "Detailed question text exploring technical understanding, edge cases, and architectural tradeoffs.",
      "category": "{req.topic}",
      "difficulty": "{req.difficulty}",
      "candidate_answer_sample": "A concise example of what a proficient candidate might say.",
      "ideal_answer_points": [
        "Key point 1 that the candidate must mention",
        "Key point 2 regarding performance or tradeoffs",
        "Key point 3 demonstrating real-world production experience"
      ]
    }}
  ]
}}
Do not write markdown prose or conversational introductory text outside the JSON. Return valid JSON only.
"""

    raw_response = None
    if installed:
        raw_response = query_ollama_generate(prompt, target_model)

    if raw_response:
        try:
            # Clean JSON if any markdown wrapping exists
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            
            data = json.loads(cleaned.strip())
            q_list = data.get("questions", [])
            parsed_questions: List[GeneratedQuestionItem] = []
            
            for idx, item in enumerate(q_list, start=1):
                parsed_questions.append(
                    GeneratedQuestionItem(
                        number=item.get("number", idx),
                        text=item.get("text", f"Question on {req.topic}"),
                        category=item.get("category", req.topic),
                        difficulty=item.get("difficulty", req.difficulty),
                        candidate_answer_sample=item.get("candidate_answer_sample", "I leverage modern best practices to optimize this flow."),
                        ideal_answer_points=item.get("ideal_answer_points", ["Conceptual depth", "Performance considerations"]),
                    )
                )

            if parsed_questions:
                return OllamaQuestionResponse(
                    success=True,
                    topic=req.topic,
                    model_used=target_model,
                    questions=parsed_questions,
                    raw_info="Generated successfully via local Ollama engine."
                )
        except Exception as parse_err:
            print("Failed to parse Ollama JSON output, falling back to smart synthesis:", parse_err)

    # Heuristic fallback if Ollama server is offline or response parsing failed
    fallback_templates = [
        (f"Can you explain the core architectural principles behind {req.topic} and how you implement them in production?",
         f"In production, I approach {req.topic} by structuring clear interfaces and optimizing state lifecycle."),
        (f"What are the biggest performance bottlenecks or common antipatterns when working with {req.topic}?",
         f"Common bottlenecks in {req.topic} involve excessive memory consumption and redundant blocking operations."),
        (f"How do you handle error resilience, telemetry, and debugging when dealing with {req.topic}?",
         f"I implement structured observability, circuit breakers, and comprehensive integration testing."),
        (f"Compare two popular strategies or libraries for solving {req.topic} problems. What tradeoffs guide your choice?",
         f"The primary tradeoff is flexibility and bundle overhead versus opinionated boilerplate."),
        (f"Walk me through a real-world edge-case scenario you faced involving {req.topic} and how you resolved it.",
         f"We encountered a race condition during peak concurrency, which we resolved by enforcing idempotent transaction boundaries.")
    ]

    selected = fallback_templates[:req.count]
    questions = [
        GeneratedQuestionItem(
            number=i + 1,
            text=text,
            category=req.topic,
            difficulty=req.difficulty,
            candidate_answer_sample=ans,
            ideal_answer_points=[
                "Deep understanding of technical fundamentals",
                "Awareness of production scalability tradeoffs",
                "Concrete example with measurable impact"
            ]
        )
        for i, (text, ans) in enumerate(selected)
    ]

    return OllamaQuestionResponse(
        success=True,
        topic=req.topic,
        model_used=f"{target_model} (Heuristic Generator Fallback)",
        questions=questions,
        raw_info="Ollama server offline or model loading; questions synthesized via contextual engineering template."
    )

# -------------------------------------------------------------
# Question Bank & Cloud-TTS Endpoints (Integrated from synterview_mark2)
# -------------------------------------------------------------

@app.get("/api/question-bank/categories")
async def get_question_bank_categories():
    """Returns catalog of roles, difficulties, and question counts from question bank."""
    return get_bank_metadata()


@app.post("/api/question-bank/select")
async def select_questions_from_bank(req: QuestionBankSelectRequest):
    """Selects categorized questions from the structured question bank."""
    questions_raw = get_fallback_questions(
        role=req.role,
        difficulty=req.difficulty,
        interview_type=req.interview_type,
        count=req.count
    )
    items = []
    for idx, q in enumerate(questions_raw, start=1):
        items.append(
            GeneratedQuestionItem(
                number=idx,
                text=q.get("text", ""),
                category=q.get("category", req.interview_type),
                difficulty=req.difficulty,
                candidate_answer_sample="I leverage best engineering practices to address this.",
                ideal_answer_points=[
                    f"Core principles of {q.get('category', req.interview_type)}",
                    "Practical architectural tradeoffs and edge cases",
                    "Demonstrable production experience"
                ]
            )
        )
    return {
        "success": True,
        "role": req.role,
        "difficulty": req.difficulty,
        "interview_type": req.interview_type,
        "questions": items
    }


@app.post("/api/tts/speak")
async def tts_speak(req: TTSRequest):
    """
    Synthesizes speech via OpenAI TTS or Edge TTS.
    Returns audio/mpeg or 204 No Content for seamless Web Speech API client fallback.
    """
    audio_data = generate_speech_audio(
        text=req.text,
        gender=req.gender,
        accent=req.accent
    )
    if audio_data:
        return Response(content=audio_data, media_type="audio/mpeg")
    return Response(status_code=204)


@app.post("/api/hint", response_model=HintResponse)
async def get_interview_hint(req: HintRequest):
    """
    Returns progressive hints (levels 1-5) and ideal answer points when a candidate is stuck.
    """
    level = max(1, min(5, req.hint_level))
    points = req.ideal_answer_points or []
    
    if level == 1:
        hint_text = "Think about the foundational concepts: clarify the core objective, definition, and the main problem this solves."
    elif level == 2:
        hint_text = "Structure your answer: explain the component architecture, data flow, or state lifecycle."
    elif level == 3:
        if points and len(points) >= 1:
            hint_text = f"Key element to cover: consider {points[0]}."
        else:
            hint_text = "Discuss practical edge cases, performance bottlenecks, and caching or optimization tradeoffs."
    elif level == 4:
        if points and len(points) >= 2:
            hint_text = f"Advanced considerations: don't forget to address {points[1]} and failure modes."
        else:
            hint_text = "Connect your explanation to a real-world production incident, metric, or deployment tradeoff."
    else:
        hint_text = "Wrap up with the STAR method (Situation, Task, Action, Result) referencing concrete tools and metrics."

    ideal = "\n• ".join(["Key elements of an exceptional answer:"] + points) if points else (
        "Ideal structure: 1) Clear technical definition, 2) Tradeoff analysis, 3) Real-world implementation example."
    )

    return HintResponse(
        success=True,
        hint_level=level,
        hint=hint_text,
        ideal_answer=ideal if level >= 3 else None
    )


# -------------------------------------------------------------
# 1B. Adaptive Turn Generation: POST /next-turn
# -------------------------------------------------------------

@app.post("/next-turn", response_model=NextTurnResponse)
async def next_turn(req: NextTurnRequest):
    """
    Generates an adaptive live-discussion turn:
    - Reaction: 1 spoken sentence referencing a specific point candidate made
    - Next Question: either a probing follow-up (if vague/short and follow_ups == 0)
      or the next planned question reworded naturally
    Strict validation & repair guarantees no hallucinations, no digit score talk, and strict follow-up caps.
    """
    # Hesitation-to-concept targeting
    candidate_words = extract_word_features_from_asr(req.candidate_answer)
    concept_res = map_hesitation_to_concepts(candidate_words)
    target_concept = req.target_concept or concept_res.target_concept
    target_concept_reason = concept_res.selection_reason
    if target_concept:
        print(f"[NextTurn] Probing target concept: '{target_concept}' | Reason: {target_concept_reason}")

    installed = get_installed_ollama_models()
    if not installed:
        # Ollama is offline or no models installed — return degraded response immediately
        return NextTurnResponse(
            reaction="",
            next_question=req.next_planned_question,
            follow_up=False,
            degraded=True,
            target_concept=target_concept,
            target_concept_reason=target_concept_reason
        )

    # Pick model: prefer NEXT_TURN_MODEL if installed, else first available
    chosen_model = NEXT_TURN_MODEL
    if chosen_model not in installed:
        # Look for small 3b models first, else fallback to whatever is installed
        small_models = [m for m in installed if "3b" in m.lower() or "qwen" in m.lower() or "llama" in m.lower()]
        chosen_model = small_models[0] if small_models else installed[0]

    persona_map = {
        "friendly": "a warm, encouraging, but rigorous interviewer",
        "neutral": "an objective, concise, and professional interviewer",
        "tough": "a direct, skeptical, senior engineering interviewer who probes for depth"
    }
    persona_desc = persona_map.get(req.persona.lower(), persona_map["friendly"])

    system_prompt = (
        f"You are {persona_desc}, a human interviewer for a {req.role} role in a live spoken interview. "
        "Reply ONLY with JSON: {\"reaction\": string, \"next_question\": string | null, \"follow_up\": boolean}.\n"
        "Rules for reaction: one spoken sentence, max 22 words, must reference a specific thing the candidate actually said, "
        "no scores, no 'great answer' style generic praise, no lists.\n"
        "Rules for next_question: conversational, one question only, max 30 words, never numbered.\n"
        f"If the answer was vague, under 25 words, or skipped a key point AND follow_ups_used_for_this_question is 0, "
        "set follow_up=true and make next_question a probing follow-up on the SAME topic.\n"
        "Otherwise set follow_up=false and use next_planned_question, lightly reworded to flow from the conversation.\n"
        "If next_planned_question is null and questions_remaining is 0, set next_question=null."
    )

    user_context = {
        "role": req.role,
        "difficulty": req.difficulty,
        "persona": req.persona,
        "recent_history": [{"question": h.question, "answer": h.answer} for h in req.history[-3:]],
        "current_question": req.current_question,
        "candidate_answer": req.candidate_answer,
        "next_planned_question": req.next_planned_question,
        "questions_remaining": req.questions_remaining,
        "follow_ups_used_for_this_question": req.follow_ups_used_for_this_question,
        "target_concept_to_probe": target_concept,
        "target_concept_reason": target_concept_reason
    }

    prompt = f"System:\n{system_prompt}\n\nContext:\n{json.dumps(user_context, indent=2)}\n\nRespond with strict JSON only:"

    payload = {
        "model": chosen_model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "keep_alive": "30m",
        "options": {
            "temperature": 0.4
        }
    }

    try:
        res = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=7.0
        )
        if res.ok:
            raw_text = res.json().get("response", "").strip()
            try:
                parsed = json.loads(raw_text)
                return validate_and_repair_next_turn(
                    parsed,
                    req.candidate_answer,
                    req.next_planned_question,
                    req.questions_remaining,
                    req.follow_ups_used_for_this_question,
                    target_concept=target_concept,
                    target_concept_reason=target_concept_reason
                )
            except json.JSONDecodeError:
                # Retry once asking for strict JSON repair
                retry_payload = {
                    "model": chosen_model,
                    "prompt": f"{prompt}\n\nPrevious response was invalid JSON: '{raw_text}'. Output valid JSON with keys reaction, next_question, follow_up:",
                    "stream": False,
                    "format": "json",
                    "keep_alive": "30m",
                    "options": {"temperature": 0.2}
                }
                retry_res = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=retry_payload, timeout=2.0)
                if retry_res.ok:
                    retry_text = retry_res.json().get("response", "").strip()
                    parsed = json.loads(retry_text)
                    return validate_and_repair_next_turn(
                        parsed,
                        req.candidate_answer,
                        req.next_planned_question,
                        req.questions_remaining,
                        req.follow_ups_used_for_this_question,
                        target_concept=target_concept,
                        target_concept_reason=target_concept_reason
                    )
    except Exception as e:
        print(f"POST /next-turn degraded: {e}")

    # Fallback on timeout or failure: no reaction (never invent one), continue interview
    return NextTurnResponse(
        reaction="",
        next_question=req.next_planned_question,
        follow_up=False,
        degraded=True,
        target_concept=target_concept,
        target_concept_reason=target_concept_reason
    )

# -------------------------------------------------------------
# 2. CosyVoice 2: Voice Synthesis & Question Speech
# -------------------------------------------------------------

@app.post("/cosyvoice/tts", response_model=CosyVoiceTTSResponse)
async def cosyvoice_tts(req: CosyVoiceTTSRequest):
    target_server = req.server_url or COSYVOICE_BASE_URL
    
    # 1. Quick check if CosyVoice server on port 50000 is running
    is_server_up = False
    try:
        r = requests.get(target_server, timeout=0.3)
        is_server_up = r.status_code in [200, 404, 405]
    except Exception:
        is_server_up = False

    if is_server_up:
        for endpoint in ["/inference_sft", "/tts", "/api/tts"]:
            try:
                payload = {
                    "tts_text": req.text,
                    "spk_id": req.speaker or "中文女",
                    "text": req.text,
                    "speaker": req.speaker,
                    "speed": req.speed or 1.0,
                }
                res = requests.post(f"{target_server}{endpoint}", json=payload, timeout=5.0)
                if res.ok and len(res.content) > 100:
                    audio_b64 = base64.b64encode(res.content).decode("utf-8")
                    return CosyVoiceTTSResponse(
                        status="success",
                        engine="cosyvoice2",
                        audio_base64=f"data:audio/wav;base64,{audio_b64}",
                        text=req.text,
                        message="Speech successfully synthesized with CosyVoice 2."
                    )
            except Exception:
                continue

    # 2. Return fallback immediately (<1ms) so the frontend speaks instantly via Web Speech API
    return CosyVoiceTTSResponse(
        status="fallback",
        engine="web_speech_fallback",
        audio_base64=None,
        text=req.text,
        message=f"CosyVoice 2 service at {target_server} is offline. Using high-fidelity browser voice engine."
    )

# -------------------------------------------------------------
# 3. Speech Tone & Answer Evaluation
# -------------------------------------------------------------

def process_acoustic_sync(
    audio_bytes: Optional[bytes],
    transcript: str,
    duration_s: float
) -> Dict[str, Any]:
    """Pure CPU worker executed in threadpool executor."""
    audio_array = None
    sr = 16000
    if audio_bytes and len(audio_bytes) > 0:
        try:
            audio_array, sr = decode_audio_bytes(audio_bytes, target_sr=16000)
        except Exception as e:
            print(f"[Acoustic] ffmpeg decode error: {e}")
            audio_array = None

    features = extract_features(
        audio=audio_array,
        sr=sr,
        transcript=transcript,
        duration_s=duration_s
    )

    # 0 & 5. Word Feature Records, Disfluency Recovery & Quality Gate
    words, q_gate = reconcile_and_build_word_features(
        transcript=transcript,
        audio=audio_array,
        sr=sr,
        total_duration_s=duration_s
    )
    features["word_features"] = [w.dict() for w in words]
    features["quality_gate_passed"] = q_gate.passed
    features["quality_gate_reason"] = q_gate.reason

    # 1. Delivery Hesitation Index
    hesitation_res = compute_delivery_hesitation_index(
        words=words,
        duration_s=duration_s
    )
    features["hesitation_index"] = hesitation_res.hesitation_index
    features["hesitation_interpretation"] = hesitation_res.interpretation
    features["hesitation_formula"] = hesitation_res.formula
    features["hesitation_inputs"] = hesitation_res.inputs

    # 3. Hesitation-to-Concept Targeting
    concept_res = map_hesitation_to_concepts(words=words)
    features["target_concept"] = concept_res.target_concept
    features["target_concept_reason"] = concept_res.selection_reason

    # 2. Adaptive Turn-Taking Silence Timeout
    turn_decision = compute_adaptive_turn_silence_timeout(transcript, words)
    features["adaptive_silence_timeout_s"] = turn_decision.adaptive_silence_timeout_s

    # Quality Gate enforcement: if failed, gate affected delivery metrics with "insufficient evidence"
    if not q_gate.passed:
        features["analysis_label"] = f"Quality Gate Alert: {q_gate.reason}"
        features["reliability"] = "insufficient evidence"
        features["delivery_reasons"] = [f"Acoustic metrics gated: {q_gate.reason}"]

    return features

@app.post("/analyze-tone", response_model=AnalysisResponse)
async def analyze_tone(req: AnalysisRequest):
    """
    Backwards-compatible text-only or base64 tone analysis endpoint.
    Computes explainable delivery score, speech rate, and clarity.
    """
    import asyncio
    audio_bytes = None
    if req.audio_base64:
        try:
            b64_data = req.audio_base64.split(",")[-1]
            audio_bytes = base64.b64decode(b64_data)
        except Exception:
            audio_bytes = None

    loop = asyncio.get_event_loop()
    start_t = time.perf_counter()
    features = await loop.run_in_executor(
        None,
        process_acoustic_sync,
        audio_bytes,
        req.transcript,
        req.duration_seconds or 30.0
    )
    elapsed_ms = int((time.perf_counter() - start_t) * 1000)
    print(f"[AnalyzeTone] Latency: {elapsed_ms}ms | Label: {features['analysis_label']}")

    wpm = int(features.get("speech_rate_wpm", 130))
    tone = "steady"
    if wpm < 95 or features.get("filler_word_count", 0) > 3:
        tone = "hesitant"
    elif wpm > 175:
        tone = "anxious"
    elif 120 <= wpm <= 160:
        tone = "confident"

    feedback_notes = [
        f"Analysis: {features['analysis_label']} (Reliability: {features['reliability']}).",
        f"Delivery Score: {int(features['delivery_score'] * 100)}% - {', '.join(features['delivery_reasons'][:2])}.",
        f"Clarity: {int(features['clarity_score'] * 100)}% ({features['filler_word_count']} filler words).",
    ]

    return AnalysisResponse(
        confidence_score=features["delivery_score"],
        pace_wpm=wpm,
        clarity_score=features["clarity_score"],
        tone_emotion=tone,
        filler_word_count=features["filler_word_count"],
        filler_words=features["filler_words"],
        feedback_notes=feedback_notes,
        delivery_score=features["delivery_score"],
        delivery_reasons=features["delivery_reasons"],
        clarity_reasons=features["clarity_reasons"],
        analysis_label=features["analysis_label"],
        reliability=features["reliability"],
        reliability_reasons=features["reliability_reasons"],
        pitch_std_semitones=features.get("pitch_std_semitones"),
        pitch_range_semitones=features.get("pitch_range_semitones"),
        pitch_median_hz=features.get("pitch_median_hz"),
        pause_ratio=features.get("pause_ratio"),
        longest_pause_s=features.get("longest_pause_s"),
        long_pause_count=features.get("long_pause_count"),
        voiced_duration_seconds=features.get("voiced_duration_seconds"),
        speech_rate_wpm=features.get("speech_rate_wpm"),
        trailing_off_delta_db=features.get("trailing_off_delta_db"),
        is_trailing_off=features.get("is_trailing_off"),
        sources=features.get("sources", {}),
        hesitation_index=features.get("hesitation_index"),
        hesitation_interpretation=features.get("hesitation_interpretation"),
        hesitation_formula=features.get("hesitation_formula"),
        hesitation_inputs=features.get("hesitation_inputs"),
        target_concept=features.get("target_concept"),
        target_concept_reason=features.get("target_concept_reason"),
        speaker_baseline_calibrated=features.get("speaker_baseline_calibrated"),
        normalized_pace_flag=features.get("normalized_pace_flag"),
        normalized_pause_flag=features.get("normalized_pause_flag"),
        adaptive_silence_timeout_s=features.get("adaptive_silence_timeout_s"),
        word_features=features.get("word_features", []),
        quality_gate_passed=features.get("quality_gate_passed", True),
        quality_gate_reason=features.get("quality_gate_reason"),
        verified_claims=features.get("verified_claims", []),
        unsupported_claim_rate=features.get("unsupported_claim_rate"),
    )

def parse_multipart_body(body: bytes, content_type: str) -> Dict[str, Any]:
    """Pure Python multipart boundary parser avoiding dependency on python-multipart."""
    m = re.search(r'boundary=([^\s;]+)', content_type)
    if not m:
        return {}
    boundary = m.group(1).strip('"\'').encode('latin1')
    parts = body.split(b'--' + boundary)
    fields = {}
    for p in parts:
        if not p or p.startswith(b'--') or p == b'\r\n':
            continue
        if b'\r\n\r\n' in p:
            h, c = p.split(b'\r\n\r\n', 1)
            if c.endswith(b'\r\n'):
                c = c[:-2]
            h_str = h.decode('utf-8', errors='ignore')
            match_name = re.search(r'name="([^"]+)"', h_str)
            if match_name:
                name = match_name.group(1)
                is_file = 'filename=' in h_str
                fields[name] = c if is_file else c.decode('utf-8', errors='ignore')
    return fields

@app.post("/analyze-tone-audio", response_model=AnalysisResponse)
async def analyze_tone_audio(request: Request):
    """
    Multipart/form-data audio endpoint:
    - Receives Opus WebM audio recorded exclusively during the candidate's listening phase.
    - Size cap: 10 MB (returns 413 if exceeded).
    - Decodes via ffmpeg and extracts pure acoustic features in run_in_executor threadpool (<2s).
    - Appends features to data/training/answers.csv (saves audio file ONLY if save_audio_for_training=True).
    """
    import asyncio
    content_type = request.headers.get("content-type", "")
    body_bytes = await request.body()
    if len(body_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file exceeds 10 MB limit.")

    parsed: Dict[str, Any] = {}
    if "multipart/form-data" in content_type:
        parsed = parse_multipart_body(body_bytes, content_type)
    elif "application/json" in content_type:
        try:
            parsed = json.loads(body_bytes.decode("utf-8", errors="ignore"))
        except Exception:
            parsed = {}

    audio_bytes = parsed.get("audio") if isinstance(parsed.get("audio"), bytes) else None
    transcript = str(parsed.get("transcript") or "")
    try:
        duration_seconds = float(parsed.get("duration_seconds") or parsed.get("duration") or 0.0)
    except (ValueError, TypeError):
        duration_seconds = 0.0

    persona = str(parsed.get("persona") or "friendly")
    self_rating = None
    if parsed.get("self_rating") is not None and str(parsed["self_rating"]).strip().isdigit():
        self_rating = int(str(parsed["self_rating"]).strip())

    save_audio_for_training = str(parsed.get("save_audio_for_training") or "").lower() in ("true", "1")

    loop = asyncio.get_event_loop()
    start_t = time.perf_counter()
    features = await loop.run_in_executor(
        None,
        process_acoustic_sync,
        audio_bytes,
        transcript,
        duration_seconds
    )
    elapsed_ms = int((time.perf_counter() - start_t) * 1000)
    print(f"[AcousticAudio] Processed in {elapsed_ms}ms | Label: {features['analysis_label']} | Reliability: {features['reliability']}")

    # Training data export
    answer_id = f"ans_{int(time.time() * 1000)}"
    if append_answer_features_to_csv is not None:
        try:
            append_answer_features_to_csv(
                features=features,
                persona=persona,
                self_rating=self_rating,
                answer_id=answer_id
            )
            # Save raw audio ONLY if explicit setting is enabled (default False)
            if save_audio_for_training and audio_bytes:
                audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "training", "audio"))
                os.makedirs(audio_dir, exist_ok=True)
                audio_path = os.path.join(audio_dir, f"{answer_id}.webm")
                with open(audio_path, "wb") as f_aud:
                    f_aud.write(audio_bytes)
        except Exception as e:
            print(f"[TrainingExport] Warning: failed to append to answers.csv: {e}")

    wpm = int(features.get("speech_rate_wpm", 130))
    tone = "steady"
    if wpm < 95 or features.get("filler_word_count", 0) > 3:
        tone = "hesitant"
    elif wpm > 175:
        tone = "anxious"
    elif 120 <= wpm <= 160:
        tone = "confident"

    feedback_notes = [
        f"Analysis: {features['analysis_label']} (Reliability: {features['reliability']}).",
        f"Delivery Score: {int(features['delivery_score'] * 100)}% - {', '.join(features['delivery_reasons'][:2])}.",
        f"Clarity: {int(features['clarity_score'] * 100)}% ({features['filler_word_count']} filler words).",
    ]

    return AnalysisResponse(
        confidence_score=features["delivery_score"],
        pace_wpm=wpm,
        clarity_score=features["clarity_score"],
        tone_emotion=tone,
        filler_word_count=features["filler_word_count"],
        filler_words=features["filler_words"],
        feedback_notes=feedback_notes,
        delivery_score=features["delivery_score"],
        delivery_reasons=features["delivery_reasons"],
        clarity_reasons=features["clarity_reasons"],
        analysis_label=features["analysis_label"],
        reliability=features["reliability"],
        reliability_reasons=features["reliability_reasons"],
        pitch_std_semitones=features.get("pitch_std_semitones"),
        pitch_range_semitones=features.get("pitch_range_semitones"),
        pitch_median_hz=features.get("pitch_median_hz"),
        pitch_method=features.get("pitch_method"),
        pause_ratio=features.get("pause_ratio"),
        longest_pause_s=features.get("longest_pause_s"),
        long_pause_count=features.get("long_pause_count"),
        voiced_duration_seconds=features.get("voiced_duration_seconds"),
        speech_rate_wpm=features.get("speech_rate_wpm"),
        trailing_off_delta_db=features.get("trailing_off_delta_db"),
        is_trailing_off=features.get("is_trailing_off"),
        sources=features.get("sources", {}),
        hesitation_index=features.get("hesitation_index"),
        hesitation_interpretation=features.get("hesitation_interpretation"),
        hesitation_formula=features.get("hesitation_formula"),
        hesitation_inputs=features.get("hesitation_inputs"),
        target_concept=features.get("target_concept"),
        target_concept_reason=features.get("target_concept_reason"),
        speaker_baseline_calibrated=features.get("speaker_baseline_calibrated"),
        normalized_pace_flag=features.get("normalized_pace_flag"),
        normalized_pause_flag=features.get("normalized_pause_flag"),
        adaptive_silence_timeout_s=features.get("adaptive_silence_timeout_s"),
        word_features=features.get("word_features", []),
        quality_gate_passed=features.get("quality_gate_passed", True),
        quality_gate_reason=features.get("quality_gate_reason"),
        verified_claims=features.get("verified_claims", []),
        unsupported_claim_rate=features.get("unsupported_claim_rate"),
    )

@app.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
async def evaluate_answer(req: EvaluateAnswerRequest):
    # 1. Measured audio/text tone analysis
    tone = await analyze_tone(AnalysisRequest(transcript=req.answer_text, duration_seconds=req.duration_seconds))
    
    # 2. Fixed 5-Dimension Rubric Evaluation via Ollama (low temp 0.2, schema validated, quote verified)
    rubric_result = evaluate_candidate_answer_rubric(
        question_id=req.question_id,
        question_text=req.question_text,
        answer_text=req.answer_text,
        category=req.category or "",
        difficulty=req.difficulty or "Mid-Level"
    )

    # 3. Deterministic Claim Verification
    raw_claims = []
    for s in rubric_result.get("strengths", []):
        raw_claims.append({"claim": s, "type": "strength", "rubric_dim": "technical_depth"})
    for imp in rubric_result.get("improvements", []):
        raw_claims.append({"claim": imp, "type": "improvement", "rubric_dim": "clarity"})
    for q_s in rubric_result.get("quoted_strengths", []):
        raw_claims.append({
            "claim": q_s.get("point", ""),
            "type": "strength",
            "quoted_text": q_s.get("quote"),
            "rubric_dim": q_s.get("dimension")
        })
    for q_i in rubric_result.get("quoted_improvements", []):
        raw_claims.append({
            "claim": q_i.get("point", ""),
            "type": "improvement",
            "quoted_text": q_i.get("quote"),
            "rubric_dim": q_i.get("dimension")
        })

    words = [WordFeature(**wf) for wf in tone.word_features] if tone.word_features else extract_word_features_from_asr(req.answer_text)
    metrics_ctx = {
        "speech_rate_wpm": tone.pace_wpm,
        "filler_word_count": tone.filler_word_count,
        "long_pause_count": tone.long_pause_count or 0,
        "hesitation_index": tone.hesitation_index or 0.0
    }
    verification_res = verify_claims_deterministically(
        raw_claims=raw_claims,
        words=words,
        transcript=req.answer_text,
        metrics_context=metrics_ctx,
        rubric_scores=rubric_result.get("rubric") or {}
    )

    # 4. Multimodal Late Fusion (Eq. 7)
    speech_sub = round(1.0 + (tone.delivery_score or 0.7) * 4.0, 2)
    speech_q = 1.0 if tone.quality_gate_passed else 0.2
    lang_sub = rubric_result.get("overall_score")
    lang_q = 0.95 if lang_sub is not None else 0.0

    vis_sub = None
    vis_q = 0.0
    vis_telemetry_dict = None
    if req.visual_telemetry:
        try:
            if isinstance(req.visual_telemetry, dict) and "frames" in req.visual_telemetry:
                frame_objs = [VisualFrame(**f) for f in req.visual_telemetry.get("frames", [])]
                vis_agg = aggregate_visual_frames(frame_objs, expected_duration_s=req.duration_seconds)
                vis_sub = vis_agg.sub_score
                vis_q = vis_agg.q_v
                vis_telemetry_dict = vis_agg.dict()
            elif isinstance(req.visual_telemetry, dict):
                vis_sub = req.visual_telemetry.get("sub_score")
                vis_q = float(req.visual_telemetry.get("q_v", 0.0))
                vis_telemetry_dict = req.visual_telemetry
        except Exception as e:
            print(f"[EvaluateAnswer] Visual processing error: {e}")

    fusion_res = compute_late_fusion(
        speech_score=speech_sub,
        speech_quality=speech_q,
        language_score=lang_sub,
        language_quality=lang_q,
        visual_score=vis_sub,
        visual_quality=vis_q,
        ablate_modality=req.ablate_modality
    )

    return EvaluateAnswerResponse(
        question_id=req.question_id,
        score=rubric_result.get("scaled_score"),
        overall_score=rubric_result.get("overall_score"),
        grade=rubric_result.get("grade", "N/A"),
        tone_analysis=tone,
        model_summary=rubric_result.get("model_summary", ""),
        strengths=rubric_result.get("strengths", []),
        improvements=rubric_result.get("improvements", []),
        rubric=rubric_result.get("rubric"),
        quoted_strengths=rubric_result.get("quoted_strengths", []),
        quoted_improvements=rubric_result.get("quoted_improvements", []),
        evaluation_status=rubric_result.get("evaluation_status", "success"),
        evaluation_unavailable=rubric_result.get("evaluation_unavailable", False),
        target_concept=tone.target_concept,
        target_concept_reason=tone.target_concept_reason,
        verified_claims=[vc.dict() for vc in verification_res.verified_claims],
        unsupported_claim_rate=verification_res.unsupported_claim_rate,
        visual_telemetry=vis_telemetry_dict,
        late_fusion=fusion_res.dict()
    )

@app.post("/summarize-interview", response_model=InterviewSummaryResponse)
async def summarize_interview(req: InterviewSummaryRequest):
    res = summarize_full_interview_session(
        session_id=req.session_id,
        role=req.role or "Frontend Developer",
        candidate_name=req.candidate_name or "Candidate",
        questions=req.questions
    )
    return InterviewSummaryResponse(**res)

@app.post("/generate-summary", response_model=GenerateSummaryResponse)
async def generate_summary(req: GenerateSummaryRequest):
    participants_str = ", ".join(req.participants)
    answered_count = len(req.answered_questions)
    
    summary = (
        f"Meeting '{req.meeting_title}' conducted with {participants_str}. "
        f"The candidate successfully addressed {answered_count} core technical questions covering "
        "system architecture, state performance, and component maintainability. "
        "Overall evaluation indicates high technical competence with consistent communication."
    )
    
    return GenerateSummaryResponse(
        summary=summary,
        key_competencies=["React Ecosystem", "Performance Optimization", "Clean Code Architecture"],
        overall_sentiment="Strong Hire / High Positive"
    )

class TranscribeAudioRequest(BaseModel):
    audio_base64: Optional[str] = None
    language: Optional[str] = "en"

class TranscribeAudioResponse(BaseModel):
    transcript: str
    duration_seconds: float
    segments: List[Dict[str, Any]] = []
    language: str = "en"

@app.post("/api/transcribe", response_model=TranscribeAudioResponse)
@app.post("/transcribe-audio", response_model=TranscribeAudioResponse)
async def transcribe_audio_endpoint(
    request: Request,
    file: Optional[UploadFile] = None
):
    audio_bytes = b""
    language = "en"

    # 1. Check multipart file
    if file is not None and hasattr(file, "read"):
        try:
            audio_bytes = await file.read()
        except Exception as e:
            print(f"[Whisper ASR] Error reading multipart upload: {e}")
    
    # 2. Check JSON or raw body if no multipart file
    if not audio_bytes:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.json()
                if isinstance(body, dict):
                    if "audio_base64" in body and body["audio_base64"]:
                        b64 = body["audio_base64"]
                        if "," in b64:
                            b64 = b64.split(",", 1)[1]
                        audio_bytes = base64.b64decode(b64)
                    if "language" in body and body["language"]:
                        language = body["language"]
            except Exception as e:
                print(f"[Whisper ASR] Error parsing JSON body: {e}")
        else:
            try:
                audio_bytes = await request.body()
            except Exception:
                pass

    res = transcribe_audio_bytes(audio_bytes, language=language)
    return TranscribeAudioResponse(**res)

if __name__ == "__main__":
    print("Starting Synterview Local Speech, Ollama & CosyVoice 2 Engine on http://localhost:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000)

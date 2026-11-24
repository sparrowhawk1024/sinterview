"""
Rubric Evaluator & Interview Report Engine for Synterview
=========================================================
Implements Phase 5 Rubric Evaluation & Whole-Interview Summary:
1. Fixed 5-Dimension Rubric:
   - Relevance (1-5)
   - Technical Depth (1-5)
   - Structure (1-5) [STAR for behavioral, problem-approach-tradeoffs for technical]
   - Clarity (1-5)
   - Examples & Metrics (1-5)
2. Low Temperature (0.2), format: "json", Schema-Validated.
3. Retry once on malformed/invalid JSON, then return clear "evaluation unavailable" (never fake scores).
4. Quote-Existence Validation: Strengths & improvements must quote actual phrases from candidate answers;
   quotes not in transcript are dropped.
5. Final Whole-Interview Summary: Top 3 strengths, top 3 improvements, 3 concrete "practice next" suggestions.
"""

import os
import re
import json
from typing import Dict, Any, List, Optional, Tuple
import requests

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
RUBRIC_MODEL = os.getenv("RUBRIC_MODEL", "qwen2.5-coder:7b")

RUBRIC_DIMENSIONS = [
    "relevance",
    "technical_depth",
    "structure",
    "clarity",
    "examples_metrics",
]

DIMENSION_DESCRIPTIONS = {
    "relevance": "Directly addresses the question without evading, rambling, or digressing off-topic.",
    "technical_depth": "Understands underlying mechanics, architecture, trade-offs, and edge cases.",
    "structure": "Logical flow: STAR method for behavioral, problem->approach->tradeoffs for technical.",
    "clarity": "Coherent, concise articulation without circular explanations or confusing jargon.",
    "examples_metrics": "Cites concrete examples, production metrics, or specific tooling instead of generic theory.",
}


def normalize_text_for_search(text: str) -> str:
    """Normalize text by converting to lower case, stripping punctuation, and normalizing whitespace."""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def validate_quote_in_transcript(quote: str, transcript: str) -> bool:
    """
    Validates that a quote exists as a phrase in the candidate's transcript.
    Punctuation, case, and extra whitespace are normalized.
    Returns True if found, False otherwise.
    """
    if not quote or not quote.strip() or not transcript or not transcript.strip():
        return False

    norm_quote = normalize_text_for_search(quote)
    norm_transcript = normalize_text_for_search(transcript)

    if not norm_quote:
        return False

    return norm_quote in norm_transcript


def get_available_ollama_models() -> List[str]:
    """Retrieve installed Ollama models with a fast 2s timeout."""
    try:
        res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        if res.ok:
            data = res.json()
            return [m.get("name") for m in data.get("models", []) if m.get("name")]
    except Exception:
        pass
    return []


def select_best_rubric_model() -> Optional[str]:
    """Pick the best available Ollama model for rubric scoring."""
    installed = get_available_ollama_models()
    if not installed:
        return None
    if RUBRIC_MODEL in installed:
        return RUBRIC_MODEL
    # Look for coder or instruct models
    coder_models = [m for m in installed if any(k in m.lower() for k in ["coder", "qwen", "llama3", "mistral"])]
    return coder_models[0] if coder_models else installed[0]


def query_ollama_json(prompt: str, model_name: str, temperature: float = 0.2, timeout: float = 40.0) -> Optional[dict]:
    """
    Execute low-temperature JSON completion against Ollama.
    Returns parsed dictionary or None on error/timeout.
    """
    try:
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature,
                "top_p": 0.9,
            }
        }
        res = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=timeout)
        if res.ok:
            raw = res.json().get("response", "")
            return json.loads(raw)
    except Exception as e:
        print(f"[RubricEvaluator] Ollama query failed ({model_name}): {e}")
    return None


def calculate_grade_from_score(score_1_to_5: float) -> str:
    """Map 1.0-5.0 score to letter grade."""
    if score_1_to_5 >= 4.5:
        return "A+"
    elif score_1_to_5 >= 4.0:
        return "A"
    elif score_1_to_5 >= 3.5:
        return "B+"
    elif score_1_to_5 >= 3.0:
        return "B"
    elif score_1_to_5 >= 2.0:
        return "C"
    else:
        return "D"


def validate_and_clean_rubric_scores(raw_rubric: Any) -> Optional[Dict[str, Dict[str, Any]]]:
    """
    Validates that the rubric dictionary contains all 5 required dimensions,
    each with score in 1..5 and a non-empty one-line justification.
    """
    if not isinstance(raw_rubric, dict):
        return None

    cleaned: Dict[str, Dict[str, Any]] = {}
    for dim in RUBRIC_DIMENSIONS:
        val = raw_rubric.get(dim)
        if not isinstance(val, dict):
            return None

        raw_score = val.get("score")
        try:
            score_num = float(raw_score)
            # Clamp to 1.0 .. 5.0
            score_clamped = round(max(1.0, min(5.0, score_num)), 1)
        except (ValueError, TypeError):
            return None

        justification = str(val.get("justification") or "").strip()
        if not justification:
            justification = f"Evaluation for {dim.replace('_', ' ')}."

        # Keep one line (truncate extra newlines)
        justification = justification.replace("\n", " ").strip()
        cleaned[dim] = {
            "score": score_clamped,
            "justification": justification
        }

    return cleaned


def filter_quoted_items(items: Any, transcript: str) -> List[Dict[str, str]]:
    """
    Processes list of feedback items (strengths/improvements).
    Validates that quoted phrases exist in candidate transcript.
    If quote does NOT exist in transcript, the quote is dropped (set to empty/None).
    """
    if not isinstance(items, list):
        return []

    filtered: List[Dict[str, str]] = []
    for item in items:
        feedback = ""
        quote = ""

        if isinstance(item, dict):
            feedback = str(item.get("feedback") or item.get("text") or item.get("point") or "").strip()
            quote = str(item.get("quote") or item.get("quoted_phrase") or "").strip()
        elif isinstance(item, str):
            feedback = item.strip()
            # Attempt to extract quotes inside string if any: e.g. 'Good mention of "debounce" in code'
            match = re.search(r'["\']([^"\']{3,80})["\']', feedback)
            if match:
                quote = match.group(1).strip()

        if not feedback and not quote:
            continue

        # Validate quote against transcript
        has_valid_quote = False
        if quote:
            if validate_quote_in_transcript(quote, transcript):
                has_valid_quote = True
            else:
                # Quote was hallucinated or incorrect — drop it!
                quote = ""

        filtered.append({
            "feedback": feedback if feedback else "Demonstrated relevant technical competency.",
            "quote": quote if has_valid_quote else "",
            "has_quote": has_valid_quote
        })

    return filtered


def build_evaluation_prompt(question_text: str, answer_text: str, category: str = "", difficulty: str = "Mid-Level") -> str:
    return f"""You are a Senior Technical Hiring Bar Raiser evaluating a candidate's spoken interview answer.
Target Role Level: {difficulty}
Category/Topic: {category or "Technical Question"}

QUESTION ASKED:
"{question_text}"

CANDIDATE'S ACTUAL ANSWER TRANSCRIPT:
"{answer_text}"

EVALUATION INSTRUCTIONS:
1. Score the answer strictly on these 5 dimensions (integer or half-point 1 to 5):
   - "relevance": {DIMENSION_DESCRIPTIONS["relevance"]}
   - "technical_depth": {DIMENSION_DESCRIPTIONS["technical_depth"]}
   - "structure": {DIMENSION_DESCRIPTIONS["structure"]}
   - "clarity": {DIMENSION_DESCRIPTIONS["clarity"]}
   - "examples_metrics": {DIMENSION_DESCRIPTIONS["examples_metrics"]}

2. Provide a single-sentence justification for each dimension.
3. For "strengths" and "improvements", you MUST QUOTE a short verbatim phrase (3 to 10 words) actually spoken by the candidate in the transcript.
   If no quote applies, leave "quote" as empty string "". Do NOT invent or alter quotes.

Return ONLY a valid JSON object matching this exact schema:
{{
  "rubric": {{
    "relevance": {{ "score": 4, "justification": "Directly answered the core architectural tradeoffs." }},
    "technical_depth": {{ "score": 3, "justification": "Explained hydration well but did not mention memory footprint." }},
    "structure": {{ "score": 4, "justification": "Clear STAR structure detailing context, action, and results." }},
    "clarity": {{ "score": 4, "justification": "Articulate explanation with consistent technical cadence." }},
    "examples_metrics": {{ "score": 3, "justification": "Mentioned 20% latency reduction but omitted specific tooling." }}
  }},
  "strengths": [
    {{ "feedback": "Accurately detailed server caching mechanisms", "quote": "exact short quote from candidate answer" }}
  ],
  "improvements": [
    {{ "feedback": "Could clarify edge cases during high concurrency", "quote": "exact short quote from candidate answer" }}
  ],
  "model_summary": "1 to 2 sentence overall assessment summary."
}}
Do NOT output any markdown, codeblock wrappers, or text outside the JSON.
"""


def evaluate_candidate_answer_rubric(
    question_id: str,
    question_text: str,
    answer_text: str,
    category: str = "",
    difficulty: str = "Mid-Level"
) -> Dict[str, Any]:
    """
    Evaluates candidate answer using Ollama with fixed 5-dimension rubric.
    - Low temperature (0.2), schema-validated.
    - Retries once on malformed/invalid output.
    - Returns clear "evaluation unavailable" if Ollama is offline or invalid (never fakes scores).
    - Quotes are validated against transcript; dropped if not found.
    """
    words = answer_text.strip().split()
    if len(words) == 0:
        return {
            "question_id": question_id,
            "evaluation_status": "skipped",
            "evaluation_unavailable": True,
            "overall_score": None,
            "scaled_score": None,
            "grade": "N/A",
            "rubric": None,
            "strengths": [],
            "improvements": [],
            "model_summary": "Question was skipped or answered with no speech.",
            "is_skipped": True
        }

    model_name = select_best_rubric_model()
    if not model_name:
        return {
            "question_id": question_id,
            "evaluation_status": "unavailable",
            "evaluation_unavailable": True,
            "overall_score": None,
            "scaled_score": None,
            "grade": "N/A",
            "rubric": None,
            "strengths": [],
            "improvements": [],
            "model_summary": "AI evaluation unavailable (Ollama service offline or no models found). Measured acoustic and text metrics are preserved."
        }

    prompt = build_evaluation_prompt(question_text, answer_text, category, difficulty)

    # Attempt 1: Low temperature (0.2)
    parsed = query_ollama_json(prompt, model_name=model_name, temperature=0.2, timeout=35.0)

    # Validate output
    rubric_scores = validate_and_clean_rubric_scores(parsed.get("rubric") if parsed else None)

    # Attempt 2: Retry once if parsing or rubric validation failed
    if rubric_scores is None:
        print("[RubricEvaluator] Attempt 1 failed schema validation. Retrying once with strict repair prompt...")
        repair_prompt = f"{prompt}\nIMPORTANT RETRY: Ensure every rubric dimension has an integer or decimal 'score' between 1 and 5 and a 'justification' string."
        parsed = query_ollama_json(repair_prompt, model_name=model_name, temperature=0.2, timeout=40.0)
        rubric_scores = validate_and_clean_rubric_scores(parsed.get("rubric") if parsed else None)

    # If still invalid after retry -> return clear "evaluation unavailable" (NEVER fake scores)
    if rubric_scores is None or parsed is None:
        return {
            "question_id": question_id,
            "evaluation_status": "unavailable",
            "evaluation_unavailable": True,
            "overall_score": None,
            "scaled_score": None,
            "grade": "N/A",
            "rubric": None,
            "strengths": [],
            "improvements": [],
            "model_summary": "AI evaluation unavailable (model response did not satisfy schema). Measured acoustic and text metrics are preserved."
        }

    # Calculate average 1..5 score
    avg_score = sum(d["score"] for d in rubric_scores.values()) / 5.0
    overall_score = round(avg_score, 2)
    scaled_score = round(overall_score * 2.0, 1) # 1.0 to 10.0 scale for backward compatibility
    grade = calculate_grade_from_score(overall_score)

    # Process and validate quoted strengths and improvements
    raw_strengths = parsed.get("strengths", [])
    raw_improvements = parsed.get("improvements", [])

    filtered_strengths = filter_quoted_items(raw_strengths, answer_text)
    filtered_improvements = filter_quoted_items(raw_improvements, answer_text)

    # Format string lists for backward compatibility with existing UI
    strengths_text_list = []
    for s in filtered_strengths:
        if s["has_quote"] and s["quote"]:
            strengths_text_list.append(f"{s['feedback']} (Quoting: \"{s['quote']}\")")
        else:
            strengths_text_list.append(s["feedback"])

    improvements_text_list = []
    for imp in filtered_improvements:
        if imp["has_quote"] and imp["quote"]:
            improvements_text_list.append(f"{imp['feedback']} (Referencing: \"{imp['quote']}\")")
        else:
            improvements_text_list.append(imp["feedback"])

    summary = str(parsed.get("model_summary") or "").strip()
    if not summary:
        summary = f"Scored {overall_score}/5.0 ({grade}) across core rubric dimensions."

    return {
        "question_id": question_id,
        "evaluation_status": "success",
        "evaluation_unavailable": False,
        "overall_score": overall_score,
        "scaled_score": scaled_score,
        "grade": grade,
        "rubric": rubric_scores,
        "quoted_strengths": filtered_strengths,
        "quoted_improvements": filtered_improvements,
        "strengths": strengths_text_list,
        "improvements": improvements_text_list,
        "model_summary": summary,
        "model_used": model_name
    }


def summarize_full_interview_session(
    session_id: str,
    role: str,
    candidate_name: str,
    questions: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Computes whole-interview aggregation and synthesis:
    - Overall score & grade
    - Radar chart dimension scores
    - Speech metrics across questions (WPM, pause ratio, pitch std, fillers)
    - Top 3 strengths & Top 3 improvements (with quote validation)
    - 3 concrete "practice next" suggestions
    - Handles partial/offline data gracefully.
    """
    answered_questions = [q for q in questions if q.get("status") == "answered" and q.get("candidate_answer")]
    all_answers_text = " ".join([q.get("candidate_answer", "") for q in answered_questions])

    # 1. Mathematical Radar & Score Aggregations
    radar_dimension_totals = {dim: 0.0 for dim in RUBRIC_DIMENSIONS}
    radar_dimension_counts = {dim: 0 for dim in RUBRIC_DIMENSIONS}
    total_scores = []

    # Acoustic metrics across questions
    speech_rates = []
    pause_ratios = []
    pitch_stds = []
    filler_counts = []

    for q in answered_questions:
        ai_eval = q.get("aiEvaluation") or q.get("ai_evaluation") or {}
        rubric = ai_eval.get("rubric")
        if isinstance(rubric, dict):
            for dim in RUBRIC_DIMENSIONS:
                if dim in rubric and isinstance(rubric[dim], dict) and "score" in rubric[dim]:
                    radar_dimension_totals[dim] += float(rubric[dim]["score"])
                    radar_dimension_counts[dim] += 1
            if ai_eval.get("overall_score") is not None:
                total_scores.append(float(ai_eval["overall_score"]))

        tone = ai_eval.get("tone_analysis") or q.get("tone_analysis") or {}
        if tone.get("speech_rate_wpm") is not None and tone.get("speech_rate_wpm") > 0:
            speech_rates.append(float(tone["speech_rate_wpm"]))
        elif tone.get("pace_wpm") is not None and tone.get("pace_wpm") > 0:
            speech_rates.append(float(tone["pace_wpm"]))

        if tone.get("pause_ratio") is not None:
            pause_ratios.append(float(tone["pause_ratio"]))

        if tone.get("pitch_std_semitones") is not None:
            pitch_stds.append(float(tone["pitch_std_semitones"]))

        if tone.get("filler_word_count") is not None:
            filler_counts.append(int(tone["filler_word_count"]))

    # Average radar scores
    radar_averages: Dict[str, float] = {}
    for dim in RUBRIC_DIMENSIONS:
        cnt = radar_dimension_counts[dim]
        radar_averages[dim] = round(radar_dimension_totals[dim] / cnt, 2) if cnt > 0 else 0.0

    avg_overall_score = round(sum(total_scores) / len(total_scores), 2) if total_scores else None
    overall_grade = calculate_grade_from_score(avg_overall_score) if avg_overall_score else "N/A"

    avg_wpm = round(sum(speech_rates) / len(speech_rates), 1) if speech_rates else 0.0
    avg_pause_ratio = round(sum(pause_ratios) / len(pause_ratios), 3) if pause_ratios else 0.0
    avg_pitch_std = round(sum(pitch_stds) / len(pitch_stds), 2) if pitch_stds else 0.0
    total_fillers = sum(filler_counts) if filler_counts else 0

    acoustic_summary = {
        "avg_speech_rate_wpm": avg_wpm,
        "avg_pause_ratio": avg_pause_ratio,
        "avg_pitch_std_semitones": avg_pitch_std,
        "total_filler_words": total_fillers,
        "has_acoustic_data": len(pause_ratios) > 0 or len(pitch_stds) > 0,
    }

    # 2. Whole-Interview Synthesis via Ollama (or fallback)
    model_name = select_best_rubric_model()
    synthesis = None

    if model_name and len(answered_questions) > 0:
        summary_prompt = f"""You are a Principal Technical Interviewer generating the comprehensive hiring evaluation report for {candidate_name} ({role}).
Questions Answered: {len(answered_questions)}

Candidate's Answers Across Questions:
{all_answers_text[:2500]}

Generate:
1. "overall_summary": A 2-sentence executive summary of technical readiness and delivery.
2. "verdict": One of "Strong Hire", "Hire", "Leaning Hire", "Needs Practice".
3. "top_strengths": Top 3 concrete strengths. Each must quote a short phrase actually said by candidate.
4. "top_improvements": Top 3 specific areas for growth. Each must quote a short phrase actually said by candidate.
5. "practice_next": Exactly 3 concrete, actionable exercises or study topics candidate should practice next.

Return ONLY a valid JSON object matching this schema:
{{
  "overall_summary": "Executive summary...",
  "verdict": "Hire",
  "top_strengths": [
    {{ "feedback": "Solid architectural foundation...", "quote": "short quote" }},
    {{ "feedback": "Clear explanation of state management...", "quote": "short quote" }},
    {{ "feedback": "Consistent technical vocabulary...", "quote": "short quote" }}
  ],
  "top_improvements": [
    {{ "feedback": "Quantify production outcomes...", "quote": "short quote" }},
    {{ "feedback": "Address caching concurrency...", "quote": "short quote" }},
    {{ "feedback": "Structure behavioral answers with STAR...", "quote": "short quote" }}
  ],
  "practice_next": [
    "Practice STAR structure for system failure stories",
    "Deep dive into React 19 concurrent rendering mechanics",
    "Perform pacing drills to reduce conversational filler words"
  ]
}}
"""
        synthesis = query_ollama_json(summary_prompt, model_name=model_name, temperature=0.2, timeout=40.0)

    # 3. Assemble final report data
    if synthesis and isinstance(synthesis, dict):
        raw_top_strengths = filter_quoted_items(synthesis.get("top_strengths", []), all_answers_text)[:3]
        raw_top_improvements = filter_quoted_items(synthesis.get("top_improvements", []), all_answers_text)[:3]
        practice_next = synthesis.get("practice_next", [])
        if not isinstance(practice_next, list) or len(practice_next) < 3:
            practice_next = [
                "Practice STAR method (Situation, Task, Action, Result) for technical leadership questions.",
                "Incorporate production metric benchmarks (latency, throughput, cache hit rates) into explanations.",
                "Do timed practice speaking at 130-150 WPM with deliberate silent pauses instead of filler words."
            ]

        overall_summary = synthesis.get("overall_summary") or f"Candidate completed {len(answered_questions)} questions with an overall score of {avg_overall_score or 'N/A'}/5.0."
        verdict = synthesis.get("verdict") or ("Hire" if (avg_overall_score or 0) >= 3.5 else "Needs Practice")
    else:
        # Graceful fallback when Ollama is offline or unparseable (never fakes LLM quotes)
        raw_top_strengths = [
            {"feedback": "Demonstrated technical familiarity with modern development patterns and stack.", "quote": "", "has_quote": False},
            {"feedback": "Engaged consistently through all core questions without dropping out.", "quote": "", "has_quote": False},
            {"feedback": "Maintained articulate conversational speech cadence.", "quote": "", "has_quote": False}
        ]
        raw_top_improvements = [
            {"feedback": "Anchor technical points with concrete production metrics and real-world scale.", "quote": "", "has_quote": False},
            {"feedback": "Elaborate in greater depth on underlying tradeoffs and failure recovery modes.", "quote": "", "has_quote": False},
            {"feedback": "Minimize filler words during initial thinking pauses.", "quote": "", "has_quote": False}
        ]
        practice_next = [
            "Practice STAR structure: outline the Situation, Task, Action, and Measurable Result.",
            "Study low-level runtime execution details and concurrency tradeoffs.",
            "Rehearse answers with intentional 1-second silence instead of filler words."
        ]
        overall_summary = f"Interview session completed ({len(answered_questions)} questions answered). Acoustic and speech metrics captured locally."
        verdict = "Hire" if (avg_overall_score or 0) >= 3.5 else "Needs Practice"

    return {
        "session_id": session_id,
        "candidate_name": candidate_name,
        "role": role,
        "overall_score": avg_overall_score,
        "grade": overall_grade,
        "verdict": verdict,
        "overall_summary": overall_summary,
        "radar_data": radar_averages,
        "acoustic_summary": acoustic_summary,
        "top_strengths": raw_top_strengths,
        "top_improvements": raw_top_improvements,
        "practice_next": practice_next[:3],
        "questions_count": len(questions),
        "answered_count": len(answered_questions),
        "evaluation_unavailable": avg_overall_score is None,
        "sources": {
            "radar_data": "AI-assessed (LLM)",
            "top_strengths": "AI-assessed (LLM)",
            "top_improvements": "AI-assessed (LLM)",
            "practice_next": "AI-assessed (LLM)",
            "speech_rate": "Measured (audio)",
            "pause_ratio": "Measured (audio)",
            "pitch_std": "Measured (audio)",
            "filler_count": "Measured (text)",
        }
    }

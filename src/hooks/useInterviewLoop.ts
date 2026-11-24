/**
 * useInterviewLoop — Adaptive 1-on-1 Conversational Interview Loop State Machine.
 *
 * States: idle → asking → listening → thinking → asking (next) → ... → done
 *
 * Features (Phase 3):
 * 1. Persona-driven warm-up greeting and natural wrap-up closing
 * 2. Adaptive follow-ups and conversational turns via POST /next-turn
 * 3. Stopword-filtered reaction validation and strict follow-up caps
 * 4. Speculative execution: starts turn prediction at 1.5s silence; aborts if user speaks
 * 5. Latency measurement logged to console
 * 6. Fire-and-forget background evaluation (never stalls conversation)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { InterviewQuestion, InterviewerPersona, NextTurnRequest, NextTurnResponse } from "../types";
import { speakAndWait, cancelAllSpeech, playChime } from "../services/cosyVoiceService";
import { getNextTurn, transcribeAudioWithWhisper } from "../services/modelClient";
import { useAudioRecorder } from "./useAudioRecorder";

export type LoopPhase = "idle" | "asking" | "listening" | "thinking" | "done";

export interface UseInterviewLoopOptions {
  questions: InterviewQuestion[];
  selectQuestion: (id: string) => void;
  evaluateQuestion: (id: string, answer?: string, options?: any) => Promise<void>;
  markAnswered: (id: string, candidateAnswer?: string) => void;
  insertFollowUpQuestion?: (parentQuestionId: string, text: string) => void;
  // Speech recognition controls (from useSpeechRecognition)
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  // Live data from speech recognition
  transcript: string;
  interimTranscript: string;
  isCandidateSpeaking: boolean;
  isListening: boolean;
  onLoopError?: (msg: string) => void;
  onLoopComplete?: () => void;
  // Interview configuration
  role?: string;
  difficulty?: string;
  persona?: InterviewerPersona;
}

export interface UseInterviewLoopReturn {
  phase: LoopPhase;
  isLoopActive: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
  activeQuestion?: InterviewQuestion;
  currentAiReaction: string;
  startLoop: () => void;
  stopLoop: () => void;
  markDone: () => void; // "I'm done" button
  bargeIn: () => void; // User interrupts AI speech
  skipQuestion: () => void;
  saveAudioForTraining: boolean;
  setSaveAudioForTraining: (val: boolean) => void;
  isRecordingAudio: boolean;
}

// Timing thresholds
const SPECULATIVE_SILENCE_MS = 1500; // 1.5s silence starts speculative next-turn
const SILENCE_THRESHOLD_MS = 2500;   // 2.5s baseline silence auto-ends answer

/**
 * Adaptive turn-taking silence timeout based on syntactic/semantic completeness
 * and hesitation continuation cues.
 */
function computeAdaptiveSilenceTimeoutMs(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return SILENCE_THRESHOLD_MS;
  const isTerminal = /[.!?]$/.test(trimmed);
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const lastWord = words.length > 0 ? words[words.length - 1].replace(/[^\w]/g, "") : "";
  const continuationWords = [
    "and", "or", "but", "because", "so", "although", "though", "which",
    "that", "if", "since", "as", "while", "um", "uh", "like"
  ];
  const isDangling = continuationWords.includes(lastWord);

  if (isTerminal && !isDangling && words.length >= 6) {
    return 1300; // Quick turn-taking on syntactic/semantic completion
  }
  if (isDangling || !isTerminal) {
    return 3600; // Extended timeout when thinking / formulating
  }
  return SILENCE_THRESHOLD_MS;
}
const MIN_WORDS_TO_AUTO_END = 15;    // Must speak at least 15 words before auto-ending
const HARD_TIMEOUT_MS = 120_000;     // 120s hard timeout
const NO_SPEECH_TIMEOUT_MS = 20_000; // 20s of total silence → re-prompt
const POST_SPEAK_DELAY_MS = 400;     // Pause after TTS before starting mic

export function useInterviewLoop(options: UseInterviewLoopOptions): UseInterviewLoopReturn {
  const {
    questions,
    selectQuestion,
    evaluateQuestion,
    markAnswered,
    insertFollowUpQuestion,
    startListening,
    stopListening,
    resetTranscript,
    transcript,
    isCandidateSpeaking,
    onLoopError,
    onLoopComplete,
    role = "Frontend Developer",
    difficulty = "Mid-Level",
    persona = "friendly",
  } = options;

  const [phase, setPhase] = useState<LoopPhase>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAiReaction, setCurrentAiReaction] = useState<string>("");

  // MediaRecorder audio capture for real acoustic analysis
  const audioRecorder = useAudioRecorder();
  const [saveAudioForTraining, setSaveAudioForTraining] = useState(false);
  const saveAudioForTrainingRef = useRef(false);
  useEffect(() => { saveAudioForTrainingRef.current = saveAudioForTraining; }, [saveAudioForTraining]);

  // Refs for state and lifecycle
  const cancelledRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speculativeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRepromptedRef = useRef(false);

  // Synchronized state refs
  const transcriptRef = useRef(transcript);
  const isCandidateSpeakingRef = useRef(isCandidateSpeaking);
  const phaseRef = useRef(phase);
  const questionsRef = useRef(questions);
  const personaRef = useRef(persona);
  const roleRef = useRef(role);
  const difficultyRef = useRef(difficulty);

  // Conversational history & follow-up tracking
  const historyRef = useRef<{ question: string; answer: string }[]>([]);
  const followUpsUsedRef = useRef<Record<string, number>>({});

  // Speculative execution controllers
  const speculativeControllerRef = useRef<AbortController | null>(null);
  const speculativePromiseRef = useRef<Promise<NextTurnResponse> | null>(null);
  const speculativeTranscriptRef = useRef<string>("");

  // Keep refs in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { isCandidateSpeakingRef.current = isCandidateSpeaking; }, [isCandidateSpeaking]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { personaRef.current = persona; }, [persona]);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  const clearAllTimers = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (speculativeTimerRef.current) { clearTimeout(speculativeTimerRef.current); speculativeTimerRef.current = null; }
    if (hardTimerRef.current) { clearTimeout(hardTimerRef.current); hardTimerRef.current = null; }
    if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null; }
  }, []);

  const abortSpeculativeRequest = useCallback(() => {
    if (speculativeControllerRef.current) {
      speculativeControllerRef.current.abort();
      speculativeControllerRef.current = null;
    }
    speculativePromiseRef.current = null;
    speculativeTranscriptRef.current = "";
  }, []);

  const safeStartListening = useCallback(async () => {
    try {
      await startListening();
    } catch (err) {
      console.warn("Failed to start listening in loop:", err);
      if (onLoopError) {
        onLoopError("Microphone permission denied or unavailable.");
      }
    }
  }, [startListening, onLoopError]);

  // ---------- Persona Greeting Helper ----------
  const getPersonaGreeting = useCallback((p: InterviewerPersona): string => {
    switch (p) {
      case "friendly":
        return "Hello! Welcome to your interview today. To warm up: could you tell me a little bit about yourself and what you've been building recently?";
      case "tough":
        return "Let's begin right away. Please give me a concise 60-second summary of your technical architecture experience.";
      case "neutral":
      default:
        return "Welcome. To start our technical discussion, please provide a brief overview of your background and primary technical focus.";
    }
  }, []);

  // ---------- Persona Wrap-up Helper ----------
  const getPersonaWrapUp = useCallback((p: InterviewerPersona): string => {
    switch (p) {
      case "friendly":
        return "That wraps up all of our questions today! Thank you so much for your time and thoughtful answers. We'll be in touch with next steps.";
      case "tough":
        return "We've covered all the core areas for today. Thank you for walking through your systems with me.";
      case "neutral":
      default:
        return "That concludes the technical interview. Thank you for your time today; our team will review the session notes and follow up.";
    }
  }, []);

  // ---------- Core loop step: ask one question ----------
  const askQuestion = useCallback(async (index: number, overrideSpokenText?: string) => {
    if (cancelledRef.current) return;

    const pending = questionsRef.current.filter((q) => q.status === "pending");
    if (index >= pending.length) {
      // Completed all questions — speak persona wrap-up
      setPhase("done");
      stopListening();
      const wrapUp = getPersonaWrapUp(personaRef.current);
      await speakAndWait(wrapUp, "wrapup-" + Date.now());
      if (onLoopComplete) {
        onLoopComplete();
      }
      return;
    }

    const question = pending[index];
    setCurrentIndex(index);
    abortSpeculativeRequest();

    // --- ASKING phase ---
    setPhase("asking");
    stopListening();
    resetTranscript();
    selectQuestion(question.id);

    await delay(150);
    if (cancelledRef.current || phaseRef.current !== "asking") return;

    playChime();
    await delay(120);
    if (cancelledRef.current || phaseRef.current !== "asking") return;

    // Speak either conversational override text or original question text
    const textToSpeak = overrideSpokenText || question.text;
    await speakAndWait(textToSpeak, question.id);
    if (cancelledRef.current || phaseRef.current !== "asking") return;

    // --- Transition to LISTENING ---
    await delay(POST_SPEAK_DELAY_MS);
    if (cancelledRef.current || phaseRef.current !== "asking") return;

    setPhase("listening");
    hasRepromptedRef.current = false;
    await safeStartListening();
    audioRecorder.startRecording().catch(() => {});

    // Hard timeout
    hardTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "listening") {
        finishAnswer(index);
      }
    }, HARD_TIMEOUT_MS);

    // No-speech timeout (20s silence)
    startNoSpeechTimer(index);

  }, [selectQuestion, stopListening, resetTranscript, safeStartListening, getPersonaWrapUp, abortSpeculativeRequest]);

  // ---------- No-speech re-prompt ----------
  const startNoSpeechTimer = useCallback((index: number) => {
    if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
    noSpeechTimerRef.current = setTimeout(() => {
      if (cancelledRef.current || phaseRef.current !== "listening") return;

      const words = transcriptRef.current.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0 || (words.length === 1 && words[0] === "")) {
        if (!hasRepromptedRef.current) {
          hasRepromptedRef.current = true;
          setPhase("asking");
          stopListening();
          speakAndWait(
            "Take your time. Whenever you're ready, go ahead and answer.",
            `reprompt-${index}`
          ).then(() => {
            if (!cancelledRef.current && phaseRef.current === "asking") {
              setPhase("listening");
              safeStartListening();
              startNoSpeechTimer(index);
            }
          });
        } else {
          // Already re-prompted once, finish this turn
          finishAnswer(index);
        }
      }
    }, NO_SPEECH_TIMEOUT_MS);
  }, [safeStartListening, stopListening]);

  // ---------- Speculative Turn Trigger (1.5s silence) ----------
  const triggerSpeculativeTurn = useCallback((pendingIdx: number) => {
    if (speculativePromiseRef.current) return;

    const pending = questionsRef.current.filter((q) => q.status === "pending");
    const currentQ = pending[pendingIdx];
    if (!currentQ) return;

    const nextQ = pending[pendingIdx + 1];
    const candidateAnswer = transcriptRef.current.trim();
    if (!candidateAnswer) return;

    const baseId = currentQ.parentQuestionId || currentQ.id;
    const followUpsUsed = followUpsUsedRef.current[baseId] || 0;

    const controller = new AbortController();
    speculativeControllerRef.current = controller;
    speculativeTranscriptRef.current = candidateAnswer;

    const payload: NextTurnRequest = {
      role: roleRef.current,
      difficulty: difficultyRef.current,
      persona: personaRef.current,
      history: historyRef.current.slice(-3),
      current_question: currentQ.text,
      candidate_answer: candidateAnswer,
      next_planned_question: nextQ ? nextQ.text : null,
      questions_remaining: Math.max(0, pending.length - 1),
      follow_ups_used_for_this_question: followUpsUsed,
      root_question_id: baseId,
    };

    speculativePromiseRef.current = getNextTurn(payload, controller.signal);
  }, []);

  // ---------- Silence Detection & Speculative Orchestration ----------
  useEffect(() => {
    if (phase !== "listening") return;

    if (isCandidateSpeaking) {
      // Candidate is actively speaking — clear timers & abort speculative request
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      if (speculativeTimerRef.current) { clearTimeout(speculativeTimerRef.current); speculativeTimerRef.current = null; }
      if (noSpeechTimerRef.current) { clearTimeout(noSpeechTimerRef.current); noSpeechTimerRef.current = null; }
      abortSpeculativeRequest();
    } else {
      // Candidate paused speaking
      const words = transcript.trim().split(/\s+/).filter(Boolean).length;
      if (words >= MIN_WORDS_TO_AUTO_END) {
        // 1. Speculative trigger at 1.5s
        if (!speculativeTimerRef.current && !speculativePromiseRef.current) {
          speculativeTimerRef.current = setTimeout(() => {
            if (phaseRef.current === "listening") {
              triggerSpeculativeTurn(currentIndex);
            }
          }, SPECULATIVE_SILENCE_MS);
        }

        // 2. Final auto-advance trigger with adaptive silence timeout
        if (!silenceTimerRef.current) {
          const timeoutMs = computeAdaptiveSilenceTimeoutMs(transcript);
          silenceTimerRef.current = setTimeout(() => {
            if (phaseRef.current === "listening") {
              finishAnswer(currentIndex);
            }
          }, timeoutMs);
        }
      }
    }
  }, [isCandidateSpeaking, phase, transcript, currentIndex, triggerSpeculativeTurn, abortSpeculativeRequest]);

  // ---------- Finish Answer → Thinking → Adaptive Next Turn ----------
  const finishAnswer = useCallback(async (index: number) => {
    if (cancelledRef.current) return;
    clearAllTimers();

    setPhase("thinking");
    stopListening();
    const recorded = await audioRecorder.stopRecording();

    const pending = questionsRef.current.filter((q) => q.status === "pending");
    const currentQ = pending[index];
    if (!currentQ) {
      setPhase("done");
      return;
    }

    let answerText = transcriptRef.current.trim();

    // Use Whisper ASR on the recorded audio blob for high-fidelity speech recognition
    if (recorded.blob && recorded.blob.size > 200) {
      try {
        console.log(`[Whisper ASR] Sending ${recorded.blob.size} bytes audio for transcription...`);
        const whisperResult = await transcribeAudioWithWhisper(recorded.blob);
        if (whisperResult && whisperResult.transcript && whisperResult.transcript.trim().length > 0) {
          const refined = whisperResult.transcript.trim();
          console.log(`[Whisper ASR] Transcribed (${whisperResult.duration_seconds}s): "${refined}"`);
          answerText = refined;
          transcriptRef.current = refined;
        }
      } catch (asrErr) {
        console.warn("[Whisper ASR] Falling back to browser speech recognition transcript:", asrErr);
      }
    }

    // Mark current question answered in session with candidate answer text
    markAnswered(currentQ.id, answerText);

    if (answerText.length > 0) {
      // Add to conversation history
      historyRef.current.push({
        question: currentQ.text,
        answer: answerText,
      });
    }

    // Call /next-turn (or use speculative in-flight promise IF transcript matches)
    const baseId = currentQ.parentQuestionId || currentQ.id;
    const followUpsUsed = followUpsUsedRef.current[baseId] || 0;
    const nextPlanned = pending[index + 1];

    let nextTurnResult: NextTurnResponse;
    const startTime = performance.now();

    const canUseSpeculative = (
      speculativePromiseRef.current !== null &&
      speculativeTranscriptRef.current.length > 0 &&
      speculativeTranscriptRef.current === answerText
    );

    if (canUseSpeculative) {
      try {
        nextTurnResult = await speculativePromiseRef.current!;
      } catch {
        nextTurnResult = {
          reaction: "",
          next_question: nextPlanned ? nextPlanned.text : null,
          follow_up: false,
          degraded: true,
        };
      }
    } else {
      // Transcript changed since 1.5s speculative fire or speculative was not triggered -> re-fire fresh
      abortSpeculativeRequest();

      const payload: NextTurnRequest = {
        role: roleRef.current,
        difficulty: difficultyRef.current,
        persona: personaRef.current,
        history: historyRef.current.slice(-3),
        current_question: currentQ.text,
        candidate_answer: answerText,
        next_planned_question: nextPlanned ? nextPlanned.text : null,
        questions_remaining: Math.max(0, pending.length - 1),
        follow_ups_used_for_this_question: followUpsUsed,
        root_question_id: baseId,
      };
      nextTurnResult = await getNextTurn(payload);
    }

    const latencyMs = Math.round(performance.now() - startTime);
    console.log(`[NextTurn] Latency: ${latencyMs} ms | Degraded: ${nextTurnResult.degraded ?? false} | SpeculativeHit: ${canUseSpeculative}`);
    abortSpeculativeRequest();

    // Item (a): Start evaluation strictly AFTER next-turn returns so next-turn is never queued behind evaluation
    if (answerText.length > 0) {
      evaluateQuestion(currentQ.id, answerText, {
        audioBlob: recorded.blob,
        durationSeconds: recorded.durationSeconds,
        persona: personaRef.current,
        saveAudioForTraining: saveAudioForTrainingRef.current,
      }).catch((err) => {
        console.warn("Background evaluation failed:", err);
      });
    }

    if (cancelledRef.current) return;

    // Speak Reaction (if validated & non-empty)
    if (nextTurnResult.reaction) {
      setCurrentAiReaction(nextTurnResult.reaction);
      await speakAndWait(nextTurnResult.reaction, `reaction-${Date.now()}`);
      await delay(POST_SPEAK_DELAY_MS);
      if (cancelledRef.current) return;
    } else {
      setCurrentAiReaction("");
    }

    // Handle Probing Follow-Up vs Next Question
    if (nextTurnResult.follow_up && nextTurnResult.next_question && followUpsUsed < 1) {
      followUpsUsedRef.current[baseId] = followUpsUsed + 1;

      if (insertFollowUpQuestion) {
        insertFollowUpQuestion(currentQ.id, nextTurnResult.next_question);
      }

      // Small delay to let React update question list
      setTimeout(() => {
        if (!cancelledRef.current) {
          // Ask the follow-up question (index 0 of remaining pending)
          askQuestion(0, nextTurnResult.next_question || undefined);
        }
      }, 200);
    } else {
      // Normal advance to next planned question
      setTimeout(() => {
        if (!cancelledRef.current) {
          askQuestion(0, nextTurnResult.next_question || undefined);
        }
      }, 200);
    }

  }, [markAnswered, evaluateQuestion, stopListening, clearAllTimers, abortSpeculativeRequest, insertFollowUpQuestion, askQuestion]);

  // ---------- Barge-in: candidate interrupts AI speech ----------
  const bargeIn = useCallback(() => {
    if (phaseRef.current === "asking") {
      cancelAllSpeech();
      clearAllTimers();
      abortSpeculativeRequest();
      setPhase("listening");
      safeStartListening();

      hardTimerRef.current = setTimeout(() => {
        if (phaseRef.current === "listening") {
          finishAnswer(currentIndex);
        }
      }, HARD_TIMEOUT_MS);
      startNoSpeechTimer(currentIndex);
    }
  }, [currentIndex, safeStartListening, clearAllTimers, finishAnswer, startNoSpeechTimer, abortSpeculativeRequest]);

  // ---------- Skip question ----------
  const skipQuestion = useCallback(() => {
    if (phaseRef.current === "asking" || phaseRef.current === "listening") {
      finishAnswer(currentIndex);
    }
  }, [currentIndex, finishAnswer]);

  // ---------- Public API ----------
  const startLoop = useCallback(async () => {
    cancelledRef.current = false;
    clearAllTimers();
    abortSpeculativeRequest();
    historyRef.current = [];
    followUpsUsedRef.current = {};
    setCurrentAiReaction("");

    // 1. Warm-up Greeting Turn
    setPhase("asking");
    stopListening();
    resetTranscript();

    await delay(150);
    if (cancelledRef.current) return;

    playChime();
    await delay(120);
    if (cancelledRef.current) return;

    const greeting = getPersonaGreeting(personaRef.current);
    await speakAndWait(greeting, "greeting-" + Date.now());
    if (cancelledRef.current) return;

    // Proceed to first question after brief pause
    await delay(POST_SPEAK_DELAY_MS);
    if (!cancelledRef.current) {
      askQuestion(0);
    }
  }, [askQuestion, clearAllTimers, abortSpeculativeRequest, stopListening, resetTranscript, getPersonaGreeting]);

  const stopLoop = useCallback(() => {
    cancelledRef.current = true;
    clearAllTimers();
    abortSpeculativeRequest();
    cancelAllSpeech();
    stopListening();
    setPhase("idle");
    setCurrentIndex(0);
    setCurrentAiReaction("");
  }, [clearAllTimers, stopListening, abortSpeculativeRequest]);

  const markDone = useCallback(() => {
    if (phase === "listening") {
      finishAnswer(currentIndex);
    }
  }, [phase, currentIndex, finishAnswer]);

  // Handle tab visibility change / blur to avoid leaking speech
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && phaseRef.current === "asking") {
        cancelAllSpeech();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearAllTimers();
      abortSpeculativeRequest();
      cancelAllSpeech();
    };
  }, [clearAllTimers, abortSpeculativeRequest]);

  const pendingQuestions = questions.filter((q) => q.status === "pending");
  const activeQuestion = pendingQuestions[currentIndex] || questions.find((q) => q.isSelected);

  return {
    phase,
    isLoopActive: phase !== "idle" && phase !== "done",
    currentQuestionIndex: currentIndex,
    totalQuestions: pendingQuestions.length,
    activeQuestion,
    currentAiReaction,
    startLoop,
    stopLoop,
    markDone,
    bargeIn,
    skipQuestion,
    saveAudioForTraining,
    setSaveAudioForTraining,
    isRecordingAudio: audioRecorder.isRecording,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

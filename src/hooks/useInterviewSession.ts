import { useState, useCallback, useEffect } from "react";
import {
  InterviewSession,
  InterviewQuestion,
  ModelEvaluationResult,
  ModelUnavailableError,
  OllamaStatus,
  CosyVoiceStatus,
  InterviewerPersona,
} from "../types";
import { mockInterview } from "../data/mockInterview";
import {
  checkModelHealth,
  evaluateAnswerWithModel,
  generateSummaryWithModel,
  getOllamaStatus,
  getCosyVoiceStatus,
} from "../services/modelClient";

function createInitialSession(sessionId?: string, initialData?: InterviewSession): InterviewSession {
  const base = initialData || mockInterview;
  if (!sessionId || sessionId === "session-001") {
    return {
      ...base,
      id: sessionId || base.id,
    };
  }

  // Brand-new live session: start with clean pending questions and unique ID
  return {
    ...base,
    id: sessionId,
    isLive: true,
    isRecording: true,
    recordingDuration: 0,
    questions: base.questions.map((q, idx) => ({
      ...q,
      candidateAnswer: undefined,
      aiEvaluation: undefined,
      status: "pending",
      isSelected: idx === 0,
    })),
    timeline: [
      {
        id: `t-init-${Date.now()}`,
        timestamp: "00:00:00",
        label: "Live Technical Interview Initialized",
        type: "note",
      },
    ],
  };
}

export function useInterviewSession(
  sessionIdOrData?: string | InterviewSession,
  initialData?: InterviewSession
) {
  const resolvedSessionId = typeof sessionIdOrData === "string" ? sessionIdOrData : undefined;
  const resolvedData = typeof sessionIdOrData === "object" ? sessionIdOrData : initialData;

  const [session, setSession] = useState<InterviewSession>(() =>
    createInitialSession(resolvedSessionId, resolvedData)
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isModelOnline, setIsModelOnline] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    online: true,
    models: ["qwen2.5-coder:7b"],
    defaultModel: "qwen2.5-coder:7b",
  });
  const [cosyVoiceStatus, setCosyVoiceStatus] = useState<CosyVoiceStatus>({
    online: true,
    serverUrl: "http://localhost:50000",
    engine: "cosyvoice2",
  });

  // Poll model server, Ollama, and CosyVoice status
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const online = await checkModelHealth();
      if (mounted) setIsModelOnline(online);

      const oStatus = await getOllamaStatus();
      if (mounted && oStatus.online) setOllamaStatus(oStatus);

      const cvStatus = await getCosyVoiceStatus();
      if (mounted) setCosyVoiceStatus(cvStatus);
    };

    check();
    const interval = setInterval(check, 6000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2500);
  }, []);

  const selectQuestion = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => ({
        ...q,
        isSelected: q.id === id,
      })),
    }));
  }, []);

  const toggleMic = useCallback(() => {
    setSession((prev) => {
      const nextMuted = !prev.candidate.isMuted;
      triggerToast(nextMuted ? "Microphone muted" : "Microphone unmuted");
      return {
        ...prev,
        candidate: {
          ...prev.candidate,
          isMuted: nextMuted,
        },
      };
    });
  }, [triggerToast]);

  const toggleCamera = useCallback(() => {
    setSession((prev) => {
      const nextCamera = !prev.candidate.isCameraOn;
      triggerToast(nextCamera ? "Camera turned on" : "Camera turned off");
      return {
        ...prev,
        candidate: {
          ...prev.candidate,
          isCameraOn: nextCamera,
        },
      };
    });
  }, [triggerToast]);

  const stopRecording = useCallback(() => {
    setSession((prev) => {
      if (!prev.isRecording) return prev;
      triggerToast("Recording Saved");
      return {
        ...prev,
        isRecording: false,
      };
    });
  }, [triggerToast]);

  const startRecording = useCallback(() => {
    setSession((prev) => {
      if (prev.isRecording) return prev;
      triggerToast("Recording Resumed");
      return {
        ...prev,
        isRecording: true,
      };
    });
  }, [triggerToast]);

  const markAnswered = useCallback((id: string, candidateAnswer?: string) => {
    setSession((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === id
          ? {
              ...q,
              status: "answered",
              ...(candidateAnswer !== undefined ? { candidateAnswer } : {}),
            }
          : q
      ),
    }));
  }, []);

  // Add questions generated on topic by Ollama
  const addQuestions = useCallback(
    (newQuestions: InterviewQuestion[]) => {
      setSession((prev) => {
        // Deselect previous questions
        const existing = prev.questions.map((q) => ({ ...q, isSelected: false }));
        // Renumber new questions
        const startIndex = existing.length + 1;
        const renumbered = newQuestions.map((q, idx) => ({
          ...q,
          number: startIndex + idx,
          isSelected: idx === 0,
        }));

        const combined = [...existing, ...renumbered];
        const topic = newQuestions[0]?.category || "Technical Topic";

        // Add timeline event
        const newTimelineEvent = {
          id: `t-ollama-${Date.now()}`,
          timestamp: "00:08:15",
          label: `Ollama added ${newQuestions.length} questions on ${topic}`,
          type: "note" as const,
        };

        triggerToast(`Ollama generated ${newQuestions.length} questions on ${topic}!`);

        return {
          ...prev,
          questions: combined,
          timeline: [...prev.timeline, newTimelineEvent],
        };
      });
    },
    [triggerToast]
  );

  // Insert a dynamically generated probing follow-up linked to its parent question
  const insertFollowUpQuestion = useCallback(
    (parentQuestionId: string, text: string) => {
      setSession((prev) => {
        const parentIdx = prev.questions.findIndex((q) => q.id === parentQuestionId);
        const parent = prev.questions[parentIdx];
        const newQ: InterviewQuestion = {
          id: `q-followup-${Date.now()}`,
          number: parent ? parent.number : prev.questions.length + 1,
          text,
          category: parent?.category ? `${parent.category} (Follow-up)` : "Probing Follow-up",
          difficulty: parent?.difficulty || "Mid-Level",
          status: "pending",
          isSelected: true,
          isFollowUp: true,
          parentQuestionId,
        };

        const updated = [...prev.questions];
        if (parentIdx >= 0) {
          updated.splice(parentIdx + 1, 0, newQ);
        } else {
          updated.push(newQ);
        }

        const newTimelineEvent = {
          id: `t-followup-${Date.now()}`,
          timestamp: "Follow-up",
          label: `Follow-up on Q${parent?.number || ""}: "${text.slice(0, 45)}..."`,
          type: "question" as const,
        };

        return {
          ...prev,
          questions: updated,
          timeline: [...prev.timeline, newTimelineEvent],
        };
      });
    },
    []
  );

  const setPersona = useCallback((persona: InterviewerPersona) => {
    setSession((prev) => ({
      ...prev,
      persona,
    }));
  }, []);

  // Live evaluation via FastAPI model backend
  const evaluateQuestion = useCallback(
    async (
      id: string,
      customAnswer?: string,
      options?: {
        audioBlob?: Blob | null;
        durationSeconds?: number;
        persona?: string;
        selfRating?: number | null;
        saveAudioForTraining?: boolean;
      }
    ) => {
      const q = session.questions.find((x) => x.id === id);
      if (!q) return;

      const answerToEvaluate =
        customAnswer?.trim() ||
        q.candidateAnswer ||
        "Candidate demonstrated standard practical experience with the core requirements.";

      setIsEvaluating(true);
      triggerToast("Sending to AI Model (Port 8000)...");

      try {
        const result: ModelEvaluationResult = await evaluateAnswerWithModel(
          q.id,
          q.text,
          answerToEvaluate,
          options
        );

        setSession((prev) => ({
          ...prev,
          questions: prev.questions.map((item) =>
            item.id === id
              ? {
                  ...item,
                  candidateAnswer: answerToEvaluate,
                  status: "answered",
                  aiEvaluation: result,
                }
              : item
          ),
        }));

        triggerToast(`Model Score: ${result.score}/10 (${result.grade})`);
      } catch (err) {
        if (err instanceof ModelUnavailableError) {
          console.warn("Backend offline, evaluation skipped:", err.message);
          triggerToast("Backend offline — evaluation skipped. Answer saved.");
          // Still save the answer text, but no fake evaluation enters state
          setSession((prev) => ({
            ...prev,
            questions: prev.questions.map((item) =>
              item.id === id
                ? { ...item, candidateAnswer: answerToEvaluate, status: "answered" }
                : item
            ),
          }));
        } else {
          console.error("Evaluation error:", err);
          triggerToast("AI evaluation failed unexpectedly.");
        }
      } finally {
        setIsEvaluating(false);
      }
    },
    [session.questions, triggerToast]
  );

  const regenerateSummary = useCallback(async () => {
    triggerToast("Generating AI Summary from Model...");
    const answered = session.questions
      .filter((q) => q.status === "answered")
      .map((q) => q.text);

    try {
      const newSummary = await generateSummaryWithModel(
        session.title,
        session.meetingNote.participants,
        answered
      );

      setSession((prev) => ({
        ...prev,
        meetingNote: {
          ...prev.meetingNote,
          aiSummary: newSummary,
        },
      }));

      triggerToast("AI Summary Updated");
    } catch (err) {
      if (err instanceof ModelUnavailableError) {
        console.warn("Backend offline, summary generation skipped:", err.message);
        triggerToast("Backend offline — summary unavailable.");
      } else {
        console.error("Summary generation error:", err);
        triggerToast("Summary generation failed.");
      }
    }
  }, [session.questions, session.title, session.meetingNote.participants, triggerToast]);

  return {
    session,
    isModelOnline,
    isEvaluating,
    ollamaStatus,
    cosyVoiceStatus,
    selectQuestion,
    toggleMic,
    toggleCamera,
    stopRecording,
    startRecording,
    markAnswered,
    addQuestions,
    insertFollowUpQuestion,
    setPersona,
    evaluateQuestion,
    regenerateSummary,
    toastMessage,
    triggerToast,
  };
}

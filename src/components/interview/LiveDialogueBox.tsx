import React, { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  Sparkles,
  Trash2,
  Send,
  AudioLines,
  Bot,
  User,
  Radio,
  Check,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";
import { InterviewQuestion } from "../../types";
import {
  askQuestionWithCosyVoice,
  stopCosyVoiceSpeaking,
  addSpeakingListener,
  getLastSpokenText,
  testBrowserAudio,
  playChime,
} from "../../services/cosyVoiceService";

interface LiveDialogueBoxProps {
  activeQuestion?: InterviewQuestion;
  candidateMuted: boolean;
  onToggleMic: () => void;
  candidateTranscript: string;
  interimTranscript: string;
  isCandidateSpeaking: boolean;
  isListening: boolean;
  volumeLevel: number;
  isSpeechSupported: boolean;
  permissionState: "prompt" | "granted" | "denied" | "unsupported";
  errorMessage: string | null;
  onStartListening: () => Promise<void>;
  onStopListening: () => void;
  onUpdateTranscript: (text: string) => void;
  onResetTranscript: () => void;
  onEvaluateAnswer?: (questionId: string, answerText: string) => void;
  isEvaluating?: boolean;
  // Auto-advancing conversational loop props
  loopPhase?: "idle" | "asking" | "listening" | "thinking" | "done";
  isLoopActive?: boolean;
  onStartLoop?: () => void;
  onStopLoop?: () => void;
  onMarkDone?: () => void;
  onBargeIn?: () => void;
  persona?: "friendly" | "neutral" | "tough";
  onSetPersona?: (persona: "friendly" | "neutral" | "tough") => void;
  currentAiReaction?: string;
  saveAudioForTraining?: boolean;
  onToggleSaveAudioForTraining?: (val: boolean) => void;
  isRecordingAudio?: boolean;
}

export const LiveDialogueBox: React.FC<LiveDialogueBoxProps> = ({
  activeQuestion,
  candidateMuted,
  onToggleMic,
  candidateTranscript,
  interimTranscript,
  isCandidateSpeaking,
  isListening,
  volumeLevel,
  isSpeechSupported,
  permissionState,
  errorMessage,
  onStartListening,
  onStopListening,
  onUpdateTranscript,
  onResetTranscript,
  onEvaluateAnswer,
  isEvaluating = false,
  loopPhase = "idle",
  isLoopActive = false,
  onStartLoop,
  onStopLoop,
  onMarkDone,
  onBargeIn,
  persona = "friendly",
  onSetPersona,
  currentAiReaction,
  saveAudioForTraining = false,
  onToggleSaveAudioForTraining,
  isRecordingAudio = false,
}) => {
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [aiText, setAiText] = useState<string>(activeQuestion?.text || "");
  const [copied, setCopied] = useState<boolean>(false);
  const [audioTesting, setAudioTesting] = useState<boolean>(false);

  // Sync active question text
  useEffect(() => {
    if (activeQuestion?.text) {
      setAiText(activeQuestion.text);
    }
  }, [activeQuestion?.text, activeQuestion?.id]);

  // Listen to AI voice speaking events
  useEffect(() => {
    const last = getLastSpokenText();
    if (last.text) {
      setAiText(last.text);
      setIsAiSpeaking(last.isSpeaking);
    }

    const unsub = addSpeakingListener((speaking, _, text) => {
      setIsAiSpeaking(speaking);
      if (text) setAiText(text);
    });
    return unsub;
  }, []);

  // Global keyboard shortcuts while loop is active: Space = "I'm done", Esc = End, M = Mute
  useEffect(() => {
    if (!isLoopActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        if (e.key === "Escape" && onStopLoop) {
          e.preventDefault();
          onStopLoop();
        }
        return;
      }

      if (e.code === "Space" && loopPhase === "listening" && onMarkDone) {
        e.preventDefault();
        onMarkDone();
      } else if (e.key === "Escape" && onStopLoop) {
        e.preventDefault();
        onStopLoop();
      } else if ((e.key === "m" || e.key === "M") && onToggleMic) {
        e.preventDefault();
        onToggleMic();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoopActive, loopPhase, onMarkDone, onStopLoop, onToggleMic]);

  const handleSpeakAi = () => {
    if (isAiSpeaking) {
      stopCosyVoiceSpeaking();
    } else if (activeQuestion) {
      playChime();
      askQuestionWithCosyVoice(activeQuestion.text, activeQuestion.id);
    }
  };

  const handleTestAudio = async () => {
    setAudioTesting(true);
    try {
      await testBrowserAudio();
    } finally {
      setTimeout(() => setAudioTesting(false), 2500);
    }
  };

  const handleMicClick = async () => {
    if (candidateMuted) {
      onToggleMic();
    }
    if (!isListening) {
      await onStartListening();
    } else {
      onStopListening();
    }
  };

  const handleSendToEvaluate = () => {
    if (!activeQuestion || !onEvaluateAnswer) return;
    const finalAnswer =
      (candidateTranscript + (interimTranscript ? " " + interimTranscript : "")).trim() ||
      activeQuestion.candidateAnswer ||
      "Candidate provided a structured explanation covering best practices.";
    onEvaluateAnswer(activeQuestion.id, finalAnswer);
  };

  const handleCopyText = () => {
    const text = candidateTranscript + (interimTranscript ? " " + interimTranscript : "");
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertSample = () => {
    if (activeQuestion?.candidateAnswer) {
      onUpdateTranscript(activeQuestion.candidateAnswer);
    } else {
      onUpdateTranscript("In production, I optimize performance by code-splitting routes, memoizing expensive pure functions, and profiling render trees.");
    }
  };

  return (
    <div className="w-full bg-white rounded-card border border-border shadow-card p-4 sm:p-5 mt-4 transition-all">
      {/* 1. Header Bar with 1-on-1 Loop Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-primary border border-indigo-100 shadow-xs">
            <Radio className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
              <span>Live 1-on-1 Q&A Engine</span>
              {isLoopActive ? (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live Interview Active
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  Interactive
                </span>
              )}
            </h3>
            <p className="text-[11px] text-textSecondary">
              {isLoopActive
                ? "The interviewer asks questions automatically and moves on as you answer."
                : "Start the 1-on-1 conversational interview or practice each question manually."}
            </p>
          </div>
        </div>

        {/* Header Right Action: Interview Loop Controls & Audio Test */}
        <div className="flex flex-wrap items-center gap-2">
          {!isLoopActive ? (
            onStartLoop && (
              <button
                type="button"
                onClick={onStartLoop}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                title="Start natural 1-on-1 mock interview with automatic speech turn-taking"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start 1-on-1 Interview</span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              {loopPhase === "asking" && onBargeIn && (
                <button
                  type="button"
                  onClick={onBargeIn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-xs transition-all active:scale-95"
                  title="Interrupt AI speaking and answer immediately"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-700" />
                  <span>Interrupt & Answer</span>
                </button>
              )}

              {loopPhase === "listening" && onMarkDone && (
                <button
                  type="button"
                  onClick={onMarkDone}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                  title="Finish speaking and advance to the next question (Space)"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>I'm Done Answering</span>
                </button>
              )}

              {onStopLoop && (
                <button
                  type="button"
                  onClick={onStopLoop}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all"
                  title="End conversation loop (Esc)"
                >
                  <Square className="w-3 h-3 fill-red-600 text-red-600" />
                  <span>End Loop</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleTestAudio}
            disabled={audioTesting}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-textPrimary transition-all border border-gray-200"
            title="Play test audio chime to verify your browser speakers"
          >
            <Volume2 className="w-3.5 h-3.5 text-primary" />
            <span>{audioTesting ? "Testing..." : "Test Audio"}</span>
          </button>
        </div>
      </div>

      {/* Loop Phase Indicator Bar (Visible when active) */}
      {isLoopActive && (
        <div className="mt-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-textSecondary uppercase tracking-wider text-[10px]">
              Interview Phase:
            </span>
            {loopPhase === "asking" && (
              <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <AudioLines className="w-3.5 h-3.5 animate-pulse text-indigo-600" />
                Interviewer Speaking
              </span>
            )}
            {loopPhase === "listening" && (
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                <Mic className="w-3.5 h-3.5 text-emerald-600" />
                Listening to Your Answer
              </span>
            )}
            {loopPhase === "thinking" && (
              <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-600" />
                Thinking & Preparing Next Question...
              </span>
            )}
            {loopPhase === "done" && (
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                All Questions Completed
              </span>
            )}
          </div>

          <div className="text-[11px] text-textSecondary font-mono hidden sm:block">
            Shortcuts: <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Space</kbd> Done · <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Esc</kbd> End · <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">M</kbd> Mute
          </div>
        </div>
      )}

      {/* Persona Selector Bar */}
      <div className="mt-3 p-2.5 rounded-xl bg-gray-50/80 border border-gray-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-textSecondary font-semibold">
          <Bot className="w-4 h-4 text-primary" />
          <span>Interviewer Persona:</span>
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-xs">
          {(["friendly", "neutral", "tough"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSetPersona && onSetPersona(p)}
              disabled={isLoopActive}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                persona === p
                  ? p === "friendly"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
                    : p === "tough"
                    ? "bg-rose-50 text-rose-800 border border-rose-200 shadow-xs"
                    : "bg-indigo-50 text-primary border border-indigo-200 shadow-xs"
                  : "text-textSecondary hover:text-textPrimary hover:bg-gray-50 border border-transparent"
              } ${isLoopActive ? "cursor-not-allowed opacity-75" : ""}`}
              title={
                p === "friendly"
                  ? "Warm, encouraging, but rigorous"
                  : p === "tough"
                  ? "Direct, skeptical, probes for depth"
                  : "Objective, concise, and professional"
              }
            >
              {p}
            </button>
          ))}
        </div>

        {/* Setting: Save audio for training (Default OFF) */}
        <label
          className="flex items-center gap-1.5 text-[11px] font-medium text-textSecondary cursor-pointer select-none bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-xs hover:border-indigo-200 transition-colors"
          title="When OFF (default), audio is decoded in-memory and discarded immediately. When ON, candidate answer audio is saved to data/training/audio for model training."
        >
          <input
            type="checkbox"
            checked={saveAudioForTraining}
            onChange={(e) => onToggleSaveAudioForTraining && onToggleSaveAudioForTraining(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-gray-300"
          />
          <span>Save audio for training</span>
          <span className="text-[9px] text-gray-400 font-mono">
            ({saveAudioForTraining ? "ON" : "OFF"})
          </span>
        </label>
      </div>

      {/* Permission Denied Alert Banner */}
      {permissionState === "denied" && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Microphone Access is Blocked:</span>
            <span>
              Click the <strong>Lock / Settings icon</strong> in your browser's address bar (next to http://localhost:3000), set <strong>Microphone</strong> to <strong>Allow</strong>, then click "Start Speaking" again.
            </span>
          </div>
        </div>
      )}

      {/* 2. AI Interviewer Turn (Prompt / Voice Output) */}
      <div className="mt-3.5 p-3.5 rounded-xl bg-gradient-to-br from-indigo-50/80 via-indigo-50/40 to-purple-50/50 border border-indigo-100/90 relative space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
              AI
            </span>
            <div>
              <span className="text-xs font-bold text-indigo-950 block">
                AI Interviewer (Mrs. Tania Shahira)
              </span>
              <span className="text-[10px] text-textSecondary">
                {isAiSpeaking
                  ? "Speaking aloud..."
                  : loopPhase === "thinking"
                  ? "Formulating adaptive turn..."
                  : "Ready"}
              </span>
            </div>
            {activeQuestion?.isFollowUp && (
              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-md animate-pulse">
                Probing Follow-Up
              </span>
            )}
            {activeQuestion?.category && !activeQuestion.isFollowUp && (
              <span className="ml-1 text-[10px] bg-white border border-indigo-200/80 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                {activeQuestion.category}
              </span>
            )}
          </div>

          {/* Primary "Speak / Play Question" Button */}
          <button
            type="button"
            onClick={handleSpeakAi}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
              isAiSpeaking
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-primary hover:bg-indigo-700 text-white active:scale-95"
            }`}
            title={isAiSpeaking ? "Stop AI voice" : "Speak this question out loud"}
          >
            {isAiSpeaking ? (
              <>
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Stop Voice</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Hear Question Aloud</span>
              </>
            )}
          </button>
        </div>

        {/* Live Reaction Bubble (Spoken during conversation turn) */}
        {currentAiReaction && (
          <div className="p-2.5 rounded-lg bg-indigo-100/70 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2 animate-fadeIn">
            <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded shrink-0">
              Reaction
            </span>
            <p className="italic leading-relaxed font-medium">"{currentAiReaction}"</p>
          </div>
        )}

        {/* Subtle Thinking Animation Banner */}
        {loopPhase === "thinking" && (
          <div className="p-3 bg-white/90 border border-purple-200 rounded-lg flex items-center gap-2.5 animate-pulse shadow-xs">
            <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 animate-spin" />
            </div>
            <div className="text-xs text-purple-900">
              <span className="font-bold">Interviewer is reflecting on your answer...</span>
              <span className="text-[11px] text-purple-700 block">Formulating context-aware feedback and next question.</span>
            </div>
          </div>
        )}

        {/* AI Spoken Text Display */}
        <div className="text-xs sm:text-sm text-textPrimary font-medium leading-relaxed bg-white/90 backdrop-blur-xs p-3 rounded-lg border border-indigo-100 shadow-xs flex items-start gap-2">
          <span className="text-primary font-bold">Q:</span>
          <span>{aiText || "Select or start a question from the panel to hear it spoken."}</span>
        </div>
      </div>

      {/* 3. Candidate Turn (Live Speech-to-Text & Spoken Text Box) */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
              You
            </span>
            <div>
              <span className="text-xs font-bold text-textPrimary block">
                Your Live Spoken Response
              </span>
              <span className="text-[10px] text-textSecondary">
                {isListening
                  ? isCandidateSpeaking
                    ? "Speech detected - transcribing..."
                    : "Mic listening... speak now"
                  : "Mic inactive. Click 'Start Speaking' to talk."}
              </span>
            </div>

            {isCandidateSpeaking && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse ml-1">
                <AudioLines className="w-3 h-3" />
                <span>Speaking</span>
              </span>
            )}

            {isRecordingAudio && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200 animate-pulse ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-ping" />
                <span>Acoustic Capture Active</span>
              </span>
            )}
          </div>

          {/* Volume Meter & Mic Action Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-textSecondary">
              <span>Mic:</span>
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    !isListening || candidateMuted
                      ? "w-0 bg-gray-400"
                      : volumeLevel > 60
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${!isListening || candidateMuted ? 0 : Math.max(10, volumeLevel)}%` }}
                />
              </div>
            </div>

            {/* Toggle Mic / Start Listening Button */}
            <button
              type="button"
              onClick={handleMicClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 ${
                isListening && !candidateMuted
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
              title={isListening ? "Pause microphone" : "Enable microphone and start speaking"}
            >
              {isListening && !candidateMuted ? (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Mic Live (Listening)</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Speaking (Enable Mic)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Speech-to-Text Input Area */}
        <div
          className={`relative rounded-xl border transition-all ${
            isCandidateSpeaking && !candidateMuted
              ? "border-emerald-400 ring-2 ring-emerald-400/20 shadow-sm"
              : "border-gray-200 hover:border-gray-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"
          }`}
        >
          <textarea
            value={candidateTranscript}
            onChange={(e) => onUpdateTranscript(e.target.value)}
            placeholder={
              !isListening
                ? "Click 'Start Speaking (Enable Mic)' above and speak your answer, or type here directly..."
                : candidateMuted
                ? "Microphone is muted. Unmute to speak or type your answer here..."
                : "Listening to your microphone... speak naturally and your words will appear here in real time."
            }
            rows={3}
            className="w-full text-xs sm:text-sm p-3 rounded-t-xl bg-gray-50/50 focus:bg-white text-textPrimary focus:outline-none resize-none leading-relaxed transition-colors"
          />

          {/* Live Interim Words Ribbon (Shows words currently forming in real time) */}
          {interimTranscript && !candidateMuted && (
            <div className="px-3 py-1 bg-emerald-50/80 border-t border-emerald-100 text-xs text-emerald-800 font-medium flex items-center gap-2 animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span className="text-[11px] font-bold text-emerald-900 uppercase">Live:</span>
              <span className="italic">{interimTranscript}</span>
            </div>
          )}

          {/* Bottom Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50/90 border-t border-gray-100 rounded-b-xl">
            {/* Left Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onResetTranscript}
                disabled={!candidateTranscript && !interimTranscript}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-textSecondary hover:text-danger hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Clear current transcription"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                disabled={!candidateTranscript}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-textSecondary hover:text-primary hover:bg-gray-100 transition-colors disabled:opacity-40"
                title="Copy response to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={handleInsertSample}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
                title="Insert a sample response to test evaluation without speaking"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fill Sample Answer</span>
              </button>
            </div>

            {/* Right Action: Send to AI Evaluation (Hidden during 1-on-1 auto loop) */}
            <div className="flex items-center gap-2">
              {isLoopActive ? (
                <div className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Auto-advancing conversation active</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSendToEvaluate}
                  disabled={isEvaluating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all disabled:opacity-50"
                  title="Submit this response to the local AI model for scoring and tone evaluation"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEvaluating ? "Evaluating..." : "Send to AI Evaluation"}</span>
                  <Send className="w-3 h-3 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

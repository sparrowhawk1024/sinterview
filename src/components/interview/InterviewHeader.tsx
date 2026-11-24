import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, StopCircle, Radio, Cpu, BrainCircuit, Volume2, FileText } from "lucide-react";
import { OllamaStatus, CosyVoiceStatus } from "../../types";

interface InterviewHeaderProps {
  title: string;
  subtitle: string;
  isRecording: boolean;
  recordingTime: string;
  isModelOnline?: boolean;
  ollamaStatus?: OllamaStatus;
  cosyVoiceStatus?: CosyVoiceStatus;
  onStopRecording: () => void;
  onStartRecording?: () => void;
  onViewReport?: () => void;
}

export const InterviewHeader: React.FC<InterviewHeaderProps> = ({
  title,
  subtitle,
  isRecording,
  recordingTime,
  isModelOnline = true,
  ollamaStatus,
  cosyVoiceStatus,
  onStopRecording,
  onStartRecording,
  onViewReport,
}) => {
  const navigate = useNavigate();

  const isOllamaOnline = ollamaStatus?.online ?? true;
  const ollamaModel = ollamaStatus?.models[0] || "qwen2.5-coder:7b";

  return (
    <div className="w-full px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 bg-white/70 backdrop-blur-xs">
      {/* Left Column: Back Arrow + Title/Subtitle + AI Badges */}
      <div className="flex items-start sm:items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-full text-textSecondary hover:text-textPrimary hover:bg-gray-100 transition-colors"
          title="Go back"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-semibold text-xl sm:text-2xl text-textPrimary tracking-tight">
              {title}
            </h1>

            {/* AI Model Badge */}
            <div
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                isModelOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
              title={
                isModelOnline
                  ? "Local Speech & NLP Model Server is connected on port 8000"
                  : "Local Model Server is offline"
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isModelOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <Cpu className="w-3 h-3" />
              <span>FastAPI :8000</span>
            </div>

            {/* Ollama Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                isOllamaOnline
                  ? "bg-indigo-50 text-primary border-indigo-200"
                  : "bg-gray-50 text-textSecondary border-gray-200"
              }`}
              title={`Ollama Local LLM on port 11434 (${ollamaModel})`}
            >
              <BrainCircuit className="w-3 h-3 text-primary" />
              <span>Ollama: {ollamaModel}</span>
            </div>

            {/* CosyVoice 2 Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                cosyVoiceStatus?.online
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-gray-50 text-textSecondary border-gray-200"
              }`}
              title={
                cosyVoiceStatus?.online
                  ? `CosyVoice 2 active at ${cosyVoiceStatus.serverUrl}`
                  : "CosyVoice 2 offline — using browser speech fallback"
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cosyVoiceStatus?.online ? "bg-purple-500 animate-pulse" : "bg-gray-400"
                }`}
              />
              <Volume2 className="w-3 h-3" />
              <span>{cosyVoiceStatus?.online ? "CosyVoice 2" : "Voice: Browser"}</span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-textSecondary mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Column: Action Buttons */}
      <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
        {onViewReport && (
          <button
            type="button"
            onClick={onViewReport}
            className="border border-indigo-200 bg-indigo-50/80 hover:bg-primary hover:text-white text-primary rounded-full px-3.5 py-2 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Open comprehensive interview evaluation report"
          >
            <FileText className="w-4 h-4" />
            <span>Interview Report</span>
          </button>
        )}

        {/* Stop Recording Button */}
        <button
          type="button"
          onClick={onStopRecording}
          disabled={!isRecording}
          className={`border rounded-full px-4 py-2 text-xs sm:text-sm font-medium flex items-center gap-2 transition-all duration-150 ${
            isRecording
              ? "border-border bg-white text-textSecondary hover:bg-gray-50 hover:text-textPrimary cursor-pointer active:scale-95"
              : "border-gray-200 bg-gray-50 text-textMuted cursor-not-allowed opacity-60"
          }`}
          title={isRecording ? "Stop current recording" : "Recording stopped"}
        >
          <StopCircle className="w-4 h-4 text-recordingGray" />
          <span>Stop Recording</span>
        </button>

        {/* Live Recording Badge / Button */}
        <div
          onClick={() => {
            if (!isRecording && onStartRecording) onStartRecording();
          }}
          className={`rounded-full px-4 py-2 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all duration-200 ${
            isRecording
              ? "bg-danger text-white shadow-danger/20"
              : "bg-gray-200 text-textSecondary cursor-pointer hover:bg-gray-300"
          }`}
          title={isRecording ? "Live recording in progress" : "Click to resume recording"}
        >
          {isRecording ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              <span>Live Recording</span>
              <span className="font-mono text-xs text-white/90 ml-0.5 tracking-wider">
                {recordingTime}
              </span>
            </>
          ) : (
            <>
              <Radio className="w-3.5 h-3.5 text-textSecondary" />
              <span>Recording Paused</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

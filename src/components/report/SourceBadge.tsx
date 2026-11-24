import React, { useState } from "react";
import { Mic, FileText, Sparkles, HelpCircle } from "lucide-react";

export type MetricSourceType = "acoustic" | "audio" | "text" | "llm" | "ai";

interface SourceBadgeProps {
  source: MetricSourceType | string;
  size?: "sm" | "md";
  className?: string;
  customLabel?: string;
}

const SOURCE_CONFIG: Record<
  string,
  {
    label: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    explanation: string;
  }
> = {
  acoustic: {
    label: "Measured (audio)",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
    icon: Mic,
    explanation:
      "Calculated deterministically from microphone audio bytes using 16 kHz DSP (FFT, autocorrelation/pyin pitch tracking, and RMS energy). Never evaluated by an AI model.",
  },
  audio: {
    label: "Measured (audio)",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100",
    icon: Mic,
    explanation:
      "Calculated deterministically from microphone audio bytes using 16 kHz DSP (FFT, autocorrelation/pyin pitch tracking, and RMS energy). Never evaluated by an AI model.",
  },
  text: {
    label: "Measured (text)",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
    icon: FileText,
    explanation:
      "Calculated deterministically from transcript text using regex word boundary matching and stopword-filtered NLP rules (e.g. word count, filler count). Never evaluated by an AI model.",
  },
  llm: {
    label: "AI-assessed (LLM)",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100",
    icon: Sparkles,
    explanation:
      "Assessed by a local LLM (Ollama) with low temperature (0.2) against a fixed 5-dimension rubric. Every quote in feedback is verified against candidate transcript.",
  },
  ai: {
    label: "AI-assessed (LLM)",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100",
    icon: Sparkles,
    explanation:
      "Assessed by a local LLM (Ollama) with low temperature (0.2) against a fixed 5-dimension rubric. Every quote in feedback is verified against candidate transcript.",
  },
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  size = "sm",
  className = "",
  customLabel,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const normalizedKey = (source || "text").toLowerCase().replace(/[\s\(\)-]+/g, "");
  
  let config = SOURCE_CONFIG[normalizedKey];
  if (!config) {
    if (normalizedKey.includes("audio") || normalizedKey.includes("acoustic")) {
      config = SOURCE_CONFIG.acoustic;
    } else if (normalizedKey.includes("text")) {
      config = SOURCE_CONFIG.text;
    } else {
      config = SOURCE_CONFIG.llm;
    }
  }

  const Icon = config.icon;
  const isSm = size === "sm";

  return (
    <div
      className={`relative inline-flex items-center group ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip(!showTooltip);
      }}
    >
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full border transition-all cursor-help ${
          config.badgeClass
        } ${isSm ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}
      >
        <Icon className={isSm ? "w-2.5 h-2.5" : "w-3 h-3"} />
        <span>{customLabel || config.label}</span>
        <HelpCircle className={isSm ? "w-2.5 h-2.5 opacity-60" : "w-3 h-3 opacity-60"} />
      </span>

      {/* Tooltip explaining calculation */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-xl border border-gray-700 z-50 animate-fadeIn pointer-events-none leading-relaxed"
        >
          <div className="font-bold text-[10px] text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Icon className="w-3 h-3 text-indigo-400" />
            <span>How this is calculated</span>
          </div>
          <p className="text-gray-200">{config.explanation}</p>
          <div className="w-2 h-2 bg-gray-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2 border-r border-b border-gray-700" />
        </div>
      )}
    </div>
  );
};

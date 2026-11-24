import React, { useMemo } from "react";

interface TranscriptViewerProps {
  transcript: string;
  longestPauseS?: number;
  longPauseCount?: number;
  className?: string;
}

const FILLER_REGEX = /\b(um|uh|like|basically|actually|literally|sorta|kinda|you know|i mean|right|so yeah)\b/gi;

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  longestPauseS,
  longPauseCount,
  className = "",
}) => {
  if (!transcript || !transcript.trim()) {
    return (
      <div className="p-3 bg-gray-50 border border-border/60 rounded-lg text-xs italic text-textMuted">
        No candidate transcript captured for this question.
      </div>
    );
  }

  // Tokenize and highlight filler words inline
  const highlightedElements = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex index
    FILLER_REGEX.lastIndex = 0;

    let key = 0;
    while ((match = FILLER_REGEX.exec(transcript)) !== null) {
      const matchStart = match.index;
      const matchEnd = FILLER_REGEX.lastIndex;

      // Plain text before filler
      if (matchStart > lastIndex) {
        parts.push(
          <span key={`text-${key++}`}>
            {transcript.substring(lastIndex, matchStart)}
          </span>
        );
      }

      // Highlighted filler badge
      parts.push(
        <span
          key={`filler-${key++}`}
          className="inline-block bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-1.5 py-0.2 mx-0.5 rounded text-[11px] shadow-2xs"
          title="Measured (text) filler word"
        >
          {match[0]}
        </span>
      );

      lastIndex = matchEnd;
    }

    // Trailing text
    if (lastIndex < transcript.length) {
      parts.push(
        <span key={`text-${key++}`}>
          {transcript.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [transcript]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="p-3.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs sm:text-sm text-textPrimary leading-relaxed">
        {highlightedElements}

        {/* Inline Long Pause Indicator */}
        {longestPauseS != null && longestPauseS > 1.2 && (
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold mx-1.5 shadow-2xs">
            ⏱️ [Pause {longestPauseS}s]
          </span>
        )}
      </div>

      {/* Legend & Stats */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-textMuted px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-amber-200 border border-amber-400 rounded-xs" />
          <span>Highlighted Filler Words (Measured: Text)</span>
        </div>
        {longestPauseS != null && longestPauseS > 1.2 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-200 border border-sky-400 rounded-xs" />
            <span>
              Longest Pause: {longestPauseS}s ({longPauseCount || 1} &gt; 1.2s pause{longPauseCount && longPauseCount > 1 ? "s" : ""})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

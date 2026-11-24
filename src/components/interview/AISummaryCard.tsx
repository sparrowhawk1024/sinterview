import React from "react";
import { Sparkles, RefreshCw } from "lucide-react";

interface AISummaryCardProps {
  summary: string;
  onRegenerate?: () => void;
  isLoading?: boolean;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  summary,
  onRegenerate,
  isLoading = false,
}) => {
  return (
    <div className="bg-primaryLight rounded-summaryCard p-4 border border-indigo-100/60 shadow-xs transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-indigo-800 tracking-tight">
            AI Summary of Meeting
          </h4>
        </div>

        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-white/60 transition-colors"
            title="Generate summary using live model"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Generating..." : "Regenerate"}</span>
          </button>
        )}
      </div>

      {/* Summary Body Text */}
      <p className="text-xs text-textSecondary leading-relaxed mt-2 font-normal">
        {summary}
      </p>
    </div>
  );
};

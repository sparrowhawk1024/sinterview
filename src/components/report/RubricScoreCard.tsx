import React from "react";
import { ModelEvaluationResult, RubricDimensionScore } from "../../types";
import { SourceBadge } from "./SourceBadge";
import { Sparkles, Quote, AlertCircle, CheckCircle, ArrowUpRight } from "lucide-react";

interface RubricScoreCardProps {
  evaluation?: ModelEvaluationResult;
  className?: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  relevance: "Relevance",
  technical_depth: "Technical Depth",
  structure: "Structure (STAR)",
  clarity: "Clarity & Cadence",
  examples_metrics: "Examples & Production Metrics",
};

export const RubricScoreCard: React.FC<RubricScoreCardProps> = ({
  evaluation,
  className = "",
}) => {
  if (!evaluation) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-textMuted flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
        <span>No evaluation data available for this question.</span>
      </div>
    );
  }

  // Handle offline / unavailable evaluation (never fake scores!)
  if (evaluation.evaluation_unavailable || !evaluation.rubric) {
    return (
      <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>AI Rubric Evaluation Unavailable</span>
          </div>
          <SourceBadge source="llm" />
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          {evaluation.model_summary ||
            "Local Ollama evaluation service was unreachable. Synterview strictly never invents fake scores. All measured acoustic and text metrics remain 100% active."}
        </p>
      </div>
    );
  }

  const rubric = evaluation.rubric;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with overall score and source badge */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-textPrimary">
            Rubric Evaluation ({evaluation.overall_score != null ? `${evaluation.overall_score}/5.0` : evaluation.grade})
          </span>
        </div>
        <SourceBadge source="llm" />
      </div>

      {/* 5-Dimension Rubric Breakdown */}
      <div className="space-y-2.5">
        {Object.entries(rubric).map(([dimKey, dimData]: [string, RubricDimensionScore]) => {
          const score = dimData.score;
          const label = DIMENSION_LABELS[dimKey] || dimKey.replace(/_/g, " ");
          const percentage = Math.round((score / 5.0) * 100);

          return (
            <div key={dimKey} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-textPrimary">{label}</span>
                <span className="font-bold text-indigo-700">{score.toFixed(1)} / 5</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${percentage}%` }}
                  className={`h-full rounded-full transition-all ${
                    score >= 4.0
                      ? "bg-emerald-500"
                      : score >= 3.0
                      ? "bg-indigo-500"
                      : "bg-amber-400"
                  }`}
                />
              </div>

              {/* One-line justification */}
              <p className="text-[11px] text-textSecondary italic">
                {dimData.justification}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quoted Strengths & Improvements */}
      {((evaluation.quoted_strengths && evaluation.quoted_strengths.length > 0) ||
        (evaluation.quoted_improvements && evaluation.quoted_improvements.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Strengths */}
          {evaluation.quoted_strengths && evaluation.quoted_strengths.length > 0 && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg space-y-2">
              <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>Strengths</span>
              </span>
              <div className="space-y-1.5">
                {evaluation.quoted_strengths.map((item, idx) => (
                  <div key={`str-${idx}`} className="text-[11px] text-emerald-950 space-y-0.5">
                    <p className="leading-snug">{item.feedback}</p>
                    {item.has_quote && item.quote && (
                      <div className="flex items-start gap-1 text-[10px] text-emerald-800 bg-white/70 p-1 rounded border border-emerald-200">
                        <Quote className="w-2.5 h-2.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="italic font-medium">"{item.quote}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {evaluation.quoted_improvements && evaluation.quoted_improvements.length > 0 && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg space-y-2">
              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-indigo-600" />
                <span>Areas for Growth</span>
              </span>
              <div className="space-y-1.5">
                {evaluation.quoted_improvements.map((item, idx) => (
                  <div key={`imp-${idx}`} className="text-[11px] text-indigo-950 space-y-0.5">
                    <p className="leading-snug">{item.feedback}</p>
                    {item.has_quote && item.quote && (
                      <div className="flex items-start gap-1 text-[10px] text-indigo-800 bg-white/70 p-1 rounded border border-indigo-200">
                        <Quote className="w-2.5 h-2.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span className="italic font-medium">"{item.quote}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verified Evidence Claims & Clickable Audio Jumps */}
      {evaluation.verified_claims && evaluation.verified_claims.length > 0 && (
        <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                Verified Evidence
              </span>
              <span>Ground-Truth Claims</span>
            </span>
            {evaluation.unsupported_claim_rate != null && (
              <span className="text-[10px] text-slate-500 font-mono">
                {Math.round((1 - evaluation.unsupported_claim_rate) * 100)}% verified
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {evaluation.verified_claims.map((claim, idx) => (
              <div
                key={`claim-${idx}`}
                className="text-[11px] text-slate-900 flex items-start justify-between gap-2 p-2 bg-white rounded border border-slate-200/80 shadow-xs"
              >
                <div className="space-y-0.5">
                  <p className="leading-snug text-slate-800">{claim.claim}</p>
                  {claim.quoted_text && (
                    <span className="italic text-[10px] text-slate-600 font-medium">
                      "{claim.quoted_text}"
                    </span>
                  )}
                  {claim.verification_reason && (
                    <p className="text-[9px] text-slate-400">{claim.verification_reason}</p>
                  )}
                </div>
                {claim.start_time_s != null && (
                  <button
                    type="button"
                    title={`Jump to audio at ${claim.start_time_s.toFixed(1)}s`}
                    onClick={() => {
                      const aud = document.querySelector("audio") as HTMLAudioElement | null;
                      if (aud && claim.start_time_s != null) {
                        aud.currentTime = claim.start_time_s;
                        aud.play().catch(() => {});
                      }
                    }}
                    className="shrink-0 px-2 py-0.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    ▶ {claim.start_time_s.toFixed(1)}s
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Concept Targeted During Session */}
      {evaluation.target_concept && (
        <div className="flex items-center gap-2 p-2 bg-amber-50/70 border border-amber-200/70 rounded-lg text-[11px] text-amber-900">
          <span className="font-semibold text-amber-950">Target Concept:</span>
          <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200">
            {evaluation.target_concept}
          </span>
          {evaluation.target_concept_reason && (
            <span className="text-[10px] text-amber-700 italic truncate">
              ({evaluation.target_concept_reason})
            </span>
          )}
        </div>
      )}

      {/* Multimodal Late Fusion (Eq. 7) */}
      {evaluation.late_fusion && (
        <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
              <span>Multimodal Late Fusion (Eq. 7)</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-purple-900">
              {evaluation.late_fusion.fused_score != null
                ? `${evaluation.late_fusion.fused_score.toFixed(2)} / 5.0`
                : "Insufficient Quality"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-purple-900">
            <div className="p-1.5 bg-white/80 rounded border border-purple-200 text-center">
              <span className="text-[9px] text-purple-600 block uppercase font-medium">Speech</span>
              <span className="font-bold">{evaluation.late_fusion.sub_scores.speech ?? "—"}</span>
              <span className="block text-[8px] text-purple-400">q: {evaluation.late_fusion.quality_indicators.speech}</span>
            </div>
            <div className="p-1.5 bg-white/80 rounded border border-purple-200 text-center">
              <span className="text-[9px] text-purple-600 block uppercase font-medium">Language</span>
              <span className="font-bold">{evaluation.late_fusion.sub_scores.language ?? "—"}</span>
              <span className="block text-[8px] text-purple-400">q: {evaluation.late_fusion.quality_indicators.language}</span>
            </div>
            <div className="p-1.5 bg-white/80 rounded border border-purple-200 text-center">
              <span className="text-[9px] text-purple-600 block uppercase font-medium">Visual</span>
              <span className="font-bold">{evaluation.late_fusion.sub_scores.visual ?? "—"}</span>
              <span className="block text-[8px] text-purple-400">q: {evaluation.late_fusion.quality_indicators.visual}</span>
            </div>
          </div>
          <p className="text-[9px] text-purple-700 italic">{evaluation.late_fusion.explanation}</p>
        </div>
      )}
    </div>
  );
};

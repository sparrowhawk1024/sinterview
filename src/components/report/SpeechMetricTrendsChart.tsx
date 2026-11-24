import React from "react";
import { InterviewQuestion } from "../../types";
import { SourceBadge } from "./SourceBadge";
import { Mic, Activity, Clock, MessageSquare } from "lucide-react";

interface SpeechMetricTrendsChartProps {
  questions: InterviewQuestion[];
}

export const SpeechMetricTrendsChart: React.FC<SpeechMetricTrendsChartProps> = ({
  questions,
}) => {
  const answeredQuestions = questions.filter(
    (q) => q.status === "answered" && (q.candidateAnswer || q.aiEvaluation)
  );

  if (answeredQuestions.length === 0) {
    return (
      <div className="p-6 rounded-card bg-gray-50 border border-border text-center text-xs text-textSecondary">
        No answered questions available to plot speech metrics.
      </div>
    );
  }

  // Data series across questions
  const labels = answeredQuestions.map((q) => `Q${q.number}`);
  const wpmData = answeredQuestions.map((q) => {
    const tone = q.aiEvaluation?.tone_analysis;
    return tone?.speech_rate_wpm ?? tone?.pace_wpm ?? null;
  });
  const pauseRatioData = answeredQuestions.map((q) => {
    const tone = q.aiEvaluation?.tone_analysis;
    return tone?.pause_ratio != null ? Math.round(tone.pause_ratio * 100) : null;
  });
  const pitchStdData = answeredQuestions.map((q) => {
    const tone = q.aiEvaluation?.tone_analysis;
    return tone?.pitch_std_semitones != null ? tone.pitch_std_semitones : null;
  });
  const fillerData = answeredQuestions.map((q) => {
    const tone = q.aiEvaluation?.tone_analysis;
    return tone?.filler_word_count ?? 0;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Speech Rate (WPM) across questions */}
        <div className="bg-white p-4 rounded-card border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-textPrimary">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Speech Rate Across Questions</span>
              </div>
              <SourceBadge source="acoustic" />
            </div>
            <p className="text-[11px] text-textSecondary mb-3">
              Target conversational pace: <span className="font-semibold text-emerald-600">120 - 160 WPM</span>.
            </p>
          </div>

          {/* Simple Clean Responsive Line / Bar representation */}
          <div className="h-32 w-full flex items-end gap-3 pt-4 border-b border-gray-100">
            {wpmData.map((wpm, i) => {
              const maxScale = 220;
              const heightPercent = wpm ? Math.min(100, Math.round((wpm / maxScale) * 100)) : 0;
              const inOptimalRange = wpm ? wpm >= 120 && wpm <= 160 : false;

              return (
                <div key={`wpm-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {wpm !== null ? (
                    <>
                      <span className="text-[10px] font-bold text-textPrimary opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                        {Math.round(wpm)} WPM
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[28px] rounded-t-md transition-all ${
                          inOptimalRange
                            ? "bg-emerald-500 hover:bg-emerald-600"
                            : "bg-indigo-400 hover:bg-indigo-500"
                        }`}
                      />
                    </>
                  ) : (
                    <div className="h-4 w-full max-w-[28px] bg-gray-200 rounded text-[9px] text-gray-500 flex items-center justify-center">
                      N/A
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-textSecondary mt-1">
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-textMuted mt-2">
            <span>Optimal range: 120-160 WPM</span>
            <span>Calculated over voiced time</span>
          </div>
        </div>

        {/* 2. Pause Ratio (% silence) across questions */}
        <div className="bg-white p-4 rounded-card border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-textPrimary">
                <Clock className="w-3.5 h-3.5 text-cyan-600" />
                <span>Pause Ratio Across Questions</span>
              </div>
              <SourceBadge source="acoustic" />
            </div>
            <p className="text-[11px] text-textSecondary mb-3">
              Percentage of duration spent in breathing and thinking silence. Ideal: 10% - 25%.
            </p>
          </div>

          <div className="h-32 w-full flex items-end gap-3 pt-4 border-b border-gray-100">
            {pauseRatioData.map((pr, i) => {
              const maxScale = 50; // 50%
              const heightPercent = pr !== null ? Math.min(100, Math.round((pr / maxScale) * 100)) : 0;
              const isHigh = pr !== null && pr > 30;

              return (
                <div key={`pause-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {pr !== null ? (
                    <>
                      <span className="text-[10px] font-bold text-textPrimary opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                        {pr}%
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[28px] rounded-t-md transition-all ${
                          isHigh ? "bg-amber-400 hover:bg-amber-500" : "bg-cyan-500 hover:bg-cyan-600"
                        }`}
                      />
                    </>
                  ) : (
                    <div className="h-4 w-full max-w-[28px] bg-gray-200 rounded text-[9px] text-gray-500 flex items-center justify-center">
                      N/A
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-textSecondary mt-1">
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-textMuted mt-2">
            <span>Ideal: 10% - 25%</span>
            <span>Silent segments &gt; 120ms</span>
          </div>
        </div>

        {/* 3. Pitch Variation (semitones std) across questions */}
        <div className="bg-white p-4 rounded-card border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-textPrimary">
                <Mic className="w-3.5 h-3.5 text-purple-600" />
                <span>Pitch Variation (Semitones)</span>
              </div>
              <SourceBadge source="acoustic" />
            </div>
            <p className="text-[11px] text-textSecondary mb-3">
              Standard deviation in semitones relative to candidate's own median pitch (neutral to voice pitch).
            </p>
          </div>

          <div className="h-32 w-full flex items-end gap-3 pt-4 border-b border-gray-100">
            {pitchStdData.map((pStd, i) => {
              const maxScale = 5.0; // 5 semitones
              const heightPercent = pStd !== null ? Math.min(100, Math.round((pStd / maxScale) * 100)) : 0;
              const isMonotone = pStd !== null && pStd < 1.0;

              return (
                <div key={`pitch-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {pStd !== null ? (
                    <>
                      <span className="text-[10px] font-bold text-textPrimary opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                        ±{pStd} st
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[28px] rounded-t-md transition-all ${
                          isMonotone ? "bg-amber-400 hover:bg-amber-500" : "bg-purple-500 hover:bg-purple-600"
                        }`}
                      />
                    </>
                  ) : (
                    <div className="h-4 w-full max-w-[28px] bg-gray-200 rounded text-[9px] text-gray-500 flex items-center justify-center">
                      N/A
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-textSecondary mt-1">
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-textMuted mt-2">
            <span>Dynamic: &gt; 1.8 st • Monotone: &lt; 1.0 st</span>
            <span>Gender-neutral semitones</span>
          </div>
        </div>

        {/* 4. Filler Count across questions */}
        <div className="bg-white p-4 rounded-card border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-textPrimary">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Filler Word Count</span>
              </div>
              <SourceBadge source="text" />
            </div>
            <p className="text-[11px] text-textSecondary mb-3">
              Occurrences of filler words (um, uh, like, basically, you know, etc.).
            </p>
          </div>

          <div className="h-32 w-full flex items-end gap-3 pt-4 border-b border-gray-100">
            {fillerData.map((count, i) => {
              const maxScale = 10;
              const heightPercent = Math.min(100, Math.round((count / maxScale) * 100));
              const isHigh = count > 3;

              return (
                <div key={`filler-${i}`} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <span className="text-[10px] font-bold text-textPrimary opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                    {count}
                  </span>
                  <div
                    style={{ height: `${Math.max(8, heightPercent)}%` }}
                    className={`w-full max-w-[28px] rounded-t-md transition-all ${
                      count === 0
                        ? "bg-emerald-400 hover:bg-emerald-500"
                        : isHigh
                        ? "bg-amber-400 hover:bg-amber-500"
                        : "bg-indigo-300 hover:bg-indigo-400"
                    }`}
                  />
                  <span className="text-[10px] font-semibold text-textSecondary mt-1">
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-textMuted mt-2">
            <span>Target: &le; 1 per question</span>
            <span>Deterministic NLP regex</span>
          </div>
        </div>
      </div>
    </div>
  );
};

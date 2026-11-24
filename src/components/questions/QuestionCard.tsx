import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Activity,
  Award,
  Volume2,
  Square,
  AudioLines,
  ListChecks,
} from "lucide-react";
import { InterviewQuestion } from "../../types";
import {
  askQuestionWithCosyVoice,
  stopCosyVoiceSpeaking,
  addSpeakingListener,
} from "../../services/cosyVoiceService";

interface QuestionCardProps {
  question: InterviewQuestion;
  onSelect: (id: string) => void;
  onEvaluate?: (id: string, customAnswer?: string) => void;
  isEvaluating?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onSelect,
  onEvaluate,
  isEvaluating = false,
}) => {
  const isAnswered = question.status === "answered";
  const [customText, setCustomText] = useState("");
  const [isSpeakingThis, setIsSpeakingThis] = useState(false);

  useEffect(() => {
    const unsubscribe = addSpeakingListener((speaking, qId) => {
      setIsSpeakingThis(speaking && qId === question.id);
    });
    return unsubscribe;
  }, [question.id]);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpeakingThis) {
      stopCosyVoiceSpeaking();
    } else {
      askQuestionWithCosyVoice(question.text, question.id);
    }
  };

  const handleEvaluate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEvaluate) {
      onEvaluate(question.id, customText || question.candidateAnswer);
    }
  };

  return (
    <div
      onClick={() => onSelect(question.id)}
      className={`rounded-[14px] border p-4 mb-3 cursor-pointer transition-all duration-200 select-none relative ${
        question.isSelected
          ? "border-indigo-300 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-200"
          : "border-border bg-white hover:border-indigo-200 hover:bg-gray-50/60"
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between">
        {/* Number Badge & Category */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-badge bg-primaryLight text-primary text-xs font-bold flex items-center justify-center shadow-xs">
            {question.number}
          </div>
          {question.isFollowUp && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
              Follow-up
            </span>
          )}
          {question.category && (
            <span className="text-[10px] font-semibold text-textSecondary bg-gray-100 px-2 py-0.5 rounded-md truncate max-w-[150px]">
              {question.category}
            </span>
          )}
          {question.difficulty && (
            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {question.difficulty}
            </span>
          )}
        </div>

        {/* Status Indicator & CosyVoice 2 Audio Button */}
        <div className="flex items-center gap-2">
          {/* CosyVoice 2 Speech Trigger */}
          <button
            type="button"
            onClick={handleSpeak}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shadow-xs ${
              isSpeakingThis
                ? "bg-danger text-white animate-pulse"
                : "bg-indigo-50 text-primary hover:bg-primary hover:text-white border border-indigo-100"
            }`}
            title={isSpeakingThis ? "Stop speech" : "Ask question out loud with CosyVoice 2"}
          >
            {isSpeakingThis ? (
              <>
                <Square className="w-3 h-3 fill-white" />
                <span>Speaking...</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>CosyVoice 2</span>
              </>
            )}
          </button>

          {question.aiEvaluation && (
            question.aiEvaluation.evaluation_unavailable ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>AI Unavailable</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>
                  {question.aiEvaluation.overall_score != null
                    ? `${question.aiEvaluation.overall_score.toFixed(1)}/5 (${question.aiEvaluation.grade})`
                    : question.aiEvaluation.score != null
                    ? `${question.aiEvaluation.score}/10 (${question.aiEvaluation.grade})`
                    : question.aiEvaluation.grade}
                </span>
              </span>
            )
          )}

          {isAnswered ? (
            <div className="flex items-center gap-1 text-success" title="Answered">
              <CheckCircle2 className="w-5 h-5 fill-emerald-100 text-success" />
            </div>
          ) : (
            <div className="flex items-center gap-1 text-textMuted/70" title="Pending response">
              <Clock className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Speaking Active Banner */}
      {isSpeakingThis && (
        <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AudioLines className="w-4 h-4 animate-bounce" />
            <span>Interviewer is asking this question via CosyVoice 2</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-1.5 py-0.5 rounded">
            Live TTS
          </span>
        </div>
      )}

      {/* Question Text */}
      <h4 className="text-sm font-semibold text-textPrimary mt-2.5 leading-snug">
        {question.text}
      </h4>

      {/* Ideal Answer Points (from Ollama) */}
      {question.idealAnswerPoints && question.idealAnswerPoints.length > 0 && question.isSelected && (
        <div className="mt-2.5 p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100/80">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 mb-1">
            <ListChecks className="w-3.5 h-3.5 text-primary" />
            <span>Ollama Target Competencies / Evaluation Rubric:</span>
          </div>
          <ul className="space-y-0.5 text-[11px] text-textSecondary">
            {question.idealAnswerPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-primary font-bold">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Answer Preview */}
      {question.candidateAnswer && (
        <div className="mt-2 text-xs text-textSecondary leading-relaxed bg-black/[0.02] p-2.5 rounded-md border border-black/[0.04]">
          <span className="font-semibold text-textPrimary/80 block mb-0.5 text-[11px]">
            Candidate Response:
          </span>
          <p className="line-clamp-2">{question.candidateAnswer}</p>
        </div>
      )}

      {/* Expanded Interactive AI Model Evaluation Panel (When Question is Selected) */}
      {question.isSelected && (
        <div className="mt-3 pt-3 border-t border-indigo-100/80 animate-fadeIn">
          {question.aiEvaluation ? (
            <div className="bg-white rounded-lg p-3 border border-indigo-100 shadow-xs space-y-2">
              {/* Analysis Label & Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Award className="w-4 h-4 text-primary" />
                  <span>Technical & Delivery Assessment</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      question.aiEvaluation.tone_analysis.analysis_label === "Text-only analysis"
                        ? "bg-gray-100 text-gray-700 border-gray-300"
                        : "bg-cyan-50 text-cyan-800 border-cyan-300"
                    }`}
                  >
                    {question.aiEvaluation.tone_analysis.analysis_label || "Acoustic + text analysis"}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Score: {question.aiEvaluation.score} / 10 ({question.aiEvaluation.grade})
                  </span>
                </div>
              </div>

              {/* Reliability Warning if Audio Quality was Low */}
              {question.aiEvaluation.tone_analysis.reliability === "low" &&
                question.aiEvaluation.tone_analysis.reliability_reasons &&
                question.aiEvaluation.tone_analysis.reliability_reasons.length > 0 && (
                  <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded p-1.5 flex items-start gap-1">
                    <span className="font-bold">Notice:</span>
                    <span>
                      Reliability marked low ({question.aiEvaluation.tone_analysis.reliability_reasons.join(", ")}).
                    </span>
                  </div>
                )}

              {/* Objective Delivery & Clarity Scores */}
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="bg-indigo-50/60 p-2 rounded border border-indigo-100">
                  <span className="text-[10px] font-semibold text-indigo-900 block">Delivery Score</span>
                  <span className="text-sm font-bold text-indigo-700">
                    {Math.round(
                      (question.aiEvaluation.tone_analysis.delivery_score ??
                        question.aiEvaluation.tone_analysis.confidence_score) * 100
                    )}
                    %
                  </span>
                  <span className="text-[9px] text-textMuted block">Pacing, pauses, vocal variation</span>
                </div>
                <div className="bg-emerald-50/60 p-2 rounded border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-900 block">Clarity Score</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {Math.round(question.aiEvaluation.tone_analysis.clarity_score * 100)}%
                  </span>
                  <span className="text-[9px] text-textMuted block">Articulation & filler density</span>
                </div>
              </div>

              {/* Acoustic & Text Metrics with Source Badges */}
              <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                  <div className="flex items-center justify-between text-[9px] text-textMuted">
                    <span>Pace</span>
                    <span className="text-[8px] uppercase font-bold text-indigo-500">
                      {question.aiEvaluation.tone_analysis.sources?.speech_rate_wpm || "text"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-textPrimary">
                    {question.aiEvaluation.tone_analysis.speech_rate_wpm ?? question.aiEvaluation.tone_analysis.pace_wpm} WPM
                  </span>
                </div>

                <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                  <div className="flex items-center justify-between text-[9px] text-textMuted">
                    <span>Pauses</span>
                    <span className="text-[8px] uppercase font-bold text-cyan-600">
                      {question.aiEvaluation.tone_analysis.sources?.pause_ratio || "acoustic"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-textPrimary">
                    {question.aiEvaluation.tone_analysis.pause_ratio != null
                      ? `${Math.round(question.aiEvaluation.tone_analysis.pause_ratio * 100)}%`
                      : "N/A"}
                  </span>
                </div>

                <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                  <div className="flex items-center justify-between text-[9px] text-textMuted">
                    <span>Pitch Std</span>
                    <span className="text-[8px] uppercase font-bold text-cyan-600">
                      {question.aiEvaluation.tone_analysis.sources?.pitch_std_semitones || "acoustic"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-textPrimary">
                    {question.aiEvaluation.tone_analysis.pitch_std_semitones != null
                      ? `±${question.aiEvaluation.tone_analysis.pitch_std_semitones} st`
                      : "N/A"}
                  </span>
                  {question.aiEvaluation.tone_analysis.pitch_method === "numpy_autocorrelation" && (
                    <span
                      className="text-[8px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded block mt-0.5"
                      title="Pitch tracked using pure numpy autocorrelation fallback"
                    >
                      Autocorr Fallback
                    </span>
                  )}
                </div>

                <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                  <div className="flex items-center justify-between text-[9px] text-textMuted">
                    <span>Fillers</span>
                    <span className="text-[8px] uppercase font-bold text-indigo-500">
                      {question.aiEvaluation.tone_analysis.sources?.filler_words || "text"}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-textPrimary">
                    {question.aiEvaluation.tone_analysis.filler_word_count}
                  </span>
                </div>
              </div>

              {/* Explainable Rule Contributions */}
              {((question.aiEvaluation.tone_analysis.delivery_reasons &&
                question.aiEvaluation.tone_analysis.delivery_reasons.length > 0) ||
                (question.aiEvaluation.tone_analysis.clarity_reasons &&
                  question.aiEvaluation.tone_analysis.clarity_reasons.length > 0)) && (
                <div className="pt-1 text-[11px] text-textSecondary space-y-0.5 bg-gray-50/70 p-2 rounded border border-gray-100">
                  <span className="text-[10px] font-bold text-textPrimary block mb-1">
                    Rule Contributions:
                  </span>
                  {question.aiEvaluation.tone_analysis.delivery_reasons?.map((reason, idx) => (
                    <div key={`del-${idx}`} className="flex items-start gap-1">
                      <span className="text-primary font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                  {question.aiEvaluation.tone_analysis.clarity_reasons?.map((reason, idx) => (
                    <div key={`cla-${idx}`} className="flex items-start gap-1">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional Rate Your Own Delivery (1-5 skippable) */}
              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <span className="text-[10px] text-textSecondary font-medium">Rate your delivery:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Send rating to feedback endpoint
                        fetch("http://localhost:8000/analyze-tone-audio", {
                          method: "POST",
                          headers: { "Content-Type": "application/x-www-form-urlencoded" },
                          body: new URLSearchParams({
                            question_id: question.id,
                            transcript: question.candidateAnswer || "",
                            self_rating: String(star),
                          }),
                        }).catch(() => {});
                      }}
                      className="w-5 h-5 rounded text-[10px] font-bold bg-gray-100 hover:bg-amber-100 hover:text-amber-800 text-gray-600 transition-colors"
                      title={`Rate ${star}/5`}
                    >
                      {star}
                    </button>
                  ))}
                </div>
              </div>

              {/* Re-evaluate trigger */}
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="w-full mt-2 py-1.5 px-3 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Re-run AI Evaluation</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {!question.candidateAnswer && (
                <textarea
                  placeholder="Type candidate answer to analyze..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  rows={2}
                  className="w-full text-xs p-2 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                />
              )}

              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="w-full py-2 px-3 rounded-lg bg-primary hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
              >
                {isEvaluating ? (
                  <>
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing with AI Model...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run AI Evaluation & Tone Analysis</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

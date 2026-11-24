import React, { useState } from "react";
import { InterviewQuestion, TimelineEvent, OllamaStatus } from "../../types";
import { QuestionTabs, QuestionTabType } from "./QuestionTabs";
import { QuestionCard } from "./QuestionCard";
import { TimelineView } from "./TimelineView";
import { OllamaQuestionModal } from "./OllamaQuestionModal";
import { Sparkles, Video, BrainCircuit, PlusCircle } from "lucide-react";

interface QuestionPanelProps {
  questions: InterviewQuestion[];
  timeline: TimelineEvent[];
  onSelectQuestion: (id: string) => void;
  onMarkAnswered?: (id: string) => void;
  onEvaluateQuestion?: (id: string, customAnswer?: string) => void;
  onAddQuestions?: (newQuestions: InterviewQuestion[]) => void;
  isEvaluating?: boolean;
  ollamaStatus?: OllamaStatus;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  questions,
  timeline,
  onSelectQuestion,
  onMarkAnswered,
  onEvaluateQuestion,
  onAddQuestions,
  isEvaluating = false,
  ollamaStatus = { online: true, models: ["qwen2.5-coder:7b"], defaultModel: "qwen2.5-coder:7b" },
}) => {
  const [activeTab, setActiveTab] = useState<QuestionTabType>("questions");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter highlights
  const highlights = timeline.filter((t) => t.type === "highlight");

  return (
    <div className="bg-surface rounded-card border border-border shadow-panel flex flex-col h-full p-4 sm:p-5">
      {/* Tab Navigation */}
      <QuestionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        questionCount={questions.length}
      />

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === "questions" && (
          <div className="space-y-2">
            {/* Generate Questions on Topic with Ollama Banner Button */}
            <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-white border border-indigo-100 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary text-white shadow-xs">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-textPrimary block">
                    Generate Questions on Topic
                  </span>
                  <span className="text-[11px] text-textSecondary block">
                    Ollama ({ollamaStatus.models[0] || "qwen2.5-coder:7b"})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Topic</span>
              </button>
            </div>

            {/* Questions List */}
            {questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onSelect={onSelectQuestion}
                onEvaluate={onEvaluateQuestion}
                isEvaluating={isEvaluating && question.isSelected}
              />
            ))}
          </div>
        )}

        {activeTab === "timeline" && (
          <TimelineView timeline={timeline} />
        )}

        {activeTab === "highlights" && (
          <div className="py-2 space-y-3">
            {highlights.length > 0 ? (
              highlights.map((h) => (
                <div
                  key={h.id}
                  className="rounded-[12px] border border-amber-200 bg-amber-50/50 p-3.5 flex items-start gap-3 transition-transform hover:scale-[1.01]"
                >
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-amber-800 font-semibold">
                        {h.timestamp}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">
                        Clip
                      </span>
                    </div>
                    <p className="text-xs text-textPrimary font-medium mt-1">
                      {h.label}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-textSecondary text-xs">
                <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                No highlight clips captured yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ollama Question Modal */}
      {onAddQuestions && (
        <OllamaQuestionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddQuestions={onAddQuestions}
          ollamaStatus={ollamaStatus}
        />
      )}
    </div>
  );
};

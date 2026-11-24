import React from "react";

export type QuestionTabType = "questions" | "timeline" | "highlights";

interface QuestionTabsProps {
  activeTab: QuestionTabType;
  onTabChange: (tab: QuestionTabType) => void;
  questionCount?: number;
}

export const QuestionTabs: React.FC<QuestionTabsProps> = ({
  activeTab,
  onTabChange,
  questionCount,
}) => {
  const tabs: { id: QuestionTabType; label: string; count?: number }[] = [
    { id: "questions", label: "Question List", count: questionCount },
    { id: "timeline", label: "Timeline" },
    { id: "highlights", label: "Highlight Clips" },
  ];

  return (
    <div className="flex items-center gap-6 border-b border-border mb-4 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`pb-2.5 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
              isActive
                ? "text-primary border-b-2 border-primary"
                : "text-textSecondary hover:text-textPrimary border-b-2 border-transparent font-medium"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-primaryLight text-primary font-bold"
                    : "bg-gray-100 text-textSecondary"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

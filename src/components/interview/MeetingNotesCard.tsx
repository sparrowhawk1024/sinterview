import React from "react";
import { Calendar, Tag as TagIcon, Users, MoreHorizontal } from "lucide-react";
import { MeetingNote } from "../../types";
import { Tag } from "../ui/Tag";
import { Divider } from "../ui/Divider";
import { AISummaryCard } from "./AISummaryCard";

interface MeetingNotesCardProps {
  note: MeetingNote;
  jobTitle?: string;
  onRegenerateSummary?: () => void;
  isGeneratingSummary?: boolean;
}

export const MeetingNotesCard: React.FC<MeetingNotesCardProps> = ({
  note,
  jobTitle = "Frontend Developer",
  onRegenerateSummary,
  isGeneratingSummary = false,
}) => {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card mt-4 p-4 sm:p-5 transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-textPrimary tracking-tight">
          Key Meeting Notes – {note.category}: {jobTitle}
        </h3>
        <button
          type="button"
          className="text-textSecondary hover:text-textPrimary p-1 rounded-md hover:bg-gray-100 transition-colors"
          title="More note actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-2.5">
        <Tag
          icon={<Calendar className="w-3.5 h-3.5" />}
          label={note.date}
        />
        <Tag
          icon={<TagIcon className="w-3.5 h-3.5" />}
          label={note.category}
        />
        <Tag
          icon={<Users className="w-3.5 h-3.5" />}
          label={note.participants.join(", ")}
        />
      </div>

      {/* Divider */}
      <Divider className="my-3.5" />

      {/* Embedded AI Summary Card */}
      <AISummaryCard
        summary={note.aiSummary}
        onRegenerate={onRegenerateSummary}
        isLoading={isGeneratingSummary}
      />
    </div>
  );
};

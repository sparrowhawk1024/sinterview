import React from "react";
import { MicOff } from "lucide-react";
import { Participant } from "../../types";

interface ParticipantBadgeProps {
  participant: Participant;
  className?: string;
}

export const ParticipantBadge: React.FC<ParticipantBadgeProps> = ({
  participant,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-lg backdrop-blur-md shadow-sm border border-white/10 ${className}`}
    >
      <div
        className={`w-6 h-6 rounded-full ${participant.avatarColor} text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-inner`}
      >
        {participant.initials}
      </div>
      <span className="font-medium text-xs tracking-tight truncate max-w-[140px] sm:max-w-[180px]">
        {participant.name}
      </span>
      {participant.isMuted && (
        <span className="bg-red-500/80 p-0.5 rounded text-white" title="Muted">
          <MicOff className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};

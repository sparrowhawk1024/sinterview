import React from "react";
import { TimelineEvent } from "../../types";

interface TimelineViewProps {
  timeline: TimelineEvent[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ timeline }) => {
  const getDotClass = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "question":
        return "bg-primary ring-4 ring-indigo-100";
      case "highlight":
        return "bg-amber-400 ring-4 ring-amber-100";
      case "note":
      default:
        return "bg-gray-400 ring-4 ring-gray-100";
    }
  };

  return (
    <div className="flex flex-col space-y-4 py-2 pl-1 pr-2">
      {timeline.map((event, index) => {
        const isLast = index === timeline.length - 1;

        return (
          <div key={event.id} className="flex items-start gap-3.5 relative group">
            {/* Timestamp */}
            <span className="text-xs font-mono text-textMuted w-14 shrink-0 mt-0.5 tracking-tight">
              {event.timestamp}
            </span>

            {/* Connecting Vertical Line & Bullet Dot */}
            <div className="relative flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 z-10 transition-transform group-hover:scale-125 ${getDotClass(
                  event.type
                )}`}
              />
              {!isLast && (
                <div className="w-[1.5px] bg-border absolute top-2.5 bottom-[-18px] left-1/2 -translate-x-1/2" />
              )}
            </div>

            {/* Event Description */}
            <div className="flex-1 pb-3">
              <p className="text-xs font-medium text-textPrimary leading-snug group-hover:text-primary transition-colors">
                {event.label}
              </p>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-textMuted">
                {event.type}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

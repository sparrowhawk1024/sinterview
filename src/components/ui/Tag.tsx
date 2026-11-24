import React from "react";
import clsx from "clsx";

interface TagProps {
  icon?: React.ReactNode;
  label: string;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ icon, label, className }) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 text-xs text-textSecondary font-medium",
        className
      )}
    >
      {icon && <span className="text-textSecondary/80">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};

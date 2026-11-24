import React from "react";
import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "number" | "live" | "recording" | "neutral" | "success";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  className,
}) => {
  const baseClasses = "inline-flex items-center justify-center font-semibold transition-colors";

  const variantClasses = {
    number: "w-7 h-7 rounded-badge bg-primaryLight text-primary text-xs font-bold",
    live: "bg-danger text-white text-xs px-3 py-1.5 rounded-button shadow-sm font-semibold",
    recording: "bg-gray-100 text-textSecondary text-xs px-3 py-1.5 rounded-button border border-border font-medium",
    neutral: "bg-badgeBg text-textSecondary text-xs px-2 py-1 rounded-md font-medium",
    success: "bg-green-100 text-success text-xs px-2.5 py-1 rounded-md font-medium",
  };

  return (
    <span className={clsx(baseClasses, variantClasses[variant], className)}>
      {children}
    </span>
  );
};

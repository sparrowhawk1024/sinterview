import React from "react";
import clsx from "clsx";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "glass" | "danger" | "neutral" | "active";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = "glass",
  size = "md",
  className,
  children,
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-control transition-all duration-150 active:scale-95 shadow-sm";

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const variantClasses = {
    glass: "bg-white/20 text-white backdrop-blur-sm hover:bg-white/30",
    danger: "bg-danger text-white hover:bg-red-600 shadow-md",
    neutral: "bg-gray-100 text-textSecondary hover:bg-gray-200 hover:text-textPrimary",
    active: "bg-danger text-white hover:bg-red-600 ring-2 ring-danger/40",
  };

  return (
    <button
      type="button"
      className={clsx(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

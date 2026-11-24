import React from "react";
import clsx from "clsx";

interface DividerProps {
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ className }) => {
  return <hr className={clsx("border-t border-border my-3", className)} />;
};

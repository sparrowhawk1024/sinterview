import React from "react";

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-pageBg text-textPrimary flex flex-col justify-start items-center p-3 sm:p-5 md:p-8 font-sans">
      <div className="w-full max-w-[1240px] bg-surface rounded-workspace shadow-card border border-white/60 overflow-hidden flex flex-col transition-all duration-200">
        {children}
      </div>
    </div>
  );
};

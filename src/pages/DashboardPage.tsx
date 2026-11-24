import React from "react";
import { Link } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import {
  PlayCircle,
  Users,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const DashboardPage: React.FC = () => {
  return (
    <WorkspaceShell>
      <TopNav />

      <main className="p-6 sm:p-10 w-full flex flex-col items-center justify-center min-h-[680px]">
        {/* Hero Section */}
        <div className="max-w-2xl text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primaryLight text-primary text-xs font-semibold mb-6 border border-indigo-100">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>AI-Assisted Technical Interview Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-textPrimary tracking-tight">
            Welcome to Synterview
          </h1>
          <p className="text-sm sm:text-base text-textSecondary mt-3 max-w-lg leading-relaxed">
            Conduct seamless, AI-assisted mock and technical interviews with automated
            question planning, live recording, and real-time meeting intelligence.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to={`/interview/session-${Date.now()}`}
              className="inline-flex items-center justify-center gap-2.5 bg-primary text-white text-sm font-semibold rounded-button px-7 py-3.5 shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <PlayCircle className="w-5 h-5" />
              <span>Start Interview Session</span>
            </Link>
            <Link
              to="/sessions"
              className="inline-flex items-center justify-center gap-2 bg-white border border-border text-textPrimary text-sm font-semibold rounded-button px-6 py-3.5 shadow-xs hover:bg-gray-50 active:scale-95 transition-all"
            >
              <span>Past Interviews & Progress</span>
            </Link>
          </div>
        </div>

        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-12 pt-10 border-t border-border/80">
          <div className="bg-gray-50/70 p-4 rounded-card border border-border/60 flex items-start gap-3">
            <div className="p-2 bg-indigo-100 text-primary rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-textPrimary uppercase tracking-wider">
                Candidates
              </h3>
              <p className="text-sm font-bold text-textPrimary mt-0.5">
                Regina Tanya
              </p>
              <span className="text-xs text-textSecondary">Frontend Developer</span>
            </div>
          </div>

          <div className="bg-gray-50/70 p-4 rounded-card border border-border/60 flex items-start gap-3">
            <div className="p-2 bg-emerald-100 text-success rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-textPrimary uppercase tracking-wider">
                Question Flow
              </h3>
              <p className="text-sm font-bold text-textPrimary mt-0.5">
                5 Technical Topics
              </p>
              <span className="text-xs text-textSecondary">Real-time tracking</span>
            </div>
          </div>

          <div className="bg-gray-50/70 p-4 rounded-card border border-border/60 flex items-start gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-textPrimary uppercase tracking-wider">
                Scheduled Session
              </h3>
              <p className="text-sm font-bold text-textPrimary mt-0.5">
                Jul 10, 2025
              </p>
              <span className="text-xs text-textSecondary">Active room ready</span>
            </div>
          </div>
        </div>

        {/* Direct Link Preview */}
        <div className="mt-8 text-center">
          <Link
            to="/interview/session-001"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-indigo-800 transition-colors"
          >
            <span>Jump directly to session-001</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </WorkspaceShell>
  );
};

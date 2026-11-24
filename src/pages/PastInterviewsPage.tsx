import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { TopNav } from "../components/layout/TopNav";
import {
  getAllInterviewSessions,
  deleteInterviewSession,
  saveInterviewSession,
} from "../services/storageService";
import { PersistedInterviewSession } from "../types";
import { mockInterview } from "../data/mockInterview";
import {
  Calendar,
  Clock,
  TrendingUp,
  Award,
  Activity,
  Trash2,
  FileText,
  PlusCircle,
  PlayCircle,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ListOrdered,
  Sparkles,
} from "lucide-react";

export const PastInterviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<PersistedInterviewSession[]>([]);
  const [activeTab, setActiveTab] = useState<"history" | "progress">("history");
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let loaded = await getAllInterviewSessions();
      // If none exist yet, seed with demo session-001 so the user has immediate data to explore
      if (loaded.length === 0) {
        const demoSession: PersistedInterviewSession = {
          id: "session-001",
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          title: "Frontend Technical System Design",
          role: "Senior Frontend Engineer",
          candidate: mockInterview.candidate,
          interviewer: mockInterview.interviewer,
          questions: mockInterview.questions,
          recordingDuration: 720,
          saveAudioForTraining: false,
          overallScore: 4.1,
          averagePace: 142,
          averageFillers: 3,
          averagePauseRatio: 0.18,
          report: {
            session_id: "session-001",
            candidate_name: mockInterview.candidate.name,
            role: "Senior Frontend Engineer",
            overall_score: 4.1,
            grade: "A",
            verdict: "Hire",
            overall_summary: "Candidate articulated core principles of state decoupling, memoization, and bundle optimization with high technical fluency.",
            radar_data: {
              relevance: 4.5,
              technical_depth: 4.2,
              structure: 4.0,
              clarity: 4.4,
              examples_metrics: 3.5,
            },
            acoustic_summary: {
              avg_speech_rate_wpm: 142,
              avg_pause_ratio: 0.18,
              avg_pitch_std_semitones: 2.6,
              total_filler_words: 3,
              has_acoustic_data: true,
            },
            top_strengths: [
              { feedback: "Detailed explanation of bundle tree-shaking", quote: "code splitting vendor libraries", has_quote: true },
              { feedback: "Consistent conversational pacing with minimal filler words", quote: "", has_quote: false },
            ],
            top_improvements: [
              { feedback: "Provide concrete benchmark numbers for latency reductions", quote: "", has_quote: false },
            ],
            practice_next: [
              "Practice STAR framework for failure retrospectives",
              "Review React 19 server action mechanics",
              "Incorporate production metric benchmarks in explanations",
            ],
            questions_count: 5,
            answered_count: 5,
            evaluation_unavailable: false,
            sources: {},
          },
        };

        const demoSession2: PersistedInterviewSession = {
          id: "session-002",
          createdAt: new Date().toISOString(),
          title: "React Architecture & Performance",
          role: "Frontend Developer",
          candidate: mockInterview.candidate,
          interviewer: mockInterview.interviewer,
          questions: mockInterview.questions,
          recordingDuration: 600,
          saveAudioForTraining: false,
          overallScore: 4.4,
          averagePace: 148,
          averageFillers: 1,
          averagePauseRatio: 0.15,
          report: {
            session_id: "session-002",
            candidate_name: mockInterview.candidate.name,
            role: "Frontend Developer",
            overall_score: 4.4,
            grade: "A",
            verdict: "Strong Hire",
            overall_summary: "Substantial improvement in technical depth, delivery confidence, and structured STAR methodology.",
            radar_data: {
              relevance: 4.8,
              technical_depth: 4.6,
              structure: 4.5,
              clarity: 4.6,
              examples_metrics: 4.0,
            },
            acoustic_summary: {
              avg_speech_rate_wpm: 148,
              avg_pause_ratio: 0.15,
              avg_pitch_std_semitones: 2.8,
              total_filler_words: 1,
              has_acoustic_data: true,
            },
            top_strengths: [
              { feedback: "Production caching latency quantified", quote: "dropping latency by 50%", has_quote: true },
              { feedback: "Flawless cadence and structured STAR responses", quote: "", has_quote: false },
            ],
            top_improvements: [
              { feedback: "Elaborate on database deadlock avoidance", quote: "", has_quote: false },
            ],
            practice_next: [
              "Prepare multi-region distributed state design walkthroughs",
              "Maintain steady 145 WPM pacing",
            ],
            questions_count: 5,
            answered_count: 5,
            evaluation_unavailable: false,
            sources: {},
          },
        };

        await saveInterviewSession(demoSession);
        await saveInterviewSession(demoSession2);
        loaded = [demoSession2, demoSession];
      }
      setSessions(loaded);
    } catch (err) {
      console.error("Failed to load past sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteInterviewSession(id);
      setSessionToDelete(null);
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  // Progress metrics calculated across sessions (oldest to newest for trend lines)
  const chronologicalSessions = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const scoreTrend = chronologicalSessions.map((s) => s.overallScore || 0);
  const paceTrend = chronologicalSessions.map((s) => s.averagePace || 0);
  const fillerTrend = chronologicalSessions.map((s) => s.averageFillers || 0);
  const pauseTrend = chronologicalSessions.map((s) => Math.round((s.averagePauseRatio || 0) * 100));

  // Summary Deltas
  const firstSession = chronologicalSessions[0];
  const latestSession = chronologicalSessions[chronologicalSessions.length - 1];
  const scoreDelta =
    firstSession && latestSession && firstSession.overallScore && latestSession.overallScore
      ? (latestSession.overallScore - firstSession.overallScore).toFixed(1)
      : null;
  const fillerDelta =
    firstSession && latestSession
      ? latestSession.averageFillers - firstSession.averageFillers
      : null;

  return (
    <WorkspaceShell>
      <TopNav />

      <main className="p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-primary text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Session History & Progress Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">
              Past Interviews & Progress Tracking
            </h1>
            <p className="text-xs sm:text-sm text-textSecondary mt-1">
              Review completed sessions, inspect detailed reports, and monitor delivery improvement over time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/interview/session-${Date.now()}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-button shadow-xs hover:bg-indigo-700 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Start New Interview</span>
            </Link>
          </div>
        </div>

        {/* Tab Switcher: "Past Interviews" vs "Progress Over Time" */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
              activeTab === "history"
                ? "border-primary text-primary bg-indigo-50/50"
                : "border-transparent text-textSecondary hover:text-textPrimary hover:bg-gray-50"
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Past Interviews ({sessions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
              activeTab === "progress"
                ? "border-primary text-primary bg-indigo-50/50"
                : "border-transparent text-textSecondary hover:text-textPrimary hover:bg-gray-50"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Candidate Progress & Trends</span>
          </button>
        </div>

        {/* TAB 1: Past Interviews List */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {sessions.map((sess) => {
              const answeredCount = sess.questions.filter((q) => q.status === "answered").length;
              const score = sess.overallScore;

              return (
                <div
                  key={sess.id}
                  className="bg-white rounded-card border border-border p-5 hover:border-indigo-200 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-textPrimary">{sess.title}</h3>
                      {score != null && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {score.toFixed(1)} / 5.0
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-textSecondary bg-gray-100 px-2 py-0.5 rounded">
                        {sess.role}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-textSecondary">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{new Date(sess.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{Math.round(sess.recordingDuration / 60)} min</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {answeredCount} of {sess.questions.length} answered
                        </span>
                      </div>
                      <span>•</span>
                      <span className="text-[11px] font-semibold text-indigo-700">
                        {sess.averagePace ? `${Math.round(sess.averagePace)} WPM` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                    <Link
                      to={`/report/${sess.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-button shadow-2xs hover:bg-indigo-700 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Full Report</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setSessionToDelete(sess.id)}
                      className="p-2 text-textSecondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: Progress View Over Time */}
        {activeTab === "progress" && (
          <div className="space-y-6">
            {/* KPI Metric Summary Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-card border border-border shadow-xs">
                <span className="text-xs text-textMuted uppercase font-bold tracking-wider block">
                  Interviews Completed
                </span>
                <span className="text-2xl font-extrabold text-textPrimary mt-1 block">
                  {sessions.length}
                </span>
                <span className="text-[11px] text-textSecondary mt-0.5 block">Stored locally in IndexedDB</span>
              </div>

              <div className="bg-white p-4 rounded-card border border-border shadow-xs">
                <span className="text-xs text-textMuted uppercase font-bold tracking-wider block">
                  Overall Score Delta
                </span>
                <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
                  {scoreDelta ? `${Number(scoreDelta) >= 0 ? "+" : ""}${scoreDelta}` : "0.0"}
                </span>
                <span className="text-[11px] text-textSecondary mt-0.5 block">1-5 rubric progression</span>
              </div>

              <div className="bg-white p-4 rounded-card border border-border shadow-xs">
                <span className="text-xs text-textMuted uppercase font-bold tracking-wider block">
                  Filler Words Reduction
                </span>
                <span className="text-2xl font-extrabold text-indigo-600 mt-1 block">
                  {fillerDelta !== null ? `${fillerDelta > 0 ? "+" : ""}${fillerDelta}` : "0"}
                </span>
                <span className="text-[11px] text-textSecondary mt-0.5 block">Total fillers per session</span>
              </div>

              <div className="bg-white p-4 rounded-card border border-border shadow-xs">
                <span className="text-xs text-textMuted uppercase font-bold tracking-wider block">
                  Latest Speaking Pace
                </span>
                <span className="text-2xl font-extrabold text-textPrimary mt-1 block">
                  {latestSession ? `${Math.round(latestSession.averagePace)} WPM` : "N/A"}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                  Target: 120-160 WPM
                </span>
              </div>
            </div>

            {/* Progress Trend Lines / Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Trend 1: Overall Score Trend */}
              <div className="bg-white p-5 rounded-card border border-border shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span>Overall Score Progression (1.0 to 5.0)</span>
                  </h3>
                  <span className="text-[10px] font-semibold text-textMuted">Latest: {latestSession?.overallScore ?? "N/A"}</span>
                </div>

                <div className="h-36 w-full flex items-end gap-6 pt-4 border-b border-gray-100">
                  {chronologicalSessions.map((s, idx) => {
                    const sc = s.overallScore || 0;
                    const pct = Math.min(100, Math.round((sc / 5.0) * 100));
                    return (
                      <div key={`sc-${idx}`} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-indigo-700">{sc.toFixed(1)}</span>
                        <div
                          style={{ height: `${pct}%` }}
                          className="w-full max-w-[36px] bg-indigo-500 rounded-t-md transition-all hover:bg-indigo-600"
                        />
                        <span className="text-[10px] text-textSecondary mt-1">
                          Sess {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trend 2: Pace Consistency (WPM) */}
              <div className="bg-white p-5 rounded-card border border-border shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Speaking Pace Across Sessions (WPM)</span>
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-semibold">Optimal 120-160 WPM</span>
                </div>

                <div className="h-36 w-full flex items-end gap-6 pt-4 border-b border-gray-100">
                  {chronologicalSessions.map((s, idx) => {
                    const wpm = s.averagePace || 0;
                    const pct = Math.min(100, Math.round((wpm / 200) * 100));
                    const inRange = wpm >= 120 && wpm <= 160;
                    return (
                      <div key={`wpm-${idx}`} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-textPrimary">{Math.round(wpm)}</span>
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full max-w-[36px] rounded-t-md transition-all ${
                            inRange ? "bg-emerald-500" : "bg-amber-400"
                          }`}
                        />
                        <span className="text-[10px] text-textSecondary mt-1">
                          Sess {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trend 3: Filler Word Reduction */}
              <div className="bg-white p-5 rounded-card border border-border shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    <span>Filler Word Reduction</span>
                  </h3>
                  <span className="text-[10px] text-textMuted">Target: 0-1 per turn</span>
                </div>

                <div className="h-36 w-full flex items-end gap-6 pt-4 border-b border-gray-100">
                  {chronologicalSessions.map((s, idx) => {
                    const fillers = s.averageFillers || 0;
                    const pct = Math.min(100, Math.round((fillers / 12) * 100));
                    return (
                      <div key={`fillers-${idx}`} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-textPrimary">{fillers}</span>
                        <div
                          style={{ height: `${Math.max(10, pct)}%` }}
                          className={`w-full max-w-[36px] rounded-t-md transition-all ${
                            fillers <= 2 ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <span className="text-[10px] text-textSecondary mt-1">
                          Sess {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trend 4: Pause Ratio (% Silence) */}
              <div className="bg-white p-5 rounded-card border border-border shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-600" />
                    <span>Pause Ratio Over Time (%)</span>
                  </h3>
                  <span className="text-[10px] text-cyan-700 font-semibold">Ideal: 10% - 25%</span>
                </div>

                <div className="h-36 w-full flex items-end gap-6 pt-4 border-b border-gray-100">
                  {chronologicalSessions.map((s, idx) => {
                    const pr = Math.round((s.averagePauseRatio || 0) * 100);
                    const pct = Math.min(100, Math.round((pr / 40) * 100));
                    return (
                      <div key={`pause-${idx}`} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-textPrimary">{pr}%</span>
                        <div
                          style={{ height: `${Math.max(10, pct)}%` }}
                          className="w-full max-w-[36px] bg-cyan-500 rounded-t-md transition-all"
                        />
                        <span className="text-[10px] text-textSecondary mt-1">
                          Sess {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {sessionToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-card p-6 max-w-sm w-full shadow-2xl border border-gray-200 space-y-4">
              <div className="flex items-center gap-2.5 text-danger">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-textPrimary">Delete Interview Session?</h3>
              </div>
              <p className="text-xs text-textSecondary leading-relaxed">
                Are you sure you want to delete session <strong>"{sessionToDelete}"</strong>? This will remove all local transcripts, rubric scores, and reports for this session.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSessionToDelete(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-textSecondary hover:bg-gray-100 rounded-button"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(sessionToDelete)}
                  className="px-4 py-2 text-xs font-semibold bg-danger text-white hover:bg-red-700 rounded-button shadow-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </WorkspaceShell>
  );
};

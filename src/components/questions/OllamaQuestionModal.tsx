import React, { useState } from "react";
import { Sparkles, X, BrainCircuit, Check, Cpu, BookOpen } from "lucide-react";
import { generateQuestionsWithOllama, selectQuestionsFromBank } from "../../services/modelClient";
import { InterviewQuestion, OllamaStatus } from "../../types";

interface OllamaQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestions: (newQuestions: InterviewQuestion[]) => void;
  ollamaStatus: OllamaStatus;
}

const TOPIC_SUGGESTIONS = [
  "React Architecture & Rendering Optimization",
  "System Design & Distributed Caching",
  "Microservices & Distributed Tracing",
  "Python Async & Concurrency",
  "Database Indexing & Sharding",
  "Docker & Kubernetes Orchestration",
];

const BANK_ROLES = [
  "Software Engineer",
  "Backend Developer",
  "Frontend Developer",
  "Data Scientist",
  "Product Manager",
  "DevOps Engineer",
];

export const OllamaQuestionModal: React.FC<OllamaQuestionModalProps> = ({
  isOpen,
  onClose,
  onAddQuestions,
  ollamaStatus,
}) => {
  const [activeTab, setActiveTab] = useState<"llm" | "bank">("llm");

  // Tab 1: LLM Generator State
  const [topic, setTopic] = useState("React Architecture & Rendering Optimization");
  const [role, setRole] = useState("Frontend Developer");
  const [difficulty, setDifficulty] = useState<"Junior" | "Mid-Level" | "Senior" | "Lead">("Senior");
  const [count, setCount] = useState<number>(3);

  // Tab 2: Question Bank State
  const [bankRole, setBankRole] = useState("Software Engineer");
  const [bankDifficulty, setBankDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [bankType, setBankType] = useState<"Technical" | "Behavioral" | "Mixed">("Technical");
  const [bankCount, setBankCount] = useState<number>(3);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      if (activeTab === "llm") {
        if (!topic.trim()) return;
        const selectedModel = ollamaStatus.defaultModel || (ollamaStatus.models[0] ?? "qwen2.5-coder:7b");
        const result = await generateQuestionsWithOllama(
          topic.trim(),
          role,
          difficulty,
          count,
          selectedModel
        );

        const isOfflineFallback = result.model_used.startsWith("Offline");

        if (result.success && result.questions.length > 0) {
          const formatted: InterviewQuestion[] = result.questions.map((q, idx) => ({
            id: `q-ollama-${Date.now()}-${idx}`,
            number: idx + 1,
            text: q.text,
            category: isOfflineFallback ? `${q.category || topic} (template)` : (q.category || topic),
            difficulty: q.difficulty || difficulty,
            candidateAnswer: q.candidate_answer_sample,
            idealAnswerPoints: q.ideal_answer_points,
            status: "pending",
            isSelected: idx === 0,
          }));

          onAddQuestions(formatted);
          onClose();
        } else {
          setErrorMsg("Failed to generate questions. Please ensure Ollama is accessible.");
        }
      } else {
        // Question Bank Selection
        const result = await selectQuestionsFromBank(
          bankRole,
          bankDifficulty,
          bankType,
          bankCount
        );

        if (result.success && result.questions.length > 0) {
          const formatted: InterviewQuestion[] = result.questions.map((q, idx) => ({
            id: `q-bank-${Date.now()}-${idx}`,
            number: idx + 1,
            text: q.text,
            category: `${bankRole} - ${bankType}`,
            difficulty: bankDifficulty,
            candidateAnswer: q.candidate_answer_sample,
            idealAnswerPoints: q.ideal_answer_points,
            status: "pending",
            isSelected: idx === 0,
          }));

          onAddQuestions(formatted);
          onClose();
        } else {
          setErrorMsg("Unable to retrieve questions from question bank.");
        }
      }
    } catch (err) {
      console.error("Error generating/selecting questions:", err);
      setErrorMsg("Error generating questions. Check backend service.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-2xl border border-indigo-100 shadow-2xl max-w-lg w-full overflow-hidden transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-white border-b border-indigo-100/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary text-white shadow-md shadow-indigo-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-textPrimary text-base tracking-tight flex items-center gap-2">
                <span>Add Interview Questions</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-primary border border-indigo-200">
                  {activeTab === "llm" ? "AI Generator" : "Question Bank"}
                </span>
              </h3>
              <p className="text-xs text-textSecondary mt-0.5">
                {activeTab === "llm"
                  ? `Powered by local LLM (${ollamaStatus.models[0] || "qwen2.5-coder:7b"})`
                  : "Curated role-based questions from verified technical banks"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-textSecondary hover:text-textPrimary hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("llm")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "llm"
                ? "bg-white text-indigo-700 shadow-sm border border-gray-200/80"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/60"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Topic Generator (Ollama)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bank")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "bank"
                ? "bg-white text-indigo-700 shadow-sm border border-gray-200/80"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/60"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Curated Question Bank (6 Roles)</span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          {activeTab === "llm" ? (
            <>
              {/* Active Model Indicator */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-textPrimary">Engine:</span>
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {ollamaStatus.models[0] || "qwen2.5-coder:7b"}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    ollamaStatus.online ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      ollamaStatus.online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  {ollamaStatus.online ? "Ollama Active" : "Fallback Ready"}
                </span>
              </div>

              {/* Topic Input */}
              <div>
                <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                  Interview Topic / Skill
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Distributed Caching, React State, Docker, Kafka..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all bg-white"
                />
              </div>

              {/* Quick Topic Chips */}
              <div>
                <span className="block text-[11px] font-semibold text-textSecondary mb-1.5">
                  Popular technical topics:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TOPIC_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setTopic(sug)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        topic === sug
                          ? "bg-indigo-50 text-primary border-primary/40 font-semibold"
                          : "bg-gray-50 text-textSecondary border-gray-200 hover:border-indigo-200 hover:text-textPrimary"
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Role & Difficulty Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                    Target Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid-Level">Mid-Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Staff / Principal</option>
                  </select>
                </div>
              </div>

              {/* Question Count Selection */}
              <div>
                <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                  Number of Questions
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                        count === n
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-gray-50 text-textSecondary border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {count === n && <Check className="w-3.5 h-3.5" />}
                      <span>{n} Questions</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Question Bank Selectors */}
              <div>
                <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                  Select Role
                </label>
                <select
                  value={bankRole}
                  onChange={(e) => setBankRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-textPrimary focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  {BANK_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={bankDifficulty}
                    onChange={(e) => setBankDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                    Question Type
                  </label>
                  <select
                    value={bankType}
                    onChange={(e) => setBankType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="Technical">Technical</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-textPrimary uppercase tracking-wider mb-1.5">
                  Number of Questions
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBankCount(n)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                        bankCount === n
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-gray-50 text-textSecondary border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {bankCount === n && <Check className="w-3.5 h-3.5" />}
                      <span>{n} Questions</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
              {errorMsg}
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-textSecondary hover:text-textPrimary hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isGenerating || (activeTab === "llm" && !topic.trim())}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              {activeTab === "llm" ? (
                <>
                  <Sparkles className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                  <span>
                    {isGenerating
                      ? "Generating with Ollama..."
                      : `Generate ${count} Questions`}
                  </span>
                </>
              ) : (
                <>
                  <BookOpen className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                  <span>
                    {isGenerating
                      ? "Loading Questions..."
                      : `Import ${bankCount} Questions`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

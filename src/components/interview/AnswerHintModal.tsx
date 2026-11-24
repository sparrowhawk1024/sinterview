import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Lightbulb, Loader2, Sparkles } from 'lucide-react';

interface AnswerHintModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionText: string;
  idealAnswerPoints?: string[];
}

const MODEL_SERVICE_URL = "http://localhost:8000";

export const AnswerHintModal: React.FC<AnswerHintModalProps> = ({
  isOpen,
  onClose,
  questionText,
  idealAnswerPoints,
}) => {
  const [currentHintLevel, setCurrentHintLevel] = useState<number>(1);
  const [hintsList, setHintsList] = useState<string[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState<boolean>(false);
  const [idealAnswer, setIdealAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchInitialHint = async () => {
      setIsLoadingHint(true);
      setError(null);
      setIdealAnswer(null);
      setCurrentHintLevel(1);
      try {
        const res = await fetch(`${MODEL_SERVICE_URL}/api/hint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: questionText,
            hint_level: 1,
            ideal_answer_points: idealAnswerPoints
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.hint) {
            setHintsList([data.hint]);
          }
        } else {
          setHintsList(["Focus on the core concept definition and main technical problem this solves."]);
        }
      } catch {
        setHintsList(["Focus on the core concept definition and main technical problem this solves."]);
      } finally {
        setIsLoadingHint(false);
      }
    };

    fetchInitialHint();
  }, [isOpen, questionText, idealAnswerPoints]);

  if (!isOpen) return null;

  const handleRevealNextHint = async () => {
    if (currentHintLevel >= 5 || isLoadingHint) return;
    const nextLevel = currentHintLevel + 1;
    setIsLoadingHint(true);
    setError(null);
    try {
      const res = await fetch(`${MODEL_SERVICE_URL}/api/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText,
          hint_level: nextLevel,
          ideal_answer_points: idealAnswerPoints
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hint) {
          setHintsList((prev) => [...prev, data.hint]);
          setCurrentHintLevel(nextLevel);
        }
        if (data.ideal_answer) {
          setIdealAnswer(data.ideal_answer);
        }
      }
    } catch {
      setError("Unable to connect to hint service. You can continue speaking your answer.");
    } finally {
      setIsLoadingHint(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-base text-amber-400">
            <Lightbulb className="w-5 h-5" />
            <span>Interview Answer Hints</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Question */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 text-xs">
          <span className="font-semibold text-slate-400 block mb-1">Active Question:</span>
          <p className="text-slate-200 font-medium italic">"{questionText}"</p>
        </div>

        {/* Hints progression */}
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {hintsList.map((hint, idx) => (
            <div
              key={idx}
              className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200/90 leading-relaxed"
            >
              <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hint Level {idx + 1}</span>
              </div>
              <p>{hint}</p>
            </div>
          ))}

          {idealAnswer && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-200 leading-relaxed">
              <span className="font-bold text-indigo-300 block mb-1">Key Points Blueprint:</span>
              <p className="whitespace-pre-line text-slate-300">{idealAnswer}</p>
            </div>
          )}

          {isLoadingHint && (
            <div className="flex items-center justify-center p-3 text-slate-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Formulating contextual hint...</span>
            </div>
          )}

          {error && (
            <div className="text-rose-400 text-xs bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleRevealNextHint}
            disabled={currentHintLevel >= 5 || isLoadingHint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span>{currentHintLevel >= 5 ? "All Hints Revealed" : `Reveal Hint ${currentHintLevel + 1}`}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md"
          >
            Got It, I'm Ready
          </button>
        </div>
      </div>
    </div>
  );
};

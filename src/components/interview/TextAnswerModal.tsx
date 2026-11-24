import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

interface TextAnswerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitText: (text: string) => void;
  questionText: string;
}

export const TextAnswerModal: React.FC<TextAnswerModalProps> = ({
  isOpen,
  onClose,
  onSubmitText,
  questionText,
}) => {
  const [text, setText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmitText(text.trim());
      setText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-base text-indigo-400">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <span>Type Your Response</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Question */}
        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/50 text-xs">
          <span className="font-semibold text-slate-400 block mb-1">Target Question:</span>
          <p className="text-slate-200 font-medium italic">"{questionText}"</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Your Technical Answer:
            </label>
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Structure your answer with key concepts, architectural rationale, and concrete metrics..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              Word count: {text.trim() ? text.trim().split(/\s+/).length : 0} words
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!text.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all shadow-md shadow-indigo-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Answer</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

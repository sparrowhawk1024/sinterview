import React from 'react';
import { ScanFace, AlertCircle } from 'lucide-react';
import type { StoredBodyLanguage } from '../../utils/bodyLanguageStore';
import { combineConfidence } from '../../hooks/useBodyLanguage';

interface BodyLanguageReportProps {
  data: StoredBodyLanguage;
  answerConfidence: number;
}

const barTone = (v: number) => (v >= 70 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-400' : 'bg-red-400');

const ADVICE: Record<string, string> = {
  eyeContact: 'Maintain direct eye contact with the camera lens rather than looking down or at the screen margins.',
  posture: 'Keep shoulders level, spine tall, and body centered within the camera frame.',
  steadiness: 'Keep head and torso steady; purposeful, measured hand gestures convey confidence.',
  expression: 'Relax facial expression to signal composure and calm engagement under questioning.',
};

export const BodyLanguageReport: React.FC<BodyLanguageReportProps> = ({ data, answerConfidence }) => {
  const s = data?.session;
  if (!s || s.samples < 3) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3 text-slate-500 text-xs">
        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span>Camera telemetry was off or insufficient frames were captured during this session. Multimodal scoring relied on acoustic and textual metrics.</span>
      </div>
    );
  }

  const rows: { key: keyof typeof ADVICE; label: string; value: number }[] = [
    { key: 'eyeContact', label: 'Eye contact (Gaze Proxy)', value: s.eyeContact },
    { key: 'posture', label: 'Posture & Shoulder Alignment', value: s.posture },
    { key: 'steadiness', label: 'Physical Steadiness', value: s.steadiness },
    { key: 'expression', label: 'Facial Composure', value: s.expression },
  ];
  const weakest = [...rows].sort((a, b) => a.value - b.value)[0];
  const overall = Math.round(s.confidence * 0.5 + answerConfidence * 0.5);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ScanFace className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span>Visual & Delivery Posture Telemetry (MediaPipe)</span>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          Client-Side Analysis · {s.facePresentPct}% face-in-frame
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-center">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Delivery Confidence</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-extrabold text-indigo-600">{overall}</span>
            <span className="text-xs font-bold text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Camera telemetry: {s.confidence}% · Verbal delivery: {answerConfidence}%
          </p>
        </div>

        <div className="md:col-span-2 space-y-2.5">
          {rows.map((row) => (
            <div key={row.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">{row.label}</span>
                <span className="font-semibold text-slate-800">{row.value}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                <div className={`h-full ${barTone(row.value)}`} style={{ width: `${row.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.answers && data.answers.length > 1 && (
        <div className="pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confidence Across Question Answers</span>
          <div className="flex items-end gap-2 mt-3 h-16">
            {data.answers.map((a, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-sm transition-all ${barTone(combineConfidence(a))}`}
                    style={{ height: `${Math.max(8, a.confidence)}%` }}
                    title={`Question ${i + 1}: ${a.confidence}%`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Q{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weakest && weakest.value < 70 && (
        <div className="text-xs text-slate-700 bg-amber-50/70 border-l-2 border-amber-500 p-3 rounded-r-xl leading-relaxed">
          <span className="font-semibold text-amber-900">Delivery Coaching Tip ({weakest.label}): </span>
          {ADVICE[weakest.key]}
        </div>
      )}
    </div>
  );
};

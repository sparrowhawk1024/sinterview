import React from 'react';
import { ScanFace, Lightbulb, VideoOff } from 'lucide-react';
import type { BodyLanguageStatus, BodyMetrics } from '../../hooks/useBodyLanguage';

interface BodyLanguagePanelProps {
  status: BodyLanguageStatus;
  live: BodyMetrics | null;
  faceDetected: boolean;
  tip: string | null;
  cameraOn: boolean;
}

const tone = (value: number) => (value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-400');
const label = (value: number) => (value >= 70 ? 'Confident' : value >= 50 ? 'Steady' : 'Nervous');

const Meter: React.FC<{ name: string; value: number | null }> = ({ name, value }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-600 font-medium">{name}</span>
      <span className="font-semibold text-slate-800">{value !== null ? `${value}%` : '--'}</span>
    </div>
    <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${value === null ? '' : tone(value)}`}
        style={{ width: `${value ?? 0}%` }}
      />
    </div>
  </div>
);

export const BodyLanguagePanel: React.FC<BodyLanguagePanelProps> = ({
  status,
  live,
  faceDetected,
  tip,
  cameraOn,
}) => {
  let notice: string | null = null;
  if (!cameraOn) {
    notice = 'Camera Standby: Enable your camera for live posture and eye contact tracking.';
  } else if (status === 'loading') {
    notice = 'Initializing MediaPipe vision pipeline...';
  } else if (status === 'error') {
    notice = 'Vision pipeline standby. The interview continues smoothly with acoustic analysis.';
  } else if (status === 'ready' && !faceDetected) {
    notice = 'No face detected in video frame. Position yourself clearly in camera view.';
  }

  const active = cameraOn && notice === null && live !== null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm flex flex-col flex-shrink-0">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <ScanFace className="w-3.5 h-3.5 text-indigo-600" />
          Live Delivery Telemetry
        </h3>
        {active ? (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              live.confidence >= 70
                ? 'bg-emerald-50 text-emerald-700'
                : live.confidence >= 50
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {label(live.confidence)}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <VideoOff className="w-3 h-3 text-slate-400" />
            Standby
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-bold text-slate-900">{active ? live.confidence : '--'}</span>
            <span className="text-xs text-slate-400 ml-1">/ 100 confidence</span>
          </div>
          {active && (
            <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live MediaPipe
            </span>
          )}
        </div>

        {notice && (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200/70 p-2 rounded-lg leading-snug">
            {notice}
          </div>
        )}

        <div className="space-y-2">
          <Meter name="Eye contact" value={active ? live.eyeContact : null} />
          <Meter name="Posture & Spine" value={active ? live.posture : null} />
          <Meter name="Physical Steadiness" value={active ? live.steadiness : null} />
          <Meter name="Facial Expression" value={active ? live.expression : null} />
        </div>

        {active && tip && (
          <div className="flex items-start gap-2 bg-amber-50/70 border-l-2 border-amber-500 pl-2.5 py-1.5 pr-2 rounded-r-lg">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-900 leading-snug">{tip}</p>
          </div>
        )}

        <p className="text-[10px] text-slate-400 text-center">
          Edge processing only. No video or raw imagery ever leaves this browser.
        </p>
      </div>
    </div>
  );
};

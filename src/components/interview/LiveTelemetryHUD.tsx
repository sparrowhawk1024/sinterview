import React from "react";
import { Activity, Eye, UserCheck, ShieldCheck, VideoOff } from "lucide-react";
import { LiveTelemetryState } from "../../services/visualTelemetryService";

interface LiveTelemetryHUDProps {
  telemetry: LiveTelemetryState;
  isCandidateSpeaking?: boolean;
  isCameraOn?: boolean;
}

export const LiveTelemetryHUD: React.FC<LiveTelemetryHUDProps> = ({
  telemetry,
  isCandidateSpeaking = false,
  isCameraOn = true,
}) => {
  const isVisualActive = isCameraOn && telemetry.faceDetected && telemetry.posture > 0;

  return (
    <div className="w-full bg-slate-900/95 text-white rounded-xl border border-white/10 p-3 sm:p-3.5 shadow-lg backdrop-blur-md transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isVisualActive ? "bg-emerald-400" : "bg-indigo-400"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isVisualActive ? "bg-emerald-500" : "bg-indigo-500"
              }`}
            ></span>
          </span>
          <span className="font-bold text-[11px] sm:text-xs tracking-wider uppercase text-slate-200">
            Live Behavioral Telemetry
          </span>
          {!isCameraOn && (
            <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
              <VideoOff className="w-2.5 h-2.5" />
              Camera Standby (Acoustic Only)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Client-Side Vision</span>
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. Delivery Confidence */}
        <div className="bg-slate-800/70 rounded-lg p-2.5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Confidence</span>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
              {telemetry.confidence}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${telemetry.confidence}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate">{telemetry.confidenceLabel}</span>
            <span className="font-mono text-emerald-400">
              {isCandidateSpeaking ? "Speaking" : "Ready"}
            </span>
          </div>
        </div>

        {/* 2. Posture Level */}
        <div className="bg-slate-800/70 rounded-lg p-2.5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-teal-300 text-xs font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Posture</span>
            </div>
            <span
              className={`text-xs sm:text-sm font-extrabold font-mono ${
                isVisualActive ? "text-white" : "text-slate-400"
              }`}
            >
              {isVisualActive ? `${telemetry.posture}%` : "Off"}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isVisualActive
                  ? "bg-gradient-to-r from-teal-500 to-emerald-400"
                  : "bg-slate-600"
              }`}
              style={{ width: `${isVisualActive ? telemetry.posture : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate">
              {isVisualActive ? telemetry.postureLabel : "Camera Off (No Signal)"}
            </span>
            <span
              className={`font-mono ${
                isVisualActive ? "text-teal-400" : "text-slate-400"
              }`}
            >
              {isVisualActive ? "Optical Track" : "Offline"}
            </span>
          </div>
        </div>

        {/* 3. Eye Contact Level */}
        <div className="bg-slate-800/70 rounded-lg p-2.5 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-purple-300 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Eye Contact</span>
            </div>
            <span
              className={`text-xs sm:text-sm font-extrabold font-mono ${
                isVisualActive ? "text-white" : "text-slate-400"
              }`}
            >
              {isVisualActive ? `${telemetry.eyeContact}%` : "Off"}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isVisualActive
                  ? "bg-gradient-to-r from-purple-500 to-indigo-400"
                  : "bg-slate-600"
              }`}
              style={{ width: `${isVisualActive ? telemetry.eyeContact : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate">
              {isVisualActive ? telemetry.eyeContactLabel : "Camera Off (No Signal)"}
            </span>
            <span
              className={`font-mono ${
                isVisualActive ? "text-purple-400" : "text-slate-400"
              }`}
            >
              {isVisualActive ? "Direct Gaze" : "Offline"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

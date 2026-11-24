import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  AudioLines,
  Subtitles,
  Lightbulb,
  MessageSquare,
  Activity,
  Eye,
  UserCheck,
  VideoOff,
} from "lucide-react";
import { Participant } from "../../types";
import { ParticipantBadge } from "./ParticipantBadge";
import { VideoControls } from "./VideoControls";
import { InterviewerAvatar } from "./InterviewerAvatar";
import { VoiceSelector } from "./VoiceSelector";
import type { VoiceGender, VoiceAccent } from "../../hooks/useTextToSpeech";
import { addSpeakingListener, getLastSpokenText } from "../../services/cosyVoiceService";
import { visualTelemetry, LiveTelemetryState } from "../../services/visualTelemetryService";

interface VideoPanelProps {
  interviewer: Participant;
  candidate: Participant;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEndCall?: () => void;
  isCandidateSpeaking?: boolean;
  candidateLiveText?: string;
  activeAiText?: string;
  voiceGender?: VoiceGender;
  voiceAccent?: VoiceAccent;
  onGenderChange?: (gender: VoiceGender) => void;
  onAccentChange?: (accent: VoiceAccent) => void;
  speechLevel?: number | null;
  onOpenHintModal?: () => void;
  onOpenTextAnswerModal?: () => void;
  telemetry?: LiveTelemetryState;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  interviewer,
  candidate,
  onToggleMic,
  onToggleCamera,
  onEndCall,
  isCandidateSpeaking = false,
  candidateLiveText = "",
  activeAiText = "",
  voiceGender = "female",
  voiceAccent = "us",
  onGenderChange,
  onAccentChange,
  speechLevel = null,
  onOpenHintModal,
  onOpenTextAnswerModal,
  telemetry,
  videoRef: externalVideoRef,
}) => {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [currentAiSpokenText, setCurrentAiSpokenText] = useState(activeAiText);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Webcam stream management
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;
    if (candidate.isCameraOn) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({
            video: {
              width: { ideal: 480 },
              height: { ideal: 360 },
              facingMode: "user",
            },
            audio: false,
          })
          .then((stream) => {
            if (!mounted) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            streamRef.current = stream;
            const video = videoRef.current;
            if (video) {
              video.srcObject = stream;
              const handleReady = () => {
                video.play().catch(() => {});
                visualTelemetry.startSampling(video);
              };
              if (video.readyState >= 2) {
                handleReady();
              } else {
                video.onloadedmetadata = handleReady;
              }
            }
          })
          .catch((err) => {
            console.warn("[VideoPanel] Camera stream access:", err);
            visualTelemetry.stopSampling();
          });
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      visualTelemetry.stopSampling();
    }

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [candidate.isCameraOn]);

  useEffect(() => {
    const last = getLastSpokenText();
    if (last.text) {
      setCurrentAiSpokenText(last.text);
      setIsInterviewerSpeaking(last.isSpeaking);
    }

    const unsub = addSpeakingListener((speaking, _, text) => {
      setIsInterviewerSpeaking(speaking);
      if (text) setCurrentAiSpokenText(text);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeAiText) {
      setCurrentAiSpokenText(activeAiText);
    }
  }, [activeAiText]);

  return (
    <div className="w-full bg-gray-950 rounded-card overflow-hidden relative aspect-video shadow-card border border-border/50 select-none">
      {/* 1. Main Video Background with Animated Interviewer Avatar */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E1B4B] via-[#0F172A] to-[#020617] flex items-center justify-center overflow-hidden">
        {/* Ambient background blur lighting */}
        <div
          className={`absolute -top-16 -left-16 w-72 h-72 rounded-full transition-all duration-500 pointer-events-none ${
            isInterviewerSpeaking
              ? "bg-indigo-500/40 blur-2xl scale-125"
              : "bg-indigo-600/15 blur-3xl scale-100"
          }`}
        />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

        {interviewer.isCameraOn ? (
          /* Animated Avatar with Dynamic Blinking & Lip Sync */
          <div className="relative w-full h-full max-w-lg flex flex-col items-center justify-center">
            <InterviewerAvatar
              gender={voiceGender}
              isSpeaking={isInterviewerSpeaking}
              isListening={isCandidateSpeaking}
              mouthLevel={speechLevel}
            />

            {/* Speaking Status Pill (Positioned cleanly above the subtitles area) */}
            <div className="absolute bottom-32 sm:bottom-36 z-10 pointer-events-none">
              {isInterviewerSpeaking ? (
                <span className="text-[10px] font-bold text-indigo-300 tracking-wider uppercase bg-indigo-950/85 px-3 py-1 rounded-full border border-indigo-500/40 flex items-center gap-1.5 shadow-lg backdrop-blur-md animate-pulse">
                  <AudioLines className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Interviewer Speaking</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase bg-slate-900/70 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                  {isCandidateSpeaking ? "Listening to You..." : "Interviewer Ready"}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Camera Off Placeholder */
          <div className="flex flex-col items-center justify-center gap-2 text-white/60">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center font-bold text-xl text-white">
              {interviewer.initials}
            </div>
            <span className="text-xs text-white/50">Camera turned off</span>
          </div>
        )}
      </div>

      {/* 2. Unified Top Bar: Toolbar on Left, Candidate PiP on Right (Zero Horizontal Overlap) */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-4 z-20 flex items-start justify-between gap-3 pointer-events-none">
        {/* Left Controls & Actions Strip */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto max-w-[68%]">
          {/* Glass Toolbar: Audio + Subtitles + Voice Persona */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md p-1 rounded-xl border border-white/15 shadow-md">
            <button
              type="button"
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className="p-1.5 sm:p-2 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-colors"
              title={isAudioMuted ? "Unmute room audio" : "Mute room audio"}
              aria-label="Room audio toggle"
            >
              {isAudioMuted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors border ${
                showSubtitles
                  ? "bg-indigo-600/80 text-white border-indigo-400/40"
                  : "bg-white/5 hover:bg-white/15 text-white/60 border-transparent"
              }`}
              title={showSubtitles ? "Hide live subtitles on video" : "Show live subtitles on video"}
              aria-label="Toggle subtitles"
            >
              <Subtitles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Voice persona selector */}
            {onGenderChange && onAccentChange && (
              <VoiceSelector
                gender={voiceGender}
                onGenderChange={onGenderChange}
                accent={voiceAccent}
                onAccentChange={onAccentChange}
                isSpeaking={isInterviewerSpeaking}
              />
            )}
          </div>

          {/* Quick Action Helpers (Hint & Type Answer) */}
          <div className="flex items-center gap-1.5">
            {onOpenHintModal && (
              <button
                type="button"
                onClick={onOpenHintModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 backdrop-blur-md text-xs font-semibold shadow-md transition-all active:scale-95"
                title="Need assistance with the active question?"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Need a</span> Hint?
              </button>
            )}

            {onOpenTextAnswerModal && (
              <button
                type="button"
                onClick={onOpenTextAnswerModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 backdrop-blur-md text-xs font-semibold shadow-md transition-all active:scale-95"
                title="Type your answer instead of speaking"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span>Type Answer</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Candidate PiP (Picture-in-Picture) with Live Video & Telemetry Overlay */}
        <div className="pointer-events-auto shrink-0 w-32 sm:w-40 md:w-48 h-24 sm:h-28 md:h-32 rounded-xl overflow-hidden shadow-2xl border border-white/20 z-20 bg-slate-900 flex flex-col justify-between p-2 relative group/pip transition-all">
          {/* Real Webcam Stream or Fallback Avatar */}
          {candidate.isCameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.play().catch(() => {});
                visualTelemetry.startSampling(v);
              }}
              onPlay={(e) => {
                visualTelemetry.startSampling(e.currentTarget);
              }}
              className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center text-white/60">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs sm:text-sm text-white">
                {candidate.initials}
              </div>
              <span className="text-[9px] text-white/50 mt-1 flex items-center gap-1">
                <VideoOff className="w-2.5 h-2.5" />
                Cam Off
              </span>
            </div>
          )}

          {/* PiP Header Strip */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-wider text-white/90 uppercase bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              You
            </span>

            {/* Live Audio Waves */}
            <div className="flex items-end gap-0.5 h-3 bg-black/40 px-1 py-0.5 rounded backdrop-blur-xs">
              <span
                className={`w-0.5 rounded-full transition-all duration-150 ${
                  isCandidateSpeaking && !candidate.isMuted
                    ? "h-3 bg-emerald-400 animate-wave-1"
                    : "h-1 bg-white/30"
                }`}
              />
              <span
                className={`w-0.5 rounded-full transition-all duration-150 ${
                  isCandidateSpeaking && !candidate.isMuted
                    ? "h-3 bg-emerald-300 animate-wave-2"
                    : "h-1 bg-white/30"
                }`}
              />
              <span
                className={`w-0.5 rounded-full transition-all duration-150 ${
                  isCandidateSpeaking && !candidate.isMuted
                    ? "h-3 bg-white animate-wave-3"
                    : "h-1 bg-white/30"
                }`}
              />
            </div>
          </div>

          {/* PiP Bottom: Live Mini Telemetry Badges */}
          <div className="relative z-10 flex items-center justify-between gap-1 mt-auto">
            <div className="bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] text-slate-200 font-medium truncate flex items-center gap-1">
              {candidate.isMuted && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />}
              <span className="truncate">{candidate.name.split(" ")[0]}</span>
            </div>

            {telemetry && candidate.isCameraOn && telemetry.posture > 0 && (
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono text-emerald-400 font-semibold border border-white/10">
                <span title="Eye Contact Focus">👁️ {telemetry.eyeContact}%</span>
                <span className="text-white/30">·</span>
                <span title="Posture Alignment">👤 {telemetry.posture}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Live Subtitles Ribbon (Positioned with high contrast and zero overlap) */}
      {showSubtitles && (isInterviewerSpeaking || isCandidateSpeaking) && (
        <div className="absolute bottom-20 left-4 right-4 sm:left-12 sm:right-12 z-30 flex justify-center pointer-events-none transition-all">
          {isInterviewerSpeaking ? (
            <div className="bg-black/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-indigo-500/50 text-white text-xs sm:text-sm shadow-2xl max-w-xl text-center animate-fadeIn">
              <span className="text-indigo-400 font-bold mr-2 uppercase text-[10px] tracking-wider bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
                AI Interviewer
              </span>
              <span className="leading-snug">{currentAiSpokenText}</span>
            </div>
          ) : isCandidateSpeaking && candidateLiveText ? (
            <div className="bg-black/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-emerald-500/50 text-white text-xs sm:text-sm shadow-2xl max-w-xl text-center animate-fadeIn">
              <span className="text-emerald-400 font-bold mr-2 uppercase text-[10px] tracking-wider bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                You (Live)
              </span>
              <span className="leading-snug">{candidateLiveText}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* 4. Participant Badge (Positioned at bottom-left, strictly below subtitles and beside controls) */}
      <div className="absolute bottom-4 left-3 sm:left-4 z-30 hidden sm:block pointer-events-auto">
        <ParticipantBadge participant={interviewer} />
      </div>

      {/* 5. Centered Bottom Video Controls */}
      <VideoControls
        isMuted={candidate.isMuted}
        isCameraOn={candidate.isCameraOn}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onEndCall={onEndCall}
      />
    </div>
  );
};

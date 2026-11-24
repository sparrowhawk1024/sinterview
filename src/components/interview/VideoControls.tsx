import React from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  MoreHorizontal,
  PhoneOff,
} from "lucide-react";
import { IconButton } from "../ui/IconButton";

interface VideoControlsProps {
  isMuted: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEndCall?: () => void;
  onOpenChat?: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isMuted,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  onEndCall,
  onOpenChat,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 py-4 sm:py-5 flex items-center justify-center gap-3 sm:gap-4 z-20">
      {/* 1. Microphone Toggle */}
      <IconButton
        variant={isMuted ? "danger" : "glass"}
        size="md"
        onClick={onToggleMic}
        title={isMuted ? "Unmute microphone" : "Mute microphone"}
        aria-label="Microphone toggle"
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </IconButton>

      {/* 2. Camera Toggle */}
      <IconButton
        variant={!isCameraOn ? "danger" : "glass"}
        size="md"
        onClick={onToggleCamera}
        title={!isCameraOn ? "Turn camera on" : "Turn camera off"}
        aria-label="Camera toggle"
      >
        {!isCameraOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      </IconButton>

      {/* 3. Chat / Message Toggle */}
      <IconButton
        variant="glass"
        size="md"
        onClick={onOpenChat}
        title="Open interview notes & chat"
        aria-label="Chat messages"
      >
        <MessageSquare className="w-5 h-5" />
      </IconButton>

      {/* 4. More Options */}
      <IconButton
        variant="glass"
        size="md"
        title="More session options"
        aria-label="More options"
      >
        <MoreHorizontal className="w-5 h-5" />
      </IconButton>

      {/* 5. End Session / PhoneOff */}
      <IconButton
        variant="danger"
        size="md"
        onClick={onEndCall}
        title="Leave or conclude interview"
        aria-label="End call"
      >
        <PhoneOff className="w-5 h-5" />
      </IconButton>
    </div>
  );
};

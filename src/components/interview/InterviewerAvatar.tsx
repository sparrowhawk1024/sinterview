import React, { useEffect, useState } from 'react';
import type { VoiceGender } from '../../hooks/useTextToSpeech';

interface InterviewerAvatarProps {
  gender: VoiceGender;
  isSpeaking: boolean;
  isListening: boolean;
  mouthLevel?: number | null;
}

const LOOKS = {
  female: {
    skin: '#E8B796',
    skinShade: '#D79F7B',
    hair: '#3B2418',
    shirt: '#1E293B',
    collar: '#F1F5F9',
  },
  male: {
    skin: '#D9A582',
    skinShade: '#C48D69',
    hair: '#1F1612',
    shirt: '#334155',
    collar: '#F8FAFC',
  },
} as const;

export const InterviewerAvatar: React.FC<InterviewerAvatarProps> = ({
  gender,
  isSpeaking,
  isListening,
  mouthLevel = null,
}) => {
  const look = LOOKS[gender];
  const [mouthOpen, setMouthOpen] = useState(0);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!isSpeaking || mouthLevel !== null) {
      setMouthOpen(0);
      return;
    }
    const id = window.setInterval(
      () => setMouthOpen(Math.random() < 0.18 ? 0 : 0.25 + Math.random() * 0.75),
      110
    );
    return () => window.clearInterval(id);
  }, [isSpeaking, mouthLevel]);

  useEffect(() => {
    let timeout: number;
    const schedule = () => {
      timeout = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2200 + Math.random() * 3200);
    };
    schedule();
    return () => window.clearTimeout(timeout);
  }, []);

  const openAmount =
    isSpeaking && mouthLevel !== null
      ? mouthLevel > 0.06
        ? Math.min(1, mouthLevel * 1.4)
        : 0
      : mouthOpen;
  const mouthHeight = 3 + openAmount * 15;
  const eyeScaleY = blink ? 0.08 : 1;

  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full h-full select-none"
      role="img"
      aria-label={`Interviewer, ${gender === 'female' ? 'she' : 'he'} is ${
        isSpeaking ? 'speaking' : isListening ? 'listening' : 'waiting'
      }`}
    >
      <defs>
        <linearGradient id="room-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E1B4B" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <radialGradient id="room-glow" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#6366F1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
        </radialGradient>
        <style>{`
          @keyframes avatarNod {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(3px) rotate(0.8deg); }
          }
          @keyframes avatarIdle {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-1.5px) rotate(-0.4deg); }
          }
          .avatar-nod { animation: avatarNod 2.4s ease-in-out infinite; }
          .avatar-idle { animation: avatarIdle 4.5s ease-in-out infinite; }
        `}</style>
      </defs>

      <rect width="400" height="400" fill="url(#room-wall)" />
      <rect width="400" height="400" fill="url(#room-glow)" />
      {/* Office shelf + books background */}
      <rect x="22" y="70" width="86" height="8" rx="3" fill="#475569" opacity="0.6" />
      <rect x="30" y="46" width="14" height="24" rx="2" fill="#64748B" opacity="0.6" />
      <rect x="48" y="38" width="12" height="32" rx="2" fill="#94A3B8" opacity="0.5" />
      <rect x="64" y="50" width="16" height="20" rx="2" fill="#64748B" opacity="0.6" />
      <ellipse cx="350" cy="330" rx="24" ry="40" fill="#166534" opacity="0.45" />
      <ellipse cx="332" cy="340" rx="16" ry="32" fill="#15803D" opacity="0.4" />

      {/* Animated figure */}
      <g
        className={isListening ? 'avatar-nod' : 'avatar-idle'}
        style={{ transformOrigin: '200px 380px' }}
      >
        {/* Shoulders / shirt */}
        <path
          d="M40 420 C 50 330, 120 300, 200 300 C 280 300, 350 330, 360 420 Z"
          fill={look.shirt}
        />
        <path d="M168 300 L200 348 L232 300 Z" fill={look.collar} />
        {/* Neck */}
        <rect x="172" y="248" width="56" height="64" rx="20" fill={look.skinShade} />

        {/* Hair back */}
        {gender === 'female' ? (
          <path
            d="M112 190 C 100 90, 160 60, 200 60 C 250 60, 304 100, 290 200 C 296 270, 280 300, 268 310 L 132 310 C 118 290, 106 250, 112 190 Z"
            fill={look.hair}
          />
        ) : (
          <path
            d="M122 150 C 120 84, 160 62, 200 62 C 244 62, 282 86, 278 150 Z"
            fill={look.hair}
          />
        )}

        {/* Ears */}
        <ellipse cx="127" cy="198" rx="10" ry="18" fill={look.skinShade} />
        <ellipse cx="273" cy="198" rx="10" ry="18" fill={look.skinShade} />

        {/* Face */}
        <path
          d="M130 170 C 130 100, 270 100, 270 170 L 270 214 C 270 262, 236 284, 200 284 C 164 284, 130 262, 130 214 Z"
          fill={look.skin}
        />

        {/* Hair front */}
        {gender === 'female' ? (
          <path
            d="M128 176 C 122 100, 170 74, 204 76 C 246 78, 284 104, 272 176 C 250 132, 206 116, 160 124 C 146 130, 134 148, 128 176 Z"
            fill={look.hair}
          />
        ) : (
          <path
            d="M126 168 C 118 96, 170 80, 204 82 C 244 84, 284 104, 274 168 C 262 134, 240 118, 204 116 C 168 116, 140 132, 126 168 Z"
            fill={look.hair}
          />
        )}

        {/* Brows */}
        <path
          d="M156 164 Q 172 156 188 163"
          stroke={look.hair}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M212 163 Q 228 156 244 164"
          stroke={look.hair}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Eyes */}
        <g
          style={{
            transformOrigin: '172px 192px',
            transform: `scaleY(${eyeScaleY})`,
            transition: 'transform 70ms',
          }}
        >
          <ellipse cx="172" cy="192" rx="12" ry="8" fill="#fff" />
          <circle cx="172" cy="192" r="5.5" fill="#2B1B12" />
          <circle cx="174" cy="190" r="1.7" fill="#fff" />
        </g>
        <g
          style={{
            transformOrigin: '228px 192px',
            transform: `scaleY(${eyeScaleY})`,
            transition: 'transform 70ms',
          }}
        >
          <ellipse cx="228" cy="192" rx="12" ry="8" fill="#fff" />
          <circle cx="228" cy="192" r="5.5" fill="#2B1B12" />
          <circle cx="230" cy="190" r="1.7" fill="#fff" />
        </g>

        {/* Nose */}
        <path
          d="M200 196 C 196 214, 190 226, 196 232 C 200 235, 204 235, 208 232"
          stroke={look.skinShade}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Mouth */}
        {openAmount > 0 ? (
          <g>
            <ellipse
              cx="200"
              cy={256}
              rx={17 - openAmount * 2}
              ry={mouthHeight}
              fill="#7A2E2E"
            />
            <rect
              x="188"
              y={256 - mouthHeight + 1}
              width="24"
              height="4"
              rx="2"
              fill="#fff"
              opacity="0.9"
            />
          </g>
        ) : (
          <path
            d="M178 254 Q 200 270 222 254"
            stroke="#8B3A3A"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {gender === 'male' && (
          <path
            d="M156 236 C 160 276, 240 276, 244 236 C 240 262, 160 262, 156 236 Z"
            fill={look.hair}
            opacity="0.16"
          />
        )}
      </g>
    </svg>
  );
};

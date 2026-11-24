import React from 'react';
import type { VoiceAccent, VoiceGender } from '../../hooks/useTextToSpeech';

interface VoiceSelectorProps {
  gender: VoiceGender;
  onGenderChange: (gender: VoiceGender) => void;
  accent: VoiceAccent;
  onAccentChange: (accent: VoiceAccent) => void;
  isSpeaking?: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  gender,
  onGenderChange,
  accent,
  onAccentChange,
  isSpeaking = false,
}) => {
  return (
    <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs">
      <span className="text-slate-400 font-medium mr-1">Voice:</span>
      
      {/* Gender toggle */}
      <div className="inline-flex rounded-md overflow-hidden bg-slate-800 p-0.5 border border-white/5">
        <button
          type="button"
          onClick={() => onGenderChange('female')}
          disabled={isSpeaking}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            gender === 'female'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Female
        </button>
        <button
          type="button"
          onClick={() => onGenderChange('male')}
          disabled={isSpeaking}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            gender === 'male'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Male
        </button>
      </div>

      {/* Accent toggle */}
      <div className="inline-flex rounded-md overflow-hidden bg-slate-800 p-0.5 border border-white/5 ml-1">
        <button
          type="button"
          onClick={() => onAccentChange('us')}
          disabled={isSpeaking}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            accent === 'us'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          US
        </button>
        <button
          type="button"
          onClick={() => onAccentChange('indian')}
          disabled={isSpeaking}
          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
            accent === 'indian'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Indian
        </button>
      </div>
    </div>
  );
};

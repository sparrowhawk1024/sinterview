import { useState, useCallback, useEffect, useRef } from 'react';

export type VoiceGender = 'female' | 'male';
export type VoiceAccent = 'us' | 'indian';

export interface UseTextToSpeechReturn {
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  error: string | null;
  voiceGender: VoiceGender;
  setVoiceGender: (gender: VoiceGender) => void;
  accent: VoiceAccent;
  setAccent: (accent: VoiceAccent) => void;
  voiceName: string | null;
  speechLevel: number | null;
}

const UNSUPPORTED_MESSAGE = "Voice playback isn't available in this browser. You can continue using the text question.";
const STORAGE_KEY = 'synterview_voice_gender';
const ACCENT_STORAGE_KEY = 'synterview_voice_accent';

const FEMALE_HINTS = [
  'female', 'zira', 'jenny', 'aria', 'sonia', 'libby', 'hazel', 'susan', 'samantha', 'victoria', 'karen',
  'moira', 'tessa', 'fiona', 'allison', 'ava', 'serena', 'emma', 'michelle', 'ana', 'natasha', 'catherine',
];
const MALE_HINTS = [
  'male', 'david', 'mark', 'guy', 'ryan', 'davis', 'daniel', 'alex', 'fred', 'george', 'james', 'brian',
  'thomas', 'richard', 'liam', 'eric', 'christopher', 'roger', 'steffan', 'oliver',
];

const matchesHint = (name: string, hints: string[]) => {
  const lower = name.toLowerCase();
  return hints.some((hint) => new RegExp(`\\b${hint}\\b`).test(lower));
};

const isFemaleName = (name: string) => matchesHint(name, FEMALE_HINTS);
const isMaleName = (name: string) => matchesHint(name, MALE_HINTS);

const voiceQuality = (voice: SpeechSynthesisVoice) => {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (name.includes('natural') || name.includes('online')) score += 4;
  if (name.includes('google') || name.includes('microsoft')) score += 2;
  if (voice.lang.toLowerCase() === 'en-us') score += 1;
  return score;
};

export const pickVoice = (voices: SpeechSynthesisVoice[], gender: VoiceGender): SpeechSynthesisVoice | null => {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const matches = english.filter((v) => (gender === 'female' ? isFemaleName(v.name) : isMaleName(v.name)));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => voiceQuality(b) - voiceQuality(a))[0];
};

const readStoredGender = (): VoiceGender => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'male' ? 'male' : 'female';
  } catch {
    return 'female';
  }
};

const readStoredAccent = (): VoiceAccent => {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY) === 'indian' ? 'indian' : 'us';
  } catch {
    return 'us';
  }
};

const MODEL_SERVICE_URL = "http://localhost:8000";

export const useTextToSpeech = (): UseTextToSpeechReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voiceGender, setVoiceGenderState] = useState<VoiceGender>(readStoredGender);
  const [accent, setAccentState] = useState<VoiceAccent>(readStoredAccent);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechLevel, setSpeechLevel] = useState<number | null>(null);

  const activeRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackRef = useRef(0);
  const stopAudioRef = useRef<() => void>(() => {});
  const audioCacheRef = useRef<Map<string, Blob>>(new Map());
  const genderRef = useRef<VoiceGender>(voiceGender);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const accentRef = useRef<VoiceAccent>(accent);
  genderRef.current = voiceGender;
  accentRef.current = accent;
  voicesRef.current = voices;

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      setError(UNSUPPORTED_MESSAGE);
      return;
    }

    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  const setVoiceGender = useCallback((gender: VoiceGender) => {
    setVoiceGenderState(gender);
    try {
      localStorage.setItem(STORAGE_KEY, gender);
    } catch {
      // Ignored
    }
  }, []);

  const setAccent = useCallback((next: VoiceAccent) => {
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      // Ignored
    }
  }, []);

  const cancel = useCallback(() => {
    playbackRef.current += 1;
    stopAudioRef.current();
    activeRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeechLevel(null);
  }, []);

  const speakWithBrowser = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      setError(UNSUPPORTED_MESSAGE);
      onEnd?.();
      return;
    }

    const cleanText = text.trim();
    activeRef.current = null;
    window.speechSynthesis.cancel();
    setError(null);

    if (!cleanText) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const gender = genderRef.current;
    const allVoices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    const voice = pickVoice(allVoices, gender);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.pitch = 1.0;
    } else {
      utterance.lang = 'en-US';
      utterance.pitch = gender === 'female' ? 1.2 : 0.8;
    }
    utterance.rate = 1.0;
    activeRef.current = utterance;

    let finished = false;
    let safetyTimer: number | undefined;
    let mouthInterval: number | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(safetyTimer);
      window.clearInterval(mouthInterval);
      if (activeRef.current !== utterance) return;
      activeRef.current = null;
      setIsSpeaking(false);
      setSpeechLevel(null);
      onEnd?.();
    };

    utterance.onstart = () => {
      if (activeRef.current === utterance) {
        setIsSpeaking(true);
        // Simulate lip sync loudness while browser speaks
        mouthInterval = window.setInterval(() => {
          setSpeechLevel(Math.random() > 0.25 ? 0.3 + Math.random() * 0.5 : 0.05);
        }, 120);
      }
    };
    utterance.onend = finish;
    utterance.onerror = (event) => {
      if (activeRef.current !== utterance) return;
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setError('Voice playback hit a minor error. Continuing with text.');
      }
      finish();
    };

    safetyTimer = window.setTimeout(finish, Math.max(4000, cleanText.length * 120 + 3000));

    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }, []);

  const fetchNeuralAudio = useCallback(async (text: string, gender: VoiceGender, voiceAccent: VoiceAccent): Promise<Blob | null> => {
    const cacheKey = `${voiceAccent}:${gender}:${text}`;
    const cached = audioCacheRef.current.get(cacheKey);
    if (cached) return cached;
    try {
      const res = await fetch(`${MODEL_SERVICE_URL}/api/tts/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender, accent: voiceAccent })
      });
      if (res.status !== 200) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0) return null;
      audioCacheRef.current.set(cacheKey, blob);
      return blob;
    } catch {
      return null;
    }
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      const cleanText = text.trim();
      const myPlayback = ++playbackRef.current;
      stopAudioRef.current();
      activeRef.current = null;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setError(null);

      if (!cleanText) {
        onEnd?.();
        return;
      }

      fetchNeuralAudio(cleanText, genderRef.current, accentRef.current).then((blob) => {
        if (playbackRef.current !== myPlayback) return;
        if (!blob) {
          speakWithBrowser(cleanText, onEnd);
          return;
        }

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        let done = false;

        const stop = () => {
          audio.pause();
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setSpeechLevel(null);
        };
        stopAudioRef.current = stop;

        const finish = (completed: boolean) => {
          if (done) return;
          done = true;
          stop();
          if (playbackRef.current === myPlayback) {
            setIsSpeaking(false);
            setSpeechLevel(null);
            if (completed) onEnd?.();
          }
        };

        audio.onplay = () => {
          if (playbackRef.current === myPlayback) {
            setIsSpeaking(true);
            setSpeechLevel(0.4);
          }
        };
        audio.onended = () => finish(true);
        audio.onerror = () => {
          // If neural playback fails, fallback to browser speech synthesis
          if (playbackRef.current === myPlayback) {
            speakWithBrowser(cleanText, onEnd);
          }
        };

        audio.play().catch(() => {
          speakWithBrowser(cleanText, onEnd);
        });
      });
    },
    [fetchNeuralAudio, speakWithBrowser]
  );

  const matchedVoice = pickVoice(voices, voiceGender);
  const voiceName = matchedVoice ? matchedVoice.name : null;

  return {
    speak,
    cancel,
    isSpeaking,
    isSupported,
    error,
    voiceGender,
    setVoiceGender,
    accent,
    setAccent,
    voiceName,
    speechLevel,
  };
};

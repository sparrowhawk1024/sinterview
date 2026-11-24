import { useState, useEffect, useRef, useCallback } from "react";

export interface UseSpeechRecognitionOptions {
  isMuted?: boolean;
  onTranscriptChange?: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isCandidateSpeaking: boolean;
  volumeLevel: number;
  isSupported: boolean;
  permissionState: "prompt" | "granted" | "denied" | "unsupported";
  errorMessage: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  setTranscript: (text: string) => void;
  toggleListening: () => Promise<void>;
}

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
  webkitAudioContext?: typeof AudioContext;
  AudioContext?: typeof AudioContext;
}

export function useSpeechRecognition({
  isMuted = false,
  onTranscriptChange,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [transcript, setTranscriptState] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const shouldListenRef = useRef<boolean>(false);

  // Check browser support on mount
  useEffect(() => {
    const win = window as unknown as IWindow;
    const hasSpeech = Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
    setIsSupported(hasSpeech);
    if (!hasSpeech) {
      setPermissionState("unsupported");
    }
  }, []);

  // Sync mute ref
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      setIsCandidateSpeaking(false);
      setVolumeLevel(0);
      setInterimTranscript("");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    } else if (shouldListenRef.current && !isListening) {
      // resume if was listening
      startListening();
    }
  }, [isMuted]);

  const setTranscript = useCallback(
    (text: string) => {
      setTranscriptState(text);
      if (onTranscriptChange) {
        onTranscriptChange(text);
      }
    },
    [onTranscriptChange]
  );

  const resetTranscript = useCallback(() => {
    setTranscriptState("");
    setInterimTranscript("");
  }, []);

  // Web Audio API Volume Analyzer
  const startAudioAnalysis = useCallback(async (stream: MediaStream) => {
    try {
      const win = window as unknown as IWindow;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return;

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (_) {}
      }

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // Resume context if suspended
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let silenceFrames = 0;

      const checkVolume = () => {
        if (!shouldListenRef.current || isMutedRef.current) {
          setIsCandidateSpeaking(false);
          setVolumeLevel(0);
          animFrameRef.current = requestAnimationFrame(checkVolume);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setVolumeLevel(normalized);

        // Speaking threshold
        if (normalized > 10) {
          silenceFrames = 0;
          setIsCandidateSpeaking(true);
        } else {
          silenceFrames++;
          if (silenceFrames > 12) {
            setIsCandidateSpeaking(false);
          }
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn("AudioContext setup warning:", err);
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsCandidateSpeaking(false);
    setVolumeLevel(0);
  }, []);

  // Start speech recognition and microphone capture
  const startListening = useCallback(async () => {
    setErrorMessage(null);
    shouldListenRef.current = true;

    // 1. Request microphone permission explicitly via user gesture
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = stream;
        setPermissionState("granted");
        startAudioAnalysis(stream);
      } catch (err: any) {
        console.warn("Microphone permission prompt result:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionState("denied");
          setErrorMessage("Microphone access was blocked. Click the lock icon in your browser address bar to allow microphone.");
          setIsListening(false);
          return;
        }
      }
    }

    // 2. Initialize Web Speech API Recognition
    const win = window as unknown as IWindow;
    const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!RecognitionClass) {
      setPermissionState("unsupported");
      setErrorMessage("Speech recognition is not supported in this browser. You can type your answers directly.");
      setIsListening(true);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }

    const recognition = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setPermissionState("granted");
    };

    recognition.onspeechstart = () => {
      if (!isMutedRef.current) {
        setIsCandidateSpeaking(true);
      }
    };

    recognition.onresult = (event: any) => {
      if (isMutedRef.current) return;

      let currentFinal = "";
      let currentInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          currentFinal += text + " ";
        } else {
          currentInterim += text;
        }
      }

      setInterimTranscript(currentInterim);
      if (currentInterim.trim().length > 0) {
        setIsCandidateSpeaking(true);
      }

      if (currentFinal.trim().length > 0) {
        setTranscriptState((prev) => {
          const updated = prev ? `${prev.trim()} ${currentFinal.trim()}` : currentFinal.trim();
          if (onTranscriptChange) onTranscriptChange(updated);
          return updated;
        });
        setInterimTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "audio-capture") {
        return; // Normal pause in speaking
      }
      if (event.error === "not-allowed") {
        setPermissionState("denied");
        setErrorMessage("Microphone permission denied. Please allow microphone access in your browser.");
        setIsListening(false);
        return;
      }
      console.warn("Speech recognition notice:", event.error);
    };

    recognition.onend = () => {
      // If candidate is still unmuted and intended to listen, gracefully restart
      if (shouldListenRef.current && !isMutedRef.current && permissionState !== "denied") {
        try {
          recognition.start();
        } catch (_) {}
      } else {
        setIsListening(false);
        setIsCandidateSpeaking(false);
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn("Recognition start notice:", err);
      // Already active is fine
      setIsListening(true);
    }
  }, [onTranscriptChange, startAudioAnalysis, permissionState]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    stopAudioAnalysis();
    setIsListening(false);
    setIsCandidateSpeaking(false);
    setInterimTranscript("");
  }, [stopAudioAnalysis]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]);

  return {
    transcript,
    interimTranscript,
    isListening,
    isCandidateSpeaking,
    volumeLevel,
    isSupported,
    permissionState,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    toggleListening,
  };
}

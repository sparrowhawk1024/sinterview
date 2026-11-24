import { useState, useRef, useCallback } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isSupported: boolean;
  recordingError: string | null;
  audioBlob: Blob | null;
  durationSeconds: number;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const isSupported = typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices && !!window.MediaRecorder;

  /**
   * Starts capturing microphone audio ONLY during the listening phase.
   * Configures echoCancellation, noiseSuppression and autoGainControl.
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setRecordingError("MediaRecorder is not supported in this browser environment.");
      return false;
    }

    // Reset previous answer blob
    setAudioBlob(null);
    audioChunksRef.current = [];
    setRecordingError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;

      // Pick preferred codec
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          mimeType = "audio/ogg;codecs=opus";
        } else {
          mimeType = "";
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event: Event) => {
        console.warn("MediaRecorder runtime error:", event);
        setRecordingError("Audio recording encountered a device error.");
      };

      startTimeRef.current = performance.now();
      recorder.start(250); // Slice chunks every 250ms
      setIsRecording(true);
      return true;
    } catch (err) {
      console.warn("Microphone access denied or unavailable for MediaRecorder:", err);
      setRecordingError("Microphone permission denied or device busy. Falling back to text-only.");
      return false;
    }
  }, [isSupported]);

  /**
   * Stops recording and finalizes a single Opus WebM Blob for the candidate's answer.
   * Stops the media tracks so microphone is closed during AI speech/thinking.
   */
  const stopRecording = useCallback(async (): Promise<{ blob: Blob | null; durationSeconds: number }> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return { blob: null, durationSeconds: 0 };
    }

    const durationSeconds = Math.max(0.1, (performance.now() - startTimeRef.current) / 1000);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const finalBlob = new Blob(audioChunksRef.current, { type: mime });
        audioChunksRef.current = [];

        // Check 10 MB cap
        if (finalBlob.size > 10 * 1024 * 1024) {
          setRecordingError("Audio size exceeds 10 MB limit.");
          resolve({ blob: null, durationSeconds });
        } else {
          setAudioBlob(finalBlob);
          resolve({ blob: finalBlob, durationSeconds });
        }

        // Release hardware tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      try {
        recorder.stop();
      } catch {
        resolve({ blob: null, durationSeconds });
      }
    });
  }, []);

  return {
    isRecording,
    isSupported,
    recordingError,
    audioBlob,
    startRecording,
    stopRecording,
  };
}

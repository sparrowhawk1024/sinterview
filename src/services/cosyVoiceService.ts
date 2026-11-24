import { CosyVoiceTTSResponse } from "../types";

const MODEL_SERVICE_URL = "http://localhost:8000";

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

let lastSpokenText: string = "";
let lastQuestionId: string = "";
let isCurrentlySpeaking: boolean = false;
let voicesLoaded: SpeechSynthesisVoice[] = [];

// Cache voices eagerly
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    try {
      voicesLoaded = window.speechSynthesis.getVoices();
    } catch (_) {}
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export interface SpeakingStateListener {
  (isSpeaking: boolean, questionId?: string, text?: string): void;
}

const listeners: Set<SpeakingStateListener> = new Set();

export function addSpeakingListener(listener: SpeakingStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastSpokenText(): { text: string; questionId: string; isSpeaking: boolean } {
  return { text: lastSpokenText, questionId: lastQuestionId, isSpeaking: isCurrentlySpeaking };
}

function notifySpeaking(isSpeaking: boolean, questionId?: string, text?: string) {
  isCurrentlySpeaking = isSpeaking;
  if (questionId) lastQuestionId = questionId;
  if (text) lastSpokenText = text;

  listeners.forEach((fn) => fn(isSpeaking, questionId || lastQuestionId, text || lastSpokenText));
  window.dispatchEvent(
    new CustomEvent("interviewer-speaking", {
      detail: { isSpeaking, questionId: questionId || lastQuestionId, text: text || lastSpokenText },
    })
  );
}

/**
 * Play a friendly audio chime via Web Audio API to confirm speaker output
 */
export function playChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch (_) {}
}

/**
 * Stop any active CosyVoice 2 or browser speech audio
 */
export function stopCosyVoiceSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  notifySpeaking(false);
}

/**
 * Quick Audio Test: greets the user aloud so they can immediately verify sound works
 */
export async function testBrowserAudio(): Promise<void> {
  playChime();
  await askQuestionWithCosyVoice(
    "Hello! This is Tania, your AI interviewer. Can you hear my voice clearly?",
    "test-audio"
  );
}

/**
 * Asks a question aloud using CosyVoice 2 or natural browser speech synthesis.
 */
export async function askQuestionWithCosyVoice(
  text: string,
  questionId: string,
  speaker: string = "female_interviewer"
): Promise<{ engine: string; status: string }> {
  // Stop previous speech if any
  stopCosyVoiceSpeaking();
  notifySpeaking(true, questionId, text);

  // 1. Try local CosyVoice 2 endpoint on port 8000 with quick timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${MODEL_SERVICE_URL}/cosyvoice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        text,
        speaker,
        speed: 1.0,
      }),
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: CosyVoiceTTSResponse = await res.json();
      if (data.status === "success" && data.audio_base64) {
        const audio = new Audio(data.audio_base64);
        currentAudio = audio;

        audio.onended = () => {
          currentAudio = null;
          notifySpeaking(false, questionId, text);
        };

        audio.onerror = () => {
          fallbackBrowserSpeech(text, questionId);
        };

        await audio.play();
        return { engine: "cosyvoice2", status: "success" };
      }
    }
  } catch (err) {
    // Port 8000 or CosyVoice unreachable or timed out; fall through immediately
  }

  // 2. High-fidelity browser speech fallback
  fallbackBrowserSpeech(text, questionId);
  return { engine: "web_speech_fallback", status: "fallback" };
}

function fallbackBrowserSpeech(text: string, questionId: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    notifySpeaking(false, questionId, text);
    return;
  }

  // Cancel any lingering utterances
  window.speechSynthesis.cancel();

  // Short delay to let Chromium's speech engine clear out cancel state
  setTimeout(() => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;

      // Refresh voice list if empty
      const voices =
        voicesLoaded.length > 0 ? voicesLoaded : window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoaded = voices;
      }

      // Pick the best natural English voice (preferring neural / Natural / Google voices)
      const selectedVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Natural") ||
              v.name.includes("Google") ||
              v.name.includes("Jenny") ||
              v.name.includes("Samantha") ||
              v.name.includes("Aria") ||
              v.name.includes("Zira"))
        ) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Natural, conversational cadence and pitch
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        notifySpeaking(true, questionId, text);
      };

      utterance.onend = () => {
        currentUtterance = null;
        notifySpeaking(false, questionId, text);
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis notice:", e);
        currentUtterance = null;
        notifySpeaking(false, questionId, text);
      };

      // In Chrome, ensure synthesis is not paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);

      // Keepalive interval for long utterances in Chromium
      const keepAlive = setInterval(() => {
        if (!currentUtterance || !window.speechSynthesis.speaking) {
          clearInterval(keepAlive);
        } else if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 5000);
    } catch (err) {
      console.error("Browser speech synthesis failed:", err);
      notifySpeaking(false, questionId, text);
    }
  }, 60);
}

/**
 * Speak text and return a Promise<void> that resolves ONLY when speech has fully ended.
 * This is used by the interview loop to sequence: speak question → wait → start listening.
 */
export function speakAndWait(
  text: string,
  questionId: string,
  speaker: string = "female_interviewer"
): Promise<void> {
  return new Promise<void>((resolve) => {
    // Listen for the speaking-end event
    const unsub = addSpeakingListener((isSpeaking) => {
      if (!isSpeaking) {
        unsub();
        resolve();
      }
    });

    askQuestionWithCosyVoice(text, questionId, speaker).then(() => {
      // If speech completed synchronously (e.g. empty text or instant error),
      // check state immediately
      if (!isCurrentlySpeaking) {
        unsub();
        resolve();
      }
    });

    // Safety timeout: never hang for more than 60s
    setTimeout(() => {
      unsub();
      resolve();
    }, 60_000);
  });
}

/**
 * Cancel all speech and return immediately. Used by the loop for clean teardown.
 */
export function cancelAllSpeech(): void {
  stopCosyVoiceSpeaking();
}



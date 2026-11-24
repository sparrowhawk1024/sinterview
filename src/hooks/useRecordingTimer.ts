import { useState, useEffect } from "react";

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function useRecordingTimer(isRecording: boolean, initialSeconds: number = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  return {
    seconds,
    formattedTime: formatDuration(seconds),
  };
}

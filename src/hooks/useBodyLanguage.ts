import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// Everything runs client-side in the browser: video frames never leave the candidate's device.
const WASM_URL = '/mediapipe/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const SAMPLE_INTERVAL_MS = 180;
const CALIBRATION_SAMPLES = 15;
const MOTION_WINDOW = 12;
const NO_FACE_GRACE_MS = 1500;
const LIVE_SMOOTHING = 0.25;

export interface BodyMetrics {
  eyeContact: number; // 0-100
  posture: number;
  steadiness: number;
  expression: number;
  confidence: number;
}

export interface BodySummary extends BodyMetrics {
  samples: number;
  facePresentPct: number;
}

export type BodyLanguageStatus = 'off' | 'loading' | 'ready' | 'error';

export interface UseBodyLanguageReturn {
  status: BodyLanguageStatus;
  live: BodyMetrics | null;
  faceDetected: boolean;
  tip: string | null;
  /** Returns the average of the samples since the last call (or null if there were none) and starts a fresh window. */
  takeAnswerSummary: () => BodySummary | null;
  /** Average over the whole interview so far. */
  getSessionSummary: () => BodySummary | null;
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** Only samples taken while this is true count toward the summaries (live meters always update). */
  collecting: boolean;
}

interface Accumulator {
  n: number;
  frames: number;
  eyeContact: number;
  posture: number;
  steadiness: number;
  expression: number;
}

const emptyAcc = (): Accumulator => ({ n: 0, frames: 0, eyeContact: 0, posture: 0, steadiness: 0, expression: 0 });

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (value: number, good: number, bad: number) => clamp01((bad - value) / (bad - good));

export const combineConfidence = (m: Omit<BodyMetrics, 'confidence'>) =>
  Math.round(m.eyeContact * 0.3 + m.posture * 0.25 + m.steadiness * 0.25 + m.expression * 0.2);

const summarize = (acc: Accumulator): BodySummary | null => {
  if (acc.n === 0) return null;
  const base = {
    eyeContact: Math.round(acc.eyeContact / acc.n),
    posture: Math.round(acc.posture / acc.n),
    steadiness: Math.round(acc.steadiness / acc.n),
    expression: Math.round(acc.expression / acc.n),
  };
  return {
    ...base,
    confidence: combineConfidence(base),
    samples: acc.n,
    facePresentPct: acc.frames ? Math.round((acc.n / acc.frames) * 100) : 0,
  };
};

const blend = (shapes: { categoryName: string; score: number }[] | undefined) => {
  const map = new Map<string, number>();
  shapes?.forEach((s) => map.set(s.categoryName, s.score));
  return (name: string) => map.get(name) ?? 0;
};

// Head rotation (degrees) from MediaPipe's 4x4 column-major facial transformation matrix
const headAngles = (data: ArrayLike<number> | undefined) => {
  if (!data || data.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
  const r = (row: number, col: number) => data[col * 4 + row];
  const toDeg = 180 / Math.PI;
  return {
    yaw: Math.atan2(r(0, 2), r(2, 2)) * toDeg,
    pitch: Math.asin(Math.max(-1, Math.min(1, -r(1, 2)))) * toDeg,
    roll: Math.atan2(r(1, 0), r(1, 1)) * toDeg,
  };
};

const std = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};

export const useBodyLanguage = ({ videoRef, enabled, collecting }: Options): UseBodyLanguageReturn => {
  const [status, setStatus] = useState<BodyLanguageStatus>('off');
  const [live, setLive] = useState<BodyMetrics | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  const collectingRef = useRef(collecting);
  collectingRef.current = collecting;

  const answerAcc = useRef<Accumulator>(emptyAcc());
  const sessionAcc = useRef<Accumulator>(emptyAcc());

  const takeAnswerSummary = useCallback(() => {
    const summary = summarize(answerAcc.current);
    answerAcc.current = emptyAcc();
    return summary;
  }, []);

  const getSessionSummary = useCallback(() => summarize(sessionAcc.current), []);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      setLive(null);
      setFaceDetected(false);
      setTip(null);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let face: FaceLandmarker | null = null;
    let pose: PoseLandmarker | null = null;

    // Running state for the frame loop
    let lastVideoTime = -1;
    let lastTimestamp = 0;
    let lastFaceSeen = 0;
    let smoothed: BodyMetrics | null = null;
    let tipHold: { text: string | null; since: number } = { text: null, since: 0 };
    const calibration: number[] = [];
    let baselineNeck: number | null = null;
    const motionX: number[] = [];
    const motionY: number[] = [];
    const motionRoll: number[] = [];
    const shoulderX: number[] = [];

    setStatus('loading');

    const create = async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const make = async <T,>(factory: (delegate: 'GPU' | 'CPU') => Promise<T>) => {
        try {
          return await factory('GPU');
        } catch {
          return factory('CPU');
        }
      };

      face = await make((delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        })
      );

      try {
        pose = await make((delegate) =>
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        );
      } catch {
        pose = null;
      }
    };

    const setTipDebounced = (text: string | null, now: number) => {
      if (text !== tipHold.text) tipHold = { text, since: now };
      const age = now - tipHold.since;
      if (text && age > 2500) setTip(text);
      if (!text && age > 1500) setTip(null);
    };

    const step = () => {
      if (cancelled) return;
      timer = window.setTimeout(step, SAMPLE_INTERVAL_MS);

      const video = videoRef.current;
      if (!video || !face || video.readyState < 2 || video.videoWidth === 0 || video.paused) {
        return;
      }
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const now = performance.now();
      const timestamp = Math.max(now, lastTimestamp + 1);
      lastTimestamp = timestamp;

      const faceResult = face.detectForVideo(video, timestamp);
      const landmarks = faceResult.faceLandmarks?.[0];

      if (collectingRef.current) {
        answerAcc.current.frames += 1;
        sessionAcc.current.frames += 1;
      }

      if (!landmarks) {
        if (now - lastFaceSeen > NO_FACE_GRACE_MS) {
          setFaceDetected(false);
          setTipDebounced('Move into the frame so the interviewer can see you.', now);
        }
        return;
      }
      lastFaceSeen = now;
      setFaceDetected(true);

      const shape = blend(faceResult.faceBlendshapes?.[0]?.categories);
      const { yaw, pitch, roll } = headAngles(faceResult.facialTransformationMatrixes?.[0]?.data);

      // Eye contact: head facing camera and eyes not wandering
      const facing = Math.min(ramp(Math.abs(yaw), 12, 35), ramp(Math.abs(pitch - 5), 12, 35));
      const gazeOff = Math.max(
        (shape('eyeLookInLeft') + shape('eyeLookOutRight')) / 2,
        (shape('eyeLookOutLeft') + shape('eyeLookInRight')) / 2,
        (shape('eyeLookDownLeft') + shape('eyeLookDownRight')) / 2,
        (shape('eyeLookUpLeft') + shape('eyeLookUpRight')) / 2
      );
      const gaze = ramp(gazeOff, 0.2, 0.6);
      const eyeContact = clamp01(facing * 0.55 + gaze * 0.45) * (facing < 0.2 ? 0.5 : 1);

      // Posture: shoulders level and head held up relative to shoulders
      const nose: NormalizedLandmark = landmarks[1];
      let posture: number | null = null;
      let shoulderLevel = 1;
      let shoulderMid = nose.x;
      if (pose) {
        const poseResult = pose.detectForVideo(video, timestamp + 0.5);
        const body = poseResult.landmarks?.[0];
        const left = body?.[11];
        const right = body?.[12];
        if (left && right && (left.visibility ?? 1) > 0.5 && (right.visibility ?? 1) > 0.5) {
          const width = Math.hypot(left.x - right.x, left.y - right.y) || 1e-3;
          const tiltDeg = Math.abs(Math.atan2(left.y - right.y, left.x - right.x) * (180 / Math.PI));
          const tilt = Math.min(tiltDeg, 180 - tiltDeg);
          shoulderLevel = ramp(tilt, 4, 16);
          shoulderMid = (left.x + right.x) / 2;
          const neck = ((left.y + right.y) / 2 - nose.y) / width;

          if (baselineNeck === null) {
            calibration.push(neck);
            if (calibration.length >= CALIBRATION_SAMPLES) {
              const sorted = [...calibration].sort((a, b) => a - b);
              baselineNeck = sorted[Math.floor(sorted.length * 0.75)];
            }
          }
          const reference = baselineNeck ?? neck;
          const heightScore = ramp(1 - neck / Math.max(reference, 1e-3), 0.08, 0.35);
          posture = clamp01(heightScore * 0.65 + shoulderLevel * 0.35);
        }
      }
      if (posture === null) {
        posture = clamp01(ramp(Math.abs(roll), 6, 22) * 0.8 + 0.2);
      }

      // Steadiness: drift of head and shoulders over recent window
      const faceSize = Math.max(Math.abs(landmarks[454].x - landmarks[234].x), 1e-3);
      motionX.push(nose.x / faceSize);
      motionY.push(nose.y / faceSize);
      motionRoll.push(roll);
      shoulderX.push(shoulderMid / faceSize);
      [motionX, motionY, motionRoll, shoulderX].forEach((buf) => {
        if (buf.length > MOTION_WINDOW) buf.shift();
      });
      const movement = std(motionX) + std(motionY) + std(motionRoll) / 20 + std(shoulderX) * 0.5;
      const steadiness = ramp(movement, 0.12, 0.9);

      // Expression: relaxed and warm vs frowning / tension
      const smile = (shape('mouthSmileLeft') + shape('mouthSmileRight')) / 2;
      const tension =
        ((shape('browDownLeft') + shape('browDownRight')) / 2) * 0.6 +
        ((shape('mouthPressLeft') + shape('mouthPressRight')) / 2) * 0.4 +
        ((shape('mouthFrownLeft') + shape('mouthFrownRight')) / 2) * 0.6;
      const expression = clamp01(0.6 + Math.min(smile, 0.6) * 0.65 - tension * 0.9);

      const raw = {
        eyeContact: Math.round(eyeContact * 100),
        posture: Math.round(posture * 100),
        steadiness: Math.round(steadiness * 100),
        expression: Math.round(expression * 100),
      };

      if (collectingRef.current) {
        for (const acc of [answerAcc.current, sessionAcc.current]) {
          acc.n += 1;
          acc.eyeContact += raw.eyeContact;
          acc.posture += raw.posture;
          acc.steadiness += raw.steadiness;
          acc.expression += raw.expression;
        }
      }

      const next: BodyMetrics = { ...raw, confidence: combineConfidence(raw) };
      smoothed = smoothed
        ? {
            eyeContact: smoothed.eyeContact + (next.eyeContact - smoothed.eyeContact) * LIVE_SMOOTHING,
            posture: smoothed.posture + (next.posture - smoothed.posture) * LIVE_SMOOTHING,
            steadiness: smoothed.steadiness + (next.steadiness - smoothed.steadiness) * LIVE_SMOOTHING,
            expression: smoothed.expression + (next.expression - smoothed.expression) * LIVE_SMOOTHING,
            confidence: smoothed.confidence + (next.confidence - smoothed.confidence) * LIVE_SMOOTHING,
          }
        : next;

      setLive({
        eyeContact: Math.round(smoothed.eyeContact),
        posture: Math.round(smoothed.posture),
        steadiness: Math.round(smoothed.steadiness),
        expression: Math.round(smoothed.expression),
        confidence: Math.round(smoothed.confidence),
      });

      const weakest = (
        [
          [smoothed.eyeContact, 'Look at the camera lens to maintain direct eye contact.'],
          [smoothed.posture, 'Sit upright with level shoulders to project confidence.'],
          [smoothed.steadiness, 'Stay steady; composed physical poise signals clarity.'],
          [smoothed.expression, 'Relax your facial expression.'],
        ] as [number, string][]
      ).sort((a, b) => a[0] - b[0])[0];
      setTipDebounced(weakest[0] < 55 ? weakest[1] : null, now);
    };

    create()
      .then(() => {
        if (cancelled) {
          face?.close();
          pose?.close();
          return;
        }
        setStatus('ready');
        step();
      })
      .catch((err) => {
        console.warn('MediaPipe initialization warning:', err);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      face?.close();
      pose?.close();
    };
  }, [enabled, videoRef]);

  return { status, live, faceDetected, tip, takeAnswerSummary, getSessionSummary };
};

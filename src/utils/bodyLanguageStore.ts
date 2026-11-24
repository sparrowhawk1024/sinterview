import type { BodySummary } from '../hooks/useBodyLanguage';

// Body language is analysed client-side in the browser, so per-interview results are kept locally rather than sent across the network.
export interface StoredBodyLanguage {
  answers: BodySummary[];
  session: BodySummary | null;
}

const key = (interviewId: string) => `synterview_body_language_${interviewId}`;

export const saveBodyLanguage = (interviewId: string, data: StoredBodyLanguage) => {
  try {
    localStorage.setItem(key(interviewId), JSON.stringify(data));
  } catch {
    // Private mode or storage quota exceeded
  }
};

export const loadBodyLanguage = (interviewId: string): StoredBodyLanguage | null => {
  try {
    const raw = localStorage.getItem(key(interviewId));
    return raw ? (JSON.parse(raw) as StoredBodyLanguage) : null;
  } catch {
    return null;
  }
};

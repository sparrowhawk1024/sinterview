import { InterviewSession } from "../types";

export const mockInterview: InterviewSession = {
  id: "session-001",
  title: "Hiring – Frontend Developer",
  subtitle: "Summary of candidates, technical evaluation, and interview progress.",
  isLive: true,
  isRecording: true,
  recordingDuration: 272, // 00:04:32 initial
  interviewer: {
    id: "p1",
    name: "Mrs. Tania Shahira",
    role: "interviewer",
    initials: "TS",
    avatarColor: "bg-indigo-500",
    isMuted: false,
    isCameraOn: true,
  },
  candidate: {
    id: "p2",
    name: "Regina Tanya",
    role: "candidate",
    initials: "RT",
    avatarColor: "bg-purple-400",
    isMuted: false,
    isCameraOn: true,
  },
  questions: [
    {
      id: "q1",
      number: 1,
      text: "How would you optimize a React app for performance?",
      candidateAnswer:
        "I use code-splitting, lazy loading, memoization (React.memo, useMemo), and avoid unnecessary re-renders with proper dependency handling in hooks.",
      status: "answered",
      isSelected: false,
    },
    {
      id: "q2",
      number: 2,
      text: "Describe your experience with Tailwind CSS.",
      candidateAnswer:
        "I've used Tailwind in three client projects. I love how it speeds up prototyping and encourages consistent design tokens.",
      status: "answered",
      isSelected: true,
    },
    {
      id: "q3",
      number: 3,
      text: "Can you explain how you structure components to keep your code clean and maintainable?",
      candidateAnswer:
        "I follow feature-based directory structuring with specialized presentation and container components, extracting reusable UI tokens.",
      status: "pending",
      isSelected: false,
    },
    {
      id: "q4",
      number: 4,
      text: "How do you handle API errors on the frontend?",
      status: "pending",
      isSelected: false,
    },
    {
      id: "q5",
      number: 5,
      text: "Walk me through your approach to responsive design.",
      status: "pending",
      isSelected: false,
    },
  ],
  timeline: [
    { id: "t1", timestamp: "00:01:20", label: "Session started", type: "note" },
    { id: "t2", timestamp: "00:02:45", label: "Q1 — React performance", type: "question" },
    { id: "t3", timestamp: "00:06:10", label: "Q2 — Tailwind CSS", type: "question" },
    { id: "t4", timestamp: "00:09:00", label: "Highlight: strong answer on hooks", type: "highlight" },
  ],
  meetingNote: {
    id: "mn1",
    date: "Jul 10, 2025",
    category: "Hiring",
    participants: ["Mrs. Tania Shahira", "Regina Tanya"],
    aiSummary:
      "Mrs. Tania Shahira and Regina Tanya led the hiring meeting to finalize the interview structure for the Frontend Developer position. The discussion covered candidate evaluation methods, role expectations, and feedback alignment across the panel. They agreed to streamline the hiring flow by merging the technical screening and live coding session.",
  },
};

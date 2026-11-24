import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pageBg: "#E8EAF6",
        surface: "#FFFFFF",
        navBg: "#FFFFFF",
        primary: "#6366F1",
        primaryLight: "#EEF0FF",
        success: "#22C55E",
        danger: "#EF4444",
        textPrimary: "#1E1B4B",
        textSecondary: "#6B7280",
        textMuted: "#9CA3AF",
        border: "#E5E7EB",
        badgeBg: "#F3F4F6",
        liveRed: "#EF4444",
        recordingGray: "#6B7280",
      },
      borderRadius: {
        workspace: "20px",
        card: "16px",
        button: "9999px",
        control: "9999px",
        badge: "8px",
        tab: "8px",
        summaryCard: "12px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.06)",
        panel: "0 4px 24px rgba(99, 102, 241, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

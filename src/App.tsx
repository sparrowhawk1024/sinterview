import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { InterviewSessionPage } from "./pages/InterviewSessionPage";
import { InterviewReportPage } from "./pages/InterviewReportPage";
import { PastInterviewsPage } from "./pages/PastInterviewsPage";
import { warmupNextTurn } from "./services/modelClient";

export const App: React.FC = () => {
  useEffect(() => {
    warmupNextTurn();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/interview/:sessionId" element={<InterviewSessionPage />} />
        <Route path="/report/:sessionId" element={<InterviewReportPage />} />
        <Route path="/sessions" element={<PastInterviewsPage />} />
        <Route path="/reports" element={<Navigate to="/sessions" replace />} />
        <Route path="/analytics" element={<Navigate to="/sessions" replace />} />
        {/* Fallback to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

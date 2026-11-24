import React, { useEffect, useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopNav } from "../components/layout/TopNav";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { InterviewHeader } from "../components/interview/InterviewHeader";
import { VideoPanel } from "../components/interview/VideoPanel";
import { LiveDialogueBox } from "../components/interview/LiveDialogueBox";
import { MeetingNotesCard } from "../components/interview/MeetingNotesCard";
import { QuestionPanel } from "../components/questions/QuestionPanel";
import { AnswerHintModal } from "../components/interview/AnswerHintModal";
import { TextAnswerModal } from "../components/interview/TextAnswerModal";
import { LiveTelemetryHUD } from "../components/interview/LiveTelemetryHUD";
import { BodyLanguagePanel } from "../components/interview/BodyLanguagePanel";
import { useBodyLanguage, BodySummary } from "../hooks/useBodyLanguage";
import { saveBodyLanguage } from "../utils/bodyLanguageStore";
import { useLiveTelemetry, visualTelemetry } from "../services/visualTelemetryService";
import { useInterviewSession } from "../hooks/useInterviewSession";
import { useRecordingTimer } from "../hooks/useRecordingTimer";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useInterviewLoop } from "../hooks/useInterviewLoop";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { saveInterviewSession } from "../services/storageService";
import { generateInterviewSummaryWithModel, evaluateAnswerWithModel } from "../services/modelClient";
import { PersistedInterviewSession } from "../types";
import { CheckCircle, Sparkles } from "lucide-react";

export const InterviewSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId = "session-001" } = useParams<{ sessionId: string }>();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const {
    session,
    isModelOnline,
    isEvaluating,
    ollamaStatus,
    cosyVoiceStatus,
    selectQuestion,
    toggleMic,
    toggleCamera,
    stopRecording,
    startRecording,
    markAnswered,
    addQuestions,
    insertFollowUpQuestion,
    setPersona,
    evaluateQuestion,
    regenerateSummary,
    toastMessage,
    triggerToast,
  } = useInterviewSession(sessionId);

  const { formattedTime } = useRecordingTimer(
    session.isRecording,
    session.recordingDuration
  );

  // Active question currently focused
  const activeQuestion =
    session.questions.find((q) => q.isSelected) || session.questions[0];

  // Neural / Browser Text-To-Speech engine
  const tts = useTextToSpeech();

  // Modals state (Hints & Text Answers from synterview_mark2)
  const [isHintModalOpen, setIsHintModalOpen] = useState(false);
  const [isTextAnswerModalOpen, setIsTextAnswerModalOpen] = useState(false);

  // Live Speech Recognition & Audio Volume Detection for Candidate
  const {
    transcript: candidateTranscript,
    interimTranscript,
    isListening,
    isCandidateSpeaking,
    volumeLevel,
    isSupported: isSpeechSupported,
    permissionState,
    errorMessage,
    startListening,
    stopListening,
    setTranscript: setCandidateTranscript,
    resetTranscript: resetCandidateTranscript,
  } = useSpeechRecognition({
    isMuted: session.candidate.isMuted,
  });

  // Candidate video element reference shared between VideoPanel and MediaPipe
  const candidateVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const bodyLanguageSummariesRef = React.useRef<BodySummary[]>([]);

  // Real-time MediaPipe Vision Pipeline (FaceLandmarker blendshapes & PoseLandmarker shoulder tilt)
  const {
    status: bodyLanguageStatus,
    live: bodyLanguageLive,
    faceDetected: bodyLanguageFaceDetected,
    tip: bodyLanguageTip,
    takeAnswerSummary,
    getSessionSummary,
  } = useBodyLanguage({
    videoRef: candidateVideoRef,
    enabled: session.candidate.isCameraOn,
    collecting: isCandidateSpeaking,
  });

  // Live Multimodal Behavioral Telemetry (Confidence, Posture, Eye Contact)
  const liveTelemetry = useLiveTelemetry(
    isCandidateSpeaking,
    volumeLevel,
    session.candidate.isCameraOn
  );

  const finishAndOpenReport = useCallback(async () => {
    tts.cancel();
    stopRecording();
    setIsGeneratingReport(true);
    triggerToast("Ollama is analyzing session & generating final report...");
    try {
      // 1. Commit active question transcript if answered
      const currentText = (candidateTranscript + (interimTranscript ? " " + interimTranscript : "")).trim();
      let questionsToSummarize = [...session.questions];
      if (activeQuestion && currentText && !activeQuestion.candidateAnswer) {
        questionsToSummarize = questionsToSummarize.map((q) =>
          q.id === activeQuestion.id
            ? { ...q, candidateAnswer: currentText, status: "answered" }
            : q
        );
      }

      // 2. Pre-evaluate any answered questions that don't have Ollama rubric evaluations yet
      for (let i = 0; i < questionsToSummarize.length; i++) {
        const q = questionsToSummarize[i];
        if (q.status === "answered" && q.candidateAnswer && !q.aiEvaluation) {
          try {
            const evalResult = await evaluateAnswerWithModel(q.id, q.text, q.candidateAnswer);
            questionsToSummarize[i] = {
              ...q,
              aiEvaluation: evalResult,
            };
          } catch (e) {
            console.warn("[FinishReport] Pre-summary Ollama evaluation error:", e);
          }
        }
      }

      // 3. Collect real visual telemetry from the session
      const visualData = visualTelemetry.stopSampling();
      const sessionBL = getSessionSummary();

      // Save client-side body language history for report rendering
      saveBodyLanguage(session.id, {
        answers: bodyLanguageSummariesRef.current,
        session: sessionBL,
      });

      const isCameraActive = session.candidate.isCameraOn && (
        (sessionBL && sessionBL.samples > 0) ||
        visualData.face_in_frame_ratio > 0 ||
        visualData.head_yaw_mean !== 0
      );

      // 4. Generate comprehensive final report via Ollama (qwen2.5-coder:7b)
      const summary = await generateInterviewSummaryWithModel(
        session.id,
        "Frontend Developer",
        session.candidate.name,
        questionsToSummarize
      );

      const visualSummary = {
        camera_enabled: isCameraActive,
        face_in_frame_ratio: sessionBL ? sessionBL.facePresentPct / 100 : visualData.face_in_frame_ratio,
        average_posture_score: isCameraActive
          ? (sessionBL?.posture ?? Math.min(98, Math.max(65, Math.round(94 - Math.abs(visualData.head_roll_mean) * 1.5))))
          : null,
        average_eye_contact_score: isCameraActive
          ? (sessionBL?.eyeContact ?? Math.min(98, Math.max(65, Math.round(92 - Math.abs(visualData.gaze_proxy_ratio - 0.5) * 75))))
          : null,
        posture_interpretation: isCameraActive
          ? "Upright, balanced posture and shoulder alignment across responses"
          : "Camera was turned off (No video telemetry captured)",
        eye_contact_interpretation: isCameraActive
          ? "Consistent lens engagement and forward-facing gaze during technical explanations"
          : "Camera was turned off (No optical telemetry)",
        visual_quality_qv: isCameraActive ? (visualData.q_v || 0.95) : 0.0,
        is_valid: isCameraActive,
        status_label: isCameraActive ? "Verified Camera-Based Indicators" : "Offline / Insufficient Evidence (Camera Off)",
        head_yaw_mean: visualData.head_yaw_mean,
        head_pitch_mean: visualData.head_pitch_mean,
        head_roll_mean: visualData.head_roll_mean,
        movement_energy: visualData.movement_energy,
      };

      summary.visual_summary = visualSummary;

      const persisted: PersistedInterviewSession = {
        id: session.id,
        createdAt: new Date().toISOString(),
        title: session.title,
        role: "Frontend Developer",
        candidate: session.candidate,
        interviewer: session.interviewer,
        questions: questionsToSummarize,
        report: summary,
        recordingDuration: session.recordingDuration || 300,
        saveAudioForTraining: false,
        overallScore: summary.overall_score,
        averagePace: summary.acoustic_summary.avg_speech_rate_wpm,
        averageFillers: summary.acoustic_summary.total_filler_words,
        averagePauseRatio: summary.acoustic_summary.avg_pause_ratio,
      };

      await saveInterviewSession(persisted);
      navigate(`/report/${session.id}`);
    } catch (err) {
      console.warn("Failed to generate and save report:", err);
      navigate(`/report/${session.id}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [session, activeQuestion, candidateTranscript, interimTranscript, stopRecording, triggerToast, navigate, tts]);

  // Auto-Advancing 1-on-1 Interview Loop State Machine
  const {
    phase: loopPhase,
    isLoopActive,
    currentAiReaction,
    startLoop,
    stopLoop,
    markDone,
    bargeIn,
    saveAudioForTraining,
    setSaveAudioForTraining,
    isRecordingAudio,
  } = useInterviewLoop({
    questions: session.questions,
    selectQuestion,
    evaluateQuestion,
    markAnswered,
    insertFollowUpQuestion,
    startListening,
    stopListening,
    resetTranscript: resetCandidateTranscript,
    transcript: candidateTranscript,
    interimTranscript,
    isCandidateSpeaking,
    isListening,
    persona: session.persona || "friendly",
    onLoopComplete: finishAndOpenReport,
  });

  // Speak AI reactions or questions aloud when phase triggers
  useEffect(() => {
    if (isLoopActive && currentAiReaction && !tts.isSpeaking) {
      tts.speak(currentAiReaction);
    }
  }, [currentAiReaction, isLoopActive]);

  const handleTextAnswerSubmit = (text: string) => {
    setCandidateTranscript(text);
    if (activeQuestion) {
      evaluateQuestion(activeQuestion.id, text);
      markDone();
      triggerToast("Typed response submitted successfully!");
    }
  };

  return (
    <WorkspaceShell>
      {/* 1. Top Navigation Bar */}
      <TopNav />

      {/* 2. Page Level Header */}
      <InterviewHeader
        title={session.title}
        subtitle={session.subtitle}
        isRecording={session.isRecording}
        recordingTime={formattedTime}
        isModelOnline={isModelOnline}
        ollamaStatus={ollamaStatus}
        cosyVoiceStatus={cosyVoiceStatus}
        onStopRecording={stopRecording}
        onStartRecording={startRecording}
        onViewReport={finishAndOpenReport}
      />

      {/* 3. Main Two-Column Content Area */}
      <main className="p-4 sm:p-6 w-full">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-stretch">
          {/* Left Column (~62% width on desktop): Video Panel + Live Dialogue Box + Meeting Notes */}
          <div className="w-full lg:w-[62%] flex flex-col justify-start space-y-4">
            {/* Live Video Call Interface with Animated Avatar, Blinking, Lip Sync & Voice Selector */}
            <VideoPanel
              interviewer={session.interviewer}
              candidate={session.candidate}
              videoRef={candidateVideoRef}
              onToggleMic={toggleMic}
              onToggleCamera={toggleCamera}
              onEndCall={() => {
                tts.cancel();
                stopLoop();
                finishAndOpenReport();
              }}
              isCandidateSpeaking={isCandidateSpeaking}
              candidateLiveText={interimTranscript || candidateTranscript}
              activeAiText={activeQuestion?.text}
              voiceGender={tts.voiceGender}
              voiceAccent={tts.accent}
              onGenderChange={tts.setVoiceGender}
              onAccentChange={tts.setAccent}
              speechLevel={tts.speechLevel}
              onOpenHintModal={() => setIsHintModalOpen(true)}
              onOpenTextAnswerModal={() => setIsTextAnswerModalOpen(true)}
              telemetry={liveTelemetry}
            />

            {/* Live Multimodal Behavioral Telemetry (MediaPipe Face & Pose Tracking) */}
            <BodyLanguagePanel
              status={bodyLanguageStatus}
              live={bodyLanguageLive}
              faceDetected={bodyLanguageFaceDetected}
              tip={bodyLanguageTip}
              cameraOn={session.candidate.isCameraOn}
            />

            {/* Live Interview Dialogue & Speech-to-Text Box */}
            <LiveDialogueBox
              activeQuestion={activeQuestion}
              candidateMuted={session.candidate.isMuted}
              onToggleMic={toggleMic}
              candidateTranscript={candidateTranscript}
              interimTranscript={interimTranscript}
              isCandidateSpeaking={isCandidateSpeaking}
              isListening={isListening}
              volumeLevel={volumeLevel}
              isSpeechSupported={isSpeechSupported}
              permissionState={permissionState}
              errorMessage={errorMessage}
              onStartListening={startListening}
              onStopListening={stopListening}
              onUpdateTranscript={setCandidateTranscript}
              onResetTranscript={resetCandidateTranscript}
              onEvaluateAnswer={(qId, text) => evaluateQuestion(qId, text)}
              isEvaluating={isEvaluating}
              loopPhase={loopPhase}
              isLoopActive={isLoopActive}
              onStartLoop={startLoop}
              onStopLoop={stopLoop}
              onMarkDone={markDone}
              onBargeIn={bargeIn}
              persona={session.persona || "friendly"}
              onSetPersona={setPersona}
              currentAiReaction={currentAiReaction}
              saveAudioForTraining={saveAudioForTraining}
              onToggleSaveAudioForTraining={setSaveAudioForTraining}
              isRecordingAudio={isRecordingAudio}
            />

            {/* Post-Meeting Summary & Candidate Notes */}
            <MeetingNotesCard
              note={session.meetingNote}
              jobTitle="Frontend Developer"
              onRegenerateSummary={regenerateSummary}
            />
          </div>

          {/* Right Column (~38% width on desktop): Question & Timeline Panel */}
          <div className="w-full lg:w-[38%] flex flex-col min-h-[500px]">
            <QuestionPanel
              questions={session.questions}
              timeline={session.timeline}
              onSelectQuestion={selectQuestion}
              onMarkAnswered={markAnswered}
              onEvaluateQuestion={evaluateQuestion}
              onAddQuestions={addQuestions}
              isEvaluating={isEvaluating}
              ollamaStatus={ollamaStatus}
            />
          </div>
        </div>
      </main>

      {/* 4. Modals */}
      <AnswerHintModal
        isOpen={isHintModalOpen}
        onClose={() => setIsHintModalOpen(false)}
        questionText={activeQuestion?.text || ""}
        idealAnswerPoints={activeQuestion?.idealAnswerPoints}
      />

      <TextAnswerModal
        isOpen={isTextAnswerModalOpen}
        onClose={() => setIsTextAnswerModalOpen(false)}
        onSubmitText={handleTextAnswerSubmit}
        questionText={activeQuestion?.text || ""}
      />

      {/* 5. Report Generation Fullscreen Overlay */}
      {isGeneratingReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 animate-fadeIn">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-border flex flex-col items-center text-center text-textPrimary">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-textPrimary">Calculating Evaluation Report</h3>
            <p className="text-sm text-textSecondary mb-6">
              Evaluating candidate transcripts with Ollama, compiling 5-dimension rubric scores, acoustic pacing, and vision telemetry metrics...
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
              <div className="h-full bg-primary rounded-full animate-pulse w-3/4" />
            </div>
            <span className="text-xs text-textTertiary font-medium">Please do not close this window</span>
          </div>
        </div>
      )}

      {/* 6. Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-gray-900/95 text-white text-xs sm:text-sm px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 backdrop-blur-md border border-white/10 transition-all transform animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </WorkspaceShell>
  );
};

import React, { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MainLayout from "@/components/layout/MainLayout";
import MeetingWorkspace from "@/components/meeting/MeetingWorkspace";
import CallTimer from "@/components/meeting/CallTimer";
import MeetingControls from "@/components/MeetingControls";
const MeetingDialogsManager = lazy(() => import("@/components/meeting/MeetingDialogsManager"));
import { MeetingProvider, useMeetingContext } from "@/components/meeting/MeetingProvider";
import { useMeetingPageLogic } from "@/hooks/useMeetingPageLogic";
import { TranscriptionWSStatus } from "@/hooks/useTranscriptionWebSocket";
const StartCallDialog = lazy(() => import("@/components/meeting/StartCallDialog").then(module => ({ default: module.StartCallDialog })));

const MeetingPageContent = () => {
  const {
    user,
    isCreatingMeeting,
    isSavingMeeting,
    webRTCStream,
    wsStatus,
    wsError,
    liveTranscript,
    fullTranscript,
    isStreaming,
    reconnectTranscription,
    insights,
    clientEmotion,
    clientInterest,
    callStage,
    aiCoachingSuggestion,
    lastGeminiResponse
  } = useMeetingContext();

  const {
    isCallActive,
    callType,
    uiCallDuration,
    setUiCallDuration,
    showControls,
    setShowControls,
    showMeetingDialog,
    showEndCallConfirmation,
    showStartCallDialog,
    handleShowStartCallDialog,
    handleCloseStartCallDialog,
    handleStartCall,
    handleCloseMeetingDialog,
    handleEndCall,
    handleConfirmEndCall,
    handleSaveMeeting,
    setShowEndCallConfirmation,
    fullTranscript: formattedTranscript,
    summary,
    insights: formattedInsights,
    savingProgress
  } = useMeetingPageLogic();

  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <Button onClick={() => navigate("/auth")}>Sign In to Continue</Button>
        </div>
      </div>
    );
  }

  console.log('MeetingPage: Rendering with state:', {
    isCallActive,
    hasWebRTCStream: !!webRTCStream,
    webRTCStreamActive: webRTCStream?.active,
    isScreenSharing: !!webRTCStream,
    fullSentences: fullTranscript ? fullTranscript.split('\n').filter(Boolean) : [],
    liveTranscript,
    insights,
    clientEmotion,
    clientInterest,
    callStage,
    aiCoachingSuggestion,
    lastGeminiResponse
  });

  // Parse full sentences from the transcript
  const fullSentences = fullTranscript ? fullTranscript.split('\n').filter(Boolean) : [];

  return (
    <MainLayout>
      <div className="relative">
        <MeetingWorkspace
          isCallActive={isCallActive}
          transcript={formattedTranscript}
          insights={insights}
          realtimeText={liveTranscript}
          fullSentences={fullSentences}
          transcriptionStatus={wsStatus as TranscriptionWSStatus}
          transcriptionError={wsError}
          onReconnectTranscription={reconnectTranscription}
          stream={webRTCStream}
          clientEmotion={clientEmotion}
          clientInterest={clientInterest}
          callStage={callStage}
          aiCoachingSuggestion={aiCoachingSuggestion}
          lastGeminiResponse={lastGeminiResponse}
          className={`transition-all duration-300 ${
            isCallActive && !showControls 
              ? "h-screen" 
              : "h-[calc(100vh-56px)]"
          }`}
        />
        
        <CallTimer
          isActive={isCallActive}
          onDurationChange={setUiCallDuration}
        />
        
        {/* Indicator when controls are hidden */}
        {isCallActive && !showControls && (
          <div 
            className="fixed bottom-0 left-0 right-0 h-1 bg-primary/20 z-10 cursor-pointer"
            onClick={() => setShowControls(true)}
          >
            <div className="w-20 h-1 mx-auto bg-primary/40 rounded-t"></div>
          </div>
        )}
        
        {/* Controls bar with autohide */}
        <div 
          className={`bg-card border-t border-border fixed bottom-0 left-0 right-0 py-2 px-4 shadow-md z-10 transition-transform duration-300 ${
            isCallActive && !showControls ? 'translate-y-full' : 'translate-y-0'
          }`}
        >
          <MeetingControls
            isCallActive={isCallActive}
            isCreatingMeeting={isCreatingMeeting}
            isSavingMeeting={isSavingMeeting}
            onShowStartCallDialog={handleShowStartCallDialog}
            onEndCall={handleEndCall}
            callType={callType}
            callDuration={uiCallDuration}
          />
          <div className="text-xs text-center text-muted-foreground mt-1">
            {wsStatus === 'connected' && isStreaming ? (
              <span className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-green-500">Connected</span>
              </span>
            ) : wsStatus === 'error' ? (
              <span className="text-red-500">Transcription error - reconnect to try again</span>
            ) : wsStatus === 'connecting' ? (
              <span className="flex items-center justify-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                Reconnecting...
              </span>
            ) : (
              <span>Transcription ready</span>
            )}
          </div>
        </div>
      </div>
      
      <Suspense fallback={null}>
        <MeetingDialogsManager
          showMeetingDialog={showMeetingDialog}
          showEndCallConfirmation={showEndCallConfirmation}
          onCloseMeetingDialog={handleCloseMeetingDialog}
          onCloseEndCallConfirmation={() => setShowEndCallConfirmation(false)}
          onConfirmEndCall={handleConfirmEndCall}
          onSaveMeeting={handleSaveMeeting}
          transcript={formattedTranscript}
          summary={summary}
          insights={formattedInsights}
          saveProgress={savingProgress}
        />
      </Suspense>

      <Suspense fallback={null}>
        <StartCallDialog
          open={showStartCallDialog}
          onOpenChange={(open) => !open && handleCloseStartCallDialog()}
          onSubmit={handleStartCall}
        />
      </Suspense>
    </MainLayout>
  );
};

const MeetingPage = () => {
  return (
    <MeetingProvider>
      <MeetingPageContent />
    </MeetingProvider>
  );
};

export default MeetingPage;

import React, { createContext, useContext, ReactNode, useState } from 'react';
import { useMeetingState } from '@/hooks/use-meeting-state';
import { useCallManager } from '@/hooks/useCallManager';
import { useAuth } from '@/contexts/AuthContext';
import { CallDetails } from '@/components/meeting/StartCallDialog';

interface MeetingContextValue {
  // Meeting state
  activeMeeting: any;
  isCreatingMeeting: boolean;
  isSavingMeeting: boolean;
  savingProgress: number;
  startMeeting: (type: string) => Promise<void>;
  endMeeting: (transcript: string, summary: string, insights: any[]) => Promise<string | null>;
  updateMeeting: (id: string, data: any) => Promise<void>;
  setActiveMeeting: (meeting: any) => void;

  // AI insights
  insights: {
    emotions: Array<{ emotion: string; level: number }>;
    painPoints: string[];
    objections: string[];
    buyingSignals: string[];
    recommendations: string[];
    closingTechniques: string[];
    nextActions: string[];
  };
  generateSummary: () => string;
  
  // Client state from webhook
  clientEmotion: string;
  clientInterest: number;
  closingPotential: number;
  callStage: string;
  aiCoachingSuggestion: string;
  
  // Gemini response for transcribed sentences
  lastGeminiResponse: string | null;

  // Call manager
  isScreenSharing: boolean;
  webRTCStream: MediaStream | null;
  webRTCError: string | null;
  wsStatus: string;
  wsError: string | null;
  liveTranscript: string;
  fullTranscript: string | null;
  isStreaming: boolean;
  reconnectAttempts: number;
  connectionTimedOut: boolean;
  setConnectionTimedOut: (value: boolean) => void;
  startCall: (callType: string, startMeeting: (type: string) => Promise<void>, user: any, details: CallDetails) => Promise<void>;
  endCall: () => void;
  reconnectTranscription: () => void;
  handleConnectionTimeout: () => void;
  micStreamRef: React.MutableRefObject<MediaStream | null>;
  systemStreamRef: React.MutableRefObject<MediaStream | null>;

  // Auth
  user: any;
}

const MeetingContext = createContext<MeetingContextValue | undefined>(undefined);

export function useMeetingContext(): MeetingContextValue {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error("useMeetingContext must be used within a MeetingProvider");
  }
  return context;
}

interface MeetingProviderProps {
  children: ReactNode;
}

export const MeetingProvider = ({ children }: MeetingProviderProps) => {
  const { user } = useAuth();
  
  const {
    activeMeeting,
    isCreatingMeeting,
    isSavingMeeting,
    savingProgress,
    startMeeting,
    endMeeting,
    updateMeeting,
    setActiveMeeting
  } = useMeetingState();
  
  const callManager = useCallManager();

  // Generate summary from insights
  const generateSummary = () => {
    const currentInsights = callManager.insights;
    
    if (!currentInsights || (!currentInsights.painPoints?.length && !currentInsights.recommendations?.length)) {
      return "AI-generated summary will appear here after the call has some transcript data.";
    }
    
    let summary = "Meeting Summary:\n\n";
    
    if (currentInsights.painPoints?.length > 0) {
      summary += "Key Pain Points:\n";
      currentInsights.painPoints.forEach((point: string, index: number) => {
        summary += `${index + 1}. ${point}\n`;
      });
      summary += "\n";
    }
    
    if (currentInsights.recommendations?.length > 0) {
      summary += "Recommendations:\n";
      currentInsights.recommendations.forEach((rec: string, index: number) => {
        summary += `${index + 1}. ${rec}\n`;
      });
      summary += "\n";
    }
    
    if (currentInsights.nextActions?.length > 0) {
      summary += "Next Actions:\n";
      currentInsights.nextActions.forEach((action: string, index: number) => {
        summary += `${index + 1}. ${action}\n`;
      });
    }
    
    return summary;
  };

  const value: MeetingContextValue = {
    // Meeting state
    activeMeeting,
    isCreatingMeeting,
    isSavingMeeting,
    savingProgress,
    startMeeting,
    endMeeting,
    updateMeeting,
    setActiveMeeting,

    // AI insights
    insights: callManager.insights,
    generateSummary,
    
    // Client state from webhook
    clientEmotion: callManager.clientEmotion,
    clientInterest: callManager.clientInterest,
    closingPotential: callManager.closingPotential,
    callStage: callManager.callStage,
    aiCoachingSuggestion: callManager.aiCoachingSuggestion,
    
    // Gemini response
    lastGeminiResponse: callManager.lastGeminiResponse,

    // Call manager - explicitly list all properties instead of using spread
    isScreenSharing: callManager.isScreenSharing,
    webRTCStream: callManager.webRTCStream,
    webRTCError: callManager.webRTCError,
    wsStatus: callManager.wsStatus,
    wsError: callManager.wsError,
    liveTranscript: callManager.liveTranscript,
    fullTranscript: callManager.fullTranscript,
    isStreaming: callManager.isStreaming,
    reconnectAttempts: callManager.reconnectAttempts,
    connectionTimedOut: callManager.connectionTimedOut,
    setConnectionTimedOut: callManager.setConnectionTimedOut,
    startCall: callManager.startCall,
    endCall: callManager.endCall,
    reconnectTranscription: callManager.reconnectTranscription,
    handleConnectionTimeout: callManager.handleConnectionTimeout,
    micStreamRef: callManager.micStreamRef,
    systemStreamRef: callManager.systemStreamRef,

    // Auth
    user
  };

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  );
};

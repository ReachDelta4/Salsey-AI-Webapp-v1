import { useCallback, useEffect, useState } from 'react';
import { useWebRTC } from './useWebRTC';
import { useTranscriptionWebSocket } from './useTranscriptionWebSocket';

interface UseMeetingStreamsResult {
  // WebRTC state
  isScreenSharing: boolean;
  isAudioEnabled: boolean;
  stream: MediaStream | null;
  webrtcError: string | null;
  
  // Transcription state
  transcriptionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  transcriptionError: string | null;
  realtimeText: string;
  fullSentences: string[];
  
  // Actions
  startMeeting: () => Promise<MediaStream | null>;
  stopMeeting: () => void;
  reconnectTranscription: () => void;
}

/**
 * Hook that combines WebRTC and transcription WebSocket functionality for meetings
 */
export function useMeetingStreams(): UseMeetingStreamsResult {
  const [isActive, setIsActive] = useState(false);
  
  // WebRTC hook for screen sharing and audio
  const {
    isScreenSharing,
    isAudioEnabled,
    stream,
    error: webrtcError,
    startScreenShare,
    stopScreenShare
  } = useWebRTC();
  
  // WebSocket hook for real-time transcription
  const {
    status: transcriptionStatus,
    error: transcriptionError,
    realtimeText,
    fullSentences,
    connect: connectTranscription,
    disconnect: disconnectTranscription
  } = useTranscriptionWebSocket({
    // Provide a no-op function for sentence processing
    onProcessSentence: (sentence) => {
      // This component doesn't need to process sentences
      console.log('useMeetingStreams: Received sentence but not processing:', sentence);
    }
  });
  
  // Start meeting: start screen sharing and connect to transcription service
  const startMeeting = useCallback(async () => {
    try {
      const mediaStream = await startScreenShare();
      setIsActive(true);
      connectTranscription();
      return mediaStream;
    } catch (error) {
      setIsActive(false);
      return null;
    }
  }, [startScreenShare, connectTranscription]);
  
  // Stop meeting: stop screen sharing and disconnect from transcription service
  const stopMeeting = useCallback(() => {
    stopScreenShare();
    disconnectTranscription();
    setIsActive(false);
  }, [stopScreenShare, disconnectTranscription]);
  
  // Reconnect transcription service
  const reconnectTranscription = useCallback(() => {
    if (isActive) {
      disconnectTranscription();
      connectTranscription();
    }
  }, [isActive, connectTranscription, disconnectTranscription]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      stopScreenShare();
      disconnectTranscription();
    };
  }, [stopScreenShare, disconnectTranscription]);
  
  return {
    // WebRTC state
    isScreenSharing,
    isAudioEnabled,
    stream,
    webrtcError,
    
    // Transcription state
    transcriptionStatus,
    transcriptionError,
    realtimeText,
    fullSentences,
    
    // Actions
    startMeeting,
    stopMeeting,
    reconnectTranscription
  };
} 
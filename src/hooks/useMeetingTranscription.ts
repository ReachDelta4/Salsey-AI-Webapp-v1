import { useTranscriptionWebSocket } from "@/hooks/useTranscriptionWebSocket";

export const useMeetingTranscription = () => {
  const {
    fullTranscript,
    realtimeText,
    fullSentences,
    status: transcriptionStatus,
    error: transcriptionError,
    connect: connectTranscription,
    disconnect: disconnectTranscription,
  } = useTranscriptionWebSocket({
    // Provide a no-op function for sentence processing
    onProcessSentence: (sentence) => {
      // This component doesn't need to process sentences
      console.log('useMeetingTranscription: Received sentence but not processing:', sentence);
    }
  });

  return {
    fullTranscript,
    realtimeText,
    fullSentences,
    transcriptionStatus,
    transcriptionError,
    connectTranscription,
    disconnectTranscription,
  };
};

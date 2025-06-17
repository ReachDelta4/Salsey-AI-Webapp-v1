import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMixedAudioWebSocket } from '@/hooks/useMixedAudioWebSocket';
import { useTranscriptionWebSocket } from '@/hooks/useTranscriptionWebSocket';
import { useNotesState } from '@/hooks/use-notes-state';
import { useMeetingState } from '@/hooks/use-meeting-state';
import GeminiClient from '@/integrations/gemini/GeminiClient';
import { ChatSession } from '@google/generative-ai';
import { CallDetails } from '@/components/meeting/StartCallDialog';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/integrations/gemini/SystemPrompts';

export const useCallManager = () => {
  const { toast } = useToast();
  const { activeMeeting } = useMeetingState();
  const {
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    stream: webRTCStream,
    error: webRTCError
  } = useWebRTC();

  const {
    status: wsStatus,
    error: wsError,
    liveTranscript,
    fullTranscript,
    isStreaming,
    connect: connectMixedAudio,
    disconnect: disconnectMixedAudio,
    reconnectAttempts,
    setAutoReconnect
  } = useMixedAudioWebSocket();

  // This ref will hold the persistent chat session for the duration of the call
  const chatSessionRef = useRef<ChatSession | null>(null);

  // Get notes directly from useNotesState for active monitoring
  const meetingId = activeMeeting?.id || null;
  const { markdown, checklist, questions } = useNotesState(meetingId, activeMeeting);

  // This function will be called by the WebSocket hook when a sentence is ready
  const handleFinalizedSentence = useCallback(async (sentence: string) => {
    if (!chatSessionRef.current) {
      console.error("CallManager: Chat session not initialized. Cannot process sentence.");
      return;
    }
    if (!sentence || sentence.trim() === "") {
      return; // Ignore empty sentences
    }

    // Normalize the sentence for comparison
    const normalizedSentence = sentence.trim().toLowerCase();
    
    // Check if we've already processed this exact sentence
    if (lastSentenceRef.current === normalizedSentence) {
      console.log("CallManager: Skipping duplicate sentence:", sentence);
      return;
    }
    
    console.log("CallManager: Processing finalized sentence:", sentence);
    try {
      // Update last sentence reference before API call to prevent race conditions
      lastSentenceRef.current = normalizedSentence;
      
      const jsonResponse = await GeminiClient.sendMessageInSession(chatSessionRef.current, sentence);
      const parsedInsights = JSON.parse(jsonResponse);

      if (parsedInsights.error) {
        console.warn('CallManager: Gemini response was an error:', parsedInsights);
        return;
      }

      console.log('CallManager: Successfully parsed insights from Gemini session.', parsedInsights);
      
      // Selectively update insights state based on what's present in the response
      if (parsedInsights.emotions) {
        setInsights(prevInsights => ({ ...prevInsights, emotions: parsedInsights.emotions }));
      }
      if (parsedInsights.painPoints) {
        setInsights(prevInsights => ({ ...prevInsights, painPoints: parsedInsights.painPoints }));
      }
      if (parsedInsights.objections) {
        setInsights(prevInsights => ({ ...prevInsights, objections: parsedInsights.objections }));
      }
      if (parsedInsights.buyingSignals) {
        setInsights(prevInsights => ({ ...prevInsights, buyingSignals: parsedInsights.buyingSignals }));
      }
      if (parsedInsights.recommendations) {
        setInsights(prevInsights => ({ ...prevInsights, recommendations: parsedInsights.recommendations }));
      }
      if (parsedInsights.closingTechniques) {
        setInsights(prevInsights => ({ ...prevInsights, closingTechniques: parsedInsights.closingTechniques }));
      }
      if (parsedInsights.nextActions) {
        setInsights(prevInsights => ({ ...prevInsights, nextActions: parsedInsights.nextActions }));
      }
      
      // Update other states only if they're present in the response
      if (parsedInsights.clientEmotion) {
        setClientEmotion(parsedInsights.clientEmotion);
      }
      if (parsedInsights.clientInterest !== undefined) {
        setClientInterest(parsedInsights.clientInterest);
      }
      if (parsedInsights.closingPotential !== undefined) {
        setClosingPotential(parsedInsights.closingPotential);
      }
      if (parsedInsights.callStage) {
        setCallStage(parsedInsights.callStage);
      }
      
      // Simply update coaching suggestion if it's present - rely on Gemini's intelligence
      if (parsedInsights.aiCoachingSuggestion) {
        setAiCoachingSuggestion(parsedInsights.aiCoachingSuggestion);
      }

    } catch (error) {
      console.error('CallManager: Failed to process sentence or parse response:', error);
    }
  }, []); // Empty dependency array as it uses refs and client singleton

  // Transcription and Gemini processing
  const {
    connect: connectTranscription,
    disconnect: disconnectTranscription
  } = useTranscriptionWebSocket({
    onProcessSentence: handleFinalizedSentence
  });

  // State for insights
  const [insights, setInsights] = useState({
    emotions: [],
    painPoints: [],
    objections: [],
    buyingSignals: [],
    recommendations: [],
    closingTechniques: [],
    nextActions: []
  });
  
  const [clientEmotion, setClientEmotion] = useState<string>("");
  const [clientInterest, setClientInterest] = useState<number>(0);
  const [closingPotential, setClosingPotential] = useState<number>(0);
  const [callStage, setCallStage] = useState<string>("");
  const [aiCoachingSuggestion, setAiCoachingSuggestion] = useState<string>("");

  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  const [isProcessingSentence, setIsProcessingSentence] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const lastSentenceRef = useRef<string | null>(null);
  const sentenceQueueRef = useRef<string[]>([]);

  // Track the last processed sentence to avoid duplicates
  const [processedSentences, setProcessedSentences] = useState<Set<string>>(new Set());

  // Define extractAudioStreams before it's used in startCall
  const extractAudioStreams = useCallback((combinedStream: MediaStream) => {
    const audioTracks = combinedStream.getAudioTracks();
    
    micStreamRef.current = null;
    systemStreamRef.current = null;
    
    if (audioTracks.length === 0) {
      console.warn('No audio tracks found in the combined stream');
      micStreamRef.current = new MediaStream();
      systemStreamRef.current = new MediaStream();
      return;
    }
    
    if (audioTracks.length === 1) {
      console.log('Only one audio track found, using it for both mic and system');
      const singleTrack = audioTracks[0];
      micStreamRef.current = new MediaStream([singleTrack]);
      systemStreamRef.current = new MediaStream([singleTrack.clone()]);
      return;
    }
    
    const micTrack = audioTracks[0];
    const systemTrack = audioTracks[1];
    
    const isMicTrack = (track: MediaStreamTrack) => 
      track.label.toLowerCase().includes('microphone') || 
      track.label.toLowerCase().includes('mic');
      
    const isSystemTrack = (track: MediaStreamTrack) => 
      track.label.toLowerCase().includes('system') || 
      track.label.toLowerCase().includes('screen') ||
      track.label.toLowerCase().includes('display');
    
    if (isMicTrack(micTrack) && isSystemTrack(systemTrack)) {
      micStreamRef.current = new MediaStream([micTrack]);
      systemStreamRef.current = new MediaStream([systemTrack]);
    } else if (isMicTrack(systemTrack) && isSystemTrack(micTrack)) {
      micStreamRef.current = new MediaStream([systemTrack]);
      systemStreamRef.current = new MediaStream([micTrack]);
    } else {
      console.log('Using default track order: track[0]=mic, track[1]=system');
      micStreamRef.current = new MediaStream([micTrack]);
      systemStreamRef.current = new MediaStream([systemTrack]);
    }
    
    console.log('Extracted audio tracks:', {
      micTrack: micStreamRef.current?.getAudioTracks()[0]?.label,
      systemTrack: systemStreamRef.current?.getAudioTracks()[0]?.label
    });
  }, []);

  const handleConnectionTimeout = useCallback(() => {
    setConnectionTimedOut(true);
    toast({
      title: "Connection Issue",
      description: "Could not connect to the transcription service. You can continue, but transcription will not be available.",
      variant: "destructive",
    });
    setAutoReconnect(false);
  }, [toast, setAutoReconnect]);

  // Function to get current notes from localStorage
  const getCurrentNotes = () => {
    // Get notes from localStorage to ensure we have the most recent version
    let markdown = "";
    let checklist = [];
    let questions = [];
    
    try {
      markdown = localStorage.getItem('notes-markdown') || "";
      
      const checklistStr = localStorage.getItem('notes-checklist');
      if (checklistStr) {
        checklist = JSON.parse(checklistStr);
      }
      
      const questionsStr = localStorage.getItem('notes-questions');
      if (questionsStr) {
        questions = JSON.parse(questionsStr);
      }
    } catch (error) {
      console.error('CallManager: Error getting notes from localStorage:', error);
    }
    
    return { markdown, checklist, questions };
  };

  // Track notes for changes during a call
  const notesRef = useRef(getCurrentNotes());
  
  // Function to update the chat session with latest notes
  const updateChatSessionWithNotes = useCallback(async (forceUpdate = false) => {
    if (!chatSessionRef.current) return;
    
    // Use either direct notes from hook or localStorage
    const currentNotes = {
      markdown,
      checklist,
      questions
    };
    
    // Check if notes have changed
    const prevNotes = notesRef.current;
    const hasChanged = forceUpdate ||
      currentNotes.markdown !== prevNotes.markdown ||
      JSON.stringify(currentNotes.checklist) !== JSON.stringify(prevNotes.checklist) ||
      JSON.stringify(currentNotes.questions) !== JSON.stringify(prevNotes.questions);
    
    if (!hasChanged) return;
    
    console.log('CallManager: Notes changed during call, updating Gemini context');
    
    try {
      // Send a system message to update the context with new notes
      // We'll format this as a special system message that won't be visible in the transcript
      const formattedNotes = formatNotesForUpdate(currentNotes);
      
      // Send the notes update as a message to the existing chat session
      await GeminiClient.sendMessageInSession(
        chatSessionRef.current, 
        `[SYSTEM] Notes have been updated. Please consider the following notes for future responses:\n\n${formattedNotes}`
      );
      
      // Update our reference to the current notes
      notesRef.current = { ...currentNotes };
      
      console.log('CallManager: Successfully updated Gemini context with new notes');
    } catch (error) {
      console.error('CallManager: Failed to update Gemini context with new notes:', error);
    }
  }, [markdown, checklist, questions]);

  // Listen for direct changes to notes via hooks
  useEffect(() => {
    if (!activeMeeting || activeMeeting.status !== 'active' || !chatSessionRef.current) return;
    
    // Update if any of the notes have changed
    updateChatSessionWithNotes();
    
  }, [markdown, checklist, questions, activeMeeting, updateChatSessionWithNotes]);
  
  // Also keep the localStorage listener as a backup
  useEffect(() => {
    // Only set up listeners if we're in an active call
    if (!activeMeeting || activeMeeting.status !== 'active' || !chatSessionRef.current) return;
    
    console.log('CallManager: Setting up notes change listeners for active call');
    
    const handleStorageChange = (e) => {
      // Check if the change is related to notes
      if (e.key && (
        e.key === 'notes-markdown' || 
        e.key === 'notes-checklist' || 
        e.key === 'notes-questions'
      )) {
        updateChatSessionWithNotes(true);
      }
    };
    
    // Listen for storage events (when localStorage changes)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeMeeting, updateChatSessionWithNotes]);

  // Helper function to format notes for a mid-call update
  const formatNotesForUpdate = (notes) => {
    let formattedNotes = "";
    
    // Add markdown notes if available
    if (notes.markdown && notes.markdown.trim()) {
      formattedNotes += "## Notes\n" + notes.markdown.trim() + "\n\n";
    }
    
    // Add checklist if available
    if (notes.checklist && notes.checklist.length > 0) {
      formattedNotes += "## Checklist\n";
      notes.checklist.forEach(item => {
        formattedNotes += `- [${item.completed ? 'x' : ' '}] ${item.label}\n`;
      });
      formattedNotes += "\n";
    }
    
    // Add questions if available
    if (notes.questions && notes.questions.length > 0) {
      formattedNotes += "## Key Questions\n";
      notes.questions.forEach(question => {
        formattedNotes += `- ${question.text}\n`;
      });
      formattedNotes += "\n";
    }
    
    return formattedNotes || "No notes provided.";
  };

  const startCall = useCallback(async (callType: string, startMeeting: (type: string) => Promise<void>, user: any, details: CallDetails) => {
    if (!callType || !user) return;
    
    console.log('CallManager: Starting call process...');
    
    try {
      setConnectionTimedOut(false);
      setAutoReconnect(true);
      
      // Get current notes to include in the Gemini context
      const notes = getCurrentNotes();
      console.log('CallManager: Retrieved notes for Gemini context:', {
        hasMarkdown: !!notes.markdown,
        checklistItems: notes.checklist.length,
        questionItems: notes.questions.length
      });
      
      // Fetch user profile data
      let userProfile: UserProfile = {};
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        if (profileData) {
          userProfile.firstName = profileData.first_name;
          userProfile.lastName = profileData.last_name;
        }

        const { data: businessData, error: businessError } = await supabase
          .from('business_details')
          .select('company_name, role, industry, company_size, business_description')
          .eq('id', user.id)
          .single();

        if (businessError) throw businessError;
        if (businessData) {
          userProfile.companyName = businessData.company_name;
          userProfile.role = businessData.role;
          userProfile.industry = businessData.industry;
          userProfile.companySize = businessData.company_size;
          userProfile.businessDescription = businessData.business_description;
        }
      } catch (error) {
        console.error("CallManager: Error fetching user profile:", error);
        // Continue without profile data if it fails
      }
      
      // Store initial notes state for comparison
      notesRef.current = notes;
      
      // Initialize the stateful chat session for this call with notes
      console.log('CallManager: Initializing stateful Gemini chat session with notes and profile...');
      chatSessionRef.current = GeminiClient.startSalesAnalysisChat(details, notes, userProfile);
      console.log('CallManager: Chat session initialized with notes and profile.');
      
      // Reset sentence tracking on new call
      lastSentenceRef.current = null;
      sentenceQueueRef.current = [];
      setProcessedSentences(new Set());
      setIsProcessingSentence(false);
      
      // Reset insights to defaults
      setInsights({
        emotions: [],
        painPoints: [],
        objections: [],
        buyingSignals: [],
        recommendations: [],
        closingTechniques: [],
        nextActions: []
      });
      setClientEmotion("");
      setClientInterest(0);
      setClosingPotential(0);
      setCallStage("");
      setAiCoachingSuggestion("");
      
      console.log('CallManager: Starting meeting in database...');
      await startMeeting(callType);
      console.log('CallManager: Meeting started in database');
      
      console.log('CallManager: Requesting screen share...');
      const combinedStream = await startScreenShare();
      
      if (!combinedStream) {
        throw new Error('Failed to get screen share stream');
      }
      
      console.log('CallManager: Screen share started successfully, stream:', {
        id: combinedStream.id,
        videoTracks: combinedStream.getVideoTracks().length,
        audioTracks: combinedStream.getAudioTracks().length,
        active: combinedStream.active,
        videoTrackStates: combinedStream.getVideoTracks().map(t => ({
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });
      
      extractAudioStreams(combinedStream);
      
      // Setup microphone fallback if needed
      if (!micStreamRef.current?.getAudioTracks().length) {
        console.warn('No microphone audio track found, attempting to get mic access separately');
        try {
          const micOnlyStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          micStreamRef.current = micOnlyStream;
          console.log('CallManager: Separate microphone stream acquired');
        } catch (micError) {
          console.error('Failed to get microphone access:', micError);
          toast({
            title: "Microphone access failed",
            description: "We couldn't access your microphone. Audio transcription may be limited.",
            variant: "destructive",
          });
        }
      }

      // Connect to audio websocket
      console.log('CallManager: Connecting to audio websocket...');
      console.log('CallManager: Audio WebSocket state:', { wsStatus, reconnectAttempts });
      
      // Start a connection timeout
      const connectionTimeoutId = setTimeout(() => {
        if (wsStatus !== 'connected') {
          handleConnectionTimeout();
        }
      }, 10000);
      
      // Ensure we have valid MediaStream objects (fallback to empty streams)
      const micStreamSafe = micStreamRef.current ?? new MediaStream();
      const sysStreamSafe = systemStreamRef.current ?? new MediaStream();
      await connectMixedAudio(micStreamSafe, sysStreamSafe);
      console.log('CallManager: Connected to mixed audio WebSocket');
      
      // Also connect to the transcription WebSocket (for Gemini processing)
      connectTranscription();
      console.log('CallManager: Connected to transcription WebSocket');
      
      // Clear the timeout if we got here
      clearTimeout(connectionTimeoutId);
      
    } catch (error) {
      console.error('CallManager: Error starting call:', error);
      toast({
        title: "Call Start Failed",
        description: error instanceof Error ? error.message : "Failed to start call.",
        variant: "destructive",
      });
      
      // End the meeting in the database too (cleanup)
      try {
        console.log('CallManager: Cleaning up failed meeting...');
        // Implement cleanup logic here if needed
      } catch (cleanupError) {
        console.error('CallManager: Cleanup error:', cleanupError);
      }
    }
    
  }, [connectMixedAudio, startScreenShare, wsStatus, reconnectAttempts, toast, handleConnectionTimeout, setAutoReconnect, connectTranscription]);
  
  // End call and disconnect all streams
  const endCall = useCallback(() => {
    console.log('CallManager: Ending call...');
    
    try {
      // Stop screen share
      stopScreenShare();

      // Close WebSocket connections
      disconnectMixedAudio();
      disconnectTranscription();
      
      // Reset audio streams
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop());
        systemStreamRef.current = null;
      }
      
      // Clear the chat session reference
      chatSessionRef.current = null;
      console.log('CallManager: Gemini chat session cleared.');
      
      // Reset state
      lastSentenceRef.current = null;
      sentenceQueueRef.current = [];
      setProcessedSentences(new Set());
      setIsProcessingSentence(false);
      setConnectionTimedOut(false);
      setAutoReconnect(false);
    } catch (error) {
      console.error('CallManager: Error ending call:', error);
    }
  }, [stopScreenShare, disconnectMixedAudio, disconnectTranscription]);
  
  // Reconnect the WebSocket connection
  const reconnectTranscription = useCallback(() => {
    console.log('CallManager: Attempting to reconnect to WebSockets...');
    setConnectionTimedOut(false);
    setAutoReconnect(true);
    const micStreamSafe2 = micStreamRef.current ?? new MediaStream();
    const sysStreamSafe2 = systemStreamRef.current ?? new MediaStream();
    connectMixedAudio(micStreamSafe2, sysStreamSafe2);
    connectTranscription();
  }, [connectMixedAudio, setAutoReconnect, connectTranscription]);
  
  return {
    // WebRTC
    isScreenSharing,
    webRTCStream,
    webRTCError,
    
    // WebSocket
    wsStatus, 
    wsError,
    liveTranscript,
    fullTranscript,
    isStreaming,
    reconnectAttempts,
    
    // Call actions
    startCall,
    endCall,
    reconnectTranscription,
    
    // Refs
    micStreamRef,
    systemStreamRef,
    
    // Connection state
    connectionTimedOut,
    setConnectionTimedOut,
    handleConnectionTimeout,
    
    // AI-generated insights
    insights,
    clientEmotion,
    clientInterest,
    closingPotential,
    callStage,
    aiCoachingSuggestion,
  };
};

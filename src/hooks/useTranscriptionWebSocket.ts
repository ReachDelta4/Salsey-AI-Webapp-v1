import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";

// Connection status types
export type TranscriptionWSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Message from backend
interface BackendMessage {
  type: 'realtime' | 'fullSentence' | string;
  text?: string;
  [key: string]: unknown;
}

interface UseTranscriptionWebSocketResult {
  status: TranscriptionWSStatus;
  error: string | null;
  realtimeText: string;
  fullSentences: string[];
  fullTranscript: string;
  connect: () => void;
  disconnect: () => void;
  lastGeminiResponse: string;
  updateGeminiResponse: (response: string) => void;
}

interface TranscriptionWebSocketOptions {
  onProcessSentence?: (sentence: string) => void;
}

/**
 * React hook for managing WebSocket connection for real-time word-by-word transcription.
 *
 * Usage:
 *   const ws = useTranscriptionWebSocket();
 *   ws.connect();
 *   ws.disconnect();
 *   // Use ws.status, ws.realtimeText, ws.fullSentences, ws.error in UI
 */
export function useTranscriptionWebSocket(options?: TranscriptionWebSocketOptions): UseTranscriptionWebSocketResult {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const controlWsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<TranscriptionWSStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [realtimeText, setRealtimeText] = useState<string>('');
  const [fullSentences, setFullSentences] = useState<string[]>([]);
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const [lastGeminiResponse, setLastGeminiResponse] = useState<string>('');
  
  const { onProcessSentence } = options || {};
  const debounceTimerRef = useRef<number | null>(null);

  // Send stop command to control server
  const sendStopCommand = useCallback(() => {
    if (controlWsRef.current && controlWsRef.current.readyState === WebSocket.OPEN) {
      console.log('TranscriptionWebSocket: Sending stop command to Control server');
      
      // Format the command exactly as in the test_stt_client.py
      const stopCommand = JSON.stringify({
        type: 'command',
        command: 'stop'
      });
      
      controlWsRef.current.send(stopCommand);
      
      // Give it a small delay to send before potentially closing
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
    }
    return Promise.resolve();
  }, []);

  // Update Gemini response
  const updateGeminiResponse = useCallback((response: string) => {
    setLastGeminiResponse(response);
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('TranscriptionWebSocket: Already connected to Data server');
      return;
    }

    if (controlWsRef.current && controlWsRef.current.readyState === WebSocket.OPEN) {
      console.log('TranscriptionWebSocket: Already connected to Control server');
      return;
    }

    setStatus('connecting');
    setError(null);

    // Connect to Control server first (port 8011)
    try {
      console.log('TranscriptionWebSocket: Connecting to Control server at ws://localhost:8011');
      const controlWs = new WebSocket('ws://localhost:8011');
      controlWsRef.current = controlWs;

      controlWs.onopen = () => {
        console.log('TranscriptionWebSocket: Control connection opened.');
        // NO LONGER SENDING START COMMAND
      };

      controlWs.onclose = () => {
        console.log('TranscriptionWebSocket: Control server connection closed');
        if (status !== 'disconnected') {
          setStatus('disconnected');
        }
      };

      controlWs.onerror = (event) => {
        console.error('TranscriptionWebSocket: Control server error:', event);
        setStatus('error');
        setError('Failed to connect to transcription control service.');
        toast({
          title: "Connection Error",
          description: "Failed to connect to the transcription control service. Please try again.",
          variant: "destructive",
        });
      };

      // Now connect to the Data server (port 8012)
      try {
        console.log('TranscriptionWebSocket: Connecting to Data server at ws://localhost:8012');
        const ws = new WebSocket('ws://localhost:8012');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('TranscriptionWebSocket: Data server connection opened');
          setStatus('connected');
          
          // No need to send start command to the Data server
          // It only receives audio data
        };

        ws.onclose = () => {
          console.log('TranscriptionWebSocket: Data server connection closed');
          if (status !== 'disconnected') {
            setStatus('disconnected');
          }
        };

        ws.onerror = (event) => {
          console.error('TranscriptionWebSocket: Data server error:', event);
          setStatus('error');
          setError('Failed to connect to transcription service.');
          toast({
            title: "Connection Error",
            description: "Failed to connect to the transcription service. Please try again.",
            variant: "destructive",
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as BackendMessage;
            
            // "Golden" transcript has arrived
            if (data.type === 'completed' || data.type === 'fullSentence') {
              // 1. Clear any existing fallback timer
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              
              // 2. Process the high-quality sentence immediately
              const newSentence = data.text || '';
              setFullSentences(prev => [...prev, newSentence]);
              setFullTranscript(prev => prev + ' ' + newSentence);
              if (onProcessSentence && newSentence) {
                console.log('TranscriptionWebSocket: Processing golden sentence:', newSentence);
                onProcessSentence(newSentence);
              }
            } 
            // Real-time transcript is updating
            else if (data.type === 'realtime') {
              const currentText = data.text || '';
              setRealtimeText(currentText);
              
              // 3. Set a fallback timer if the sentence appears complete
              const trimmedText = currentText.trim();
              if (trimmedText.length > 0 && ['.', '?', '!'].some(p => trimmedText.endsWith(p))) {
                
                // If a timer isn't already running, start one
                if (!debounceTimerRef.current) {
                  console.log('TranscriptionWebSocket: Starting debounce timer for:', trimmedText);
                  debounceTimerRef.current = window.setTimeout(() => {
                    console.log('TranscriptionWebSocket: Debounce timer fired for:', trimmedText);
                    if (onProcessSentence) {
                      onProcessSentence(trimmedText);
                    }
                    debounceTimerRef.current = null; // Clear the ref after firing
                  }, 750); // 750ms delay
                }
              }
            }
          } catch (error) {
            console.error('TranscriptionWebSocket: Error parsing message:', error);
          }
        };
      } catch (error) {
        console.error('TranscriptionWebSocket: Error connecting to Data server:', error);
        setStatus('error');
        setError('Failed to connect to transcription service');
        toast({
          title: "Connection Error",
          description: "Failed to connect to the data server. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('TranscriptionWebSocket: Error connecting to Control server:', error);
      setStatus('error');
      setError('Failed to connect to transcription control service');
      toast({
        title: "Connection Error",
        description: "Failed to connect to the control server. Please try again.",
        variant: "destructive",
      });
    }
  }, [status, toast, onProcessSentence]);

  // Close WebSocket connections
  const disconnect = useCallback(() => {
    if (controlWsRef.current) {
      console.log('TranscriptionWebSocket: Closing control connection.');
      controlWsRef.current.close();
      controlWsRef.current = null;
    }
    if (wsRef.current) {
      console.log('TranscriptionWebSocket: Closing data connection.');
      wsRef.current.close();
      wsRef.current = null;
    }
    // Clear any pending timers on disconnect
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setStatus('disconnected');
    console.log('TranscriptionWebSocket: Disconnected.');
  }, []);

  // Function to normalize sentences
  const normalizeSentence = useCallback((sentence: string): string => {
    if (!sentence) return '';
    // Remove leading/trailing whitespace
    return sentence.trim();
  }, []);

  // Trigger the sentence processing
  const triggerProcessing = useCallback((sentence: string) => {
    if (onProcessSentence) {
      const normalizedSentence = normalizeSentence(sentence);
      if (normalizedSentence) {
        onProcessSentence(normalizedSentence);
      }
    }
  }, [onProcessSentence, normalizeSentence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // First try to send the stop command
      sendStopCommand().then(() => {
        // Then close both connections
        if (controlWsRef.current) {
          controlWsRef.current.close();
          controlWsRef.current = null;
        }
        
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      });
    };
  }, [sendStopCommand]);

  // Update realtime transcription
  const updateRealtimeTranscript = useCallback((text: string) => {
    setRealtimeText(text);
  }, []);

  return {
    status,
    error,
    realtimeText,
    fullSentences,
    fullTranscript,
    connect,
    disconnect,
    lastGeminiResponse,
    updateGeminiResponse,
  };
}

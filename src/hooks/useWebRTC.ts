import { useState, useCallback, useRef, useEffect } from 'react';
import { isScreenSharingSupported } from '@/lib/browser-detection';

interface WebRTCState {
  isScreenSharing: boolean;
  isAudioEnabled: boolean;
  stream: MediaStream | null;
  error: string | null;
}

export const useWebRTC = () => {
  const [state, setState] = useState<WebRTCState>({
    isScreenSharing: false,
    isAudioEnabled: false,
    stream: null,
    error: null,
  });

  // Keep a ref to the original screen stream
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Keep a ref to the latest stopScreenShare function for use in event handlers
  const stopScreenShareRef = useRef<() => void>(() => {});

  // Stop all tracks in both the combined and original screen stream
  const stopScreenShare = useCallback(() => {
    console.log("useWebRTC: Stopping screen share...");
    
    if (state.stream) {
      state.stream.getTracks().forEach(track => {
        console.log(`useWebRTC: Stopping track: ${track.kind} - ${track.label}`);
        track.stop();
      });
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        console.log(`useWebRTC: Stopping original track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      screenStreamRef.current = null;
    }
    
    setState({
      isScreenSharing: false,
      isAudioEnabled: false,
      stream: null,
      error: null,
    });
    
    console.log("useWebRTC: Screen share stopped");
  }, [state.stream]);
  stopScreenShareRef.current = stopScreenShare;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("useWebRTC: Hook unmounting, cleaning up streams");
      stopScreenShareRef.current();
    };
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream> => {
    // First, check if screen sharing is supported
    if (!isScreenSharingSupported()) {
      const errorMsg = 'Screen sharing is not supported in this browser.';
      
      setState(prev => ({ 
        ...prev, 
        error: errorMsg,
        isScreenSharing: false
      }));
      
      throw new Error(errorMsg);
    }
    
    // Always stop any existing screen share before starting a new one
    stopScreenShareRef.current();
    
    console.log("useWebRTC: Starting screen capture process...");
    
    try {
      // Clear any previous error and set loading state
      setState(prev => ({ 
        ...prev, 
        error: null,
        isScreenSharing: true // Set this immediately to show loading state
      }));
      
      console.log("useWebRTC: Requesting display media...");
      
      // Try the standard API
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Also try to capture microphone audio and combine streams
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          
          // Create a new stream that combines both screen and mic
          const combinedStream = new MediaStream();
          
          // Add all tracks from screen stream
          screenStream.getTracks().forEach(track => {
            combinedStream.addTrack(track);
          });
          
          // Add mic audio track
          micStream.getAudioTracks().forEach(track => {
            combinedStream.addTrack(track);
          });
          
        // Use the combined stream
        screenStreamRef.current = screenStream;
          
        // Set up track ended handlers
        combinedStream.getTracks().forEach(track => {
          track.onended = () => {
            console.log(`useWebRTC: Track ended: ${track.kind} - ${track.label}`);
            if (track.kind === 'video') {
              stopScreenShareRef.current();
            }
          };
        });
          
        setState({
          isScreenSharing: true,
          isAudioEnabled: true,
          stream: combinedStream,
          error: null,
            });
            
        console.log('useWebRTC: Combined screen and microphone streams successfully');
        return combinedStream;
      } catch (micError) {
        console.warn('useWebRTC: Failed to get microphone access, continuing with just screen audio:', micError);
                
        // Continue with just the screen stream
        screenStreamRef.current = screenStream;
                
        // Set up track ended handlers
                screenStream.getTracks().forEach(track => {
          track.onended = () => {
            console.log(`useWebRTC: Track ended: ${track.kind} - ${track.label}`);
            if (track.kind === 'video') {
              stopScreenShareRef.current();
            }
          };
        });
          
      setState({
        isScreenSharing: true,
          isAudioEnabled: screenStream.getAudioTracks().length > 0,
        stream: screenStream,
        error: null,
      });

      return screenStream;
      }
    } catch (err) {
      console.error('useWebRTC: Failed to start screen sharing:', err);
        
      // Update state with error
      setState({
        isScreenSharing: false,
        isAudioEnabled: false,
        stream: null,
        error: 'Failed to start screen sharing. Please try again or use a different browser.'
      });
      
      throw err;
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (!state.stream) return;
    
    const audioTracks = state.stream.getAudioTracks();
    const newEnabledState = !state.isAudioEnabled;
    
    audioTracks.forEach(track => {
      track.enabled = newEnabledState;
    });
    
    setState(prev => ({
      ...prev,
      isAudioEnabled: newEnabledState
    }));
  }, [state.stream, state.isAudioEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (state.isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      await startScreenShare();
    } catch (e) {
      console.error('Failed to toggle screen share:', e);
      // Error state is already set in startScreenShare
    }
  }, [state.isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    ...state,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    toggleAudio,
    isScreenSharingSupported: isScreenSharingSupported()
  };
};

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface EmergencySaveData {
  title: string;
  transcript: string;
  summary: string;
}

interface UseEmergencySaveProps {
  isOpen: boolean;
  onSave: (title: string, transcript: string, summary: string) => Promise<void>;
  initialTitle: string;
  initialTranscript: string;
  initialSummary: string;
}

export const useEmergencySave = ({
  isOpen,
  onSave,
  initialTitle = "New Meeting",
  initialTranscript = "",
  initialSummary = ""
}: UseEmergencySaveProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [summary, setSummary] = useState(initialSummary);
  const [autoSaveAttempted, setAutoSaveAttempted] = useState(false);
  const dataRef = useRef<EmergencySaveData>({ title, transcript, summary });

  // Keep ref updated with latest data for auto-save
  useEffect(() => {
    dataRef.current = { title, transcript, summary };
  }, [title, transcript, summary]);

  // Reset data when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || "New Meeting");
      setTranscript(initialTranscript || "");
      setSummary(initialSummary || "");
      setAutoSaveAttempted(false);
    }
  }, [isOpen, initialTitle, initialTranscript, initialSummary]);

  // Auto-save on page exit if dialog is open
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isOpen && !autoSaveAttempted) {
        e.preventDefault();
        e.returnValue = "You have unsaved meeting data. Are you sure you want to leave?";
        
        // Try to auto-save - but can't await in beforeunload
        setAutoSaveAttempted(true);
        try {
          const { title: currentTitle, transcript: currentTranscript, summary: currentSummary } = dataRef.current;
          
          // Store current data in localStorage for recovery
          const emergencyData = {
            title: currentTitle,
            transcript: currentTranscript,
            summary: currentSummary,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('meeting_end_dialog_data', JSON.stringify(emergencyData));
          
          // Use setTimeout to ensure this runs after the beforeunload handling
          setTimeout(() => {
            onSave(currentTitle, currentTranscript, currentSummary)
              .then(() => {
                // Clear emergency data if save succeeds
                localStorage.removeItem('meeting_end_dialog_data');
              })
              .catch(error => console.error("Auto-save failed:", error));
          }, 0);
        } catch (error) {
          console.error("Auto-save setup failed:", error);
        }
        
        return e.returnValue;
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen, onSave, autoSaveAttempted]);

  // Check for emergency data when dialog opens
  useEffect(() => {
    if (isOpen) {
      try {
        const savedData = localStorage.getItem('meeting_end_dialog_data');
        if (savedData) {
          const data = JSON.parse(savedData);
          
          // Only restore if the data is less than 1 hour old
          const savedTime = new Date(data.timestamp).getTime();
          const currentTime = new Date().getTime();
          const oneHour = 60 * 60 * 1000;
          
          if (currentTime - savedTime < oneHour) {
            // Ask user if they want to restore
            if (window.confirm('We found unsaved meeting data. Would you like to restore it?')) {
              setTitle(data.title || initialTitle || "New Meeting");
              setTranscript(data.transcript || initialTranscript || "");
              setSummary(data.summary || initialSummary || "");
              toast({
                title: "Data restored",
                description: "Your unsaved meeting data has been restored."
              });
            }
          }
          
          // Clear the saved data regardless of whether it was used
          localStorage.removeItem('meeting_end_dialog_data');
        }
      } catch (error) {
        console.error("Failed to restore emergency data:", error);
      }
    }
  }, [isOpen, initialTitle, initialTranscript, initialSummary, toast]);

  return {
    title,
    setTitle,
    transcript,
    setTranscript,
    summary,
    setSummary
  };
}; 
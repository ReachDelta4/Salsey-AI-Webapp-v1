import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseSaveProgressProps {
  saveProgress: number;
  onClose: () => void;
}

export const useSaveProgress = ({ saveProgress = 0, onClose }: UseSaveProgressProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [internalProgress, setInternalProgress] = useState(0);

  // Update internal progress based on incoming saveProgress
  useEffect(() => {
    if (saveProgress > 0) {
      setInternalProgress(saveProgress);
      if (saveProgress >= 100) {
        // Auto-close after completion
        setTimeout(() => {
          setIsSaving(false);
          toast({
            title: "Meeting saved",
            description: "Your meeting has been successfully saved.",
          });
          // Only close after successful save
          onClose();
        }, 500);
      }
    }
  }, [saveProgress, toast, onClose]);

  const handleSave = async (onSave: (title: string, transcript: string, summary: string) => Promise<void>, title: string, transcript: string, summary: string) => {
    try {
      setIsSaving(true);
      
      // Start progress animation
      setInternalProgress(10);
      const progressInterval = setInterval(() => {
        setInternalProgress(prev => {
          // Increment until 90% (leave room for actual completion)
          if (prev < 90 && saveProgress === 0) {
            return prev + 5;
          }
          return prev;
        });
      }, 300);
      
      // Execute the save with a longer timeout
      try {
        await Promise.race([
          onSave(title, transcript, summary),
          // Longer timeout (15s) for large meeting data
          new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 15000))
        ]);
        
        // If save is handled by parent component via saveProgress, this won't execute
        if (saveProgress === 0) {
          setInternalProgress(100);
          toast({
            title: "Meeting saved",
            description: "Your meeting has been successfully saved.",
          });
          setTimeout(() => {
            setIsSaving(false);
            setInternalProgress(0);
            onClose();
          }, 500);
        }
      } catch (error) {
        throw error;
      } finally {
        clearInterval(progressInterval);
      }
    } catch (error) {
      console.error("Error saving meeting:", error);
      toast({
        title: "Failed to save meeting",
        description: "There was an error saving your meeting. Please try again.",
        variant: "destructive",
      });
      setIsSaving(false);
      setInternalProgress(0);
    }
  };

  return {
    isSaving,
    internalProgress,
    handleSave
  };
}; 
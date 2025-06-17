import React from "react";
import { Progress } from "@/components/ui/progress";

interface SaveProgressBarProps {
  isSaving: boolean;
  internalProgress: number;
  saveProgress: number;
}

export const SaveProgressBar = ({ 
  isSaving, 
  internalProgress, 
  saveProgress 
}: SaveProgressBarProps) => {
  if (!isSaving && internalProgress === 0) return null;
  
  const displayProgress = Math.max(internalProgress, saveProgress);
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span>Saving your meeting</span>
        <span>{Math.round(displayProgress)}%</span>
      </div>
      <Progress value={displayProgress} className="h-2" />
    </div>
  );
}; 
import React from "react";
import { X, PlusSquare, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  isHistoryPanelOpen: boolean;
  onToggleHistoryPanel: () => void;
  onStartNewChat: () => void;
  onClose: () => void;
}

export const ChatHeader = ({
  isHistoryPanelOpen,
  onToggleHistoryPanel,
  onStartNewChat,
  onClose
}: ChatHeaderProps) => {
  return (
    <div className="p-2 flex justify-between items-center border-b">
      {!isHistoryPanelOpen && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleHistoryPanel}>
          <PanelRight className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={onStartNewChat}>
        <PlusSquare className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}; 
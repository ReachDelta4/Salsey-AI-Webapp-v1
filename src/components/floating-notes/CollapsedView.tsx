import React from "react";
import { StickyNote } from "lucide-react";

interface CollapsedViewProps {
  onClick: () => void;
}

export const CollapsedView = ({ onClick }: CollapsedViewProps) => {
  return (
    <div
      className="bg-card/90 backdrop-blur-sm border-2 border-border rounded-[20px] h-full flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 hover:bg-card/95"
      onClick={onClick}
    >
      <StickyNote size={16} className="text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">Notes</span>
    </div>
  );
}; 
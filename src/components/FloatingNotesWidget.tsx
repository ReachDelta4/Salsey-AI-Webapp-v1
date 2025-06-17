import React, { useState, useCallback } from "react";
import { 
  DraggableContainer, 
  CollapsedView, 
  ExpandedView 
} from "./floating-notes";

interface FloatingNotesWidgetProps {
  isCallActive: boolean;
}

const FloatingNotesWidget = ({ isCallActive }: FloatingNotesWidgetProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleToggleExpanded = useCallback(() => {
    if (!isDragging) {
      setIsExpanded(!isExpanded);
    }
  }, [isDragging, isExpanded]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
  }, []);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // This is only used for dragging the header when expanded
    // The actual drag logic is handled by DraggableContainer
  }, []);

  return (
    <DraggableContainer 
      isExpanded={isExpanded}
      expandedSize={{ width: 300, height: 400 }}
      collapsedSize={{ width: 120, height: 40 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
    >
      {!isExpanded ? (
        <CollapsedView onClick={handleToggleExpanded} />
      ) : (
        <ExpandedView 
          onClose={handleClose}
          onHeaderMouseDown={handleHeaderMouseDown}
          isDragging={isDragging}
        />
      )}
    </DraggableContainer>
  );
};

export default FloatingNotesWidget;

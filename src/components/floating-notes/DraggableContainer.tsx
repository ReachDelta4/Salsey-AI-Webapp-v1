import React, { useState, useRef, useCallback, ReactNode, useEffect } from "react";

interface DraggableContainerProps {
  children: ReactNode;
  isExpanded: boolean;
  initialPosition?: { x: number; y: number };
  expandedSize: { width: number; height: number };
  collapsedSize: { width: number; height: number };
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}

export const DraggableContainer = ({
  children,
  isExpanded,
  initialPosition = { x: window.innerWidth - 140, y: window.innerHeight - 80 },
  expandedSize = { width: 300, height: 400 },
  collapsedSize = { width: 120, height: 40 },
  onDragStart,
  onDragEnd,
  className = ""
}: DraggableContainerProps) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure widget stays within viewport bounds when resizing window
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const currentWidth = isExpanded ? expandedSize.width : collapsedSize.width;
        const currentHeight = isExpanded ? expandedSize.height : collapsedSize.height;
        
        return {
          x: Math.min(prev.x, window.innerWidth - currentWidth),
          y: Math.min(prev.y, window.innerHeight - currentHeight)
        };
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded, expandedSize, collapsedSize]);

  // Adjust position when expanding to ensure it stays in bounds
  useEffect(() => {
    const width = isExpanded ? expandedSize.width : collapsedSize.width;
    const height = isExpanded ? expandedSize.height : collapsedSize.height;
    
    setPosition(prev => ({
      x: Math.min(prev.x, window.innerWidth - width),
      y: Math.min(prev.y, window.innerHeight - height)
    }));
  }, [isExpanded, expandedSize, collapsedSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    // Prevent text selection during drag
    e.preventDefault();
    
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
    onDragStart?.();
  }, [onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    // Prevent text selection during drag
    e.preventDefault();
    
    const width = isExpanded ? expandedSize.width : collapsedSize.width;
    const height = isExpanded ? expandedSize.height : collapsedSize.height;
    
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    
    // Constraint to viewport - ensure the widget stays within screen bounds
    const maxX = window.innerWidth - width;
    const maxY = window.innerHeight - height;
    
    // Keep widget within bounds
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset, isExpanded, expandedSize, collapsedSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    onDragEnd?.();
  }, [onDragEnd]);

  useEffect(() => {
    if (isDragging) {
      // Disable text selection on the entire document during drag
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      // Re-enable text selection when not dragging
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Ensure text selection is re-enabled on cleanup
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 transition-all duration-300 ease-out ${
        isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
      } ${isExpanded ? 'cursor-default' : ''} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width: isExpanded ? `${expandedSize.width}px` : `${collapsedSize.width}px`,
        height: isExpanded ? `${expandedSize.height}px` : `${collapsedSize.height}px`,
        userSelect: isDragging ? 'none' : 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
}; 
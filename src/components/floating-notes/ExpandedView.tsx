import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ChecklistPanel from "../notes/ChecklistPanel";
import QuestionsPanel from "../notes/QuestionsPanel";
import MarkdownEditor from "../notes/MarkdownEditor";

interface ExpandedViewProps {
  onClose: (e: React.MouseEvent) => void;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
}

export const ExpandedView = ({ 
  onClose, 
  onHeaderMouseDown,
  isDragging 
}: ExpandedViewProps) => {
  return (
    <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-xl shadow-2xl h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div 
        className={`flex items-center justify-between p-3 border-b-2 border-border ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        onMouseDown={onHeaderMouseDown}
        style={{ userSelect: 'none' }}
      >
        <h3 className="text-sm font-medium">Notes & Agenda</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-muted/80"
          onClick={onClose}
        >
          <X size={14} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="checklist" className="w-full h-full flex flex-col">
          <div className="px-3 pt-2">
            <TabsList className="grid w-full grid-cols-2 h-8 border border-border">
              <TabsTrigger value="checklist" className="text-xs">
                ✅ Checklist
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">
                📝 Notes
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-3 pb-3">
            <TabsContent value="checklist" className="mt-3 space-y-3">
              <ChecklistPanel />
              <QuestionsPanel />
            </TabsContent>

            <TabsContent value="notes" className="mt-3 h-full">
              <div className="h-[280px]">
                <MarkdownEditor />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}; 
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  SaveProgressBar, 
  InsightsTabContent, 
  TabContent, 
  useEmergencySave,
  useSaveProgress
} from "./meeting-end";

interface MeetingInsight {
  type: string;
  data: any[];
}

interface MeetingEndDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, transcript: string, summary: string) => Promise<void>;
  transcript: string;
  summary: string;
  insights: MeetingInsight[];
  saveProgress?: number;
}

const MeetingEndDialog = ({
  isOpen,
  onClose,
  onSave,
  transcript: initialTranscript,
  summary: initialSummary,
  insights,
  saveProgress = 0
}: MeetingEndDialogProps) => {
  const [activeTab, setActiveTab] = useState("summary");
  
  // Use the extracted custom hooks
  const {
    title,
    setTitle,
    transcript,
    setTranscript,
    summary,
    setSummary
  } = useEmergencySave({
    isOpen,
    onSave,
    initialTitle: "New Meeting",
    initialTranscript,
    initialSummary
  });
  
  const {
    isSaving,
    internalProgress,
    handleSave
  } = useSaveProgress({
    saveProgress,
    onClose
  });

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Allow dialog to be closed if not saving
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Meeting</DialogTitle>
          <DialogDescription>
            Review and edit your meeting details before saving.
          </DialogDescription>
        </DialogHeader>

        <SaveProgressBar 
          isSaving={isSaving} 
          internalProgress={internalProgress} 
          saveProgress={saveProgress} 
        />

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Meeting Title
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter meeting title"
              disabled={isSaving}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="summary" className="flex-1" disabled={isSaving}>
                Summary
              </TabsTrigger>
              <TabsTrigger value="transcript" className="flex-1" disabled={isSaving}>
                Transcript
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex-1" disabled={isSaving}>
                Insights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <TabContent
                id="summary"
                label="Meeting Summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Enter or edit meeting summary"
                disabled={isSaving}
              />
            </TabsContent>

            <TabsContent value="transcript">
              <TabContent
                id="transcript"
                label="Meeting Transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Enter or edit meeting transcript"
                disabled={isSaving}
                className="font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="insights">
              <InsightsTabContent insights={insights} isSaving={isSaving} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline"
            onClick={onClose} 
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Discard
          </Button>
          <Button 
            onClick={() => handleSave(onSave, title, transcript, summary)} 
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? "Saving..." : "Save Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingEndDialog;

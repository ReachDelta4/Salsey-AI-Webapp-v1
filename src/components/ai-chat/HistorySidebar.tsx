import React from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatHistory from '../ChatHistory';

interface ChatHistoryItem {
  id: string;
  title: string;
  createdAt: string;
}

interface HistorySidebarProps {
  history: ChatHistoryItem[];
  activeChatId: string;
  onSwitchChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onClose: () => void;
}

export const HistorySidebar = ({
  history,
  activeChatId,
  onSwitchChat,
  onDeleteChat,
  onClose
}: HistorySidebarProps) => {
  return (
    <div className="w-56 border-r flex flex-col">
      <div className="p-2 flex justify-between items-center border-b">
        <h3 className="text-sm font-medium pl-2">Chat History</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
      <ChatHistory 
        history={history}
        activeChatId={activeChatId}
        onSwitchChat={onSwitchChat}
        onDeleteChat={onDeleteChat}
      />
    </div>
  );
}; 
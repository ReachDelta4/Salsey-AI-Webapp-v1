import React, { useState, useRef, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGeminiChat } from "@/hooks/useGeminiChat";
import { cn } from "@/lib/utils";
import {
  ChatMessages,
  ChatInput,
  ChatHeader,
  HistorySidebar
} from "./ai-chat";

/**
 * A global, collapsible chat drawer for interacting with Unbound AI.
 * It is fixed to the bottom-right of the screen and can be expanded or collapsed.
 * The chat state is managed by the `useGeminiChat` hook, ensuring it has its own
 * isolated and stateful conversation session.
 */
const UnboundAIChat = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const { 
    messages, 
    history,
    activeChatId,
    sendMessage, 
    isLoading, 
    error, 
    isClientAvailable, 
    startNewChat,
    switchChat,
    deleteChat
  } = useGeminiChat();
  
  useEffect(() => {
    if (isExpanded && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [isExpanded, messages]);

  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };
  
  const toggleHistoryPanel = () => {
    setIsHistoryPanelOpen(prev => !prev);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out`}
    >
      {isExpanded ? (
        <div className={cn(
          "bg-card border border-border rounded-lg shadow-lg flex",
          "transition-all duration-300 ease-in-out",
          isHistoryPanelOpen ? "w-[600px] h-[500px]" : "w-96 h-[500px]"
        )}>
          {/* History Panel */}
          {isHistoryPanelOpen && (
            <HistorySidebar
              history={history}
              activeChatId={activeChatId}
              onSwitchChat={switchChat}
              onDeleteChat={deleteChat}
              onClose={toggleHistoryPanel}
            />
          )}

          {/* Main Chat Panel */}
          <div className="flex-1 flex flex-col">
            <ChatHeader
              isHistoryPanelOpen={isHistoryPanelOpen}
              onToggleHistoryPanel={toggleHistoryPanel}
              onStartNewChat={startNewChat}
              onClose={toggleExpanded}
            />
            
            <div className="flex-1 overflow-hidden p-2">
              <ScrollArea className="h-full pr-4" ref={scrollAreaRef as React.RefObject<HTMLDivElement>}>
                <ChatMessages
                  messages={messages}
                  isLoading={isLoading}
                  error={error}
                  isClientAvailable={isClientAvailable}
                />
              </ScrollArea>
            </div>

            <ChatInput
              onSendMessage={sendMessage}
              isLoading={isLoading}
              isClientAvailable={isClientAvailable}
            />
          </div>
        </div>
      ) : (
        <Button
          className="h-12 w-36 rounded-full shadow-lg"
          onClick={toggleExpanded}
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Chat with AI
        </Button>
      )}
    </div>
  );
};

export default UnboundAIChat; 
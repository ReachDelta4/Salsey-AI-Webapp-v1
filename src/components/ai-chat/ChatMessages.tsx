import React from "react";
import { MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface Message {
  role: string;
  content: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isClientAvailable: boolean;
}

export const ChatMessages = ({ 
  messages, 
  isLoading, 
  error, 
  isClientAvailable 
}: ChatMessagesProps) => {
  // Show API key error if client is not available
  if (!isClientAvailable) {
    return (
      <Alert className="mb-4 bg-destructive/10 border-destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unbound AI is not available. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  // Show welcome message if there are no messages
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold">Start a conversation</h3>
        <p className="text-sm text-muted-foreground">Ask Unbound AI anything.</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message, index) => (
        <div
          key={index}
          className={`mb-3 p-2 rounded-lg ${
            message.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8"
          }`}
        >
          <p className="text-sm">{message.content}</p>
        </div>
      ))}
      
      {isLoading && (
        <div className="flex justify-center items-center py-2">
          <div className="animate-pulse text-sm text-muted-foreground">Unbound AI is thinking...</div>
        </div>
      )}
      
      {error && (
        <Alert className="mb-4 bg-destructive/10 border-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}; 
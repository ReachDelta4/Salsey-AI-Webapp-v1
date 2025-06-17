import React, { useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isClientAvailable: boolean;
}

export const ChatInput = ({
  onSendMessage,
  isLoading,
  isClientAvailable
}: ChatInputProps) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && isClientAvailable) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 border-t">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask Unbound AI..."
          disabled={isLoading || !isClientAvailable}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !inputValue.trim() || !isClientAvailable}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}; 
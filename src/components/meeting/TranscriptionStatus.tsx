import React from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranscriptionWSStatus } from "@/hooks/useTranscriptionWebSocket";

interface TranscriptionStatusProps {
  status: TranscriptionWSStatus;
  error: string | null;
  onReconnect: () => void;
}

const TranscriptionStatus: React.FC<TranscriptionStatusProps> = ({
  status,
  error,
  onReconnect,
}) => {
  return (
    <div className="flex items-center gap-2">
      {status === "connected" && (
        <>
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="text-xs text-green-500">Connected</span>
        </>
      )}
      
      {status === "connecting" && (
        <>
          <Loader2 size={16} className="animate-spin text-yellow-500" />
          <span className="text-xs text-yellow-500">Connecting...</span>
        </>
      )}
      
      {status === "error" && (
        <>
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-xs text-red-500">
            {error || "Connection error"}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 px-2 py-0 ml-2"
            onClick={onReconnect}
          >
            <RefreshCw size={12} className="mr-1" />
            Reconnect
          </Button>
        </>
      )}
      
      {status === "disconnected" && (
        <>
          <AlertCircle size={16} className="text-gray-500" />
          <span className="text-xs text-gray-500">Disconnected</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 px-2 py-0 ml-2"
            onClick={onReconnect}
          >
            <RefreshCw size={12} className="mr-1" />
            Connect
          </Button>
        </>
      )}
    </div>
  );
};

export default TranscriptionStatus; 
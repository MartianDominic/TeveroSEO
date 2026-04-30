"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type ProgressStage =
  | "connecting"
  | "crawling"
  | "extracting"
  | "analyzing"
  | "complete"
  | "error";

export interface ProgressState {
  stage: ProgressStage;
  progress: number;
  message?: string;
  error?: string;
}

interface UseAnalysisProgressOptions {
  prospectId?: string;
  enabled?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useAnalysisProgress({
  prospectId,
  enabled = true,
  onComplete,
  onError,
}: UseAnalysisProgressOptions) {
  const [state, setState] = useState<ProgressState>({
    stage: "connecting",
    progress: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!prospectId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/prospects/progress/${prospectId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setState({ stage: "connecting", progress: 10 });
    };

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressState;
        setState(data);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("complete", () => {
      setState({
        stage: "complete",
        progress: 100,
        message: "Analysis complete!",
      });
      eventSource.close();
      setIsConnected(false);
      onComplete?.();
    });

    eventSource.addEventListener("error", (event) => {
      let errorMessage = "Connection lost";
      try {
        const data = JSON.parse((event as MessageEvent).data);
        errorMessage = data.message || errorMessage;
      } catch {
        // Use default message
      }
      setState({ stage: "error", progress: 0, error: errorMessage });
      eventSource.close();
      setIsConnected(false);
      onError?.(errorMessage);
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setState((prev) =>
          prev.stage === "complete"
            ? prev
            : { stage: "error", progress: 0, error: "Connection lost" }
        );
        setIsConnected(false);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [prospectId, enabled, onComplete, onError]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const reset = useCallback(() => {
    disconnect();
    setState({ stage: "connecting", progress: 0 });
  }, [disconnect]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    isConnected,
    connect,
    disconnect,
    reset,
  };
}

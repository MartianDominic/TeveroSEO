"use client";

/**
 * useAnalysisProgress Hook - SSE-based progress tracking for prospect analysis
 *
 * HIGH-41 FIX: Ensures EventSource is properly closed in all code paths:
 * - On successful completion
 * - On error events
 * - On component unmount (cleanup function)
 * - On manual disconnect
 */
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
      // HIGH-41 FIX: Close EventSource and null out ref on completion
      eventSource.close();
      eventSourceRef.current = null;
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
      // HIGH-41 FIX: Close EventSource and null out ref on error event
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      onError?.(errorMessage);
    });

    // HIGH-41 FIX: Handle onerror - close EventSource and update ref
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setState((prev) =>
          prev.stage === "complete"
            ? prev
            : { stage: "error", progress: 0, error: "Connection lost" }
        );
        setIsConnected(false);
      }
      // HIGH-41 FIX: Always close on error to prevent memory leaks
      eventSource.close();
      eventSourceRef.current = null;
    };

    // HIGH-41 FIX: Cleanup function ensures EventSource is closed on unmount
    // This handles cases where the effect re-runs or component unmounts
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
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

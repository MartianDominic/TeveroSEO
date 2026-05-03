"use client";

/**
 * useAnalysisProgress Hook - SSE-based progress tracking for prospect analysis
 *
 * HIGH-41 FIX: Ensures EventSource is properly closed in all code paths:
 * - On successful completion
 * - On error events
 * - On component unmount (cleanup function)
 * - On manual disconnect
 *
 * HIGH-STATE-05 FIX: Added isMountedRef cleanup flag to prevent state updates
 * after component unmounts, avoiding React memory leak warnings.
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
  // HIGH-STATE-05 FIX: Cleanup flag to prevent state updates after unmount
  const isMountedRef = useRef(true);

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
      // HIGH-STATE-05 FIX: Check if mounted before updating state
      if (!isMountedRef.current) return;
      setIsConnected(true);
      setState({ stage: "connecting", progress: 10 });
    };

    eventSource.addEventListener("progress", (event) => {
      // HIGH-STATE-05 FIX: Check if mounted before updating state
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data) as ProgressState;
        setState(data);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("complete", () => {
      // HIGH-41 FIX: Close EventSource and null out ref on completion
      eventSource.close();
      eventSourceRef.current = null;
      // HIGH-STATE-05 FIX: Check if mounted before updating state
      if (!isMountedRef.current) return;
      setState({
        stage: "complete",
        progress: 100,
        message: "Analysis complete!",
      });
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
      // HIGH-41 FIX: Close EventSource and null out ref on error event
      eventSource.close();
      eventSourceRef.current = null;
      // HIGH-STATE-05 FIX: Check if mounted before updating state
      if (!isMountedRef.current) return;
      setState({ stage: "error", progress: 0, error: errorMessage });
      setIsConnected(false);
      onError?.(errorMessage);
    });

    // HIGH-41 FIX: Handle onerror - close EventSource and update ref
    eventSource.onerror = () => {
      // HIGH-41 FIX: Always close on error to prevent memory leaks
      eventSource.close();
      eventSourceRef.current = null;
      // HIGH-STATE-05 FIX: Check if mounted before updating state
      if (!isMountedRef.current) return;
      if (eventSource.readyState === EventSource.CLOSED) {
        setState((prev) =>
          prev.stage === "complete"
            ? prev
            : { stage: "error", progress: 0, error: "Connection lost" }
        );
        setIsConnected(false);
      }
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
    // HIGH-STATE-05 FIX: Set mounted flag on mount
    isMountedRef.current = true;
    const cleanup = connect();
    return () => {
      // HIGH-STATE-05 FIX: Clear mounted flag before cleanup
      isMountedRef.current = false;
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

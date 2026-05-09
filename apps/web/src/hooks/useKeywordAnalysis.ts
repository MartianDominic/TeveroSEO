"use client";

/**
 * useKeywordAnalysis Hook
 * Phase 82: Chat Integration
 *
 * SSE-based hook for keyword analysis with progress tracking.
 * Follows the same patterns as useAnalysisProgress but tailored
 * for the keyword analysis pipeline.
 */

import { useState, useCallback, useRef, useEffect } from "react";

import type {
  AnalysisStage,
  AnalysisEvent,
  AnalysisResult,
  AnalyzeRequest,
  AnalysisConfig,
} from "@/lib/keyword-chat/types";

export interface UseKeywordAnalysisState {
  stage: AnalysisStage;
  progress: number;
  message?: string;
  result: AnalysisResult | null;
  partials: Partial<AnalysisResult>[];
  error?: string;
  isAnalyzing: boolean;
}

interface UseKeywordAnalysisOptions {
  onComplete?: (result: AnalysisResult) => void;
  onError?: (error: string) => void;
}

export function useKeywordAnalysis(options: UseKeywordAnalysisOptions = {}) {
  const { onComplete, onError } = options;

  const [state, setState] = useState<UseKeywordAnalysisState>({
    stage: "idle",
    progress: 0,
    result: null,
    partials: [],
    isAnalyzing: false,
  });

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (isMountedRef.current) {
      setState((prev) => ({ ...prev, isAnalyzing: false }));
    }
  }, []);

  const analyze = useCallback(
    async (
      clientId: string,
      conversation: string,
      keywords: string[],
      config?: AnalysisConfig
    ) => {
      // Close existing connection
      disconnect();

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Reset state
      setState({
        stage: "extracting_constraints",
        progress: 0,
        result: null,
        partials: [],
        isAnalyzing: true,
      });

      // Build request
      const request: AnalyzeRequest = {
        clientId,
        conversation,
        keywords,
        config,
      };

      // POST to SSE endpoint using fetch + ReadableStream
      try {
        const response = await fetch("/api/keyword-chat/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete message in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const eventData = JSON.parse(line.slice(6)) as AnalysisEvent;

              if (!isMountedRef.current) continue;

              switch (eventData.type) {
                case "progress":
                  setState((prev) => ({
                    ...prev,
                    stage: eventData.stage,
                    progress: eventData.progress,
                    message: eventData.message,
                  }));
                  break;

                case "partial":
                  setState((prev) => ({
                    ...prev,
                    partials: [...prev.partials, eventData.data],
                  }));
                  break;

                case "complete":
                  setState((prev) => ({
                    ...prev,
                    stage: "complete",
                    progress: 100,
                    result: eventData.data,
                    isAnalyzing: false,
                  }));
                  onComplete?.(eventData.data);
                  break;

                case "error":
                  setState((prev) => ({
                    ...prev,
                    stage: "idle",
                    error: eventData.message,
                    isAnalyzing: false,
                  }));
                  onError?.(eventData.message);
                  break;
              }
            } catch {
              // Ignore parse errors (could be heartbeat comments)
            }
          }
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Analysis failed";
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            stage: "idle",
            error: message,
            isAnalyzing: false,
          }));
          onError?.(message);
        }
      }
    },
    [disconnect, onComplete, onError]
  );

  const reset = useCallback(() => {
    disconnect();
    setState({
      stage: "idle",
      progress: 0,
      result: null,
      partials: [],
      isAnalyzing: false,
    });
  }, [disconnect]);

  return {
    ...state,
    analyze,
    reset,
    disconnect,
  };
}

/**
 * Keyword analysis hook with SSE auto-reconnect and checkpoint support.
 *
 * Features:
 * - Exponential backoff reconnection (5 retries max)
 * - Automatic checkpoint saving after each stage
 * - Resume from checkpoint on browser refresh
 * - Progress tracking via SSE events
 *
 * @module client/features/keywords/hooks/useKeywordAnalysis
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  checkpointManager,
  type AnalysisCheckpoint,
  type PartialResults,
  type PartialKeyword as Keyword,
  type PartialCluster as Cluster,
  type PartialScore as Score,
} from "../lib/checkpoint-manager";
import { classifyError, getErrorTemplate, type ErrorCode } from "../lib/error-templates";

// Re-export types for external consumers
export type { PartialResults, Keyword, Cluster, Score };

const SSE_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export type AnalysisStage =
  | "initializing"
  | "constraints"
  | "embedding"
  | "clustering"
  | "scoring"
  | "labeling"
  | "complete"
  | "error";

export interface AnalysisProgress {
  stage: AnalysisStage;
  progress: number;
  message?: string;
  partialResults?: PartialResults;
}

export interface UseKeywordAnalysisOptions {
  onProgress?: (progress: AnalysisProgress) => void;
  onComplete?: (results: AnalysisResults) => void;
  onError?: (error: AnalysisError) => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
}

export interface AnalysisResults {
  sessionId: string;
  keywords: Keyword[];
  clusters: Cluster[];
  scores: Score[];
  costUsd: number;
}

export interface AnalysisError {
  code: ErrorCode;
  title: string;
  message: string;
  action: string;
  retryable: boolean;
}

export interface UseKeywordAnalysisReturn {
  startAnalysis: (keywords: string[], context?: string) => Promise<void>;
  resumeAnalysis: (checkpoint: AnalysisCheckpoint) => Promise<void>;
  cancelAnalysis: () => void;
  retryAnalysis: () => void;
  isAnalyzing: boolean;
  progress: AnalysisProgress;
  results: AnalysisResults | null;
  error: AnalysisError | null;
  retryCount: number;
  pendingCheckpoint: AnalysisCheckpoint | null;
}

export function useKeywordAnalysis(
  options: UseKeywordAnalysisOptions = {}
): UseKeywordAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: "initializing",
    progress: 0,
  });
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingCheckpoint, setPendingCheckpoint] = useState<AnalysisCheckpoint | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastKeywordsRef = useRef<string[]>([]);
  const lastContextRef = useRef<string | undefined>(undefined);

  // Check for pending checkpoint on mount
  useEffect(() => {
    const checkPendingCheckpoint = async () => {
      const checkpoint = await checkpointManager.getLatestCheckpoint();
      if (checkpoint && checkpoint.stage !== "complete") {
        setPendingCheckpoint(checkpoint);
      }
    };
    checkPendingCheckpoint();
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const saveCheckpoint = useCallback(async (progressData: AnalysisProgress) => {
    if (!sessionIdRef.current) return;

    const checkpoint: AnalysisCheckpoint = {
      sessionId: sessionIdRef.current,
      timestamp: Date.now(),
      stage: progressData.stage as AnalysisCheckpoint["stage"],
      progress: progressData.progress,
      keywords: lastKeywordsRef.current.map((kw) => ({ keyword: kw })),
      partialResults: progressData.partialResults,
    };

    await checkpointManager.saveCheckpoint(checkpoint);
  }, []);

  const connect = useCallback(
    (url: string, isResume: boolean = false) => {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setRetryCount(0);
        setError(null);
        if (!isResume) {
          setProgress({ stage: "initializing", progress: 0 });
        }
      };

      es.onerror = () => {
        es.close();

        if (retryCount < SSE_CONFIG.maxRetries) {
          const delay = Math.min(
            SSE_CONFIG.baseDelay * Math.pow(SSE_CONFIG.backoffMultiplier, retryCount),
            SSE_CONFIG.maxDelay
          );

          options.onReconnecting?.(retryCount + 1, SSE_CONFIG.maxRetries);

          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            connect(url, true);
          }, delay);
        } else {
          setIsAnalyzing(false);
          const errTemplate = getErrorTemplate("NETWORK_ERROR");
          setError(errTemplate);
          options.onError?.(errTemplate);
        }
      };

      es.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "progress": {
              const progressData: AnalysisProgress = {
                stage: data.stage,
                progress: data.progress,
                message: data.message,
                partialResults: data.partialResults,
              };
              setProgress(progressData);
              options.onProgress?.(progressData);
              await saveCheckpoint(progressData);
              break;
            }

            case "complete": {
              const analysisResults: AnalysisResults = {
                sessionId: sessionIdRef.current!,
                keywords: data.keywords,
                clusters: data.clusters,
                scores: data.scores,
                costUsd: data.costUsd,
              };
              setResults(analysisResults);
              setProgress({ stage: "complete", progress: 100 });
              setIsAnalyzing(false);
              cleanup();

              // Clear checkpoint on success
              if (sessionIdRef.current) {
                await checkpointManager.clearCheckpoint(sessionIdRef.current);
              }

              options.onComplete?.(analysisResults);
              break;
            }

            case "error": {
              const errorCode = classifyError(new Error(data.message));
              const errTemplate = getErrorTemplate(errorCode);
              setError(errTemplate);
              setProgress({ stage: "error", progress: 0, message: data.message });
              setIsAnalyzing(false);
              cleanup();
              options.onError?.(errTemplate);
              break;
            }
          }
        } catch (parseError) {
          console.error("Failed to parse SSE message:", parseError);
        }
      };
    },
    [retryCount, options, cleanup, saveCheckpoint]
  );

  const startAnalysis = useCallback(
    async (keywords: string[], context?: string) => {
      cleanup();
      setError(null);
      setResults(null);
      setRetryCount(0);
      setIsAnalyzing(true);

      // Generate session ID
      sessionIdRef.current = crypto.randomUUID();
      lastKeywordsRef.current = keywords;
      lastContextRef.current = context;

      // Clear any pending checkpoint
      setPendingCheckpoint(null);

      // Build SSE URL with POST data encoded
      const params = new URLSearchParams({
        sessionId: sessionIdRef.current,
        keywords: JSON.stringify(keywords),
        ...(context && { context }),
      });

      const url = `/api/keywords/analyze?${params.toString()}`;
      connect(url);
    },
    [cleanup, connect]
  );

  const resumeAnalysis = useCallback(
    async (checkpoint: AnalysisCheckpoint) => {
      cleanup();
      setError(null);
      setRetryCount(0);
      setIsAnalyzing(true);

      sessionIdRef.current = checkpoint.sessionId;
      lastKeywordsRef.current = checkpoint.keywords.map((kw) => kw.keyword);
      setPendingCheckpoint(null);

      setProgress({
        stage: checkpoint.stage,
        progress: checkpoint.progress,
        partialResults: checkpoint.partialResults,
      });

      const params = new URLSearchParams({
        sessionId: checkpoint.sessionId,
        resume: "true",
        stage: checkpoint.stage,
      });

      const url = `/api/keywords/analyze?${params.toString()}`;
      connect(url, true);
    },
    [cleanup, connect]
  );

  const cancelAnalysis = useCallback(() => {
    cleanup();
    setIsAnalyzing(false);
    setProgress({ stage: "initializing", progress: 0 });
  }, [cleanup]);

  const retryAnalysis = useCallback(() => {
    if (lastKeywordsRef.current.length > 0) {
      startAnalysis(lastKeywordsRef.current, lastContextRef.current);
    }
  }, [startAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    startAnalysis,
    resumeAnalysis,
    cancelAnalysis,
    retryAnalysis,
    isAnalyzing,
    progress,
    results,
    error,
    retryCount,
    pendingCheckpoint,
  };
}

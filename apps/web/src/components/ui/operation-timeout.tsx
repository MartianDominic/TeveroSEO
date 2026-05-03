/**
 * OperationTimeout Component
 * FIX-17 MED-UJ-01: Missing timeout handling for long operations
 *
 * Provides visual feedback for long-running operations with:
 * - Progress indication after initial delay
 * - Timeout warning with retry option
 * - Cancel/abort capability
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button, Card, CardContent } from "@tevero/ui";

export interface OperationTimeoutProps {
  /** Whether the operation is currently running */
  isLoading: boolean;
  /** Callback to cancel/abort the operation */
  onCancel?: () => void;
  /** Callback to retry the operation */
  onRetry?: () => void;
  /** Delay before showing "taking longer than expected" (default: 10s) */
  warningDelayMs?: number;
  /** Delay before showing timeout error (default: 60s) */
  timeoutDelayMs?: number;
  /** Custom message for the loading state */
  loadingMessage?: string;
  /** Custom message for the warning state */
  warningMessage?: string;
  /** Custom message for the timeout state */
  timeoutMessage?: string;
  /** Child content to show while loading */
  children?: React.ReactNode;
}

type TimeoutState = "loading" | "warning" | "timeout";

export function OperationTimeout({
  isLoading,
  onCancel,
  onRetry,
  warningDelayMs = 10000,
  timeoutDelayMs = 60000,
  loadingMessage = "Processing...",
  warningMessage = "This is taking longer than expected",
  timeoutMessage = "Operation timed out",
  children,
}: OperationTimeoutProps) {
  const [state, setState] = useState<TimeoutState>("loading");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Track elapsed time
  useEffect(() => {
    if (!isLoading) {
      setState("loading");
      setElapsedSeconds(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedSeconds(Math.floor(elapsed / 1000));

      if (elapsed >= timeoutDelayMs) {
        setState("timeout");
      } else if (elapsed >= warningDelayMs) {
        setState("warning");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, warningDelayMs, timeoutDelayMs]);

  if (!isLoading) {
    return <>{children}</>;
  }

  const formatElapsed = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Card className="border-dashed">
      <CardContent className="py-6">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {state === "timeout" ? (
            <>
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{timeoutMessage}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The operation took longer than expected ({formatElapsed(elapsedSeconds)})
                </p>
              </div>
              <div className="flex gap-2">
                {onRetry && (
                  <Button onClick={onRetry} variant="default" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
                {onCancel && (
                  <Button onClick={onCancel} variant="outline" size="sm">
                    Cancel
                  </Button>
                )}
              </div>
            </>
          ) : state === "warning" ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-warning" />
              <div>
                <p className="font-medium text-warning">{warningMessage}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait... ({formatElapsed(elapsedSeconds)})
                </p>
              </div>
              {onCancel && (
                <Button onClick={onCancel} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">{loadingMessage}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook for managing operation timeout state
 *
 * @example
 * ```tsx
 * const { startOperation, cancelOperation, isTimedOut, elapsedTime } = useOperationTimeout({
 *   timeoutMs: 30000,
 *   onTimeout: () => toast.error("Operation timed out"),
 * });
 *
 * const handleSubmit = async () => {
 *   const controller = startOperation();
 *   try {
 *     await fetch("/api/slow", { signal: controller.signal });
 *   } catch (e) {
 *     if (e.name === "AbortError") return; // Cancelled
 *     throw e;
 *   }
 * };
 * ```
 */
export function useOperationTimeout(options: {
  timeoutMs?: number;
  onTimeout?: () => void;
}) {
  const { timeoutMs = 60000, onTimeout } = options;
  const [isRunning, setIsRunning] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const startOperation = useCallback(() => {
    const newController = new AbortController();
    setController(newController);
    setIsRunning(true);
    setIsTimedOut(false);
    setStartTime(Date.now());

    // Set timeout
    const timeoutId = setTimeout(() => {
      setIsTimedOut(true);
      newController.abort();
      onTimeout?.();
    }, timeoutMs);

    // Clean up timeout when controller aborts
    newController.signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      setIsRunning(false);
    });

    return newController;
  }, [timeoutMs, onTimeout]);

  const cancelOperation = useCallback(() => {
    controller?.abort();
    setIsRunning(false);
  }, [controller]);

  const completeOperation = useCallback(() => {
    setIsRunning(false);
    setStartTime(null);
  }, []);

  const elapsedTime = startTime ? Date.now() - startTime : 0;

  return {
    startOperation,
    cancelOperation,
    completeOperation,
    isRunning,
    isTimedOut,
    elapsedTime,
  };
}

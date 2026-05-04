"use client";

/**
 * Sync Status Hook - FIX-08: H-SYNC-04
 *
 * Provides real-time sync status feedback for cross-service operations.
 * Shows sync progress indicator during client creation/updates.
 */

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Sync status enum matching the server-side status.
 */
export enum SyncStatus {
  /** Sync not started */
  IDLE = "idle",
  /** Sync in progress */
  SYNCING = "syncing",
  /** Sync completed successfully */
  SUCCESS = "success",
  /** Sync failed after retries */
  FAILED = "failed",
  /** Sync timed out */
  TIMEOUT = "timeout",
}

/**
 * Sync progress state for UI feedback.
 */
export interface SyncProgress {
  /** Current status */
  status: SyncStatus;
  /** Current attempt number (1-based) */
  attempt: number;
  /** Maximum attempts */
  maxAttempts: number;
  /** Progress message for display */
  message: string;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
}

const DEFAULT_PROGRESS: SyncProgress = {
  status: SyncStatus.IDLE,
  attempt: 0,
  maxAttempts: 3,
  message: "",
  durationMs: 0,
};

/**
 * Get user-friendly message for sync status.
 */
function getStatusMessage(status: SyncStatus, attempt: number, maxAttempts: number): string {
  switch (status) {
    case SyncStatus.IDLE:
      return "";
    case SyncStatus.SYNCING:
      if (attempt === 1) {
        return "Syncing data across services...";
      }
      return `Retrying sync (attempt ${attempt} of ${maxAttempts})...`;
    case SyncStatus.SUCCESS:
      return "Sync complete!";
    case SyncStatus.FAILED:
      return "Sync failed. Some features may be unavailable.";
    case SyncStatus.TIMEOUT:
      return "Sync timed out. Please try again.";
    default:
      return "";
  }
}

export interface UseSyncStatusOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Callback when sync succeeds */
  onSuccess?: () => void;
  /** Callback when sync fails */
  onError?: (error: string) => void;
}

export interface UseSyncStatusReturn {
  /** Current sync progress */
  progress: SyncProgress;
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Start tracking a sync operation */
  startSync: () => void;
  /** Mark sync as successful */
  markSuccess: () => void;
  /** Mark sync as failed */
  markFailed: (error: string) => void;
  /** Mark a retry attempt */
  markRetry: (attempt: number) => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Hook for tracking cross-service sync status.
 * FIX-08: H-SYNC-04 - Visible sync status to user.
 *
 * @example
 * ```tsx
 * const { progress, isSyncing, startSync, markSuccess, markFailed } = useSyncStatus({
 *   onSuccess: () => router.push(`/clients/${clientId}`),
 *   onError: (error) => toast.error(error),
 * });
 *
 * // In create handler:
 * startSync();
 * try {
 *   await createClientWithSync(data);
 *   markSuccess();
 * } catch (err) {
 *   markFailed(err.message);
 * }
 *
 * // In UI:
 * {isSyncing && <SyncProgressIndicator progress={progress} />}
 * ```
 */
export function useSyncStatus(
  options: UseSyncStatusOptions = {}
): UseSyncStatusReturn {
  const { maxAttempts = 3, timeoutMs = 30000, onSuccess, onError } = options;

  const [progress, setProgress] = useState<SyncProgress>({
    ...DEFAULT_PROGRESS,
    maxAttempts,
  });

  const startTimeRef = useRef<number>(0);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const startSync = useCallback(() => {
    startTimeRef.current = Date.now();

    setProgress({
      status: SyncStatus.SYNCING,
      attempt: 1,
      maxAttempts,
      message: getStatusMessage(SyncStatus.SYNCING, 1, maxAttempts),
      durationMs: 0,
    });

    // Set timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    timeoutIdRef.current = setTimeout(() => {
      setProgress((prev) => ({
        ...prev,
        status: SyncStatus.TIMEOUT,
        message: getStatusMessage(SyncStatus.TIMEOUT, prev.attempt, maxAttempts),
        durationMs: Date.now() - startTimeRef.current,
      }));
      onError?.("Sync operation timed out");
    }, timeoutMs);
  }, [maxAttempts, timeoutMs, onError]);

  const markSuccess = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    setProgress((prev) => ({
      ...prev,
      status: SyncStatus.SUCCESS,
      message: getStatusMessage(SyncStatus.SUCCESS, prev.attempt, maxAttempts),
      durationMs: Date.now() - startTimeRef.current,
    }));

    onSuccess?.();
  }, [maxAttempts, onSuccess]);

  const markFailed = useCallback(
    (error: string) => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      setProgress((prev) => ({
        ...prev,
        status: SyncStatus.FAILED,
        message: getStatusMessage(SyncStatus.FAILED, prev.attempt, maxAttempts),
        error,
        durationMs: Date.now() - startTimeRef.current,
      }));

      onError?.(error);
    },
    [maxAttempts, onError]
  );

  const markRetry = useCallback(
    (attempt: number) => {
      setProgress((prev) => ({
        ...prev,
        status: SyncStatus.SYNCING,
        attempt,
        message: getStatusMessage(SyncStatus.SYNCING, attempt, maxAttempts),
        durationMs: Date.now() - startTimeRef.current,
      }));
    },
    [maxAttempts]
  );

  const reset = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    startTimeRef.current = 0;
    setProgress({
      ...DEFAULT_PROGRESS,
      maxAttempts,
    });
  }, [maxAttempts]);

  return {
    progress,
    isSyncing: progress.status === SyncStatus.SYNCING,
    startSync,
    markSuccess,
    markFailed,
    markRetry,
    reset,
  };
}

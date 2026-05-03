/**
 * useVerificationPoll Hook - Real-time pixel installation verification
 * Phase 66-06: Verification UI
 *
 * Polls the verification API for pixel installation status with:
 * - Long-poll requests (30s timeout)
 * - Automatic retry (max 5 attempts = 2.5 minutes total)
 * - Location data on successful detection
 * - Manual check option
 * - AbortController for proper cleanup
 */
import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export type VerificationStatusType =
  | "pending"
  | "detected"
  | "verified"
  | "error";

export interface GeoLocation {
  city?: string;
  country?: string;
  countryCode?: string;
}

export interface VerificationState {
  status: VerificationStatusType;
  isPolling: boolean;
  attempts: number;
  location?: GeoLocation;
  error?: string;
  firstPing?: string;
  lastPing?: string;
  pingCount?: number;
}

export interface UseVerificationPollReturn extends VerificationState {
  /** Start polling for verification status */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Make a single check request (no polling) */
  checkNow: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_ATTEMPTS = 5;
const POLL_TIMEOUT_MS = 30000;
const API_BASE = "/api/connect/verify";

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for polling pixel verification status.
 *
 * @param siteId - The site ID to verify, or null to disable
 * @returns Verification state and control functions
 *
 * @example
 * ```tsx
 * const { status, location, startPolling, stopPolling, checkNow } =
 *   useVerificationPoll(siteId);
 *
 * // Start polling after user completes installation steps
 * useEffect(() => {
 *   if (completedGuide) startPolling();
 *   return () => stopPolling();
 * }, [completedGuide]);
 *
 * // Show success when detected
 * if (status === "detected" || status === "verified") {
 *   return <SuccessScreen location={location} />;
 * }
 * ```
 */
export function useVerificationPoll(
  siteId: string | null
): UseVerificationPollReturn {
  const [state, setState] = useState<VerificationState>({
    status: "pending",
    isPolling: false,
    attempts: 0,
  });

  // Refs for cleanup and polling control
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPollingRef = useRef(false);

  /**
   * Fetch verification status from API.
   */
  const fetchStatus = useCallback(
    async (signal: AbortSignal) => {
      if (!siteId) return null;

      const url = `${API_BASE}?siteId=${encodeURIComponent(siteId)}&timeoutMs=${POLL_TIMEOUT_MS}`;

      const response = await fetch(url, { signal });

      if (!response.ok) {
        throw new Error("Verification request failed");
      }

      return response.json();
    },
    [siteId]
  );

  /**
   * Process API response and update state.
   * Returns true if polling should stop.
   */
  const processResponse = useCallback(
    (
      data: {
        status: VerificationStatusType;
        pingCount?: number;
        firstPing?: string;
        lastPing?: string;
        location?: GeoLocation;
        timedOut?: boolean;
      },
      currentAttempts: number
    ): boolean => {
      const newStatus = data.status;

      // Success states - stop polling
      if (newStatus === "detected" || newStatus === "verified") {
        setState({
          status: newStatus,
          isPolling: false,
          attempts: currentAttempts,
          location: data.location,
          firstPing: data.firstPing,
          lastPing: data.lastPing,
          pingCount: data.pingCount,
        });
        return true;
      }

      // Error state - stop polling
      if (newStatus === "error") {
        setState({
          status: "error",
          isPolling: false,
          attempts: currentAttempts,
          error: "Installation verification failed",
        });
        return true;
      }

      // Timeout or still pending
      if (data.timedOut) {
        const newAttempts = currentAttempts + 1;

        // Max attempts reached
        if (newAttempts >= MAX_ATTEMPTS) {
          setState({
            status: "pending",
            isPolling: false,
            attempts: newAttempts,
          });
          return true;
        }

        // Continue polling
        setState((prev) => ({
          ...prev,
          attempts: newAttempts,
        }));
        return false;
      }

      // Still pending, continue
      return false;
    },
    []
  );

  /**
   * Main polling loop.
   */
  const poll = useCallback(async () => {
    if (!siteId) return;

    let attempts = 0;

    while (isPollingRef.current && attempts < MAX_ATTEMPTS) {
      try {
        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        const data = await fetchStatus(abortControllerRef.current.signal);

        if (!data || !isPollingRef.current) break;

        const shouldStop = processResponse(data, attempts);
        if (shouldStop) break;

        // If timed out, increment attempts for next iteration
        if (data.timedOut) {
          attempts++;
        }
      } catch (error) {
        // Abort errors are expected on cleanup
        if (error instanceof Error && error.name === "AbortError") {
          break;
        }

        // Network or other error
        setState({
          status: "error",
          isPolling: false,
          attempts,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        break;
      }
    }

    // Ensure isPolling is false when loop exits
    if (isPollingRef.current) {
      isPollingRef.current = false;
      setState((prev) => ({ ...prev, isPolling: false }));
    }
  }, [siteId, fetchStatus, processResponse]);

  /**
   * Start polling for verification.
   */
  const startPolling = useCallback(() => {
    if (!siteId || isPollingRef.current) return;

    isPollingRef.current = true;
    setState({
      status: "pending",
      isPolling: true,
      attempts: 0,
    });

    poll();
  }, [siteId, poll]);

  /**
   * Stop polling.
   */
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  /**
   * Make a single verification check (no polling).
   */
  const checkNow = useCallback(async () => {
    if (!siteId) return;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const data = await fetchStatus(controller.signal);

      if (data) {
        setState({
          status: data.status,
          isPolling: false,
          attempts: state.attempts,
          location: data.location,
          firstPing: data.firstPing,
          lastPing: data.lastPing,
          pingCount: data.pingCount,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setState({
        status: "error",
        isPolling: false,
        attempts: state.attempts,
        error: error instanceof Error ? error.message : "Verification failed",
      });
    }
  }, [siteId, fetchStatus, state.attempts]);

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      isPollingRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    startPolling,
    stopPolling,
    checkNow,
  };
}

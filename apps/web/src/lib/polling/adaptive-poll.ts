/**
 * Adaptive Polling Utilities with Exponential Backoff
 * PERF FIX (MEDIUM-03): Implements intelligent polling to reduce unnecessary API calls.
 *
 * Features:
 * - Exponential backoff: Increases delay between polls when status unchanged
 * - Success reset: Reverts to fast polling when changes detected
 * - Jitter: Adds random variation to prevent thundering herd
 * - Max backoff: Caps delay at reasonable limit
 * - Activity-aware: Pauses polling when tab not visible
 */

// ============================================================================
// Types
// ============================================================================

export interface AdaptivePollConfig {
  /** Initial delay between polls in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay between polls in ms (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier?: number;
  /** Jitter factor 0-1 (default: 0.2 = 20% random variation) */
  jitterFactor?: number;
  /** Maximum number of polls before stopping (default: 60) */
  maxAttempts?: number;
  /** Whether to pause when tab is not visible (default: true) */
  pauseOnHidden?: boolean;
}

export interface PollState<T> {
  /** Last successful response data */
  data: T | null;
  /** Current error if any */
  error: Error | null;
  /** Whether currently polling */
  isPolling: boolean;
  /** Number of poll attempts made */
  attempts: number;
  /** Current delay between polls in ms */
  currentDelayMs: number;
  /** Whether polling is paused (e.g., tab hidden) */
  isPaused: boolean;
}

export interface AdaptivePollResult<T> {
  /** Current poll state */
  state: PollState<T>;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Force an immediate poll */
  pollNow: () => Promise<T | null>;
  /** Reset backoff to initial delay */
  resetBackoff: () => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<AdaptivePollConfig> = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 1.5,
  jitterFactor: 0.2,
  maxAttempts: 60,
  pauseOnHidden: true,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate next delay with exponential backoff and jitter.
 */
export function calculateNextDelay(
  currentDelay: number,
  config: Required<AdaptivePollConfig>
): number {
  // Apply backoff multiplier
  let nextDelay = currentDelay * config.backoffMultiplier;

  // Apply jitter (random variation to prevent thundering herd)
  const jitter = nextDelay * config.jitterFactor * (Math.random() - 0.5) * 2;
  nextDelay += jitter;

  // Cap at maximum delay
  return Math.min(nextDelay, config.maxDelayMs);
}

/**
 * Create an adaptive polling function.
 *
 * @param fetcher - Async function that fetches data
 * @param onChange - Callback when data changes (returns true if changed)
 * @param config - Polling configuration
 * @returns Poll control functions and state
 *
 * @example
 * ```typescript
 * const poll = createAdaptivePoll(
 *   async () => fetch('/api/status').then(r => r.json()),
 *   (prev, next) => prev?.status !== next?.status,
 *   { initialDelayMs: 2000, maxDelayMs: 30000 }
 * );
 *
 * poll.start();
 * // ... later
 * poll.stop();
 * ```
 */
export function createAdaptivePoll<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  onChange: (prev: T | null, next: T) => boolean,
  config: AdaptivePollConfig = {}
): AdaptivePollResult<T> {
  const mergedConfig: Required<AdaptivePollConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let state: PollState<T> = {
    data: null,
    error: null,
    isPolling: false,
    attempts: 0,
    currentDelayMs: mergedConfig.initialDelayMs,
    isPaused: false,
  };

  let abortController: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let visibilityHandler: (() => void) | null = null;

  const updateState = (updates: Partial<PollState<T>>) => {
    state = { ...state, ...updates };
  };

  const poll = async (): Promise<T | null> => {
    if (state.isPaused) return null;

    abortController = new AbortController();

    try {
      const data = await fetcher(abortController.signal);
      const hasChanged = onChange(state.data, data);

      if (hasChanged) {
        // Reset backoff on change
        updateState({
          data,
          error: null,
          currentDelayMs: mergedConfig.initialDelayMs,
          attempts: state.attempts + 1,
        });
      } else {
        // Apply backoff for unchanged data
        const nextDelay = calculateNextDelay(state.currentDelayMs, mergedConfig);
        updateState({
          data,
          error: null,
          currentDelayMs: nextDelay,
          attempts: state.attempts + 1,
        });
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return null;
      }

      // Apply backoff on error too
      const nextDelay = calculateNextDelay(state.currentDelayMs, mergedConfig);
      updateState({
        error: error instanceof Error ? error : new Error(String(error)),
        currentDelayMs: nextDelay,
        attempts: state.attempts + 1,
      });

      return null;
    }
  };

  const scheduleNext = () => {
    if (!state.isPolling || state.isPaused) return;
    if (state.attempts >= mergedConfig.maxAttempts) {
      updateState({ isPolling: false });
      return;
    }

    timeoutId = setTimeout(async () => {
      await poll();
      scheduleNext();
    }, state.currentDelayMs);
  };

  const start = () => {
    if (state.isPolling) return;

    updateState({
      isPolling: true,
      attempts: 0,
      currentDelayMs: mergedConfig.initialDelayMs,
      error: null,
    });

    // Setup visibility handler for pause-on-hidden
    if (mergedConfig.pauseOnHidden && typeof document !== "undefined") {
      visibilityHandler = () => {
        const isHidden = document.visibilityState === "hidden";
        updateState({ isPaused: isHidden });

        if (!isHidden && state.isPolling) {
          // Resume polling when tab becomes visible
          scheduleNext();
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);
    }

    // Start immediately
    poll().then(() => scheduleNext());
  };

  const stop = () => {
    updateState({ isPolling: false });

    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
  };

  const pollNow = async (): Promise<T | null> => {
    // Cancel scheduled poll
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const result = await poll();

    // Reschedule if still polling
    if (state.isPolling) {
      scheduleNext();
    }

    return result;
  };

  const resetBackoff = () => {
    updateState({ currentDelayMs: mergedConfig.initialDelayMs });
  };

  return {
    get state() {
      return state;
    },
    start,
    stop,
    pollNow,
    resetBackoff,
  };
}

/**
 * Calculate polling delay based on consecutive unchanged responses.
 * Useful for simpler polling scenarios.
 *
 * @param unchangedCount - Number of consecutive unchanged responses
 * @param config - Polling configuration
 * @returns Delay in milliseconds
 */
export function getAdaptiveDelay(
  unchangedCount: number,
  config: Partial<AdaptivePollConfig> = {}
): number {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate delay with exponential backoff
  let delay = mergedConfig.initialDelayMs * Math.pow(mergedConfig.backoffMultiplier, unchangedCount);

  // Apply jitter
  const jitter = delay * mergedConfig.jitterFactor * (Math.random() - 0.5) * 2;
  delay += jitter;

  // Cap at max
  return Math.min(Math.round(delay), mergedConfig.maxDelayMs);
}

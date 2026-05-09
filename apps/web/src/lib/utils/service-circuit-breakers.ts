/**
 * Service Circuit Breakers
 *
 * Centralized circuit breakers for cross-service calls to AI-Writer and open-seo-main.
 * Prevents cascading failures when backend services become unavailable.
 *
 * HIGH-02 DOCUMENTATION: Circuit Breaker Behavior Differences
 *
 * This apps/web circuit breaker uses in-memory state (per Next.js server instance).
 * The AI-Writer circuit breaker in autonomous_pipeline.py also uses in-memory state.
 * These are INDEPENDENT - if apps/web opens its circuit, AI-Writer won't know and vice versa.
 *
 * Design Decision: Each service manages its own circuit breaker state because:
 * 1. Services have different failure patterns and thresholds
 * 2. Network issues may affect one service but not another
 * 3. Avoiding Redis dependency for simple circuit breaking keeps latency low
 *
 * For multi-instance deployments (e.g., multiple Next.js pods), consider:
 * - Redis-backed state sharing via @upstash/ratelimit or similar
 * - Health check endpoint that aggregates circuit states
 * - Observability dashboards showing all circuit states across instances
 *
 * Usage:
 * - Import the appropriate breaker for your service call
 * - Wrap fetch operations with breaker.execute()
 * - Handle CircuitOpenError gracefully with user-friendly messages
 *
 * @example
 * ```typescript
 * import { AI_WRITER_BREAKER, wrapWithCircuitBreaker, getServiceErrorMessage } from './service-circuit-breakers';
 *
 * try {
 *   const result = await wrapWithCircuitBreaker(AI_WRITER_BREAKER, () => fetchFromAIWriter());
 * } catch (e) {
 *   return { error: getServiceErrorMessage(e) };
 * }
 * ```
 */

import { logger } from '@/lib/logger';

import {
  getCircuitBreaker,
  CircuitOpenError,
  getAllCircuitBreakerStates,
  type CircuitBreakerOptions,
  type CircuitState,
} from "./circuit-breaker";

// Re-export for consumers
export { CircuitOpenError, getAllCircuitBreakerStates };
export type { CircuitState };

// ============================================================================
// Circuit Breaker Configurations
// ============================================================================

/**
 * AI-Writer backend circuit breaker configuration.
 * More lenient since AI operations can be slow.
 */
const AI_WRITER_CONFIG: Partial<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeout: 60_000, // 60 seconds recovery window
  onStateChange: (state, name) => {
    console.warn(`[CircuitBreaker] ${name} state changed to: ${state}`);
  },
};

/**
 * open-seo-main backend circuit breaker configuration.
 * Standard configuration for SEO API calls.
 */
const OPEN_SEO_CONFIG: Partial<CircuitBreakerOptions> = {
  failureThreshold: 5,
  resetTimeout: 60_000, // 60 seconds recovery window
  onStateChange: (state, name) => {
    console.warn(`[CircuitBreaker] ${name} state changed to: ${state}`);
  },
};

/**
 * Voice API circuit breaker configuration.
 * Slightly more tolerant since voice analysis can be slow.
 */
const VOICE_API_CONFIG: Partial<CircuitBreakerOptions> = {
  failureThreshold: 7, // Voice operations have higher latency
  resetTimeout: 90_000, // 90 seconds recovery window
  onStateChange: (state, name) => {
    console.warn(`[CircuitBreaker] ${name} state changed to: ${state}`);
  },
};

// ============================================================================
// Service Circuit Breakers (Singleton Instances)
// ============================================================================

/**
 * Circuit breaker for AI-Writer FastAPI backend calls.
 * Used by: server-fetch.ts (getFastApi, postFastApi, etc.)
 */
export const AI_WRITER_BREAKER = getCircuitBreaker("ai-writer", AI_WRITER_CONFIG);

/**
 * Circuit breaker for open-seo-main backend calls.
 * Used by: server-fetch.ts (getOpenSeo, postOpenSeo, etc.)
 */
export const OPEN_SEO_BREAKER = getCircuitBreaker("open-seo", OPEN_SEO_CONFIG);

/**
 * Circuit breaker for Voice API calls.
 * Used by: voiceApi.ts (fetchVoiceProfile, updateVoiceProfile, etc.)
 */
export const VOICE_API_BREAKER = getCircuitBreaker("voice-api", VOICE_API_CONFIG);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wrap an async operation with circuit breaker protection.
 * Provides cleaner API for one-off wrapped calls.
 *
 * @param breaker - Circuit breaker instance to use
 * @param fn - Async function to execute
 * @returns Promise resolving to function result
 * @throws CircuitOpenError if circuit is open
 * @throws Original error if function fails
 */
export async function wrapWithCircuitBreaker<T>(
  breaker: ReturnType<typeof getCircuitBreaker>,
  fn: () => Promise<T>
): Promise<T> {
  return breaker.execute(fn);
}

/**
 * Get a user-friendly error message for service errors.
 * Handles CircuitOpenError specially to explain service unavailability.
 *
 * @param error - Error to extract message from
 * @returns User-friendly error message
 */
export function getServiceErrorMessage(error: unknown): string {
  if (error instanceof CircuitOpenError) {
    return `Service temporarily unavailable. Please try again in ${Math.ceil(error.remainingMs / 1000)} seconds.`;
  }

  if (error instanceof Error) {
    // Don't expose internal error details to users
    if (error.message.includes("timeout") || error.message.includes("Timeout")) {
      return "Request timed out. Please try again.";
    }
    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      return "Unable to connect to service. Please try again later.";
    }
    // Return generic message for other errors
    return "An error occurred. Please try again.";
  }

  return "An unexpected error occurred.";
}

/**
 * Check if a service is currently available (circuit not open).
 *
 * @param service - Service name ('ai-writer' | 'open-seo' | 'voice-api')
 * @returns True if service is accepting requests
 */
export function isServiceAvailable(service: "ai-writer" | "open-seo" | "voice-api"): boolean {
  switch (service) {
    case "ai-writer":
      return AI_WRITER_BREAKER.isAllowingRequests();
    case "open-seo":
      return OPEN_SEO_BREAKER.isAllowingRequests();
    case "voice-api":
      return VOICE_API_BREAKER.isAllowingRequests();
    default:
      return true;
  }
}

/**
 * Get circuit breaker states for health monitoring.
 * Returns state information for all service circuit breakers.
 */
export function getServiceCircuitStates(): Record<
  string,
  {
    state: CircuitState;
    failures: number;
    threshold: number;
    lastFailure: number | null;
  }
> {
  return getAllCircuitBreakerStates();
}

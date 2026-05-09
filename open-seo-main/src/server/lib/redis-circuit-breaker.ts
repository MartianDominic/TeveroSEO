/**
 * Redis-backed Circuit Breaker for distributed systems.
 *
 * Unlike in-memory circuit breakers, this implementation shares state across
 * all workers via Redis, ensuring consistent circuit breaker behavior in
 * multi-process deployments (BullMQ workers, multiple Node.js instances).
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests rejected
 * - HALF_OPEN: After recovery time, allows one test request
 */

import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "redis-circuit-breaker" });

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  threshold: number;
}

/**
 * Redis-backed circuit breaker for distributed failure handling.
 *
 * All state is stored in Redis, making it shared across all workers/processes.
 * Uses atomic Redis operations to prevent race conditions.
 */
/**
 * In-memory circuit state fallback for when Redis is unavailable.
 * Uses a simple Map with TTL-based cleanup.
 */
const inMemoryCircuitState = new Map<string, {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  expiresAt: number;
}>();

/**
 * Clean up expired in-memory circuit states.
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, value] of inMemoryCircuitState) {
    if (value.expiresAt < now) {
      inMemoryCircuitState.delete(key);
    }
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupExpiredStates, 60000);

export class RedisCircuitBreaker {
  private readonly key: string;
  private readonly threshold: number;
  private readonly recoveryTimeMs: number;

  /**
   * Create a new Redis-backed circuit breaker.
   *
   * @param name - Unique name for this circuit breaker (e.g., "dataforseo", "anthropic")
   * @param threshold - Number of failures before opening the circuit (default: 5)
   * @param recoveryTimeMs - Time in ms before attempting recovery (default: 60000)
   */
  constructor(name: string, threshold = 5, recoveryTimeMs = 60000) {
    this.key = `circuit:${name}`;
    this.threshold = threshold;
    this.recoveryTimeMs = recoveryTimeMs;
  }

  /**
   * Check if circuit is open (rejecting requests).
   * Automatically transitions to half-open if recovery time has passed.
   */
  async isOpen(): Promise<boolean> {
    try {
      const state = await redis.hgetall(this.key);

      if (!state.state || state.state === "closed") {
        return false;
      }

      if (state.state === "open") {
        const lastFailureTime = parseInt(state.lastFailureTime || "0", 10);
        const elapsed = Date.now() - lastFailureTime;

        if (elapsed > this.recoveryTimeMs) {
          // Transition to half-open
          await this.setHalfOpen();
          log.info("Circuit breaker entering half-open state", { name: this.key });
          return false;
        }
        return true;
      }

      // half-open state allows requests through for testing
      return false;
    } catch (error) {
      // If Redis is unavailable, fall back to in-memory state
      log.warn("Circuit breaker Redis check failed, using in-memory fallback", {
        name: this.key,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.isOpenInMemory();
    }
  }

  /**
   * Get remaining recovery time in milliseconds.
   */
  async getRemainingRecoveryTime(): Promise<number> {
    try {
      const state = await redis.hgetall(this.key);
      if (state.state !== "open") return 0;

      const lastFailureTime = parseInt(state.lastFailureTime || "0", 10);
      const elapsed = Date.now() - lastFailureTime;
      return Math.max(0, this.recoveryTimeMs - elapsed);
    } catch {
      return 0;
    }
  }

  /**
   * Record a successful request.
   * Resets the circuit breaker to closed state.
   */
  async recordSuccess(): Promise<void> {
    try {
      const state = await redis.hget(this.key, "state");

      if (state === "half-open") {
        log.info("Circuit breaker closed after successful test request", { name: this.key });
      }

      // Reset all state atomically
      await redis.del(this.key);
    } catch (error) {
      log.warn("Circuit breaker recordSuccess failed, using in-memory fallback", {
        name: this.key,
        error: error instanceof Error ? error.message : String(error),
      });
      this.recordSuccessInMemory();
    }
  }

  /**
   * Record a failed request.
   * Opens the circuit if failure threshold is exceeded.
   */
  async recordFailure(): Promise<void> {
    try {
      // Use pipeline for atomic operations
      const pipeline = redis.pipeline();
      pipeline.hincrby(this.key, "failures", 1);
      pipeline.hset(this.key, "lastFailureTime", Date.now().toString());
      const results = await pipeline.exec();

      // Get the new failure count from the HINCRBY result
      const failuresResult = results?.[0];
      const failures = typeof failuresResult?.[1] === "number" ? failuresResult[1] : 0;

      if (failures >= this.threshold) {
        await redis.hset(this.key, "state", "open");
        log.error("Circuit breaker opened due to failures", undefined, {
          name: this.key,
          failures,
          threshold: this.threshold,
        });
      }

      // Set TTL to auto-cleanup stale circuit breaker state (2x recovery time)
      await redis.expire(this.key, Math.ceil((this.recoveryTimeMs * 2) / 1000));
    } catch (error) {
      log.warn("Circuit breaker recordFailure failed, using in-memory fallback", {
        name: this.key,
        error: error instanceof Error ? error.message : String(error),
      });
      this.recordFailureInMemory();
    }
  }

  /**
   * Get current state for monitoring.
   */
  async getState(): Promise<CircuitBreakerState> {
    try {
      const state = await redis.hgetall(this.key);
      return {
        state: (state.state as CircuitState) || "closed",
        failures: parseInt(state.failures || "0", 10),
        lastFailureTime: parseInt(state.lastFailureTime || "0", 10),
        threshold: this.threshold,
      };
    } catch {
      return {
        state: "closed",
        failures: 0,
        lastFailureTime: 0,
        threshold: this.threshold,
      };
    }
  }

  /**
   * Reset circuit breaker to closed state.
   */
  async reset(): Promise<void> {
    try {
      await redis.del(this.key);
      log.info("Circuit breaker manually reset", { name: this.key });
    } catch (error) {
      log.warn("Circuit breaker reset failed", {
        name: this.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set circuit to half-open state.
   */
  private async setHalfOpen(): Promise<void> {
    await redis.hset(this.key, "state", "half-open");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // In-Memory Fallback Methods (used when Redis is unavailable)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if circuit is open using in-memory state (fallback).
   */
  private isOpenInMemory(): boolean {
    const state = inMemoryCircuitState.get(this.key);
    if (!state || state.state === "closed") {
      return false;
    }

    if (state.state === "open") {
      const elapsed = Date.now() - state.lastFailureTime;
      if (elapsed > this.recoveryTimeMs) {
        // Transition to half-open
        state.state = "half-open";
        log.info("Circuit breaker entering half-open state (in-memory)", { name: this.key });
        return false;
      }
      return true;
    }

    // half-open state allows requests through for testing
    return false;
  }

  /**
   * Record a failure using in-memory state (fallback).
   */
  private recordFailureInMemory(): void {
    const existing = inMemoryCircuitState.get(this.key);
    const now = Date.now();
    const failures = (existing?.failures ?? 0) + 1;
    const newState: CircuitState = failures >= this.threshold ? "open" : (existing?.state ?? "closed");

    inMemoryCircuitState.set(this.key, {
      state: newState,
      failures,
      lastFailureTime: now,
      expiresAt: now + this.recoveryTimeMs * 2,
    });

    if (newState === "open" && existing?.state !== "open") {
      log.error("Circuit breaker opened due to failures (in-memory)", undefined, {
        name: this.key,
        failures,
        threshold: this.threshold,
      });
    }
  }

  /**
   * Record a success using in-memory state (fallback).
   */
  private recordSuccessInMemory(): void {
    inMemoryCircuitState.delete(this.key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-configured Circuit Breakers for External APIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Circuit breaker for DataForSEO API.
 * Opens after 5 failures, recovers after 2 minutes.
 */
export const dataForSeoCircuitBreaker = new RedisCircuitBreaker(
  "dataforseo",
  5,
  120000,
);

/**
 * Circuit breaker for Anthropic Claude API.
 * Opens after 3 failures, recovers after 1 minute.
 */
export const anthropicCircuitBreaker = new RedisCircuitBreaker(
  "anthropic",
  3,
  60000,
);

/**
 * Circuit breaker for OpenAI API.
 * Opens after 3 failures, recovers after 1 minute.
 */
export const openaiCircuitBreaker = new RedisCircuitBreaker(
  "openai",
  3,
  60000,
);

/**
 * Circuit breaker for SERP API.
 * Opens after 5 failures, recovers after 1 minute.
 */
export const serpApiCircuitBreaker = new RedisCircuitBreaker(
  "serpapi",
  5,
  60000,
);

/**
 * Circuit breaker for Jina AI API.
 * Opens after 5 failures, recovers after 1 minute.
 */
export const jinaCircuitBreaker = new RedisCircuitBreaker(
  "jina",
  5,
  60000,
);

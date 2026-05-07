/**
 * DfsErrorHandler Tests
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  classifyDfsError,
  isRetryableError,
  shouldEscalateTier,
  getDfsErrorMessage,
  escalateTier,
  calculateBackoffDelay,
  withRetry,
  DfsCircuitBreaker,
  buildDfsError,
  getDfsCircuitBreaker,
  resetDfsCircuitBreaker,
} from "./DfsErrorHandler";
import { DEFAULT_DFS_RETRY_CONFIG } from "./DataForSEOFetcher.types";

// =============================================================================
// classifyDfsError Tests
// =============================================================================

describe("classifyDfsError", () => {
  it("should classify rate limit error", () => {
    expect(classifyDfsError(20002)).toBe("rate_limited");
    expect(classifyDfsError(undefined, 429)).toBe("rate_limited");
  });

  it("should classify timeout errors", () => {
    // 50001 is "target unreachable" which maps to timeout
    // 50002 is "target timeout" which maps to timeout
    expect(classifyDfsError(50002)).toBe("timeout");
    expect(classifyDfsError(undefined, undefined, "connection timeout")).toBe("timeout");
  });

  it("should classify captcha detection", () => {
    expect(classifyDfsError(50007)).toBe("captcha");
    expect(classifyDfsError(undefined, undefined, "captcha required")).toBe("captcha");
  });

  it("should classify bot detection", () => {
    expect(classifyDfsError(50008)).toBe("bot_detected");
    expect(classifyDfsError(50003)).toBe("bot_detected");
  });

  it("should classify JS required", () => {
    expect(classifyDfsError(50004)).toBe("js_required");
    expect(classifyDfsError(50005)).toBe("js_required");
    expect(classifyDfsError(undefined, undefined, "javascript rendering failed")).toBe("js_required");
  });

  it("should classify IP blocked", () => {
    expect(classifyDfsError(undefined, 403)).toBe("ip_blocked");
    expect(classifyDfsError(undefined, undefined, "access blocked")).toBe("ip_blocked");
  });

  it("should classify empty response", () => {
    expect(classifyDfsError(undefined, undefined, "empty response received")).toBe("empty_response");
    expect(classifyDfsError(undefined, undefined, "no content returned")).toBe("empty_response");
  });

  it("should classify SSL errors", () => {
    expect(classifyDfsError(undefined, undefined, "ssl handshake failed")).toBe("ssl_error");
    expect(classifyDfsError(undefined, undefined, "tls error")).toBe("ssl_error");
  });

  it("should classify DNS errors", () => {
    expect(classifyDfsError(undefined, undefined, "dns resolution failed")).toBe("dns_error");
  });

  it("should classify connection reset", () => {
    expect(classifyDfsError(undefined, undefined, "connection reset by peer")).toBe("connection_reset");
    expect(classifyDfsError(undefined, 500)).toBe("connection_reset");
  });

  it("should default to bot_detected for unknown errors", () => {
    expect(classifyDfsError(99999)).toBe("bot_detected");
    expect(classifyDfsError(undefined, undefined, "unknown error")).toBe("bot_detected");
  });
});

// =============================================================================
// isRetryableError Tests
// =============================================================================

describe("isRetryableError", () => {
  it("should return true for rate limit error", () => {
    expect(isRetryableError(20002)).toBe(true);
  });

  it("should return true for server errors", () => {
    expect(isRetryableError(60001)).toBe(true);
    expect(isRetryableError(60002)).toBe(true);
    expect(isRetryableError(60003)).toBe(true);
  });

  it("should return false for client errors", () => {
    expect(isRetryableError(40001)).toBe(false);
    expect(isRetryableError(40100)).toBe(false);
  });

  it("should return false for fetch errors", () => {
    expect(isRetryableError(50001)).toBe(false);
    expect(isRetryableError(50007)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isRetryableError(undefined)).toBe(false);
  });
});

// =============================================================================
// shouldEscalateTier Tests
// =============================================================================

describe("shouldEscalateTier", () => {
  it("should return true for target unreachable", () => {
    expect(shouldEscalateTier(50001)).toBe(true);
  });

  it("should return true for timeout", () => {
    expect(shouldEscalateTier(50002)).toBe(true);
  });

  it("should return true for JS/browser failures", () => {
    expect(shouldEscalateTier(50004)).toBe(true);
    expect(shouldEscalateTier(50005)).toBe(true);
  });

  it("should return true for captcha and bot detection", () => {
    expect(shouldEscalateTier(50007)).toBe(true);
    expect(shouldEscalateTier(50008)).toBe(true);
  });

  it("should return false for rate limit", () => {
    expect(shouldEscalateTier(20002)).toBe(false);
  });

  it("should return false for server errors", () => {
    expect(shouldEscalateTier(60001)).toBe(false);
  });
});

// =============================================================================
// getDfsErrorMessage Tests
// =============================================================================

describe("getDfsErrorMessage", () => {
  it("should return message for known codes", () => {
    expect(getDfsErrorMessage(20000)).toBe("OK");
    expect(getDfsErrorMessage(20002)).toBe("Rate limit exceeded");
    expect(getDfsErrorMessage(50007)).toBe("CAPTCHA detected");
  });

  it("should return unknown for unrecognized codes", () => {
    expect(getDfsErrorMessage(99999)).toBe("Unknown error (99999)");
  });
});

// =============================================================================
// escalateTier Tests
// =============================================================================

describe("escalateTier", () => {
  it("should escalate basic to js", () => {
    const result = escalateTier("basic");
    expect(result.mode).toBe("js");
    expect(result.cost).toBe(0.00125);
    expect(result.canEscalate).toBe(true);
  });

  it("should escalate js to browser", () => {
    const result = escalateTier("js");
    expect(result.mode).toBe("browser");
    expect(result.cost).toBe(0.00425);
    expect(result.canEscalate).toBe(true);
  });

  it("should not escalate beyond browser", () => {
    const result = escalateTier("browser");
    expect(result.mode).toBe("browser");
    expect(result.canEscalate).toBe(false);
  });
});

// =============================================================================
// calculateBackoffDelay Tests
// =============================================================================

describe("calculateBackoffDelay", () => {
  it("should return base delay for first attempt", () => {
    const delay = calculateBackoffDelay(0);
    // Base delay is 1000ms, plus jitter 0-1000ms
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(2000);
  });

  it("should double delay for each attempt", () => {
    // Attempt 1: 2000 + jitter
    // Attempt 2: 4000 + jitter
    const delay1 = calculateBackoffDelay(1);
    expect(delay1).toBeGreaterThanOrEqual(2000);
    expect(delay1).toBeLessThanOrEqual(3000);

    const delay2 = calculateBackoffDelay(2);
    expect(delay2).toBeGreaterThanOrEqual(4000);
    expect(delay2).toBeLessThanOrEqual(5000);
  });

  it("should cap at maxDelay", () => {
    const delay = calculateBackoffDelay(10); // Would be 1024000ms without cap
    expect(delay).toBeLessThanOrEqual(DEFAULT_DFS_RETRY_CONFIG.maxDelayMs + 1000);
  });
});

// =============================================================================
// withRetry Tests
// =============================================================================

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("error code: 60001"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, {
      ...DEFAULT_DFS_RETRY_CONFIG,
      maxRetries: 3,
      baseDelayMs: 10, // Fast for tests
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not retry on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("error code: 40001"));

    await expect(
      withRetry(fn, {
        ...DEFAULT_DFS_RETRY_CONFIG,
        maxRetries: 3,
      })
    ).rejects.toThrow("error code: 40001");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should call onRetry callback", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("error code: 60001"))
      .mockResolvedValue("success");

    await withRetry(
      fn,
      {
        ...DEFAULT_DFS_RETRY_CONFIG,
        maxRetries: 3,
        baseDelayMs: 10,
      },
      onRetry
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
  });

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("error code: 60001"));

    await expect(
      withRetry(fn, {
        ...DEFAULT_DFS_RETRY_CONFIG,
        maxRetries: 2,
        baseDelayMs: 10,
      })
    ).rejects.toThrow("error code: 60001");

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

// =============================================================================
// DfsCircuitBreaker Tests
// =============================================================================

describe("DfsCircuitBreaker", () => {
  let breaker: DfsCircuitBreaker;

  beforeEach(() => {
    breaker = new DfsCircuitBreaker({
      failureThreshold: 3,
      recoveryTimeoutMs: 100, // Fast for tests
      successThreshold: 2,
    });
  });

  it("should start in closed state", () => {
    expect(breaker.getState()).toBe("closed");
    expect(breaker.isHealthy()).toBe(true);
  });

  it("should allow requests in closed state", async () => {
    const result = await breaker.execute(() => Promise.resolve("success"));
    expect(result).toBe("success");
  });

  it("should open after failure threshold", async () => {
    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    expect(breaker.getState()).toBe("open");
    expect(breaker.isHealthy()).toBe(false);
  });

  it("should reject requests when open", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    await expect(breaker.execute(() => Promise.resolve("success"))).rejects.toThrow(
      "DataForSEO circuit breaker is open"
    );
  });

  it("should transition to half-open after recovery timeout", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // Wait for recovery timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Next call should transition to half-open and allow through
    const result = await breaker.execute(() => Promise.resolve("success"));
    expect(result).toBe("success");
    expect(breaker.getState()).toBe("half-open");
  });

  it("should close after success threshold in half-open", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // Wait for recovery timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Success threshold is 2
    await breaker.execute(() => Promise.resolve("success"));
    expect(breaker.getState()).toBe("half-open");

    await breaker.execute(() => Promise.resolve("success"));
    expect(breaker.getState()).toBe("closed");
  });

  it("should reopen on failure in half-open", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    // Wait for recovery timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Transition to half-open with a success
    await breaker.execute(() => Promise.resolve("success"));
    expect(breaker.getState()).toBe("half-open");

    // Failure reopens
    await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    expect(breaker.getState()).toBe("open");
  });

  it("should reset on manual reset call", () => {
    // Put in failed state
    breaker["failures"] = 5;
    breaker["state"] = "open";

    breaker.reset();

    expect(breaker.getState()).toBe("closed");
    expect(breaker.getFailureCount()).toBe(0);
  });
});

// =============================================================================
// buildDfsError Tests
// =============================================================================

describe("buildDfsError", () => {
  it("should include base message", () => {
    const error = buildDfsError("Fetch failed", {});
    expect(error.message).toBe("Fetch failed");
  });

  it("should include URL", () => {
    const error = buildDfsError("Fetch failed", { url: "https://example.com" });
    expect(error.message).toContain("URL: https://example.com");
  });

  it("should include mode", () => {
    const error = buildDfsError("Fetch failed", { mode: "js" });
    expect(error.message).toContain("Mode: js");
  });

  it("should include error code with message", () => {
    const error = buildDfsError("Fetch failed", { errorCode: 50007 });
    expect(error.message).toContain("DFS Error: 50007 (CAPTCHA detected)");
  });

  it("should include HTTP status", () => {
    const error = buildDfsError("Fetch failed", { statusCode: 403 });
    expect(error.message).toContain("HTTP: 403");
  });

  it("should include attempt number", () => {
    const error = buildDfsError("Fetch failed", { attempt: 2 });
    expect(error.message).toContain("Attempt: 3"); // 0-indexed, displayed as 1-indexed
  });

  it("should combine all context", () => {
    const error = buildDfsError("Fetch failed", {
      url: "https://example.com",
      mode: "browser",
      errorCode: 50002,
      statusCode: 504,
      attempt: 1,
    });

    expect(error.message).toContain("Fetch failed");
    expect(error.message).toContain("URL: https://example.com");
    expect(error.message).toContain("Mode: browser");
    expect(error.message).toContain("DFS Error: 50002");
    expect(error.message).toContain("HTTP: 504");
    expect(error.message).toContain("Attempt: 2");
  });
});

// =============================================================================
// Singleton Tests
// =============================================================================

describe("Circuit Breaker Singleton", () => {
  beforeEach(() => {
    resetDfsCircuitBreaker();
  });

  it("should return same instance", () => {
    const breaker1 = getDfsCircuitBreaker();
    const breaker2 = getDfsCircuitBreaker();
    expect(breaker1).toBe(breaker2);
  });

  it("should reset singleton", () => {
    const breaker1 = getDfsCircuitBreaker();
    breaker1["failures"] = 5;

    resetDfsCircuitBreaker();

    const breaker2 = getDfsCircuitBreaker();
    expect(breaker2.getFailureCount()).toBe(0);
  });
});

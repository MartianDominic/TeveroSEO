/**
 * Tests for retry service utility.
 * DUP-006 FIX: Consolidated retry logic tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  withRetryResult,
  isRetryableError,
  RETRY_CONFIGS,
  DEFAULT_RETRY_CONFIG,
} from "./retry-service";

// Create retryable errors (network errors are retryable)
function createRetryableError(message: string): Error & { code?: string } {
  const error = new Error(message) as Error & { code?: string };
  error.code = "ECONNRESET"; // Network error codes are retryable
  return error;
}

describe("withRetry", () => {
  it("returns result on first successful call", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable failure and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createRetryableError("fail 1"))
      .mockRejectedValueOnce(createRetryableError("fail 2"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 1, // Use 1ms for fast tests
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries exceeded", async () => {
    const fn = vi.fn().mockRejectedValue(createRetryableError("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 1 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("respects custom isRetryable predicate", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        isRetryable: (error) => !error.message.includes("non-retryable"),
      })
    ).rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1); // No retries due to predicate
  });

  it("calls onRetry callback on each retry", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createRetryableError("fail 1"))
      .mockRejectedValueOnce(createRetryableError("fail 2"))
      .mockResolvedValue("success");

    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 1,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2, expect.any(Number));
  });

  it("throws immediately for non-retryable errors with default predicate", async () => {
    // A generic error without network codes is not retryable by default
    const fn = vi.fn().mockRejectedValue(new Error("validation failed"));

    await expect(
      withRetry(fn, { maxRetries: 3, initialDelayMs: 1 })
    ).rejects.toThrow("validation failed");
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });
});

describe("withRetryResult", () => {
  it("returns success result on successful call", async () => {
    const fn = vi.fn().mockResolvedValue("data");

    const result = await withRetryResult(fn);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("data");
      expect(result.attempts).toBe(1);
    }
  });

  it("returns failure result after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(createRetryableError("persistent failure"));

    const result = await withRetryResult(fn, { maxRetries: 1, initialDelayMs: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error?.message).toBe("persistent failure");
      expect(result.attempts).toBe(2); // Initial + 1 retry
    }
  });

  it("tracks attempt count correctly", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(createRetryableError("fail"))
      .mockRejectedValueOnce(createRetryableError("fail"))
      .mockResolvedValue("success");

    const result = await withRetryResult(fn, { maxRetries: 3, initialDelayMs: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.attempts).toBe(3);
    }
  });

  it("returns failure for non-retryable error without retrying", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("bad request"));

    const result = await withRetryResult(fn, { maxRetries: 3, initialDelayMs: 1 });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // No retries for non-retryable
  });
});

describe("isRetryableError", () => {
  it("returns true for network error codes", () => {
    const errors = ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EPIPE"];
    for (const code of errors) {
      const error = new Error("Network error") as Error & { code: string };
      error.code = code;
      expect(isRetryableError(error)).toBe(true);
    }
  });

  it("returns true for retryable HTTP status codes", () => {
    const statuses = [408, 429, 500, 502, 503, 504];
    for (const status of statuses) {
      const error = new Error("HTTP error") as Error & { status: number };
      error.status = status;
      expect(isRetryableError(error)).toBe(true);
    }
  });

  it("returns true for retryable error message patterns", () => {
    const messages = [
      "Request timeout",
      "Operation timed out",
      "Network error occurred",
      "Socket hang up",
      "Connection reset",
      "Connection refused",
      "Too many requests",
      "Rate limit exceeded",
      "Service unavailable",
      "Bad gateway",
      "Gateway timeout",
    ];
    for (const msg of messages) {
      expect(isRetryableError(new Error(msg))).toBe(true);
    }
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError(new Error("validation failed"))).toBe(false);
    expect(isRetryableError(new Error("not found"))).toBe(false);
    expect(isRetryableError(new Error("unauthorized"))).toBe(false);

    const error404 = new Error("Not found") as Error & { status: number };
    error404.status = 404;
    expect(isRetryableError(error404)).toBe(false);
  });
});

describe("RETRY_CONFIGS", () => {
  it("exports FAST config", () => {
    expect(RETRY_CONFIGS.FAST).toMatchObject({
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
    });
  });

  it("exports STANDARD config", () => {
    expect(RETRY_CONFIGS.STANDARD).toMatchObject({
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    });
  });

  it("exports AGGRESSIVE config", () => {
    expect(RETRY_CONFIGS.AGGRESSIVE).toMatchObject({
      maxRetries: 5,
      initialDelayMs: 500,
      maxDelayMs: 30000,
    });
  });

  it("exports EXTERNAL_API config", () => {
    expect(RETRY_CONFIGS.EXTERNAL_API).toMatchObject({
      maxRetries: 3,
      initialDelayMs: 2000,
      maxDelayMs: 60000,
    });
  });

  it("exports WEBHOOK config", () => {
    expect(RETRY_CONFIGS.WEBHOOK).toMatchObject({
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 300000,
    });
  });
});

describe("DEFAULT_RETRY_CONFIG", () => {
  it("has expected default values", () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    expect(DEFAULT_RETRY_CONFIG.jitter).toBe(0.1);
  });
});

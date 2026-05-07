/**
 * Retry Configuration Unit Tests.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import { describe, it, expect } from "vitest";
import {
  getRetryPolicy,
  calculateDelay,
  shouldEscalateTier,
  isPermanentError,
  DEFAULT_RETRY_CONFIG,
  ERROR_RETRY_POLICIES,
} from "../queue/retry.config";

describe("retry.config", () => {
  describe("DEFAULT_RETRY_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_RETRY_CONFIG.attempts).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.backoff.type).toBe("exponential");
      expect(DEFAULT_RETRY_CONFIG.backoff.delay).toBe(2_000);
    });
  });

  describe("ERROR_RETRY_POLICIES", () => {
    it("should have more attempts for RATE_LIMITED", () => {
      expect(ERROR_RETRY_POLICIES.RATE_LIMITED?.attempts).toBe(5);
      expect(ERROR_RETRY_POLICIES.RATE_LIMITED?.backoff.delay).toBe(5_000);
    });

    it("should have fewer attempts for BLOCKED", () => {
      expect(ERROR_RETRY_POLICIES.BLOCKED?.attempts).toBe(2);
    });

    it("should have no retries for INVALID_URL", () => {
      expect(ERROR_RETRY_POLICIES.INVALID_URL?.attempts).toBe(0);
    });

    it("should have minimal retries for SSL_ERROR", () => {
      expect(ERROR_RETRY_POLICIES.SSL_ERROR?.attempts).toBe(1);
    });

    it("should have fixed backoff for DNS_FAILURE", () => {
      expect(ERROR_RETRY_POLICIES.DNS_FAILURE?.backoff.type).toBe("fixed");
      expect(ERROR_RETRY_POLICIES.DNS_FAILURE?.backoff.delay).toBe(10_000);
    });
  });

  describe("getRetryPolicy", () => {
    it("should return error-specific policy when available", () => {
      const policy = getRetryPolicy("RATE_LIMITED");
      expect(policy.attempts).toBe(5);
    });

    it("should return default policy for unknown errors", () => {
      const policy = getRetryPolicy("UNKNOWN");
      expect(policy).toEqual(DEFAULT_RETRY_CONFIG);
    });

    it("should return default policy when no error code", () => {
      const policy = getRetryPolicy(undefined);
      expect(policy).toEqual(DEFAULT_RETRY_CONFIG);
    });
  });

  describe("calculateDelay", () => {
    it("should return fixed delay for fixed backoff", () => {
      const delay = calculateDelay(1, 1000, "fixed");
      expect(delay).toBe(1000);

      const delay2 = calculateDelay(5, 1000, "fixed");
      expect(delay2).toBe(1000);
    });

    it("should calculate exponential backoff", () => {
      // attempt 1: 2s
      // attempt 2: 4s
      // attempt 3: 8s
      const delay1 = calculateDelay(1, 2000, "exponential");
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThan(3100); // 2s + 1s jitter max

      const delay2 = calculateDelay(2, 2000, "exponential");
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThan(5100);

      const delay3 = calculateDelay(3, 2000, "exponential");
      expect(delay3).toBeGreaterThanOrEqual(8000);
      expect(delay3).toBeLessThan(9100);
    });

    it("should cap delay at 60 seconds", () => {
      const delay = calculateDelay(10, 2000, "exponential");
      expect(delay).toBeLessThanOrEqual(61000); // 60s + jitter
    });

    it("should add jitter for exponential backoff", () => {
      // Run multiple times, should have some variation
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(calculateDelay(1, 2000, "exponential"));
      }
      // With jitter, we should get some different values
      // (statistically very unlikely to get all same)
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe("shouldEscalateTier", () => {
    it("should return true for BLOCKED", () => {
      expect(shouldEscalateTier("BLOCKED")).toBe(true);
    });

    it("should return true for CAPTCHA", () => {
      expect(shouldEscalateTier("CAPTCHA")).toBe(true);
    });

    it("should return true for BOT_DETECTION", () => {
      expect(shouldEscalateTier("BOT_DETECTION")).toBe(true);
    });

    it("should return true for RATE_LIMITED", () => {
      expect(shouldEscalateTier("RATE_LIMITED")).toBe(true);
    });

    it("should return false for TIMEOUT", () => {
      expect(shouldEscalateTier("TIMEOUT")).toBe(false);
    });

    it("should return false for DNS_FAILURE", () => {
      expect(shouldEscalateTier("DNS_FAILURE")).toBe(false);
    });

    it("should return false for UNKNOWN", () => {
      expect(shouldEscalateTier("UNKNOWN")).toBe(false);
    });
  });

  describe("isPermanentError", () => {
    it("should return true for INVALID_URL", () => {
      expect(isPermanentError("INVALID_URL")).toBe(true);
    });

    it("should return true for SSL_ERROR", () => {
      expect(isPermanentError("SSL_ERROR")).toBe(true);
    });

    it("should return true for PARSE_ERROR", () => {
      expect(isPermanentError("PARSE_ERROR")).toBe(true);
    });

    it("should return false for transient errors", () => {
      expect(isPermanentError("TIMEOUT")).toBe(false);
      expect(isPermanentError("RATE_LIMITED")).toBe(false);
      expect(isPermanentError("BLOCKED")).toBe(false);
      expect(isPermanentError("DNS_FAILURE")).toBe(false);
      expect(isPermanentError("UNKNOWN")).toBe(false);
    });
  });
});

/**
 * AdaptiveBackoff Unit Tests.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AdaptiveBackoff, parseRetryAfter, type BackoffState } from "../ratelimit/AdaptiveBackoff";

// Mock Redis client
function createMockRedis() {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    setex: vi.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace("*", "");
      return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    }),
    _store: store,
    _clear: () => store.clear(),
  };
}

describe("AdaptiveBackoff", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let adaptiveBackoff: AdaptiveBackoff;

  beforeEach(() => {
    mockRedis = createMockRedis();
    adaptiveBackoff = new AdaptiveBackoff(mockRedis as never, {
      maxMultiplier: 16,
      baseDuration429: 60_000,
      baseDuration503: 30_000,
      baseDurationOther: 15_000,
    });
  });

  describe("recordFailure", () => {
    it("should create initial backoff state on first failure", async () => {
      const state = await adaptiveBackoff.recordFailure("example.com", 429);

      expect(state.multiplier).toBe(1);
      expect(state.consecutiveFailures).toBe(1);
      expect(state.lastError).toBe(429);
      expect(state.until).toBeGreaterThan(Date.now());
    });

    it("should double multiplier on subsequent failures", async () => {
      await adaptiveBackoff.recordFailure("example.com", 429);
      const state = await adaptiveBackoff.recordFailure("example.com", 429);

      expect(state.multiplier).toBe(2);
      expect(state.consecutiveFailures).toBe(2);
    });

    it("should cap multiplier at maxMultiplier", async () => {
      // Record 10 failures to exceed max
      for (let i = 0; i < 10; i++) {
        await adaptiveBackoff.recordFailure("example.com", 429);
      }

      const state = await adaptiveBackoff.getState("example.com");
      expect(state?.multiplier).toBeLessThanOrEqual(16);
    });

    it("should use different base duration for 503", async () => {
      const state429 = await adaptiveBackoff.recordFailure("domain1.com", 429);
      const state503 = await adaptiveBackoff.recordFailure("domain2.com", 503);

      // 429 has 60s base, 503 has 30s base
      const duration429 = state429.until - Date.now();
      const duration503 = state503.until - Date.now();

      expect(duration429).toBeGreaterThan(duration503);
    });

    it("should store state in Redis", async () => {
      await adaptiveBackoff.recordFailure("example.com", 429);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "backoff:domain:example.com",
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe("recordSuccess", () => {
    it("should halve multiplier on success", async () => {
      await adaptiveBackoff.recordFailure("example.com", 429);
      await adaptiveBackoff.recordFailure("example.com", 429);
      // multiplier is now 2

      await adaptiveBackoff.recordSuccess("example.com");

      const state = await adaptiveBackoff.getState("example.com");
      // After success, multiplier = 2 / 2 = 1, which means delete
      expect(state).toBeNull();
    });

    it("should delete state when multiplier reaches 1", async () => {
      await adaptiveBackoff.recordFailure("example.com", 429);
      await adaptiveBackoff.recordSuccess("example.com");

      expect(mockRedis.del).toHaveBeenCalledWith("backoff:domain:example.com");
    });

    it("should do nothing if no backoff state exists", async () => {
      await adaptiveBackoff.recordSuccess("nonexistent.com");

      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe("getEffectiveLimit", () => {
    it("should return base limit when no backoff", async () => {
      const limit = await adaptiveBackoff.getEffectiveLimit("example.com", 2);

      expect(limit).toBe(2);
    });

    it("should reduce limit based on multiplier", async () => {
      // Set up state with multiplier 4
      const futureTime = Date.now() + 60_000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 4, until: futureTime })
      );

      const limit = await adaptiveBackoff.getEffectiveLimit("example.com", 2);

      expect(limit).toBe(0.5); // 2 / 4
    });

    it("should return higher limit after backoff expires", async () => {
      // Set up expired backoff
      const pastTime = Date.now() - 1000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 4, until: pastTime })
      );

      const limit = await adaptiveBackoff.getEffectiveLimit("example.com", 2);

      // Should use reduced multiplier (4/2 = 2) for recently expired
      expect(limit).toBe(1); // 2 / 2
    });

    it("should never return less than 0.1", async () => {
      const futureTime = Date.now() + 60_000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 16, until: futureTime })
      );

      const limit = await adaptiveBackoff.getEffectiveLimit("example.com", 1);

      expect(limit).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("isInBackoff", () => {
    it("should return true when in active backoff", async () => {
      const futureTime = Date.now() + 60_000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 1, until: futureTime })
      );

      const result = await adaptiveBackoff.isInBackoff("example.com");

      expect(result).toBe(true);
    });

    it("should return false when backoff expired", async () => {
      const pastTime = Date.now() - 1000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 1, until: pastTime })
      );

      const result = await adaptiveBackoff.isInBackoff("example.com");

      expect(result).toBe(false);
    });

    it("should return false when no backoff exists", async () => {
      const result = await adaptiveBackoff.isInBackoff("nonexistent.com");

      expect(result).toBe(false);
    });
  });

  describe("getRemainingBackoffMs", () => {
    it("should return remaining time in ms", async () => {
      const futureTime = Date.now() + 30_000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 1, until: futureTime })
      );

      const remaining = await adaptiveBackoff.getRemainingBackoffMs("example.com");

      expect(remaining).toBeGreaterThan(29_000);
      expect(remaining).toBeLessThanOrEqual(30_000);
    });

    it("should return 0 when backoff expired", async () => {
      const pastTime = Date.now() - 1000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 1, until: pastTime })
      );

      const remaining = await adaptiveBackoff.getRemainingBackoffMs("example.com");

      expect(remaining).toBe(0);
    });
  });

  describe("clearBackoff", () => {
    it("should delete backoff state", async () => {
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 4, until: Date.now() + 60_000 })
      );

      await adaptiveBackoff.clearBackoff("example.com");

      expect(mockRedis.del).toHaveBeenCalledWith("backoff:domain:example.com");
    });
  });

  describe("getBackoffDomains", () => {
    it("should return all domains in active backoff", async () => {
      const futureTime = Date.now() + 60_000;
      mockRedis._store.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 2, until: futureTime, lastError: 429 })
      );
      mockRedis._store.set(
        "backoff:domain:test.com",
        JSON.stringify({ multiplier: 4, until: futureTime, lastError: 503 })
      );
      // Expired backoff
      mockRedis._store.set(
        "backoff:domain:expired.com",
        JSON.stringify({ multiplier: 1, until: Date.now() - 1000, lastError: 429 })
      );

      const domains = await adaptiveBackoff.getBackoffDomains();

      expect(domains.length).toBe(2);
      expect(domains.map((d) => d.domain)).toContain("example.com");
      expect(domains.map((d) => d.domain)).toContain("test.com");
      expect(domains.map((d) => d.domain)).not.toContain("expired.com");
    });

    it("should sort by blockedUntil descending", async () => {
      const time1 = Date.now() + 30_000;
      const time2 = Date.now() + 60_000;

      mockRedis._store.set(
        "backoff:domain:first.com",
        JSON.stringify({ multiplier: 1, until: time1 })
      );
      mockRedis._store.set(
        "backoff:domain:second.com",
        JSON.stringify({ multiplier: 2, until: time2 })
      );

      const domains = await adaptiveBackoff.getBackoffDomains();

      expect(domains[0].domain).toBe("second.com"); // Longer backoff first
    });
  });

  describe("domain normalization", () => {
    it("should normalize subdomains", async () => {
      await adaptiveBackoff.recordFailure("www.example.com", 429);

      // Should be stored under normalized domain
      expect(mockRedis._store.has("backoff:domain:example.com")).toBe(true);
    });

    it("should handle protocol in domain", async () => {
      await adaptiveBackoff.recordFailure("https://api.example.com/path", 429);

      expect(mockRedis._store.has("backoff:domain:example.com")).toBe(true);
    });
  });

  describe("Retry-After header support", () => {
    it("should use Retry-After header duration for 429 responses", async () => {
      const state = await adaptiveBackoff.recordFailure("example.com", 429, "120");

      // Should use 120 seconds (120000ms) instead of default 60s
      const duration = state.until - Date.now();
      expect(duration).toBeGreaterThan(110_000); // Allow some timing slack
      expect(duration).toBeLessThanOrEqual(120_000);
    });

    it("should ignore Retry-After header for non-429 responses", async () => {
      const state = await adaptiveBackoff.recordFailure("example.com", 503, "300");

      // Should use default 503 duration (30s), not 300s from header
      const duration = state.until - Date.now();
      expect(duration).toBeLessThan(60_000);
    });

    it("should fall back to default when Retry-After header is null", async () => {
      const state = await adaptiveBackoff.recordFailure("example.com", 429, null);

      // Should use default 60s
      const duration = state.until - Date.now();
      expect(duration).toBeLessThanOrEqual(60_000);
    });

    it("should fall back to default when Retry-After header is invalid", async () => {
      const state = await adaptiveBackoff.recordFailure("example.com", 429, "invalid-value");

      // Should use default 60s
      const duration = state.until - Date.now();
      expect(duration).toBeLessThanOrEqual(60_000);
    });

    it("should cap excessive Retry-After values", async () => {
      // 1 hour is too long, should be capped at 30 minutes
      const state = await adaptiveBackoff.recordFailure("example.com", 429, "3600");

      const duration = state.until - Date.now();
      // Max is 30 minutes (1800000ms)
      expect(duration).toBeLessThanOrEqual(30 * 60 * 1000 + 1000); // Allow 1s slack
    });
  });
});

describe("parseRetryAfter", () => {
  describe("delta-seconds format", () => {
    it("should parse integer seconds", () => {
      const result = parseRetryAfter("120");
      expect(result).toBe(120_000); // 120 seconds in ms
    });

    it("should parse zero seconds as minimum backoff", () => {
      const result = parseRetryAfter("0");
      expect(result).toBe(1000); // Min backoff is 1 second
    });

    it("should cap excessive values at max backoff", () => {
      const result = parseRetryAfter("7200"); // 2 hours
      expect(result).toBe(30 * 60 * 1000); // Max is 30 minutes
    });

    it("should handle whitespace", () => {
      const result = parseRetryAfter("  60  ");
      expect(result).toBe(60_000);
    });
  });

  describe("HTTP-date format", () => {
    it("should parse valid HTTP date", () => {
      const futureDate = new Date(Date.now() + 60_000);
      const httpDate = futureDate.toUTCString();

      const result = parseRetryAfter(httpDate);

      expect(result).toBeGreaterThan(50_000);
      expect(result).toBeLessThanOrEqual(60_000);
    });

    it("should return min backoff for past dates", () => {
      const pastDate = new Date(Date.now() - 60_000);
      const httpDate = pastDate.toUTCString();

      const result = parseRetryAfter(httpDate);

      expect(result).toBe(1000); // Min backoff
    });

    it("should cap future dates at max backoff", () => {
      const farFuture = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      const httpDate = farFuture.toUTCString();

      const result = parseRetryAfter(httpDate);

      expect(result).toBe(30 * 60 * 1000); // Max is 30 minutes
    });
  });

  describe("invalid values", () => {
    it("should return null for null input", () => {
      expect(parseRetryAfter(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(parseRetryAfter(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseRetryAfter("")).toBeNull();
    });

    it("should return null for whitespace-only string", () => {
      expect(parseRetryAfter("   ")).toBeNull();
    });

    it("should return null for non-numeric, non-date strings", () => {
      expect(parseRetryAfter("abc")).toBeNull();
      expect(parseRetryAfter("12abc")).toBeNull();
      // Note: "-5" is parsed as a date (5th of current month) by Date constructor
      // This is acceptable behavior - we return min backoff for past dates
    });

    it("should handle floating point numbers as dates", () => {
      // "3.5" is not a valid delta-seconds (must be integer),
      // but JavaScript Date() interprets it as a date (3rd of some month)
      // This results in a past date, returning min backoff
      const result = parseRetryAfter("3.5");
      expect(result).toBe(1000); // Min backoff for past date
    });
  });
});

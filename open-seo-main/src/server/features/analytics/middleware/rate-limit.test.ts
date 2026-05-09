/**
 * Tests for Analytics Rate Limiting Middleware
 * Phase 96-Security: SEC-H01 Fix Tests
 *
 * Tests fail-closed behavior with in-memory fallback:
 * - Redis healthy: use Redis rate limiting
 * - Redis unavailable: use in-memory fallback with conservative limits
 * - Both exhausted: return 503 Service Unavailable
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// Mocks must be defined inline in vi.mock factory to avoid hoisting issues
vi.mock("@/server/lib/redis", () => {
  return {
    redis: {
      eval: vi.fn(),
      hgetall: vi.fn(),
      del: vi.fn(),
    },
    isCircuitBreakerClosed: vi.fn(),
    recordRedisFailure: vi.fn(),
    recordRedisSuccess: vi.fn(),
  };
});

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import mocked modules after vi.mock
import { redis, isCircuitBreakerClosed, recordRedisFailure, recordRedisSuccess } from "@/server/lib/redis";

// Cast to mock types
const mockRedisEval = redis.eval as unknown as Mock;
const mockRedisHgetall = redis.hgetall as unknown as Mock;
const mockRedisDel = redis.del as unknown as Mock;
const mockIsCircuitBreakerClosed = isCircuitBreakerClosed as unknown as Mock;
const mockRecordRedisFailure = recordRedisFailure as unknown as Mock;
const mockRecordRedisSuccess = recordRedisSuccess as unknown as Mock;

import {
  createAnalyticsRateLimiter,
  withAnalyticsRateLimit,
  getFallbackBucketCount,
  clearFallbackBuckets,
  type AnalyticsRateLimiter,
} from "./rate-limit";

describe("Analytics Rate Limiting (SEC-H01)", () => {
  let rateLimiter: AnalyticsRateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    clearFallbackBuckets();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));

    // Default: Redis is healthy
    mockIsCircuitBreakerClosed.mockReturnValue(true);

    rateLimiter = createAnalyticsRateLimiter({
      name: "test-limiter",
      tokensPerSecond: 10,
      maxBurst: 20,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    clearFallbackBuckets();
  });

  describe("Redis Healthy Path", () => {
    it("should allow request when Redis returns success", async () => {
      // Lua script returns: [allowed, tokens_remaining, wait_time]
      mockRedisEval.mockResolvedValue([1, 15, 0]);

      const result = await rateLimiter.checkLimit("workspace-123");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15);
      expect(result.source).toBe("redis");
      expect(result.limit).toBe(20);
      expect(mockRecordRedisSuccess).toHaveBeenCalled();
    });

    it("should block request when Redis returns rate limited", async () => {
      // Lua script returns: [not_allowed, 0, wait_time_ms]
      mockRedisEval.mockResolvedValue([0, 0, 5000]);

      const result = await rateLimiter.checkLimit("workspace-123");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(5); // 5000ms -> 5s
      expect(result.source).toBe("redis");
      expect(result.response).toBeDefined();
      expect(result.response?.status).toBe(429);
    });

    it("should include rate limit headers in 429 response", async () => {
      mockRedisEval.mockResolvedValue([0, 0, 10000]);

      const result = await rateLimiter.checkLimit("workspace-123");

      expect(result.response).toBeDefined();
      expect(result.response?.headers.get("X-RateLimit-Limit")).toBe("20");
      expect(result.response?.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(result.response?.headers.get("Retry-After")).toBe("10");
    });
  });

  describe("Redis Unavailable - Fallback Path", () => {
    beforeEach(() => {
      // Simulate Redis failure
      mockRedisEval.mockRejectedValue(new Error("Connection refused"));
    });

    it("should fall back to in-memory rate limiting when Redis fails", async () => {
      const result = await rateLimiter.checkLimit("workspace-456");

      expect(result.allowed).toBe(true);
      expect(result.source).toBe("fallback");
      // Conservative limit: 20 / 4 = 5
      expect(result.limit).toBe(5);
      expect(mockRecordRedisFailure).toHaveBeenCalled();
    });

    it("should track fallback buckets per identifier", async () => {
      await rateLimiter.checkLimit("workspace-a");
      await rateLimiter.checkLimit("workspace-b");

      expect(getFallbackBucketCount()).toBe(2);
    });

    it("should block request when fallback bucket exhausted", async () => {
      // Exhaust the fallback bucket (limit is 5)
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkLimit("workspace-exhausted");
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const result = await rateLimiter.checkLimit("workspace-exhausted");

      expect(result.allowed).toBe(false);
      expect(result.source).toBe("circuit-open");
      expect(result.response).toBeDefined();
      expect(result.response?.status).toBe(503);
    });

    it("should return 503 when both Redis and fallback exhausted", async () => {
      // Exhaust fallback bucket
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit("workspace-503");
      }

      const result = await rateLimiter.checkLimit("workspace-503");

      expect(result.allowed).toBe(false);
      expect(result.response?.status).toBe(503);

      const body = await result.response?.json() as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    });
  });

  describe("Circuit Breaker Open Path", () => {
    beforeEach(() => {
      // Circuit breaker is open - skip Redis entirely
      mockIsCircuitBreakerClosed.mockReturnValue(false);
    });

    it("should skip Redis when circuit breaker is open", async () => {
      const result = await rateLimiter.checkLimit("workspace-circuit");

      expect(result.source).toBe("fallback");
      expect(mockRedisEval).not.toHaveBeenCalled();
    });
  });

  describe("Token Refill Logic", () => {
    beforeEach(() => {
      // Redis unavailable - test fallback refill
      mockRedisEval.mockRejectedValue(new Error("Connection refused"));
    });

    it("should refill tokens over time in fallback mode", async () => {
      // Exhaust fallback bucket
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit("workspace-refill");
      }

      // Should be rate limited
      let result = await rateLimiter.checkLimit("workspace-refill");
      expect(result.allowed).toBe(false);

      // Advance time by 10 seconds (should refill some tokens)
      vi.advanceTimersByTime(10000);

      // Should be allowed again (conservative rate is ~0.625 tokens/sec)
      result = await rateLimiter.checkLimit("workspace-refill");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Rate Limiter Configuration", () => {
    it("should use custom fallback limit when provided", async () => {
      const customLimiter = createAnalyticsRateLimiter({
        name: "custom-fallback",
        tokensPerSecond: 100,
        maxBurst: 200,
        fallbackLimit: 10, // Custom instead of default 50 (200/4)
      });

      mockRedisEval.mockRejectedValue(new Error("Connection refused"));

      const result = await customLimiter.checkLimit("workspace-custom");

      expect(result.limit).toBe(10);
    });

    it("should use default fallback limit of maxBurst/4", async () => {
      const limiter = createAnalyticsRateLimiter({
        name: "default-fallback",
        tokensPerSecond: 40,
        maxBurst: 80,
      });

      mockRedisEval.mockRejectedValue(new Error("Connection refused"));

      const result = await limiter.checkLimit("workspace-default");

      expect(result.limit).toBe(20); // 80 / 4
    });
  });

  describe("getStatus()", () => {
    it("should return current tokens from Redis when healthy", async () => {
      mockRedisHgetall.mockResolvedValue({ tokens: "15", lastRefill: "1715342400000" });

      const status = await rateLimiter.getStatus("workspace-status");

      expect(status.tokens).toBe(15);
      expect(status.maxTokens).toBe(20);
    });

    it("should return fallback status when Redis unavailable", async () => {
      mockIsCircuitBreakerClosed.mockReturnValue(false);

      const status = await rateLimiter.getStatus("workspace-fallback-status");

      expect(status.maxTokens).toBe(5); // Fallback limit
    });
  });

  describe("reset()", () => {
    it("should delete Redis key and clear fallback bucket", async () => {
      mockRedisDel.mockResolvedValue(1);

      await rateLimiter.reset("workspace-reset");

      expect(mockRedisDel).toHaveBeenCalledWith(
        "ratelimit:analytics:test-limiter:workspace-reset"
      );
    });

    it("should handle Redis errors during reset gracefully", async () => {
      mockRedisDel.mockRejectedValue(new Error("Redis error"));

      // Should not throw
      await expect(rateLimiter.reset("workspace-error")).resolves.not.toThrow();
    });
  });

  describe("withAnalyticsRateLimit middleware", () => {
    it("should add rate limit headers to successful response", async () => {
      mockRedisEval.mockResolvedValue([1, 18, 0]);

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: "test" }), { status: 200 })
      );

      const wrappedHandler = withAnalyticsRateLimit(
        rateLimiter,
        () => "workspace-middleware",
        handler
      );

      const response = await wrappedHandler(new Request("http://localhost/api/test"));

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("20");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("18");
      expect(response.headers.get("X-RateLimit-Source")).toBe("redis");
    });

    it("should block request when rate limited", async () => {
      mockRedisEval.mockResolvedValue([0, 0, 30000]);

      const handler = vi.fn();

      const wrappedHandler = withAnalyticsRateLimit(
        rateLimiter,
        () => "workspace-blocked",
        handler
      );

      const response = await wrappedHandler(new Request("http://localhost/api/test"));

      expect(response.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should support async identifier extraction", async () => {
      mockRedisEval.mockResolvedValue([1, 19, 0]);

      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const wrappedHandler = withAnalyticsRateLimit(
        rateLimiter,
        async (req) => {
          const url = new URL(req.url);
          return url.searchParams.get("workspaceId") ?? "unknown";
        },
        handler
      );

      const request = new Request("http://localhost/api/test?workspaceId=async-workspace");
      await wrappedHandler(request);

      expect(handler).toHaveBeenCalledWith(request);
    });
  });
});

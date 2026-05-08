/**
 * Tests for Unified Rate Limit Service
 *
 * Tests cover:
 * - Basic rate limiting functionality
 * - Fail-closed behavior (SEC-002)
 * - In-memory fallback with degraded limits
 * - Multiple tiers (strict, standard, relaxed)
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Use vi.hoisted to create mock functions that are available during vi.mock hoisting
const {
  mockEval,
  mockZremrangebyscore,
  mockZcard,
  mockDel,
  mockSet,
  mockGet,
  mockIsCircuitBreakerClosed,
  mockRecordRedisFailure,
  mockRecordRedisSuccess,
} = vi.hoisted(() => ({
  mockEval: vi.fn(),
  mockZremrangebyscore: vi.fn(),
  mockZcard: vi.fn(),
  mockDel: vi.fn(),
  mockSet: vi.fn(),
  mockGet: vi.fn(),
  mockIsCircuitBreakerClosed: vi.fn(() => true),
  mockRecordRedisFailure: vi.fn(),
  mockRecordRedisSuccess: vi.fn(),
}));

// Mock Redis before importing the service
vi.mock("@/server/lib/redis", () => ({
  redis: {
    eval: mockEval,
    zremrangebyscore: mockZremrangebyscore,
    zcard: mockZcard,
    del: mockDel,
    set: mockSet,
    get: mockGet,
  },
  isCircuitBreakerClosed: mockIsCircuitBreakerClosed,
  recordRedisFailure: mockRecordRedisFailure,
  recordRedisSuccess: mockRecordRedisSuccess,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  getRateLimitService,
  checkRateLimit,
  createRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  rateLimitHeaders,
  withRateLimit,
  RATE_LIMIT_CONFIGS,
  type RateLimitResult,
} from "./RateLimitService";

describe("RateLimitService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset circuit breaker mock to closed (allow Redis)
    mockIsCircuitBreakerClosed.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      mockEval.mockResolvedValue([1, 5, 10, 0]);

      const result = await checkRateLimit({
        key: "test:user123",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(10);
      expect(result.fromFallback).toBe(false);
    });

    it("should deny requests when limit exceeded", async () => {
      const now = Date.now();
      mockEval.mockResolvedValue([0, 10, 10, now - 30000]);

      const result = await checkRateLimit({
        key: "test:user123",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.current).toBe(10);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.fromFallback).toBe(false);
    });

    it("should use fallback when Redis fails (SEC-002 fix)", async () => {
      mockEval.mockRejectedValue(new Error("Redis connection error"));

      const result = await checkRateLimit({
        key: "test:user123:sec002",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      // Should still allow but with degraded limit
      expect(result.allowed).toBe(true);
      expect(result.fromFallback).toBe(true);
      // Standard tier = 50% of limit = 5
      expect(result.limit).toBe(5);
    });

    it("should use fallback when circuit breaker is open", async () => {
      mockIsCircuitBreakerClosed.mockReturnValue(false);

      const result = await checkRateLimit({
        key: "test:user123:cb",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      expect(result.allowed).toBe(true);
      expect(result.fromFallback).toBe(true);
      // Redis.eval should not be called when circuit breaker is open
      expect(mockEval).not.toHaveBeenCalled();
    });

    it("should apply stricter fallback limits for strict tier", async () => {
      mockEval.mockRejectedValue(new Error("Redis connection error"));

      const result = await checkRateLimit({
        key: "test:user123:strict",
        limit: 10,
        window: 60,
        tier: "strict",
      });

      expect(result.fromFallback).toBe(true);
      // Strict tier = 25% of limit = 2 (minimum 1)
      expect(result.limit).toBe(2);
    });

    it("should apply relaxed fallback limits for relaxed tier", async () => {
      mockEval.mockRejectedValue(new Error("Redis connection error"));

      const result = await checkRateLimit({
        key: "test:user123:relaxed",
        limit: 10,
        window: 60,
        tier: "relaxed",
      });

      expect(result.fromFallback).toBe(true);
      // Relaxed tier = 75% of limit = 7
      expect(result.limit).toBe(7);
    });
  });

  describe("createRateLimiter", () => {
    it("should create a configured rate limiter function", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const limiter = createRateLimiter({
        keyPrefix: "api:endpoint",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      const result = await limiter("user123");

      expect(result.allowed).toBe(true);
      expect(mockEval).toHaveBeenCalled();

      // Verify the key was built correctly
      const evalCall = mockEval.mock.calls[0];
      expect(evalCall[2]).toContain("api:endpoint:user123");
    });
  });

  describe("In-memory fallback", () => {
    beforeEach(() => {
      mockEval.mockRejectedValue(new Error("Redis unavailable"));
    });

    it("should track requests per key in fallback mode", async () => {
      // First request should be allowed
      let result = await checkRateLimit({
        key: "fallback:test:track",
        limit: 2,
        window: 60,
        tier: "relaxed", // 75% = 1 (minimum 1)
      });
      expect(result.allowed).toBe(true);
      expect(result.fromFallback).toBe(true);

      // Second request should be blocked (limit of 1 with 75% of 2 = 1.5 rounded to 1)
      result = await checkRateLimit({
        key: "fallback:test:track",
        limit: 2,
        window: 60,
        tier: "relaxed",
      });
      expect(result.allowed).toBe(false);
      expect(result.fromFallback).toBe(true);
    });

    it("should handle multiple keys independently", async () => {
      const result1 = await checkRateLimit({
        key: "fallback:user1:multi",
        limit: 4,
        window: 60,
        tier: "standard", // 50% = 2
      });
      expect(result1.allowed).toBe(true);

      const result2 = await checkRateLimit({
        key: "fallback:user2:multi",
        limit: 4,
        window: 60,
        tier: "standard",
      });
      expect(result2.allowed).toBe(true);

      // Both should have been allowed since they're different keys
      expect(result1.remaining).toBe(1); // 2 - 1 = 1
      expect(result2.remaining).toBe(1);
    });
  });

  describe("Service metrics", () => {
    it("should track metrics", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const service = getRateLimitService();

      // Make some requests
      await service.checkLimit({
        key: "metrics:test",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      const metrics = service.getMetrics();

      expect(metrics.totalChecks).toBeGreaterThanOrEqual(1);
      expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should track fallback usage", async () => {
      mockEval.mockRejectedValue(new Error("Redis error"));

      const service = getRateLimitService();
      const initialMetrics = service.getMetrics();
      const initialFallback = initialMetrics.fallbackChecks;

      await service.checkLimit({
        key: "metrics:fallback:track",
        limit: 10,
        window: 60,
        tier: "standard",
      });

      const metrics = service.getMetrics();
      expect(metrics.fallbackChecks).toBe(initialFallback + 1);
      expect(metrics.errorChecks).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Response helpers", () => {
    it("should create 429 response for exceeded limit", () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
        limit: 10,
        current: 10,
        retryAfter: 60,
        fromFallback: false,
      };

      const response = rateLimitExceededResponse(result);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("should add degraded header for fallback responses", () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
        limit: 5,
        current: 5,
        retryAfter: 60,
        fromFallback: true,
      };

      const response = rateLimitExceededResponse(result);

      expect(response.headers.get("X-RateLimit-Degraded")).toBe("true");
    });

    it("should add rate limit headers to successful response", () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 5,
        resetAt: new Date(Date.now() + 60000),
        limit: 10,
        current: 5,
        fromFallback: false,
      };

      const originalResponse = new Response("OK", { status: 200 });
      const modifiedResponse = addRateLimitHeaders(originalResponse, result);

      expect(modifiedResponse.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(modifiedResponse.headers.get("X-RateLimit-Remaining")).toBe("5");
    });

    it("should create headers object for custom responses", () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 5,
        resetAt: new Date(Date.now() + 60000),
        limit: 10,
        current: 5,
        fromFallback: true,
      };

      const headers = rateLimitHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("5");
      expect(headers["X-RateLimit-Degraded"]).toBe("true");
    });
  });

  describe("withRateLimit wrapper", () => {
    it("should allow requests within limit", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      const wrappedHandler = withRateLimit(
        {
          key: () => "wrapper:test",
          limit: 10,
          window: 60,
          tier: "standard",
        },
        handler
      );

      const request = new Request("http://localhost/test");
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    });

    it("should block requests when limit exceeded", async () => {
      mockEval.mockResolvedValue([0, 10, 10, Date.now() - 30000]);

      const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      const wrappedHandler = withRateLimit(
        {
          key: () => "wrapper:exceeded",
          limit: 10,
          window: 60,
          tier: "standard",
        },
        handler
      );

      const request = new Request("http://localhost/test");
      const response = await wrappedHandler(request);

      expect(response.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should support async key extraction", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      const wrappedHandler = withRateLimit(
        {
          key: async (req) => {
            const url = new URL(req.url);
            return `async:${url.pathname}`;
          },
          limit: 10,
          window: 60,
          tier: "standard",
        },
        handler
      );

      const request = new Request("http://localhost/api/test");
      await wrappedHandler(request);

      expect(mockEval).toHaveBeenCalled();
      const evalCall = mockEval.mock.calls[0];
      expect(evalCall[2]).toContain("async:/api/test");
    });
  });

  describe("RATE_LIMIT_CONFIGS", () => {
    it("should have GSC_BRIDGE config", () => {
      expect(RATE_LIMIT_CONFIGS.GSC_BRIDGE).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.GSC_BRIDGE.limit).toBe(100);
      expect(RATE_LIMIT_CONFIGS.GSC_BRIDGE.window).toBe(86400); // 24 hours
    });

    it("should have strict auth configs", () => {
      expect(RATE_LIMIT_CONFIGS.AUTH.tier).toBe("strict");
      expect(RATE_LIMIT_CONFIGS.PASSWORD_RESET.tier).toBe("strict");
      expect(RATE_LIMIT_CONFIGS.SIGNUP.tier).toBe("strict");
    });

    it("should have analytics configs", () => {
      expect(RATE_LIMIT_CONFIGS.ANALYTICS_STANDARD).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.ANALYTICS_EXPENSIVE).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.ANALYTICS_SYNC).toBeDefined();
    });
  });

  describe("Health check", () => {
    it("should return healthy when Redis is working", async () => {
      mockSet.mockResolvedValue("OK");
      mockGet.mockResolvedValue("1");

      const service = getRateLimitService();
      const isHealthy = await service.isHealthy();

      expect(isHealthy).toBe(true);
    });

    it("should return unhealthy when Redis fails", async () => {
      mockSet.mockRejectedValue(new Error("Redis error"));

      const service = getRateLimitService();
      const isHealthy = await service.isHealthy();

      expect(isHealthy).toBe(false);
    });

    it("should return unhealthy when circuit breaker is open", async () => {
      mockIsCircuitBreakerClosed.mockReturnValue(false);

      const service = getRateLimitService();
      const isHealthy = await service.isHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe("Reset functionality", () => {
    it("should reset rate limit key", async () => {
      mockDel.mockResolvedValue(1);

      const service = getRateLimitService();
      await service.resetLimit("test:key");

      expect(mockDel).toHaveBeenCalledWith("ratelimit:test:key");
    });

    it("should handle reset errors gracefully", async () => {
      mockDel.mockRejectedValue(new Error("Redis error"));

      const service = getRateLimitService();

      // Should not throw
      await expect(service.resetLimit("test:key")).resolves.not.toThrow();
    });
  });
});

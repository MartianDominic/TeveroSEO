/**
 * Tests for Unified Rate Limit Service
 *
 * Tests cover:
 * - All three strategies (sliding window, token bucket, fixed window)
 * - Fail-closed and fail-degraded behavior
 * - In-memory fallback with tier-based limits
 * - Backward compatibility with legacy API
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Use vi.hoisted to create mock functions
const {
  mockEval,
  mockDel,
  mockSet,
  mockGet,
  mockIsCircuitBreakerClosed,
  mockRecordRedisFailure,
  mockRecordRedisSuccess,
} = vi.hoisted(() => ({
  mockEval: vi.fn(),
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
  createRateLimiter,
  createRateLimitMiddleware,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  rateLimitHeaders,
  rateLimit,
  withRateLimit,
  RATE_LIMIT_PRESETS,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rate-limit-service";

describe("RateLimitService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitBreakerClosed.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Sliding Window Strategy", () => {
    it("should allow requests within limit", async () => {
      mockEval.mockResolvedValue([1, 5, 10, 0]);

      const service = getRateLimitService();
      const result = await service.check("test:user123", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
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

      const service = getRateLimitService();
      const result = await service.check("test:user123", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("Token Bucket Strategy", () => {
    it("should allow requests when tokens available", async () => {
      mockEval.mockResolvedValue([1, 4, 0]);

      const service = getRateLimitService();
      const result = await service.check("test:api", {
        strategy: "token-bucket",
        scope: "endpoint",
        limit: 5,
        windowMs: 1000,
        tokensPerSecond: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should deny requests when no tokens available", async () => {
      mockEval.mockResolvedValue([0, 0, 200]);

      const service = getRateLimitService();
      const result = await service.check("test:api", {
        strategy: "token-bucket",
        scope: "endpoint",
        limit: 5,
        windowMs: 1000,
        tokensPerSecond: 5,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("Fixed Window Strategy", () => {
    it("should allow requests within limit", async () => {
      mockEval.mockResolvedValue([1, 5, 10, 0]);

      const service = getRateLimitService();
      const result = await service.check("test:fixed", {
        strategy: "fixed-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it("should deny requests when limit exceeded", async () => {
      mockEval.mockResolvedValue([0, 10, 10, 30]);

      const service = getRateLimitService();
      const result = await service.check("test:fixed", {
        strategy: "fixed-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(30);
    });
  });

  describe("Fail-Closed Behavior", () => {
    it("should block requests when Redis fails and failClosed is true", async () => {
      mockEval.mockRejectedValue(new Error("Redis connection error"));

      const service = getRateLimitService();
      const result = await service.check("test:secure", {
        strategy: "sliding-window",
        scope: "ip",
        limit: 10,
        windowMs: 60000,
        failClosed: true,
      });

      expect(result.allowed).toBe(false);
      expect(result.fromFallback).toBe(false);
    });
  });

  describe("Fallback Behavior", () => {
    beforeEach(() => {
      mockEval.mockRejectedValue(new Error("Redis unavailable"));
    });

    it("should use fallback when Redis fails", async () => {
      const service = getRateLimitService();
      const result = await service.check("test:fallback", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.fromFallback).toBe(true);
    });

    it("should apply stricter limits for strict tier", async () => {
      const service = getRateLimitService();
      const result = await service.check("test:strict", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
        tier: "strict",
      });

      expect(result.fromFallback).toBe(true);
      // Strict tier = 25% of limit = 2 (minimum 1)
      expect(result.limit).toBe(2);
    });

    it("should apply relaxed limits for relaxed tier", async () => {
      const service = getRateLimitService();
      const result = await service.check("test:relaxed", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
        tier: "relaxed",
      });

      expect(result.fromFallback).toBe(true);
      // Relaxed tier = 75% of limit = 7
      expect(result.limit).toBe(7);
    });

    it("should use fallback when circuit breaker is open", async () => {
      mockIsCircuitBreakerClosed.mockReturnValue(false);

      const service = getRateLimitService();
      const result = await service.check("test:cb", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      expect(result.fromFallback).toBe(true);
      expect(mockEval).not.toHaveBeenCalled();
    });
  });

  describe("createRateLimiter", () => {
    it("should create a configured rate limiter function", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const limiter = createRateLimiter({
        keyPrefix: "api:endpoint",
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      const result = await limiter("user123");

      expect(result.allowed).toBe(true);
      expect(mockEval).toHaveBeenCalled();
    });
  });

  describe("Response Helpers", () => {
    it("should create 429 response for exceeded limit", () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
        retryAfter: 60,
        fromFallback: false,
        current: 10,
        limit: 10,
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
        retryAfter: 60,
        fromFallback: true,
        current: 5,
        limit: 5,
      };

      const response = rateLimitExceededResponse(result);

      expect(response.headers.get("X-RateLimit-Degraded")).toBe("true");
    });

    it("should add rate limit headers to response", () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 5,
        resetAt: new Date(Date.now() + 60000),
        fromFallback: false,
        current: 5,
        limit: 10,
      };

      const originalResponse = new Response("OK", { status: 200 });
      const modified = addRateLimitHeaders(originalResponse, result);

      expect(modified.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(modified.headers.get("X-RateLimit-Remaining")).toBe("5");
    });

    it("should create headers object", () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 5,
        resetAt: new Date(Date.now() + 60000),
        fromFallback: true,
        current: 5,
        limit: 10,
      };

      const headers = rateLimitHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("5");
      expect(headers["X-RateLimit-Degraded"]).toBe("true");
    });
  });

  describe("createRateLimitMiddleware", () => {
    it("should wrap handler with rate limiting", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const handler = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      const wrappedHandler = createRateLimitMiddleware({
        keyExtractor: () => "test:middleware",
        config: {
          strategy: "sliding-window",
          scope: "client",
          limit: 10,
          windowMs: 60000,
        },
      })(handler);

      const request = new Request("http://localhost/test");
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    });

    it("should block requests when limit exceeded", async () => {
      mockEval.mockResolvedValue([0, 10, 10, Date.now() - 30000]);

      const handler = vi.fn();

      const wrappedHandler = createRateLimitMiddleware({
        keyExtractor: () => "test:exceeded",
        config: {
          strategy: "sliding-window",
          scope: "client",
          limit: 10,
          windowMs: 60000,
        },
      })(handler);

      const request = new Request("http://localhost/test");
      const response = await wrappedHandler(request);

      expect(response.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Backward Compatibility", () => {
    it("rateLimit() should work with legacy API", async () => {
      mockEval.mockResolvedValue([1, 5, 10, 0]);

      const result = await rateLimit({
        key: "legacy:test",
        limit: 10,
        window: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it("withRateLimit() should work with legacy API", async () => {
      mockEval.mockResolvedValue([1, 5, 10, 0]);

      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const wrapped = withRateLimit(
        {
          key: () => "legacy:wrapper",
          limit: 10,
          window: 60,
        },
        handler
      );

      const request = new Request("http://localhost/test");
      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Service Metrics", () => {
    it("should track metrics", async () => {
      mockEval.mockResolvedValue([1, 1, 10, 0]);

      const service = getRateLimitService();
      await service.check("metrics:test", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
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

      await service.check("metrics:fallback", {
        strategy: "sliding-window",
        scope: "client",
        limit: 10,
        windowMs: 60000,
      });

      const metrics = service.getMetrics();
      expect(metrics.fallbackChecks).toBe(initialFallback + 1);
    });
  });

  describe("Health Check", () => {
    it("should return healthy when Redis works", async () => {
      mockSet.mockResolvedValue("OK");
      mockGet.mockResolvedValue("1");

      const service = getRateLimitService();
      const healthy = await service.isHealthy();

      expect(healthy).toBe(true);
    });

    it("should return unhealthy when Redis fails", async () => {
      mockSet.mockRejectedValue(new Error("Redis error"));

      const service = getRateLimitService();
      const healthy = await service.isHealthy();

      expect(healthy).toBe(false);
    });

    it("should return unhealthy when circuit breaker open", async () => {
      mockIsCircuitBreakerClosed.mockReturnValue(false);

      const service = getRateLimitService();
      const healthy = await service.isHealthy();

      expect(healthy).toBe(false);
    });
  });

  describe("Reset Functionality", () => {
    it("should reset rate limit key", async () => {
      mockDel.mockResolvedValue(1);

      const service = getRateLimitService();
      await service.reset("test:key");

      expect(mockDel).toHaveBeenCalledWith("ratelimit:test:key");
    });

    it("should handle reset errors gracefully", async () => {
      mockDel.mockRejectedValue(new Error("Redis error"));

      const service = getRateLimitService();
      await expect(service.reset("test:key")).resolves.not.toThrow();
    });
  });

  describe("RATE_LIMIT_PRESETS", () => {
    it("should have API presets", () => {
      expect(RATE_LIMIT_PRESETS.API_STANDARD).toBeDefined();
      expect(RATE_LIMIT_PRESETS.API_STANDARD.strategy).toBe("sliding-window");
      expect(RATE_LIMIT_PRESETS.API_STANDARD.limit).toBe(60);
    });

    it("should have auth presets with fail-closed", () => {
      expect(RATE_LIMIT_PRESETS.AUTH.failClosed).toBe(true);
      expect(RATE_LIMIT_PRESETS.PASSWORD_RESET.failClosed).toBe(true);
    });

    it("should have token bucket presets for external APIs", () => {
      expect(RATE_LIMIT_PRESETS.DATAFORSEO.strategy).toBe("token-bucket");
      expect(RATE_LIMIT_PRESETS.DATAFORSEO.tokensPerSecond).toBe(5);
    });
  });
});

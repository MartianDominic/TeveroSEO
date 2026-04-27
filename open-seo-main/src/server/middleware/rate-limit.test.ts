/**
 * Tests for rate limiting middleware.
 *
 * Uses Redis mock to test sliding window algorithm behavior
 * without requiring a real Redis connection.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// Define mock type for Redis methods
interface MockRedis {
  pipeline: Mock;
  zrange: Mock;
  zadd: Mock;
  expire: Mock;
  del: Mock;
  zremrangebyscore: Mock;
  zcard: Mock;
}

// Mocks must be hoisted - define mock implementations inline
vi.mock("@/server/lib/redis", () => {
  const mockRedis = {
    pipeline: vi.fn(),
    zrange: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
  };
  return { redis: mockRedis };
});

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import mocked redis and cast to our mock type
import { redis } from "@/server/lib/redis";
const mockRedis = redis as unknown as MockRedis;

import {
  rateLimit,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  withRateLimit,
  extractClientIdFromRequest,
  createEndpointRateLimiter,
  resetRateLimit,
  getRateLimitStatus,
  RATE_LIMITS,
  type RateLimitOptions,
  type RateLimitResult,
} from "./rate-limit";

describe("rate-limit middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rateLimit()", () => {
    it("should allow request when under limit", async () => {
      // Setup pipeline mock
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 5], // zcard result - 5 existing requests
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await rateLimit({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1 (new request)
      expect(result.limit).toBe(10);
      expect(result.current).toBe(6);
      expect(result.retryAfter).toBeUndefined();
    });

    it("should reject request when at limit", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 10], // At limit
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);

      // Mock zrange for oldest entry
      const oldestTimestamp = Date.now() - 30000; // 30 seconds ago
      mockRedis.zrange.mockResolvedValue([
        "entry-id",
        oldestTimestamp.toString(),
      ]);

      const result = await rateLimit({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(30); // 60 - 30 seconds
      expect(result.current).toBe(10);
    });

    it("should fail open on Redis error", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);

      const result = await rateLimit({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      // Should allow on error (fail open)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.current).toBe(0);
    });

    it("should handle null pipeline result", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(null),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);

      const result = await rateLimit({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      // Should fail open
      expect(result.allowed).toBe(true);
    });

    it("should not double-prefix keys that already start with ratelimit:", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 0],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await rateLimit({
        key: "ratelimit:audit:run-checks:client1",
        limit: 10,
        window: 60,
      });

      // Check that the key used in zadd doesn't have double prefix
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "ratelimit:audit:run-checks:client1",
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe("rateLimitExceededResponse()", () => {
    it("should return 429 status with proper headers", () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        retryAfter: 30,
        limit: 10,
        current: 10,
      };

      const response = rateLimitExceededResponse(result);

      expect(response.status).toBe(429);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("Retry-After")).toBe("30");
    });

    it("should include error message in body", async () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        retryAfter: 45,
        limit: 10,
        current: 10,
      };

      const response = rateLimitExceededResponse(result);
      const body = (await response.json()) as {
        error: string;
        retryAfter: number;
        message: string;
      };

      expect(body.error).toBe("Rate limit exceeded");
      expect(body.retryAfter).toBe(45);
      expect(body.message).toContain("45 seconds");
    });
  });

  describe("addRateLimitHeaders()", () => {
    it("should add rate limit headers to existing response", () => {
      const originalResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      const result: RateLimitResult = {
        allowed: true,
        remaining: 5,
        limit: 10,
        current: 5,
      };

      const newResponse = addRateLimitHeaders(originalResponse, result);

      expect(newResponse.status).toBe(200);
      expect(newResponse.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(newResponse.headers.get("X-RateLimit-Remaining")).toBe("5");
      expect(newResponse.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("withRateLimit()", () => {
    it("should allow requests under the limit", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 3],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const wrappedHandler = withRateLimit(
        {
          key: () => "test:client1",
          limit: 10,
          window: 60,
        },
        handler
      );

      const request = new Request("http://localhost/api/test");
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalledWith(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("6");
    });

    it("should reject requests over the limit", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 10], // At limit
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);
      mockRedis.zrange.mockResolvedValue(["id", Date.now().toString()]);

      const handler = vi.fn();

      const wrappedHandler = withRateLimit(
        {
          key: () => "test:client1",
          limit: 10,
          window: 60,
        },
        handler
      );

      const request = new Request("http://localhost/api/test");
      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
    });

    it("should support async key function", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 0],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const wrappedHandler = withRateLimit(
        {
          key: async () => {
            await Promise.resolve();
            return "async:key:123";
          },
          limit: 10,
          window: 60,
        },
        handler
      );

      const request = new Request("http://localhost/api/test");
      await wrappedHandler(request);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "ratelimit:async:key:123",
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe("extractClientIdFromRequest()", () => {
    it("should extract client ID from X-Client-ID header", async () => {
      const request = new Request("http://localhost/api/test", {
        headers: { "X-Client-ID": "client-123" },
      });

      const clientId = await extractClientIdFromRequest(request);
      expect(clientId).toBe("client-123");
    });

    it("should extract client ID from query parameter", async () => {
      const request = new Request("http://localhost/api/test?clientId=client-456");

      const clientId = await extractClientIdFromRequest(request);
      expect(clientId).toBe("client-456");
    });

    it("should extract client ID from POST body", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: "client-789", data: "test" }),
      });

      const clientId = await extractClientIdFromRequest(request);
      expect(clientId).toBe("client-789");
    });

    it("should fallback to IP address", async () => {
      const request = new Request("http://localhost/api/test", {
        headers: { "X-Forwarded-For": "192.168.1.100, 10.0.0.1" },
      });

      const clientId = await extractClientIdFromRequest(request);
      expect(clientId).toBe("ip:192.168.1.100");
    });

    it("should return anonymous when no identifier found", async () => {
      const request = new Request("http://localhost/api/test");

      const clientId = await extractClientIdFromRequest(request);
      expect(clientId).toBe("anonymous");
    });

    it("should prioritize header over query param", async () => {
      const request = new Request("http://localhost/api/test?clientId=query-client", {
        headers: { "X-Client-ID": "header-client" },
      });

      const clientId = await extractClientIdFromRequest(request);
      expect(clientId).toBe("header-client");
    });
  });

  describe("createEndpointRateLimiter()", () => {
    it("should create a rate limiter with the specified config", async () => {
      const pipelineMock = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 0],
          [null, 5],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(pipelineMock);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const limiter = createEndpointRateLimiter({
        keyPrefix: "custom:endpoint:",
        limit: 20,
        window: 120,
      });

      const result = await limiter("my-client");

      expect(result.limit).toBe(20);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        "ratelimit:custom:endpoint:my-client",
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe("RATE_LIMITS configurations", () => {
    it("should have correct defaults for AUDIT_RUN_CHECKS", () => {
      expect(RATE_LIMITS.AUDIT_RUN_CHECKS).toEqual({
        limit: 10,
        window: 60,
        keyPrefix: "ratelimit:audit:run-checks:",
      });
    });

    it("should have correct defaults for CONTENT_VALIDATE", () => {
      expect(RATE_LIMITS.CONTENT_VALIDATE).toEqual({
        limit: 10,
        window: 60,
        keyPrefix: "ratelimit:seo:content:validate:",
      });
    });

    it("should have correct defaults for LINK_SUGGESTIONS", () => {
      expect(RATE_LIMITS.LINK_SUGGESTIONS).toEqual({
        limit: 30,
        window: 60,
        keyPrefix: "ratelimit:seo:links:suggestions:",
      });
    });
  });

  describe("resetRateLimit()", () => {
    it("should delete the rate limit key from Redis", async () => {
      mockRedis.del.mockResolvedValue(1);

      await resetRateLimit("test:client1");

      expect(mockRedis.del).toHaveBeenCalledWith("ratelimit:test:client1");
    });
  });

  describe("getRateLimitStatus()", () => {
    it("should return current status without incrementing", async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(7);

      const result = await getRateLimitStatus({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.current).toBe(7);
      expect(result.limit).toBe(10);

      // Should NOT call zadd (not incrementing)
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it("should return not allowed when at limit", async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(10);

      const result = await getRateLimitStatus({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedis.zremrangebyscore.mockRejectedValue(new Error("Redis error"));

      const result = await getRateLimitStatus({
        key: "test:client1",
        limit: 10,
        window: 60,
      });

      // Should fail open
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });
  });
});

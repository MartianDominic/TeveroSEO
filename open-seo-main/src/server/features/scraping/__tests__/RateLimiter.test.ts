/**
 * RateLimiter Unit Tests.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter, RateLimitExceededError } from "../ratelimit/RateLimiter";

// Mock Redis client
function createMockRedis() {
  const store = new Map<string, { score: number; member: string }[]>();
  const stringStore = new Map<string, string>();

  return {
    call: vi.fn(async (command: string, ...args: (string | number)[]) => {
      if (command === "EVAL") {
        // Simulate Lua script behavior
        const key = args[1] as string;
        const now = parseInt(args[2] as string, 10);
        const windowStart = parseInt(args[3] as string, 10);
        const maxRequests = parseInt(args[4] as string, 10);
        const requestId = args[5] as string;

        // Get or create sorted set
        let entries = store.get(key) || [];

        // Remove expired entries
        entries = entries.filter((e) => e.score > windowStart);
        store.set(key, entries);

        if (entries.length < maxRequests) {
          // Allowed
          entries.push({ score: now, member: requestId });
          store.set(key, entries);
          return 0;
        } else {
          // Calculate wait time
          const oldest = entries.sort((a, b) => a.score - b.score)[0];
          return oldest ? oldest.score - windowStart + 1 : 1000;
        }
      }
      return null;
    }),
    zremrangebyscore: vi.fn(async () => 0),
    zcard: vi.fn(async (key: string) => {
      const entries = store.get(key) || [];
      return entries.length;
    }),
    zrange: vi.fn(async (key: string) => {
      const entries = store.get(key) || [];
      if (entries.length === 0) return [];
      const sorted = entries.sort((a, b) => a.score - b.score);
      return [sorted[0].member, sorted[0].score.toString()];
    }),
    get: vi.fn(async (key: string) => stringStore.get(key) || null),
    keys: vi.fn(async () => Array.from(store.keys())),
    zrem: vi.fn(async (key: string, member: string) => {
      const entries = store.get(key) || [];
      const index = entries.findIndex((e) => e.member === member);
      if (index >= 0) {
        entries.splice(index, 1);
        store.set(key, entries);
        return 1;
      }
      return 0;
    }),
    // For testing - clear all data
    _clear: () => {
      store.clear();
      stringStore.clear();
    },
    _store: store,
    _stringStore: stringStore,
  };
}

describe("RateLimiter", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    mockRedis = createMockRedis();
    rateLimiter = new RateLimiter(mockRedis as never, {
      requestsPerWindow: 2,
      windowMs: 1000,
      maxWaitMs: 5000,
    });
  });

  describe("normalizeDomain", () => {
    it("should normalize standard domains", () => {
      expect(rateLimiter.normalizeDomain("www.example.com")).toBe("example.com");
      expect(rateLimiter.normalizeDomain("blog.example.com")).toBe("example.com");
      expect(rateLimiter.normalizeDomain("api.v2.example.com")).toBe("example.com");
    });

    it("should handle compound TLDs", () => {
      expect(rateLimiter.normalizeDomain("shop.example.co.uk")).toBe("example.co.uk");
      expect(rateLimiter.normalizeDomain("www.example.com.au")).toBe("example.com.au");
    });

    it("should strip protocol and path", () => {
      expect(rateLimiter.normalizeDomain("https://www.example.com/page")).toBe("example.com");
      expect(rateLimiter.normalizeDomain("http://blog.example.com:8080/path")).toBe("example.com");
    });

    it("should handle bare domains", () => {
      expect(rateLimiter.normalizeDomain("example.com")).toBe("example.com");
    });

    it("should convert to lowercase", () => {
      expect(rateLimiter.normalizeDomain("WWW.EXAMPLE.COM")).toBe("example.com");
    });
  });

  describe("acquire", () => {
    it("should allow requests within rate limit", async () => {
      await expect(rateLimiter.acquire("example.com")).resolves.toBeUndefined();
      expect(mockRedis.call).toHaveBeenCalled();
    });

    it("should call Redis EVAL command", async () => {
      await rateLimiter.acquire("example.com");

      expect(mockRedis.call).toHaveBeenCalledWith(
        "EVAL",
        expect.any(String), // Lua script
        1,
        "ratelimit:domain:example.com",
        expect.any(String), // now
        expect.any(String), // windowStart
        "2", // requestsPerWindow
        expect.any(String), // requestId
        "1000" // windowMs
      );
    });
  });

  describe("getStatus", () => {
    it("should return status for a domain", async () => {
      const status = await rateLimiter.getStatus("example.com");

      expect(status).toMatchObject({
        domain: "example.com",
        normalizedDomain: "example.com",
        windowMs: 1000,
        maxRequests: 2,
        backoffMultiplier: 1,
      });
    });

    it("should read backoff state from Redis", async () => {
      mockRedis._stringStore.set(
        "backoff:domain:example.com",
        JSON.stringify({ multiplier: 4 })
      );

      const status = await rateLimiter.getStatus("example.com");

      expect(status.backoffMultiplier).toBe(4);
      expect(status.effectiveLimit).toBe(0.5); // 2 / 4
    });
  });

  describe("getActiveDomains", () => {
    it("should return list of active domains", async () => {
      mockRedis._store.set("ratelimit:domain:example.com", []);
      mockRedis._store.set("ratelimit:domain:test.com", []);

      const domains = await rateLimiter.getActiveDomains();

      expect(domains).toContain("example.com");
      expect(domains).toContain("test.com");
    });
  });

  describe("release", () => {
    it("should remove entry from sorted set", async () => {
      mockRedis._store.set("ratelimit:domain:example.com", [
        { score: 1000, member: "req1" },
        { score: 2000, member: "req2" },
      ]);

      await rateLimiter.release("example.com");

      expect(mockRedis.zrem).toHaveBeenCalled();
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", () => {
      const config = rateLimiter.getConfig();

      expect(config).toEqual({
        requestsPerWindow: 2,
        windowMs: 1000,
        maxWaitMs: 5000,
        enableAdaptiveBackoff: true,
      });
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      rateLimiter.updateConfig({ requestsPerWindow: 5 });

      const config = rateLimiter.getConfig();
      expect(config.requestsPerWindow).toBe(5);
    });
  });
});

describe("RateLimitExceededError", () => {
  it("should have correct properties", () => {
    const error = new RateLimitExceededError("example.com", 5000);

    expect(error.name).toBe("RateLimitExceededError");
    expect(error.domain).toBe("example.com");
    expect(error.waitedMs).toBe(5000);
    expect(error.message).toContain("example.com");
    expect(error.message).toContain("5000ms");
  });
});

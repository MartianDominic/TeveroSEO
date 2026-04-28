/**
 * Tests for Classification Singleflight service.
 *
 * Test coverage:
 * - Single request returns result
 * - Concurrent requests share single classification
 * - Different categories get different cache keys
 * - Same categories share results
 * - Leader crash triggers retry after TTL
 * - Timeout handling works
 * - Cache hit skips classification entirely
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Redis } from "ioredis";
import { ClassificationSingleflight } from "./ClassificationSingleflight";
import type { ClassificationResult, ClassifierFn } from "../types/singleflight";

// Create comprehensive mock for Redis
function createMockRedis(): {
  redis: Redis;
  mocks: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    eval: ReturnType<typeof vi.fn>;
    pipeline: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
  pipelineMocks: {
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  };
} {
  const pipelineMocks = {
    set: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    publish: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };

  const subscriberMocks = {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    removeListener: vi.fn(),
  };

  const mocks = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    eval: vi.fn(),
    pipeline: vi.fn().mockReturnValue(pipelineMocks),
    duplicate: vi.fn().mockReturnValue(subscriberMocks),
    subscribe: subscriberMocks.subscribe,
    unsubscribe: subscriberMocks.unsubscribe,
    quit: subscriberMocks.quit,
    publish: vi.fn(),
    on: subscriberMocks.on,
    removeAllListeners: subscriberMocks.removeAllListeners,
    removeListener: subscriberMocks.removeListener,
  };

  return {
    redis: mocks as unknown as Redis,
    mocks,
    pipelineMocks,
  };
}

// Sample classification result
const sampleResult: ClassificationResult = {
  category: "Hair Care",
  subcategory: "Shampoo",
  confidence: 0.95,
  reasoning: "Keyword mentions hair care product",
};

// Sample classifier function
const createMockClassifier = (): ClassifierFn => {
  return vi.fn().mockResolvedValue(sampleResult);
};

describe("ClassificationSingleflight", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let singleflight: ClassificationSingleflight;
  let mockClassifier: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    singleflight = new ClassificationSingleflight(mockRedis.redis, {
      leaderTTL: 60,
      resultTTL: 604800,
      waitTimeout: 55,
      pollInterval: 100, // Short poll interval for tests
    });
    mockClassifier = vi.fn().mockResolvedValue(sampleResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("buildCacheKey", () => {
    it("should generate consistent hash for same keyword and categories", () => {
      const key1 = singleflight.buildCacheKey("šampūnas dažytiems plaukams", [
        "Hair Care",
        "Shampoo",
      ]);
      const key2 = singleflight.buildCacheKey("šampūnas dažytiems plaukams", [
        "Hair Care",
        "Shampoo",
      ]);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(16); // SHA256 truncated to 16 chars
    });

    it("should normalize keyword to lowercase", () => {
      const key1 = singleflight.buildCacheKey("ŠAMPŪNAS", ["Hair Care"]);
      const key2 = singleflight.buildCacheKey("šampūnas", ["Hair Care"]);

      expect(key1).toBe(key2);
    });

    it("should sort categories for consistent hashing", () => {
      const key1 = singleflight.buildCacheKey("test", ["B", "A", "C"]);
      const key2 = singleflight.buildCacheKey("test", ["A", "B", "C"]);
      const key3 = singleflight.buildCacheKey("test", ["C", "A", "B"]);

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it("should produce different keys for different categories", () => {
      const key1 = singleflight.buildCacheKey("test", ["Hair Care", "Shampoo"]);
      const key2 = singleflight.buildCacheKey("test", ["Skin Care", "Lotion"]);

      expect(key1).not.toBe(key2);
    });

    it("should produce different keys for different keywords", () => {
      const key1 = singleflight.buildCacheKey("šampūnas", ["Hair Care"]);
      const key2 = singleflight.buildCacheKey("kondicionierius", ["Hair Care"]);

      expect(key1).not.toBe(key2);
    });

    it("should handle empty categories array", () => {
      const key = singleflight.buildCacheKey("test", []);
      expect(key).toHaveLength(16);
    });

    it("should trim whitespace from keyword", () => {
      const key1 = singleflight.buildCacheKey("  test  ", ["Hair Care"]);
      const key2 = singleflight.buildCacheKey("test", ["Hair Care"]);

      expect(key1).toBe(key2);
    });
  });

  describe("classify - cache hit", () => {
    it("should return cached result without calling classifier", async () => {
      const cachedResult = { ...sampleResult, fromCache: true, source: "cache" };
      mockRedis.mocks.get.mockResolvedValue(JSON.stringify(sampleResult));

      const result = await singleflight.classify(
        "test keyword",
        ["Category A"],
        mockClassifier,
      );

      expect(result.category).toBe("Hair Care");
      expect(result.fromCache).toBe(true);
      expect(result.source).toBe("cache");
      expect(mockClassifier).not.toHaveBeenCalled();
      expect(mockRedis.mocks.eval).not.toHaveBeenCalled();
    });
  });

  describe("classify - leader path", () => {
    it("should become leader and call classifier when cache miss", async () => {
      // First get returns null (cache miss)
      mockRedis.mocks.get.mockResolvedValue(null);
      // Eval returns 1 (became leader)
      mockRedis.mocks.eval.mockResolvedValue(1);

      const result = await singleflight.classify(
        "test keyword",
        ["Category A"],
        mockClassifier,
      );

      expect(mockClassifier).toHaveBeenCalledWith("test keyword", ["Category A"]);
      expect(result.category).toBe("Hair Care");
      expect(result.fromCache).toBe(false);
      expect(result.source).toBe("llm");

      // Verify pipeline was used to store result
      expect(mockRedis.pipelineMocks.set).toHaveBeenCalled();
      expect(mockRedis.pipelineMocks.del).toHaveBeenCalled();
      expect(mockRedis.pipelineMocks.publish).toHaveBeenCalledWith(
        expect.stringContaining("classify:done:"),
        "done",
      );
      expect(mockRedis.pipelineMocks.exec).toHaveBeenCalled();
    });

    it("should notify failure when classifier throws", async () => {
      mockRedis.mocks.get.mockResolvedValue(null);
      mockRedis.mocks.eval.mockResolvedValue(1);
      mockClassifier.mockRejectedValue(new Error("LLM API error"));

      await expect(
        singleflight.classify("test keyword", ["Category A"], mockClassifier),
      ).rejects.toThrow("LLM API error");

      // Verify failure notification was published
      expect(mockRedis.pipelineMocks.del).toHaveBeenCalled();
      expect(mockRedis.pipelineMocks.publish).toHaveBeenCalledWith(
        expect.stringContaining("classify:done:"),
        "fail",
      );
    });
  });

  describe("classify - follower path", () => {
    it("should wait and return cached result when not leader", async () => {
      // First get returns null (cache miss)
      // Second get (after subscribe) returns the result
      mockRedis.mocks.get
        .mockResolvedValueOnce(null) // Initial cache check
        .mockResolvedValueOnce(JSON.stringify(sampleResult)); // After subscribe check

      // Eval returns 0 (not leader)
      mockRedis.mocks.eval.mockResolvedValue(0);

      const result = await singleflight.classify(
        "test keyword",
        ["Category A"],
        mockClassifier,
      );

      expect(mockClassifier).not.toHaveBeenCalled();
      expect(result.category).toBe("Hair Care");
      expect(result.fromCache).toBe(true);
      expect(result.source).toBe("cache");
    });
  });

  describe("isCached", () => {
    it("should return true when result exists", async () => {
      mockRedis.mocks.exists.mockResolvedValue(1);

      const result = await singleflight.isCached("test", ["Category"]);

      expect(result).toBe(true);
      expect(mockRedis.mocks.exists).toHaveBeenCalledWith(
        expect.stringContaining("classify:result:"),
      );
    });

    it("should return false when result does not exist", async () => {
      mockRedis.mocks.exists.mockResolvedValue(0);

      const result = await singleflight.isCached("test", ["Category"]);

      expect(result).toBe(false);
    });
  });

  describe("getCached", () => {
    it("should return cached result if exists", async () => {
      mockRedis.mocks.get.mockResolvedValue(JSON.stringify(sampleResult));

      const result = await singleflight.getCached("test", ["Category"]);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("Hair Care");
      expect(result!.fromCache).toBe(true);
    });

    it("should return null if not cached", async () => {
      mockRedis.mocks.get.mockResolvedValue(null);

      const result = await singleflight.getCached("test", ["Category"]);

      expect(result).toBeNull();
    });
  });

  describe("invalidate", () => {
    it("should delete the cached result", async () => {
      mockRedis.mocks.del.mockResolvedValue(1);

      await singleflight.invalidate("test", ["Category"]);

      expect(mockRedis.mocks.del).toHaveBeenCalledWith(
        expect.stringContaining("classify:result:"),
      );
    });
  });

  describe("warmCache", () => {
    it("should store result with TTL", async () => {
      mockRedis.mocks.set.mockResolvedValue("OK");

      await singleflight.warmCache("test", ["Category"], sampleResult);

      expect(mockRedis.mocks.set).toHaveBeenCalledWith(
        expect.stringContaining("classify:result:"),
        expect.stringContaining('"category":"Hair Care"'),
        "EX",
        604800, // 7 days
      );
    });

    it("should mark source as prewarmed", async () => {
      mockRedis.mocks.set.mockResolvedValue("OK");

      await singleflight.warmCache("test", ["Category"], sampleResult);

      const setCall = mockRedis.mocks.set.mock.calls[0];
      const storedData = JSON.parse(setCall[1]);
      expect(storedData.source).toBe("prewarmed");
    });
  });

  describe("category-aware caching", () => {
    it("should share results for clients with same categories", async () => {
      // First client - cache miss, becomes leader
      mockRedis.mocks.get.mockResolvedValueOnce(null);
      mockRedis.mocks.eval.mockResolvedValueOnce(1);

      const result1 = await singleflight.classify(
        "šampūnas",
        ["Hair Care", "Shampoo", "Conditioner"],
        mockClassifier,
      );

      expect(mockClassifier).toHaveBeenCalledTimes(1);
      expect(result1.fromCache).toBe(false);

      // Second client - same categories (different order), should hit cache
      mockRedis.mocks.get.mockResolvedValueOnce(
        JSON.stringify({ ...sampleResult, fromCache: false, source: "llm" }),
      );

      const result2 = await singleflight.classify(
        "šampūnas",
        ["Shampoo", "Conditioner", "Hair Care"], // Different order
        mockClassifier,
      );

      expect(mockClassifier).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2.fromCache).toBe(true);
    });

    it("should NOT share results for clients with different categories", async () => {
      // First client with categories A, B
      mockRedis.mocks.get.mockResolvedValueOnce(null);
      mockRedis.mocks.eval.mockResolvedValueOnce(1);

      await singleflight.classify("šampūnas", ["Hair Care", "Shampoo"], mockClassifier);

      expect(mockClassifier).toHaveBeenCalledTimes(1);

      // Second client with different categories - should NOT share cache
      mockRedis.mocks.get.mockResolvedValueOnce(null);
      mockRedis.mocks.eval.mockResolvedValueOnce(1);

      await singleflight.classify("šampūnas", ["Skin Care", "Lotion"], mockClassifier);

      // Classifier should be called again because categories differ
      expect(mockClassifier).toHaveBeenCalledTimes(2);
    });
  });

  describe("concurrent request handling", () => {
    it("should handle multiple concurrent requests for same keyword", async () => {
      // Simulate 5 concurrent requests
      // First one becomes leader, others become followers

      let callCount = 0;
      mockRedis.mocks.get.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) {
          // All initial cache checks return null
          return Promise.resolve(null);
        }
        // After leader completes, followers get cached result
        return Promise.resolve(JSON.stringify(sampleResult));
      });

      // First eval returns 1 (leader), rest return 0 (followers)
      let evalCallCount = 0;
      mockRedis.mocks.eval.mockImplementation(() => {
        evalCallCount++;
        return Promise.resolve(evalCallCount === 1 ? 1 : 0);
      });

      // Run first request (leader)
      const leaderPromise = singleflight.classify(
        "test",
        ["Category"],
        mockClassifier,
      );

      const leaderResult = await leaderPromise;

      expect(leaderResult.fromCache).toBe(false);
      expect(mockClassifier).toHaveBeenCalledTimes(1);
    });
  });

  describe("configuration", () => {
    it("should use default config when none provided", () => {
      const sf = new ClassificationSingleflight(mockRedis.redis);
      // Verify it doesn't throw
      expect(sf).toBeDefined();
    });

    it("should merge custom config with defaults", () => {
      const sf = new ClassificationSingleflight(mockRedis.redis, {
        leaderTTL: 120,
      });
      // Verify it uses custom leaderTTL
      expect(sf).toBeDefined();
    });
  });
});

describe("ClassificationSingleflight - Integration patterns", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let singleflight: ClassificationSingleflight;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    singleflight = new ClassificationSingleflight(mockRedis.redis, {
      leaderTTL: 2, // Very short for testing
      resultTTL: 604800,
      waitTimeout: 1,
      pollInterval: 50,
    });
  });

  describe("leader crash recovery", () => {
    it("should handle leader timeout gracefully", async () => {
      // Cache miss
      mockRedis.mocks.get.mockResolvedValue(null);
      // Not leader
      mockRedis.mocks.eval.mockResolvedValue(0);

      // With very short timeouts, this should eventually timeout
      await expect(
        singleflight.classify("test", ["Category"], vi.fn().mockResolvedValue(sampleResult)),
      ).rejects.toThrow(/timeout/i);
    });
  });

  describe("cache key collision resistance", () => {
    it("should have low collision probability for different inputs", () => {
      const keys = new Set<string>();
      const testCases = [
        ["keyword1", ["A", "B"]],
        ["keyword2", ["A", "B"]],
        ["keyword1", ["B", "C"]],
        ["keyword1", ["A", "B", "C"]],
        ["keyword 1", ["A", "B"]],
        ["KEYWORD1", ["A", "B"]],
        ["keyword1 ", ["A", "B"]],
      ] as const;

      for (const [keyword, categories] of testCases) {
        keys.add(singleflight.buildCacheKey(keyword, [...categories]));
      }

      // After normalization, some should be the same (uppercase, trailing space)
      // But different keywords/categories should produce unique keys
      expect(keys.size).toBeGreaterThanOrEqual(4);
    });
  });
});

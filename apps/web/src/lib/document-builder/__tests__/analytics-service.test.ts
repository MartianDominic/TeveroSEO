/**
 * Tests for document builder analytics service.
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 *
 * TDD: RED phase - these tests should fail until analytics-service.ts is implemented.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis module - must use vi.hoisted for top-level variables
const mockPipeline = vi.hoisted(() => ({
  incr: vi.fn().mockReturnThis(),
  incrby: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}));

const mockRedis = vi.hoisted(() => ({
  incr: vi.fn(),
  incrby: vi.fn(),
  get: vi.fn(),
  mget: vi.fn(),
  set: vi.fn(),
  zadd: vi.fn(),
  zrange: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
  scanStream: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
}));

vi.mock("@/lib/redis/client", () => ({
  redis: mockRedis,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mock
import {
  recordBlockView,
  recordBlockDwell,
  getBlockAnalytics,
  calculateCorrelation,
  markConversion,
  getAnalyticsKeys,
  processBatchedEvents,
  type BlockAnalytics,
  type CorrelationResult,
  type BlockInteraction,
} from "../analytics-service";

describe("analytics-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.incrby.mockResolvedValue(100);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.mget.mockResolvedValue([]);
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.zrange.mockResolvedValue([]);
    mockRedis.keys.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // =============================================================================
  // H-TEST-02: Validation Edge Cases
  // =============================================================================

  describe("recordBlockView validation edge cases", () => {
    it("should reject empty blockId", async () => {
      const result = await recordBlockView("");

      expect(result).toBe(false);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only blockId", async () => {
      const result = await recordBlockView("   ");

      expect(result).toBe(false);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it("should reject null blockId (type coercion)", async () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      const result = await recordBlockView(null);

      expect(result).toBe(false);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it("should reject undefined blockId", async () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      const result = await recordBlockView(undefined);

      expect(result).toBe(false);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it("should accept valid blockId with leading/trailing spaces (trimmed internally)", async () => {
      // The validation checks trim(), so " valid " with spaces passes the truthy check
      // but generates key with spaces - this tests actual behavior
      const result = await recordBlockView(" valid-block ");

      expect(result).toBe(true);
      expect(mockRedis.incr).toHaveBeenCalled();
    });
  });

  describe("recordBlockDwell validation edge cases", () => {
    it("should reject empty blockId", async () => {
      const result = await recordBlockDwell("", undefined, 1000);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only blockId", async () => {
      const result = await recordBlockDwell("   ", undefined, 1000);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should reject NaN dwellMs", async () => {
      const result = await recordBlockDwell("block-123", undefined, NaN);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should reject Infinity dwellMs", async () => {
      const result = await recordBlockDwell("block-123", undefined, Infinity);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should reject negative Infinity dwellMs", async () => {
      const result = await recordBlockDwell("block-123", undefined, -Infinity);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should reject negative dwellMs", async () => {
      const result = await recordBlockDwell("block-123", undefined, -100);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should reject zero dwellMs", async () => {
      const result = await recordBlockDwell("block-123", undefined, 0);

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it("should handle very large dwellMs values", async () => {
      // Test with maximum safe integer - should work but be rounded
      const result = await recordBlockDwell("block-123", undefined, Number.MAX_SAFE_INTEGER);

      expect(result).toBe(true);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        "block:block-123:dwell",
        Number.MAX_SAFE_INTEGER
      );
    });

    it("should round fractional dwellMs to nearest integer", async () => {
      const result = await recordBlockDwell("block-123", undefined, 1500.7);

      expect(result).toBe(true);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        "block:block-123:dwell",
        1501 // Math.round(1500.7)
      );
    });

    it("should reject string dwellMs (type coercion)", async () => {
      // @ts-expect-error - Testing runtime behavior with invalid input
      const result = await recordBlockDwell("block-123", undefined, "5000");

      expect(result).toBe(false);
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // M-TEST-03: Concurrent Operation Tests
  // =============================================================================

  describe("concurrent operations", () => {
    it("should handle concurrent recordBlockView calls without data loss", async () => {
      const blockId = "concurrent-block";
      const concurrentCalls = 10;

      // Simulate concurrent calls
      const promises = Array.from({ length: concurrentCalls }, () =>
        recordBlockView(blockId)
      );

      const results = await Promise.all(promises);

      // All calls should succeed
      expect(results.every(r => r === true)).toBe(true);
      // Redis incr should be called for each
      expect(mockRedis.incr).toHaveBeenCalledTimes(concurrentCalls);
    });

    it("should handle concurrent recordBlockDwell calls correctly", async () => {
      const blockId = "concurrent-dwell-block";
      const dwellValues = [1000, 2000, 3000, 4000, 5000];

      const promises = dwellValues.map(dwell =>
        recordBlockDwell(blockId, undefined, dwell)
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r === true)).toBe(true);
      expect(mockRedis.incrby).toHaveBeenCalledTimes(dwellValues.length);
    });

    it("should handle concurrent processBatchedEvents calls", async () => {
      const events1: BlockInteraction[] = [
        { type: "block_view", blockId: "block-a" },
        { type: "block_dwell", blockId: "block-a", dwellMs: 1000 },
      ];
      const events2: BlockInteraction[] = [
        { type: "block_view", blockId: "block-b" },
        { type: "block_dwell", blockId: "block-b", dwellMs: 2000 },
      ];

      const [result1, result2] = await Promise.all([
        processBatchedEvents("session-1", events1),
        processBatchedEvents("session-2", events2),
      ]);

      // Both should complete without error
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      // Each batch creates its own pipeline
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed concurrent operations", async () => {
      const operations = [
        recordBlockView("block-1"),
        recordBlockDwell("block-1", undefined, 1000),
        recordBlockView("block-2"),
        getBlockAnalytics("block-1"),
        markConversion("block-1", undefined, "won"),
      ];

      // All operations should complete without throwing
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  // =============================================================================
  // M-TEST-04: Redis Failure Scenarios
  // =============================================================================

  describe("Redis failure scenarios", () => {
    it("should return false when Redis incr fails for recordBlockView", async () => {
      mockRedis.incr.mockRejectedValue(new Error("Redis connection refused"));

      const result = await recordBlockView("block-123");

      expect(result).toBe(false);
    });

    it("should return false when Redis incrby fails for recordBlockDwell", async () => {
      mockRedis.incrby.mockRejectedValue(new Error("Redis connection timeout"));

      const result = await recordBlockDwell("block-123", undefined, 1000);

      expect(result).toBe(false);
    });

    it("should return default analytics when Redis mget fails", async () => {
      mockRedis.mget.mockRejectedValue(new Error("Redis cluster unavailable"));

      const analytics = await getBlockAnalytics("block-123");

      expect(analytics).toEqual({
        blockId: "block-123",
        impressions: 0,
        conversions: 0,
        totalDwellMs: 0,
        avgDwellMs: 0,
        conversionRate: 0,
      });
    });

    it("should return zero correlation when Redis fails for calculateCorrelation", async () => {
      mockRedis.mget.mockRejectedValue(new Error("Redis command failed"));

      const result = await calculateCorrelation("block-123");

      expect(result).toEqual({
        correlation: 0,
        wonCount: 0,
        lostCount: 0,
        confidence: 0,
      });
    });

    it("should handle Redis pipeline exec failure gracefully", async () => {
      mockPipeline.exec.mockRejectedValue(new Error("Pipeline execution failed"));

      const events: BlockInteraction[] = [
        { type: "block_view", blockId: "block-1" },
      ];

      // Should not throw
      await expect(processBatchedEvents("session-123", events)).resolves.toBeUndefined();
    });

    it("should handle scanStream error in getAnalyticsKeys", async () => {
      const mockStream = {
        on: vi.fn((event: string, callback: (err?: Error) => void) => {
          if (event === "error") {
            setTimeout(() => callback(new Error("SCAN failed")), 0);
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      await expect(getAnalyticsKeys()).rejects.toThrow("SCAN failed");
    });

    it("should recover after transient Redis failure", async () => {
      // First call fails
      mockRedis.incr.mockRejectedValueOnce(new Error("Transient error"));
      // Second call succeeds
      mockRedis.incr.mockResolvedValueOnce(1);

      const result1 = await recordBlockView("block-123");
      const result2 = await recordBlockView("block-123");

      expect(result1).toBe(false);
      expect(result2).toBe(true);
    });

    it("should not call zadd when incr fails in recordBlockView", async () => {
      mockRedis.incr.mockRejectedValue(new Error("Redis down"));

      await recordBlockView("block-123");

      // zadd should not be called since incr failed first
      expect(mockRedis.zadd).not.toHaveBeenCalled();
    });

    it("should not call incr dwell count when incrby fails in recordBlockDwell", async () => {
      mockRedis.incrby.mockRejectedValue(new Error("Redis down"));

      await recordBlockDwell("block-123", undefined, 1000);

      // incr for dwell:count should not be called since incrby failed
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });
  });

  describe("recordBlockView", () => {
    it("increments Redis counter with key format block:{blockId}:variant:{variantId}:views", async () => {
      const blockId = "block-123";
      const variantId = "variant-456";

      await recordBlockView(blockId, variantId);

      expect(mockRedis.incr).toHaveBeenCalledWith(
        `block:${blockId}:variant:${variantId}:views`
      );
    });

    it("uses key block:{blockId}:views when no variant specified", async () => {
      const blockId = "block-789";

      await recordBlockView(blockId);

      expect(mockRedis.incr).toHaveBeenCalledWith(`block:${blockId}:views`);
    });

    it("also adds to time-series sorted set for decay analysis", async () => {
      const blockId = "block-123";
      const variantId = "variant-456";

      await recordBlockView(blockId, variantId);

      expect(mockRedis.zadd).toHaveBeenCalled();
      const zaddCall = mockRedis.zadd.mock.calls[0];
      expect(zaddCall[0]).toBe(`block:${blockId}:views:ts`);
      // Score should be timestamp
      expect(typeof zaddCall[1]).toBe("number");
      // Member should contain variantId
      expect(zaddCall[2]).toContain(variantId);
    });
  });

  describe("recordBlockDwell", () => {
    it("increments cumulative dwell time in Redis", async () => {
      const blockId = "block-123";
      const variantId = "variant-456";
      const dwellMs = 5000;

      await recordBlockDwell(blockId, variantId, dwellMs);

      expect(mockRedis.incrby).toHaveBeenCalledWith(
        `block:${blockId}:variant:${variantId}:dwell`,
        dwellMs
      );
    });

    it("uses key block:{blockId}:dwell when no variant specified", async () => {
      const blockId = "block-789";
      const dwellMs = 3000;

      await recordBlockDwell(blockId, undefined, dwellMs);

      expect(mockRedis.incrby).toHaveBeenCalledWith(
        `block:${blockId}:dwell`,
        dwellMs
      );
    });

    it("increments view count for dwell tracking", async () => {
      const blockId = "block-123";
      const dwellMs = 5000;

      await recordBlockDwell(blockId, undefined, dwellMs);

      // Also increments dwell count for avg calculation
      expect(mockRedis.incr).toHaveBeenCalledWith(`block:${blockId}:dwell:count`);
    });
  });

  describe("getBlockAnalytics", () => {
    it("returns impressions, conversions, dwellTimeMs", async () => {
      const blockId = "block-123";
      mockRedis.mget.mockResolvedValue(["100", "5", "50000", "10"]);

      const analytics = await getBlockAnalytics(blockId);

      expect(analytics).toEqual<BlockAnalytics>({
        blockId,
        impressions: 100,
        conversions: 5,
        totalDwellMs: 50000,
        avgDwellMs: 5000, // 50000 / 10 views
        conversionRate: 0.05, // 5 / 100
      });
    });

    it("returns zero values when no data exists", async () => {
      const blockId = "block-new";
      mockRedis.mget.mockResolvedValue([null, null, null, null]);

      const analytics = await getBlockAnalytics(blockId);

      expect(analytics).toEqual<BlockAnalytics>({
        blockId,
        impressions: 0,
        conversions: 0,
        totalDwellMs: 0,
        avgDwellMs: 0,
        conversionRate: 0,
      });
    });

    it("fetches data from correct Redis keys", async () => {
      const blockId = "block-123";
      mockRedis.mget.mockResolvedValue(["100", "5", "50000", "10"]);

      await getBlockAnalytics(blockId);

      expect(mockRedis.mget).toHaveBeenCalledWith(
        `block:${blockId}:views`,
        `block:${blockId}:conversions`,
        `block:${blockId}:dwell`,
        `block:${blockId}:dwell:count`
      );
    });
  });

  describe("calculateCorrelation", () => {
    it("returns -1 to 1 correlation score with win/loss data", async () => {
      const blockId = "block-123";
      mockRedis.mget.mockResolvedValue(["10", "5", "15"]); // won, lost, total

      const result = await calculateCorrelation(blockId);

      expect(result.correlation).toBeGreaterThanOrEqual(-1);
      expect(result.correlation).toBeLessThanOrEqual(1);
      expect(result.wonCount).toBe(10);
      expect(result.lostCount).toBe(5);
    });

    it("returns confidence level based on sample size", async () => {
      const blockId = "block-123";
      mockRedis.mget.mockResolvedValue(["10", "5", "15"]);

      const result = await calculateCorrelation(blockId);

      expect(result).toMatchObject<Partial<CorrelationResult>>({
        wonCount: 10,
        lostCount: 5,
        confidence: expect.any(Number),
      });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("calculates positive correlation when block appears more in wins", async () => {
      const blockId = "block-winner";
      // Block appears in 80% of won proposals, 20% of lost
      mockRedis.mget.mockResolvedValue(["40", "5", "50"]); // won, lost, total

      const result = await calculateCorrelation(blockId);

      expect(result.correlation).toBeGreaterThan(0);
    });

    it("calculates negative correlation when block appears more in losses", async () => {
      const blockId = "block-loser";
      // Block appears in 20% of won proposals, 80% of lost
      mockRedis.mget.mockResolvedValue(["5", "40", "50"]);

      const result = await calculateCorrelation(blockId);

      expect(result.correlation).toBeLessThan(0);
    });

    it("returns zero correlation when no data exists", async () => {
      const blockId = "block-new";
      mockRedis.mget.mockResolvedValue([null, null, null]);

      const result = await calculateCorrelation(blockId);

      expect(result.correlation).toBe(0);
      expect(result.wonCount).toBe(0);
      expect(result.lostCount).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe("markConversion", () => {
    it("increments conversion counter for won proposals", async () => {
      const blockId = "block-123";
      const variantId = "variant-456";

      await markConversion(blockId, variantId, "won");

      expect(mockRedis.incr).toHaveBeenCalledWith(
        `block:${blockId}:variant:${variantId}:conversions`
      );
      expect(mockRedis.incr).toHaveBeenCalledWith(
        `block:${blockId}:variant:${variantId}:won`
      );
    });

    it("increments loss counter for lost proposals", async () => {
      const blockId = "block-123";
      const variantId = "variant-456";

      await markConversion(blockId, variantId, "lost");

      expect(mockRedis.incr).toHaveBeenCalledWith(
        `block:${blockId}:variant:${variantId}:lost`
      );
    });

    it("uses block-level key when no variant specified", async () => {
      const blockId = "block-123";

      await markConversion(blockId, undefined, "won");

      expect(mockRedis.incr).toHaveBeenCalledWith(
        `block:${blockId}:conversions`
      );
      expect(mockRedis.incr).toHaveBeenCalledWith(`block:${blockId}:won`);
    });
  });

  describe("getAnalyticsKeys", () => {
    it("uses SCAN cursor iteration, not KEYS command", async () => {
      // Create a mock readable stream that emits keys
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Emit some keys
            callback(["block:123:views", "block:456:views"]);
          }
          if (event === "end") {
            // Signal stream end
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      const keys = await getAnalyticsKeys();

      // Should use scanStream, NOT keys command
      expect(mockRedis.scanStream).toHaveBeenCalledWith({
        match: "block:*:views",
        count: 100,
      });
      expect(mockRedis.keys).not.toHaveBeenCalled();
      expect(keys).toContain("block:123:views");
      expect(keys).toContain("block:456:views");
    });

    it("handles SCAN pagination correctly", async () => {
      // Create a mock stream that collects multiple batches
      const dataCallbacks: ((data: string[]) => void)[] = [];
      let endCallback: (() => void) | null = null;

      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            dataCallbacks.push(callback as (data: string[]) => void);
          }
          if (event === "end") {
            endCallback = callback as () => void;
          }
          // Simulate async emission after all handlers registered
          setTimeout(() => {
            if (dataCallbacks.length > 0 && endCallback) {
              // Emit multiple batches
              dataCallbacks[0](["block:1:views", "block:2:views"]);
              dataCallbacks[0](["block:3:views"]);
              endCallback();
            }
          }, 0);
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      const keys = await getAnalyticsKeys();

      expect(keys.length).toBe(3);
    });
  });

  describe("processBatchedEvents", () => {
    it("uses pipelined commands for atomicity", async () => {
      const events: BlockInteraction[] = [
        { type: "block_view", blockId: "block-1" },
        { type: "block_view", blockId: "block-2", variantId: "variant-1" },
        { type: "block_dwell", blockId: "block-1", dwellMs: 5000 },
      ];

      await processBatchedEvents("session-123", events);

      // Should use pipeline
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it("pipelines INCR + INCRBY operations for non-atomic Redis operations", async () => {
      const events: BlockInteraction[] = [
        { type: "block_view", blockId: "block-1" },
        { type: "block_dwell", blockId: "block-1", dwellMs: 3000 },
      ];

      await processBatchedEvents("session-123", events);

      // Pipeline should have been used for multiple operations
      expect(mockPipeline.incr).toHaveBeenCalled();
      expect(mockPipeline.incrby).toHaveBeenCalled();
    });

    it("adds to time-series sorted set for block_view events (matches recordBlockView)", async () => {
      const events: BlockInteraction[] = [
        { type: "block_view", blockId: "block-1", variantId: "variant-1" },
        { type: "block_view", blockId: "block-2" },
      ];

      await processBatchedEvents("session-123", events);

      // Should add to time-series sorted set for each block_view
      expect(mockPipeline.zadd).toHaveBeenCalledTimes(2);
    });

    it("skips events with invalid blockId", async () => {
      const events: BlockInteraction[] = [
        { type: "block_view", blockId: "" },
        { type: "block_view", blockId: "   " },
        { type: "block_view", blockId: "valid-block" },
      ];

      await processBatchedEvents("session-123", events);

      // Only the valid block should be processed
      expect(mockPipeline.incr).toHaveBeenCalledTimes(1);
    });

    it("validates dwellMs is positive number for block_dwell events", async () => {
      const events: BlockInteraction[] = [
        { type: "block_dwell", blockId: "block-1", dwellMs: -100 },
        { type: "block_dwell", blockId: "block-2", dwellMs: 0 },
        { type: "block_dwell", blockId: "block-3", dwellMs: 5000 },
      ];

      await processBatchedEvents("session-123", events);

      // Only the valid dwell event should be processed
      expect(mockPipeline.incrby).toHaveBeenCalledTimes(1);
    });

    it("skips block_dwell with NaN dwellMs in batch", async () => {
      const events: BlockInteraction[] = [
        { type: "block_dwell", blockId: "block-1", dwellMs: NaN },
        { type: "block_dwell", blockId: "block-2", dwellMs: 1000 },
      ];

      await processBatchedEvents("session-123", events);

      // Only valid dwell should be processed
      expect(mockPipeline.incrby).toHaveBeenCalledTimes(1);
    });

    it("skips block_dwell with Infinity dwellMs in batch", async () => {
      const events: BlockInteraction[] = [
        { type: "block_dwell", blockId: "block-1", dwellMs: Infinity },
        { type: "block_dwell", blockId: "block-2", dwellMs: -Infinity },
        { type: "block_dwell", blockId: "block-3", dwellMs: 2000 },
      ];

      await processBatchedEvents("session-123", events);

      // Only valid dwell should be processed
      expect(mockPipeline.incrby).toHaveBeenCalledTimes(1);
    });

    it("handles scroll_depth events without processing (session-level)", async () => {
      const events: BlockInteraction[] = [
        { type: "scroll_depth", blockId: "block-1", percent: 50 },
        { type: "scroll_depth", blockId: "block-2", percent: 100 },
      ];

      await processBatchedEvents("session-123", events);

      // scroll_depth is handled at session level, not block level
      expect(mockPipeline.incr).not.toHaveBeenCalled();
      expect(mockPipeline.incrby).not.toHaveBeenCalled();
    });

    it("handles cta_click events without processing (session-level)", async () => {
      const events: BlockInteraction[] = [
        { type: "cta_click", blockId: "block-1" },
      ];

      await processBatchedEvents("session-123", events);

      // cta_click is handled at session level, not block level
      expect(mockPipeline.incr).not.toHaveBeenCalled();
    });

    it("handles empty event array gracefully", async () => {
      await processBatchedEvents("session-123", []);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it("handles undefined dwellMs for block_dwell events", async () => {
      const events: BlockInteraction[] = [
        { type: "block_dwell", blockId: "block-1" }, // dwellMs undefined
        { type: "block_dwell", blockId: "block-2", dwellMs: 3000 },
      ];

      await processBatchedEvents("session-123", events);

      // Only valid dwell should be processed
      expect(mockPipeline.incrby).toHaveBeenCalledTimes(1);
    });

    it("handles null blockId in batch (type coercion)", async () => {
      const events: BlockInteraction[] = [
        // @ts-expect-error - Testing runtime behavior with invalid input
        { type: "block_view", blockId: null },
        { type: "block_view", blockId: "valid-block" },
      ];

      await processBatchedEvents("session-123", events);

      // Only valid block should be processed
      expect(mockPipeline.incr).toHaveBeenCalledTimes(1);
    });

    it("handles very large dwellMs in batch", async () => {
      const events: BlockInteraction[] = [
        { type: "block_dwell", blockId: "block-1", dwellMs: Number.MAX_SAFE_INTEGER },
      ];

      await processBatchedEvents("session-123", events);

      expect(mockPipeline.incrby).toHaveBeenCalledWith(
        "block:block-1:dwell",
        Number.MAX_SAFE_INTEGER
      );
    });
  });

  // =============================================================================
  // Additional Edge Cases for markConversion
  // =============================================================================

  describe("markConversion edge cases", () => {
    it("handles Redis error gracefully without throwing", async () => {
      mockRedis.incr.mockRejectedValue(new Error("Redis unavailable"));

      // Should not throw
      await expect(markConversion("block-123", undefined, "won")).resolves.toBeUndefined();
    });

    it("does not increment conversion counter for lost outcome", async () => {
      await markConversion("block-123", undefined, "lost");

      // Should only increment the lost counter, not conversions
      expect(mockRedis.incr).toHaveBeenCalledTimes(1);
      expect(mockRedis.incr).toHaveBeenCalledWith("block:block-123:lost");
    });

    it("increments both conversion and won counter for won outcome", async () => {
      await markConversion("block-123", undefined, "won");

      expect(mockRedis.incr).toHaveBeenCalledTimes(2);
      expect(mockRedis.incr).toHaveBeenCalledWith("block:block-123:conversions");
      expect(mockRedis.incr).toHaveBeenCalledWith("block:block-123:won");
    });
  });
});

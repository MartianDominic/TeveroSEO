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
  });
});

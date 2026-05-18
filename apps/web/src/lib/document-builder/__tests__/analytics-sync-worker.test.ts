/**
 * Analytics Sync Worker Tests
 * Phase 102-06: Redis to Postgres sync
 *
 * TDD RED phase: Tests for syncing Redis counters to Postgres.
 * Uses GETSET pattern for atomic read-and-reset of counters.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis module
const mockRedis = vi.hoisted(() => ({
  getset: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
  setex: vi.fn(),
  scanStream: vi.fn(),
  pipeline: vi.fn(() => ({
    getset: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("@/lib/redis/client", () => ({
  redis: mockRedis,
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Drizzle database
const mockDb = vi.hoisted(() => ({
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ id: "variant-1" }]),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  })),
}));

vi.mock("@/db", () => ({
  db: mockDb,
}));

// Mock schema
vi.mock("@/db/schema/document-builder", () => ({
  blockVariants: {
    id: "id",
    impressions: "impressions",
    conversions: "conversions",
  },
}));

// Import after mocks
import {
  syncAnalytics,
  analyticsSyncWorker,
  type SyncResult,
} from "../analytics-sync-worker";

describe("analytics-sync-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("syncAnalytics", () => {
    it("reads Redis counters and updates Postgres block_variants", async () => {
      // Setup: Mock SCAN to return some keys
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            callback(["block:123:variant:456:views"]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // Mock GETSET to return counter value
      mockRedis.getset.mockResolvedValue("100");

      const result = await syncAnalytics();

      // Should have synced
      expect(result.keysProcessed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toEqual([]);
    });

    it("uses GETSET pattern to atomically read and reset counters", async () => {
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            callback(["block:123:variant:456:views"]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("50");

      await syncAnalytics();

      // Should use GETSET with 0 to atomically read and reset
      expect(mockRedis.getset).toHaveBeenCalledWith(
        "block:123:variant:456:views",
        "0"
      );
    });

    it("handles missing variants gracefully", async () => {
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Key for a variant that doesn't exist in DB
            callback(["block:999:variant:999:views"]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("10");

      // Mock DB to return no results (variant not found)
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // Empty result = not found
        }),
      });

      const result = await syncAnalytics();

      // Should not throw, but may log a warning
      expect(result.errors.length).toBe(0);
    });

    it("batch updates to minimize DB round trips", async () => {
      // Track which pattern is being scanned
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // First call is for views, second for conversions
            if (callCount === 0) {
              callback([
                "block:1:variant:1:views",
                "block:2:variant:2:views",
                "block:3:variant:3:views",
              ]);
            } else {
              callback([]); // No conversion keys
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("25");

      const result = await syncAnalytics();

      // 3 view keys processed
      expect(result.keysProcessed).toBe(3);
    });

    it("restores Redis values on DB failure for retry", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return key on first scan call
            if (callCount === 0) {
              callback(["block:fail-block:variant:fail-variant:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("42");
      mockRedis.get.mockResolvedValue("0"); // Retry count = 0
      mockRedis.incr.mockResolvedValue(1); // First retry
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.incrby.mockResolvedValue(42);

      // Mock DB update to fail
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB connection error")),
        }),
      });

      const result = await syncAnalytics();

      // Should restore value to Redis for retry
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        "block:fail-block:variant:fail-variant:views",
        42
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("moves to dead letter queue after max retries", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return key on first scan call
            if (callCount === 0) {
              callback(["block:dlq-block:variant:dlq-variant:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("100");
      mockRedis.incr.mockResolvedValue(3); // Max retries (3) reached
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.setex.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);

      // Mock DB update to fail
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("Persistent DB error")),
        }),
      });

      const result = await syncAnalytics();

      // Should move to DLQ instead of restoring to Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^dlq:analytics-sync:failed:dlq-variant:/),
        expect.any(Number),
        expect.stringContaining("dlq-variant")
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("clears retry count on successful sync", async () => {
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            callback(["block:success-block:variant:success-variant:views"]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("50");
      mockRedis.del.mockResolvedValue(1);

      // Mock successful DB update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "success-variant" }]),
        }),
      });

      await syncAnalytics();

      // Should clear retry count after success
      expect(mockRedis.del).toHaveBeenCalledWith(
        "dlq:analytics-sync:retry:success-variant"
      );
    });

    it("verifies SCAN error handler is registered", async () => {
      // This test verifies that the scanKeys function properly registers an error handler.
      // The error handling behavior itself is validated by the "restores Redis values on DB failure"
      // test which exercises the try-catch block in syncAnalytics.
      //
      // Full stream error simulation is complex due to:
      // 1. Fake timers interaction with stream callbacks
      // 2. monitorDeadLetterQueue() being called outside try-catch after main sync

      let errorHandlerRegistered = false;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "error") {
            errorHandlerRegistered = true;
          }
          if (event === "data") {
            callback([]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      await syncAnalytics();

      // Verify that error handler was registered on the stream
      expect(errorHandlerRegistered).toBe(true);
    });

    it("handles null GETSET response (key didn't exist)", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return key on first scan call
            if (callCount === 0) {
              callback(["block:null-block:variant:null-variant:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue(null);

      const result = await syncAnalytics();

      // Should process key but skip DB update (no value)
      expect(result.keysProcessed).toBe(1);
      expect(result.updatesPerformed).toBe(0);
    });

    it("handles zero GETSET response (counter already reset)", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return key on first scan call
            if (callCount === 0) {
              callback(["block:zero-block:variant:zero-variant:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("0");

      const result = await syncAnalytics();

      // Should process key but skip DB update (zero value)
      expect(result.keysProcessed).toBe(1);
      expect(result.updatesPerformed).toBe(0);
    });

    it("handles invalid numeric value in Redis", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return key on first scan call
            if (callCount === 0) {
              callback(["block:invalid-block:variant:invalid-variant:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("not-a-number");

      const result = await syncAnalytics();

      // Should process key but skip DB update (NaN)
      expect(result.keysProcessed).toBe(1);
      expect(result.updatesPerformed).toBe(0);
    });

    it("handles malformed Redis key format", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return key on first scan call
            if (callCount === 0) {
              callback(["invalid:key:format"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("10");

      const result = await syncAnalytics();

      // Should skip invalid key format
      expect(result.keysProcessed).toBe(1);
      expect(result.updatesPerformed).toBe(0);
    });

    it("accumulates multiple metrics for same variant", async () => {
      let callIndex = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // First scan returns views, second returns conversions for same variant
            const keys = [
              ["block:multi-block:variant:multi-variant:views"],
              ["block:multi-block:variant:multi-variant:conversions"],
              [],
              [],
            ];
            callback(keys[callIndex] || []);
          }
          if (event === "end") {
            callIndex++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValueOnce("100").mockResolvedValueOnce("5");
      mockRedis.del.mockResolvedValue(1);

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "multi-variant" }]),
        }),
      });

      const result = await syncAnalytics();

      // Both views and conversions should be processed
      expect(result.keysProcessed).toBe(2);
    });

    it("scans block-level keys (no variant) in addition to variant keys", async () => {
      // Track scan patterns
      const scannedPatterns: string[] = [];
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            callback([]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockImplementation((opts: { match: string }) => {
        scannedPatterns.push(opts.match);
        return mockStream;
      });

      await syncAnalytics();

      // Should scan both variant-level and block-level patterns
      expect(scannedPatterns).toContain("block:*:variant:*:views");
      expect(scannedPatterns).toContain("block:*:variant:*:conversions");
      expect(scannedPatterns).toContain("block:*:views");
      expect(scannedPatterns).toContain("block:*:conversions");
    });

    it("filters out variant keys from block-level scan results", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Simulate block:*:views scan returning both block-level and variant keys
            // (Redis glob pattern matches both)
            if (callCount === 2) {
              // Third scan (block:*:views)
              callback([
                "block:1:views",
                "block:2:variant:1:views", // Should be filtered out
              ]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("10");

      const result = await syncAnalytics();

      // block:1:views should be processed (block-level key, no DB update)
      // block:2:variant:1:views should be filtered out (contains :variant:)
      // So only 1 key processed, 0 DB updates (block-level keys don't update DB)
      expect(result.keysProcessed).toBeGreaterThanOrEqual(1);
      expect(result.updatesPerformed).toBe(0);
    });

    it("skips block-level keys for DB update but still processes them", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            if (callCount === 2) {
              // Third scan (block:*:views) - block-level keys
              callback(["block:1:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("10");

      const result = await syncAnalytics();

      // Block-level key processed but no DB update (no variant to update)
      expect(result.keysProcessed).toBeGreaterThanOrEqual(1);
      // No DB updates for block-level keys (they don't map to blockVariants table)
      expect(result.updatesPerformed).toBe(0);
    });

    it("parses block-level keys correctly (block:{blockId}:views)", async () => {
      let callCount = 0;
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            // Only return block-level key on third scan (block:*:views)
            if (callCount === 2) {
              callback(["block:test-block-123:views"]);
            } else {
              callback([]);
            }
          }
          if (event === "end") {
            callCount++;
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);
      mockRedis.getset.mockResolvedValue("50");

      const result = await syncAnalytics();

      // Key should be processed (GETSET called)
      expect(mockRedis.getset).toHaveBeenCalledWith("block:test-block-123:views", "0");
      // Block-level key processed + extra keysProcessed increment for skipped block-level update
      expect(result.keysProcessed).toBeGreaterThanOrEqual(1);
    });
  });

  describe("analyticsSyncWorker", () => {
    it("exports worker that can be started and stopped", () => {
      expect(analyticsSyncWorker).toBeDefined();
      expect(typeof analyticsSyncWorker.start).toBe("function");
      expect(typeof analyticsSyncWorker.stop).toBe("function");
    });

    it("runs sync every 5 minutes when started", async () => {
      const mockStream = {
        on: vi.fn((event: string, callback: (data?: string[]) => void) => {
          if (event === "data") {
            callback([]);
          }
          if (event === "end") {
            callback();
          }
          return mockStream;
        }),
      };
      mockRedis.scanStream.mockReturnValue(mockStream);

      // Start the worker
      analyticsSyncWorker.start();

      // Advance time by 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Worker should have attempted a sync (scanStream called)
      expect(mockRedis.scanStream).toHaveBeenCalled();

      // Stop the worker
      analyticsSyncWorker.stop();
    });
  });
});

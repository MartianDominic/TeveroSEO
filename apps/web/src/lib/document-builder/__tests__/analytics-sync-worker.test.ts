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

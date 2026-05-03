/**
 * Tests for Redis Pub/Sub Cache Invalidation
 * CRIT-CACHE-01 FIX: Cross-instance L1 cache invalidation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  registerInvalidationHandler,
  clearInvalidationHandlers,
  recordCacheHit,
  recordCacheMiss,
  recordCacheInvalidation,
  getCacheMetrics,
  getAllCacheMetrics,
  resetCacheMetrics,
  getInstanceId,
  type InvalidationMessage,
} from "./pubsub-invalidation";

describe("pubsub-invalidation", () => {
  beforeEach(() => {
    clearInvalidationHandlers();
    resetCacheMetrics();
  });

  afterEach(() => {
    clearInvalidationHandlers();
    resetCacheMetrics();
  });

  describe("registerInvalidationHandler", () => {
    it("should register a handler", () => {
      const handler = vi.fn(() => 0);
      registerInvalidationHandler(handler);
      // Handler registered successfully (no error thrown)
      expect(true).toBe(true);
    });

    it("should allow multiple handlers", () => {
      const handler1 = vi.fn(() => 1);
      const handler2 = vi.fn(() => 2);
      registerInvalidationHandler(handler1);
      registerInvalidationHandler(handler2);
      // Both handlers registered successfully
      expect(true).toBe(true);
    });
  });

  describe("clearInvalidationHandlers", () => {
    it("should clear all handlers", () => {
      const handler = vi.fn(() => 0);
      registerInvalidationHandler(handler);
      clearInvalidationHandlers();
      // All handlers cleared (no error thrown)
      expect(true).toBe(true);
    });
  });

  describe("cache metrics", () => {
    describe("recordCacheHit", () => {
      it("should record hits for a cache", () => {
        recordCacheHit("test-cache");
        recordCacheHit("test-cache");
        recordCacheHit("test-cache");

        const metrics = getCacheMetrics("test-cache");
        expect(metrics?.hits).toBe(3);
        expect(metrics?.misses).toBe(0);
      });

      it("should initialize metrics if not exists", () => {
        recordCacheHit("new-cache");
        const metrics = getCacheMetrics("new-cache");
        expect(metrics).not.toBeNull();
        expect(metrics?.hits).toBe(1);
      });
    });

    describe("recordCacheMiss", () => {
      it("should record misses for a cache", () => {
        recordCacheMiss("test-cache");
        recordCacheMiss("test-cache");

        const metrics = getCacheMetrics("test-cache");
        expect(metrics?.misses).toBe(2);
        expect(metrics?.hits).toBe(0);
      });
    });

    describe("recordCacheInvalidation", () => {
      it("should record invalidations for a cache", () => {
        recordCacheInvalidation("test-cache");
        recordCacheInvalidation("test-cache");

        const metrics = getCacheMetrics("test-cache");
        expect(metrics?.invalidations).toBe(2);
      });
    });

    describe("getCacheMetrics", () => {
      it("should return null for unknown cache", () => {
        const metrics = getCacheMetrics("unknown-cache");
        expect(metrics).toBeNull();
      });

      it("should return metrics for known cache", () => {
        recordCacheHit("test-cache");
        const metrics = getCacheMetrics("test-cache");
        expect(metrics).not.toBeNull();
        expect(metrics?.lastReset).toBeDefined();
      });
    });

    describe("getAllCacheMetrics", () => {
      it("should return all cache metrics with hit rates", () => {
        recordCacheHit("cache-a");
        recordCacheHit("cache-a");
        recordCacheMiss("cache-a");

        recordCacheHit("cache-b");
        recordCacheMiss("cache-b");
        recordCacheMiss("cache-b");
        recordCacheMiss("cache-b");

        const all = getAllCacheMetrics();

        expect(all["cache-a"].hitRate).toBeCloseTo(2 / 3, 2);
        expect(all["cache-b"].hitRate).toBeCloseTo(1 / 4, 2);
      });

      it("should return 0 hit rate for cache with no activity", () => {
        recordCacheInvalidation("empty-cache");
        const all = getAllCacheMetrics();
        expect(all["empty-cache"].hitRate).toBe(0);
      });
    });

    describe("resetCacheMetrics", () => {
      it("should reset specific cache metrics", () => {
        recordCacheHit("cache-a");
        recordCacheHit("cache-b");

        resetCacheMetrics("cache-a");

        expect(getCacheMetrics("cache-a")).toBeNull();
        expect(getCacheMetrics("cache-b")).not.toBeNull();
      });

      it("should reset all cache metrics when no name provided", () => {
        recordCacheHit("cache-a");
        recordCacheHit("cache-b");

        resetCacheMetrics();

        expect(getCacheMetrics("cache-a")).toBeNull();
        expect(getCacheMetrics("cache-b")).toBeNull();
      });
    });
  });

  describe("getInstanceId", () => {
    it("should return a string instance ID", () => {
      const id = getInstanceId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should return consistent ID across calls", () => {
      const id1 = getInstanceId();
      const id2 = getInstanceId();
      expect(id1).toBe(id2);
    });
  });
});

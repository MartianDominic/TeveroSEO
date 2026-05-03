/**
 * Tests for Crawl Metrics Collection
 *
 * Verifies metrics tracking for:
 * - Singleflight hits/misses and ratio
 * - Delta skips by layer (L0/L1/L2)
 * - Queue completions by lane
 * - Cost savings calculation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSingleflight,
  recordDeltaSkip,
  recordFullProcess,
  recordQueueCompletion,
  getMetrics,
  getSingleflightRatio,
  getDeltaSkipRatio,
  resetMetrics,
  COST_PER_CRAWL_DOLLAR,
  type CrawlMetrics,
} from "./crawl-metrics";

describe("crawl-metrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe("recordSingleflight", () => {
    it("increments hits on true", () => {
      recordSingleflight(true);
      const metrics = getMetrics();
      expect(metrics.singleflightHits).toBe(1);
      expect(metrics.singleflightMisses).toBe(0);
    });

    it("increments misses on false", () => {
      recordSingleflight(false);
      const metrics = getMetrics();
      expect(metrics.singleflightHits).toBe(0);
      expect(metrics.singleflightMisses).toBe(1);
    });

    it("adds to costSavings on hit", () => {
      recordSingleflight(true);
      const metrics = getMetrics();
      expect(metrics.costSavingsDollars).toBe(COST_PER_CRAWL_DOLLAR);
    });

    it("does not add to costSavings on miss", () => {
      recordSingleflight(false);
      const metrics = getMetrics();
      expect(metrics.costSavingsDollars).toBe(0);
    });
  });

  describe("recordDeltaSkip", () => {
    it("increments L0 counter", () => {
      recordDeltaSkip("L0");
      const metrics = getMetrics();
      expect(metrics.deltaL0Skips).toBe(1);
      expect(metrics.deltaL1Skips).toBe(0);
      expect(metrics.deltaL2Skips).toBe(0);
    });

    it("increments L1 counter", () => {
      recordDeltaSkip("L1");
      const metrics = getMetrics();
      expect(metrics.deltaL0Skips).toBe(0);
      expect(metrics.deltaL1Skips).toBe(1);
      expect(metrics.deltaL2Skips).toBe(0);
    });

    it("increments L2 counter", () => {
      recordDeltaSkip("L2");
      const metrics = getMetrics();
      expect(metrics.deltaL0Skips).toBe(0);
      expect(metrics.deltaL1Skips).toBe(0);
      expect(metrics.deltaL2Skips).toBe(1);
    });

    it("adds COST_PER_CRAWL to costSavings for each skip", () => {
      recordDeltaSkip("L0");
      recordDeltaSkip("L1");
      recordDeltaSkip("L2");
      const metrics = getMetrics();
      expect(metrics.costSavingsDollars).toBe(COST_PER_CRAWL_DOLLAR * 3);
    });
  });

  describe("recordFullProcess", () => {
    it("increments fullProcessed counter", () => {
      recordFullProcess();
      recordFullProcess();
      const metrics = getMetrics();
      expect(metrics.fullProcessed).toBe(2);
    });

    it("does not add to costSavings", () => {
      recordFullProcess();
      const metrics = getMetrics();
      expect(metrics.costSavingsDollars).toBe(0);
    });
  });

  describe("recordQueueCompletion", () => {
    it("increments fastApi counter", () => {
      recordQueueCompletion("fastApi");
      const metrics = getMetrics();
      expect(metrics.fastApiCompleted).toBe(1);
      expect(metrics.heavyCrawlCompleted).toBe(0);
    });

    it("increments heavyCrawl counter", () => {
      recordQueueCompletion("heavyCrawl");
      const metrics = getMetrics();
      expect(metrics.fastApiCompleted).toBe(0);
      expect(metrics.heavyCrawlCompleted).toBe(1);
    });
  });

  describe("getSingleflightRatio", () => {
    it("returns 0 when no singleflight events", () => {
      expect(getSingleflightRatio()).toBe(0);
    });

    it("returns hits/(hits+misses)", () => {
      recordSingleflight(true);
      recordSingleflight(true);
      recordSingleflight(false);
      // 2 hits, 1 miss -> 2/3 = 0.666...
      expect(getSingleflightRatio()).toBeCloseTo(2 / 3, 5);
    });

    it("returns 1 when all hits", () => {
      recordSingleflight(true);
      recordSingleflight(true);
      expect(getSingleflightRatio()).toBe(1);
    });

    it("returns 0 when all misses", () => {
      recordSingleflight(false);
      recordSingleflight(false);
      expect(getSingleflightRatio()).toBe(0);
    });
  });

  describe("getDeltaSkipRatio", () => {
    it("returns 0 when no delta events", () => {
      expect(getDeltaSkipRatio()).toBe(0);
    });

    it("returns skips/(skips+processed)", () => {
      recordDeltaSkip("L0");
      recordDeltaSkip("L1");
      recordFullProcess();
      // 2 skips, 1 processed -> 2/3 = 0.666...
      expect(getDeltaSkipRatio()).toBeCloseTo(2 / 3, 5);
    });

    it("returns 1 when all skips", () => {
      recordDeltaSkip("L0");
      recordDeltaSkip("L1");
      recordDeltaSkip("L2");
      expect(getDeltaSkipRatio()).toBe(1);
    });

    it("returns 0 when all processed", () => {
      recordFullProcess();
      recordFullProcess();
      expect(getDeltaSkipRatio()).toBe(0);
    });
  });

  describe("getMetrics", () => {
    it("returns immutable snapshot", () => {
      recordSingleflight(true);
      const metrics1 = getMetrics();
      const metrics2 = getMetrics();
      // Should be different objects
      expect(metrics1).not.toBe(metrics2);
      // But same values
      expect(metrics1).toEqual(metrics2);
    });

    it("mutations to snapshot do not affect internal state", () => {
      recordSingleflight(true);
      const metrics = getMetrics();
      // Try to mutate
      (metrics as { singleflightHits: number }).singleflightHits = 999;
      // Internal state should be unchanged
      expect(getMetrics().singleflightHits).toBe(1);
    });
  });

  describe("resetMetrics", () => {
    it("clears all counters to 0", () => {
      recordSingleflight(true);
      recordSingleflight(false);
      recordDeltaSkip("L0");
      recordDeltaSkip("L1");
      recordDeltaSkip("L2");
      recordFullProcess();
      recordQueueCompletion("fastApi");
      recordQueueCompletion("heavyCrawl");

      resetMetrics();

      const metrics = getMetrics();
      expect(metrics.singleflightHits).toBe(0);
      expect(metrics.singleflightMisses).toBe(0);
      expect(metrics.deltaL0Skips).toBe(0);
      expect(metrics.deltaL1Skips).toBe(0);
      expect(metrics.deltaL2Skips).toBe(0);
      expect(metrics.fullProcessed).toBe(0);
      expect(metrics.fastApiCompleted).toBe(0);
      expect(metrics.heavyCrawlCompleted).toBe(0);
      expect(metrics.costSavingsDollars).toBe(0);
    });
  });
});

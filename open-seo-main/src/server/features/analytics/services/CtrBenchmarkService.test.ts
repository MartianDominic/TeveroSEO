/**
 * Tests for CtrBenchmarkService
 * Phase 96-05: Position-based CTR benchmarks
 *
 * TDD RED phase - tests for CTR curve and comparison logic
 */
import { describe, it, expect } from "vitest";
import { CtrBenchmarkService } from "./CtrBenchmarkService";

describe("CtrBenchmarkService", () => {
  const service = new CtrBenchmarkService();

  describe("getPositionCtrBenchmark", () => {
    it("should return ~28.4% CTR for position 1", () => {
      const ctr = service.getPositionCtrBenchmark(1);
      expect(ctr).toBeCloseTo(0.284, 2);
    });

    it("should return ~15.5% CTR for position 2", () => {
      const ctr = service.getPositionCtrBenchmark(2);
      expect(ctr).toBeCloseTo(0.155, 2);
    });

    it("should return ~11.0% CTR for position 3", () => {
      const ctr = service.getPositionCtrBenchmark(3);
      expect(ctr).toBeCloseTo(0.110, 2);
    });

    it("should return ~2.4% CTR for position 10", () => {
      const ctr = service.getPositionCtrBenchmark(10);
      expect(ctr).toBeCloseTo(0.024, 2);
    });

    it("should return ~1.8% CTR for position 11 (striking distance)", () => {
      const ctr = service.getPositionCtrBenchmark(11);
      expect(ctr).toBeCloseTo(0.018, 2);
    });

    it("should return low but positive CTR for position 50", () => {
      const ctr = service.getPositionCtrBenchmark(50);
      expect(ctr).toBeGreaterThan(0);
      expect(ctr).toBeLessThan(0.01);
    });

    it("should return 0 for position 0 or negative", () => {
      expect(service.getPositionCtrBenchmark(0)).toBe(0);
      expect(service.getPositionCtrBenchmark(-1)).toBe(0);
    });

    it("should return decreasing CTR for increasing positions", () => {
      const ctr1 = service.getPositionCtrBenchmark(1);
      const ctr5 = service.getPositionCtrBenchmark(5);
      const ctr10 = service.getPositionCtrBenchmark(10);
      const ctr20 = service.getPositionCtrBenchmark(20);

      expect(ctr1).toBeGreaterThan(ctr5);
      expect(ctr5).toBeGreaterThan(ctr10);
      expect(ctr10).toBeGreaterThan(ctr20);
    });
  });

  describe("compareActualToBenchmark", () => {
    it("should return 'above' status when actual > benchmark * 1.1", () => {
      // Position 10 benchmark is ~2.4%, so 3% should be 'above'
      const result = service.compareActualToBenchmark(10, 0.03);

      expect(result.status).toBe("above");
      expect(result.position).toBe(10);
      expect(result.actualCtr).toBe(0.03);
      expect(result.benchmarkCtr).toBeCloseTo(0.024, 2);
      expect(result.delta).toBeGreaterThan(0);
    });

    it("should return 'below' status when actual < benchmark * 0.9", () => {
      // Position 10 benchmark is ~2.4%, so 1% should be 'below'
      const result = service.compareActualToBenchmark(10, 0.01);

      expect(result.status).toBe("below");
      expect(result.delta).toBeLessThan(0);
    });

    it("should return 'at' status when actual is within 10% of benchmark", () => {
      // Position 10 benchmark is ~2.4%, so 2.4% should be 'at'
      const result = service.compareActualToBenchmark(10, 0.024);

      expect(result.status).toBe("at");
    });

    it("should calculate correct delta percentage", () => {
      // Position 1 benchmark is 28.4%, actual is 30%
      const result = service.compareActualToBenchmark(1, 0.30);

      // Delta = 0.30 - 0.284 = 0.016
      // DeltaPercent = (0.016 / 0.284) * 100 = ~5.6%
      expect(result.deltaPercent).toBeCloseTo(5.6, 0);
    });

    it("should handle zero actual CTR", () => {
      const result = service.compareActualToBenchmark(5, 0);

      expect(result.status).toBe("below");
      expect(result.actualCtr).toBe(0);
    });
  });

  describe("generateCtrCurve", () => {
    it("should generate curve for default 20 positions", () => {
      const curve = service.generateCtrCurve();

      expect(curve.length).toBe(20);
      expect(curve[0].position).toBe(1);
      expect(curve[19].position).toBe(20);
    });

    it("should generate curve for custom position count", () => {
      const curve = service.generateCtrCurve(10);

      expect(curve.length).toBe(10);
    });

    it("should have correct CTR values in curve", () => {
      const curve = service.generateCtrCurve(3);

      expect(curve[0]).toEqual({ position: 1, ctr: expect.closeTo(0.284, 2) });
      expect(curve[1]).toEqual({ position: 2, ctr: expect.closeTo(0.155, 2) });
      expect(curve[2]).toEqual({ position: 3, ctr: expect.closeTo(0.110, 2) });
    });

    it("should generate monotonically decreasing curve", () => {
      const curve = service.generateCtrCurve(20);

      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].ctr).toBeLessThan(curve[i - 1].ctr);
      }
    });
  });

  describe("analyzePositionOpportunities", () => {
    it("should identify pages performing below benchmark", () => {
      const pages = [
        { url: "/page1", position: 5, ctr: 0.03 },  // Below benchmark (6.5%)
        { url: "/page2", position: 3, ctr: 0.15 },  // Above benchmark (11%)
        { url: "/page3", position: 10, ctr: 0.01 }, // Below benchmark (2.4%)
      ];

      const result = service.analyzePositionOpportunities(pages);

      expect(result.belowBenchmark).toHaveLength(2);
      expect(result.atOrAboveBenchmark).toHaveLength(1);
    });

    it("should sort below-benchmark pages by opportunity size", () => {
      const pages = [
        { url: "/page1", position: 1, ctr: 0.20 },  // Delta: -8.4%
        { url: "/page2", position: 10, ctr: 0.01 }, // Delta: -1.4%
      ];

      const result = service.analyzePositionOpportunities(pages);

      // Page1 has bigger opportunity (more clicks to gain)
      expect(result.belowBenchmark[0].url).toBe("/page1");
    });

    it("should handle empty pages array", () => {
      const result = service.analyzePositionOpportunities([]);

      expect(result.belowBenchmark).toEqual([]);
      expect(result.atOrAboveBenchmark).toEqual([]);
    });
  });

  describe("getIndustryBenchmarks", () => {
    it("should return benchmark data for all standard positions", () => {
      const benchmarks = service.getIndustryBenchmarks();

      expect(benchmarks).toHaveProperty("1");
      expect(benchmarks).toHaveProperty("10");
      expect(benchmarks).toHaveProperty("20");
    });

    it("should match individual position lookups", () => {
      const benchmarks = service.getIndustryBenchmarks();

      expect(benchmarks[1]).toBeCloseTo(service.getPositionCtrBenchmark(1), 3);
      expect(benchmarks[10]).toBeCloseTo(service.getPositionCtrBenchmark(10), 3);
    });
  });
});

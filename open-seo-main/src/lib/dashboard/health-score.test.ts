/**
 * Tests for health score calculation algorithm.
 * Phase 21: Agency Command Center
 */
import { describe, it, expect } from "vitest";
import { computeHealthScore, type HealthInputs } from "./health-score";

describe("health-score", () => {
  describe("computeHealthScore", () => {
    it("should return score 90-100 for perfect client with no issues", () => {
      const inputs: Partial<HealthInputs> = {
        trafficTrend: 0,
        alertsCritical: 0,
        alertsWarning: 0,
        keywordsTop10Pct: 100,
        backlinksLostPct: 0,
        lastReportDaysAgo: 0,
        connectionStale: false,
      };

      const result = computeHealthScore(inputs);

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown).toBeDefined();
    });

    it("should return score < 60 for client with 2 critical alerts", () => {
      const inputs: Partial<HealthInputs> = {
        alertsCritical: 2,
        alertsWarning: 0,
        keywordsTop10Pct: 50,
      };

      const result = computeHealthScore(inputs);

      expect(result.score).toBeLessThan(60);
    });

    it("should return score < 70 for client with >20% traffic drop", () => {
      const inputs: Partial<HealthInputs> = {
        trafficTrend: -0.25, // 25% drop
        alertsCritical: 0,
        keywordsTop10Pct: 80,
      };

      const result = computeHealthScore(inputs);

      expect(result.score).toBeLessThan(70);
    });

    it("should return score < 85 for client with stale connection", () => {
      const inputs: Partial<HealthInputs> = {
        trafficTrend: 0,
        alertsCritical: 0,
        keywordsTop10Pct: 100,
        connectionStale: true,
      };

      const result = computeHealthScore(inputs);

      expect(result.score).toBeLessThan(85);
    });

    it("should clamp score between 0 and 100", () => {
      // Extreme negative scenario
      const badInputs: Partial<HealthInputs> = {
        trafficTrend: -0.5, // 50% drop
        alertsCritical: 5,
        alertsWarning: 5,
        keywordsTop10Pct: 0,
        backlinksLostPct: 0.5, // 50% lost
        lastReportDaysAgo: 60,
        connectionStale: true,
      };

      const badResult = computeHealthScore(badInputs);
      expect(badResult.score).toBeGreaterThanOrEqual(0);
      expect(badResult.score).toBeLessThanOrEqual(100);

      // Extreme positive scenario
      const goodInputs: Partial<HealthInputs> = {
        trafficTrend: 0.5, // 50% gain
        alertsCritical: 0,
        alertsWarning: 0,
        keywordsTop10Pct: 100,
        backlinksLostPct: 0,
        lastReportDaysAgo: 0,
        connectionStale: false,
      };

      const goodResult = computeHealthScore(goodInputs);
      expect(goodResult.score).toBeGreaterThanOrEqual(0);
      expect(goodResult.score).toBeLessThanOrEqual(100);
    });

    it("should return 100 (healthy default) for empty inputs", () => {
      const result = computeHealthScore({});

      // Empty inputs use defaults: no alerts, good keywords, no traffic drop
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.breakdown.traffic).toBeDefined();
      expect(result.breakdown.rankings).toBeDefined();
      expect(result.breakdown.technical).toBeDefined();
      expect(result.breakdown.backlinks).toBeDefined();
      expect(result.breakdown.content).toBeDefined();
    });

    it("should return breakdown with all components", () => {
      const inputs: Partial<HealthInputs> = {
        trafficTrend: 0.1,
        alertsCritical: 1,
        keywordsTop10Pct: 70,
        backlinksLostPct: 0.05,
        lastReportDaysAgo: 10,
      };

      const result = computeHealthScore(inputs);

      expect(result.breakdown.traffic).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.traffic).toBeLessThanOrEqual(30);

      expect(result.breakdown.rankings).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.rankings).toBeLessThanOrEqual(25);

      expect(result.breakdown.technical).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.technical).toBeLessThanOrEqual(20);

      expect(result.breakdown.backlinks).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.backlinks).toBeLessThanOrEqual(15);

      expect(result.breakdown.content).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.content).toBeLessThanOrEqual(10);
    });
  });
});

/**
 * Tests for heatmap calculator.
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 */

import { describe, it, expect } from "vitest";
import {
  calculateEngagementScore,
  getHeatLevel,
  getHeatColor,
  getHeatLabel,
  calculateHeatmapData,
  getHeatGradient,
  type HeatLevel,
} from "../heatmap-calculator";

describe("heatmap-calculator", () => {
  describe("calculateEngagementScore", () => {
    it("returns 0 when totalViews is 0", () => {
      const score = calculateEngagementScore(10, 5000, 0);
      expect(score).toBe(0);
    });

    it("calculates score with 40% view rate and 60% dwell time", () => {
      // 50 views out of 100 total = 50% view rate = 20 points (40% * 50)
      // 15000ms out of 30000ms max = 50% dwell = 30 points (60% * 50)
      // Total: 50 points
      const score = calculateEngagementScore(50, 15000, 100, 30000);
      expect(score).toBe(50);
    });

    it("caps score at 100", () => {
      // Very high values
      const score = calculateEngagementScore(200, 60000, 100, 30000);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("returns 0 for no engagement", () => {
      const score = calculateEngagementScore(0, 0, 100, 30000);
      expect(score).toBe(0);
    });
  });

  describe("getHeatLevel", () => {
    it("returns cold for scores 0-20", () => {
      expect(getHeatLevel(0)).toBe("cold");
      expect(getHeatLevel(10)).toBe("cold");
      expect(getHeatLevel(20)).toBe("cold");
    });

    it("returns cool for scores 21-40", () => {
      expect(getHeatLevel(21)).toBe("cool");
      expect(getHeatLevel(30)).toBe("cool");
      expect(getHeatLevel(40)).toBe("cool");
    });

    it("returns warm for scores 41-60", () => {
      expect(getHeatLevel(41)).toBe("warm");
      expect(getHeatLevel(50)).toBe("warm");
      expect(getHeatLevel(60)).toBe("warm");
    });

    it("returns hot for scores 61-80", () => {
      expect(getHeatLevel(61)).toBe("hot");
      expect(getHeatLevel(70)).toBe("hot");
      expect(getHeatLevel(80)).toBe("hot");
    });

    it("returns very_hot for scores 81-100", () => {
      expect(getHeatLevel(81)).toBe("very_hot");
      expect(getHeatLevel(90)).toBe("very_hot");
      expect(getHeatLevel(100)).toBe("very_hot");
    });
  });

  describe("getHeatColor", () => {
    it("returns correct color per UI-SPEC", () => {
      expect(getHeatColor("cold")).toBe("rgba(156, 163, 175, 0.15)");
      expect(getHeatColor("cool")).toBe("rgba(251, 191, 36, 0.15)");
      expect(getHeatColor("warm")).toBe("rgba(251, 146, 60, 0.20)");
      expect(getHeatColor("hot")).toBe("rgba(239, 68, 68, 0.25)");
      expect(getHeatColor("very_hot")).toBe("rgba(220, 38, 38, 0.35)");
    });
  });

  describe("getHeatLabel", () => {
    it("returns 'Skipped by most viewers' for cold", () => {
      expect(getHeatLabel("cold")).toBe("Skipped by most viewers");
    });

    it("returns 'High engagement' for hot", () => {
      expect(getHeatLabel("hot")).toBe("High engagement");
    });

    it("returns labels for all levels", () => {
      const levels: HeatLevel[] = ["cold", "cool", "warm", "hot", "very_hot"];
      for (const level of levels) {
        expect(getHeatLabel(level)).toBeTruthy();
        expect(typeof getHeatLabel(level)).toBe("string");
      }
    });
  });

  describe("calculateHeatmapData", () => {
    it("returns empty array for empty input", () => {
      const result = calculateHeatmapData([]);
      expect(result).toEqual([]);
    });

    it("calculates heatmap data for multiple blocks", () => {
      const blocks = [
        { blockId: "block-1", views: 100, avgDwellMs: 10000 },
        { blockId: "block-2", views: 50, avgDwellMs: 5000 },
        { blockId: "block-3", views: 10, avgDwellMs: 1000 },
      ];

      const result = calculateHeatmapData(blocks);

      expect(result).toHaveLength(3);
      expect(result[0].blockId).toBe("block-1");
      expect(result[0].score).toBeGreaterThan(result[2].score);
      expect(result[0].level).toBeDefined();
      expect(result[0].color).toMatch(/^rgba\(/);
      expect(result[0].label).toBeTruthy();
    });

    it("normalizes scores across blocks", () => {
      const blocks = [
        { blockId: "block-1", views: 100, avgDwellMs: 30000 },
        { blockId: "block-2", views: 0, avgDwellMs: 0 },
      ];

      const result = calculateHeatmapData(blocks);

      // Block 1 should have high score
      expect(result[0].score).toBeGreaterThan(50);
      // Block 2 should have low/zero score
      expect(result[1].score).toBeLessThanOrEqual(10);
    });
  });

  describe("getHeatGradient", () => {
    it("returns CSS linear-gradient string", () => {
      const gradient = getHeatGradient("hot");
      expect(gradient).toContain("linear-gradient");
      expect(gradient).toContain("transparent");
      expect(gradient).toContain("rgba");
    });

    it("includes the heat color", () => {
      const gradient = getHeatGradient("cold");
      expect(gradient).toContain("156, 163, 175");
    });
  });
});

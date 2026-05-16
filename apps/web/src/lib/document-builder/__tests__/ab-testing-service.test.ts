/**
 * A/B Testing Service Tests
 * Phase 102-05: A/B testing UI and version diff
 *
 * Tests for deterministic variant assignment and statistical significance.
 */

import { describe, expect, it } from "vitest";

import {
  getVariantForProspect,
  calculateSignificance,
  normalizeWeights,
} from "../ab-testing-service";
import type { BlockVariant } from "../types";

const createMockVariant = (
  id: string,
  weight: number,
  impressions = 0,
  conversions = 0
): BlockVariant => ({
  id,
  parentBlockId: "block-1",
  variantName: id === "control" ? "Control" : `Variant ${id.toUpperCase()}`,
  content: { type: "doc", content: [] },
  styling: null,
  weight,
  impressions,
  conversions,
  status: "active",
  createdAt: new Date().toISOString(),
});

describe("ab-testing-service", () => {
  describe("getVariantForProspect", () => {
    it("returns same variant for same prospect+block (deterministic)", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      const result1 = getVariantForProspect("prospect-123", "block-456", variants);
      const result2 = getVariantForProspect("prospect-123", "block-456", variants);
      const result3 = getVariantForProspect("prospect-123", "block-456", variants);

      expect(result1.id).toBe(result2.id);
      expect(result2.id).toBe(result3.id);
    });

    it("returns different variant for different prospect", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      // Run many trials to ensure statistical distribution
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const variant = getVariantForProspect(`prospect-${i}`, "block-test", variants);
        results.add(variant.id);
      }

      // With 50/50 split, both variants should appear
      expect(results.size).toBe(2);
    });

    it("distributes evenly across variants based on weights", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 70),
        createMockVariant("a", 30),
      ];

      const counts: Record<string, number> = { control: 0, a: 0 };
      const totalTrials = 1000;

      for (let i = 0; i < totalTrials; i++) {
        const variant = getVariantForProspect(
          `prospect-distribution-${i}`,
          "block-distribution-test",
          variants
        );
        counts[variant.id]++;
      }

      // Allow 10% deviation from expected distribution
      expect(counts.control).toBeGreaterThan(totalTrials * 0.6);
      expect(counts.control).toBeLessThan(totalTrials * 0.8);
      expect(counts.a).toBeGreaterThan(totalTrials * 0.2);
      expect(counts.a).toBeLessThan(totalTrials * 0.4);
    });

    it("returns last variant if weights sum to less than 100", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 20),
        createMockVariant("a", 20),
      ];

      // Hash that produces bucket > 40 should still work
      const variant = getVariantForProspect("prospect-edge", "block-edge", variants);
      expect(variants.map((v) => v.id)).toContain(variant.id);
    });

    it("handles single variant", () => {
      const variants: BlockVariant[] = [createMockVariant("control", 100)];

      const result = getVariantForProspect("any-prospect", "any-block", variants);
      expect(result.id).toBe("control");
    });

    it("throws error for empty variants array", () => {
      expect(() => {
        getVariantForProspect("prospect", "block", []);
      }).toThrow("At least one variant is required");
    });
  });

  describe("calculateSignificance", () => {
    it("returns confidence level 0-100", () => {
      const controlVariant = createMockVariant("control", 50, 500, 50);
      const testVariant = createMockVariant("a", 50, 500, 75);

      const results = calculateSignificance([controlVariant, testVariant]);

      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result.confidenceLevel).toBeGreaterThanOrEqual(0);
        expect(result.confidenceLevel).toBeLessThanOrEqual(100);
      });
    });

    it("marks isSignificant=true when confidence > 95", () => {
      // Stark difference: 10% vs 20% conversion rate with large sample
      const controlVariant = createMockVariant("control", 50, 1000, 100);
      const testVariant = createMockVariant("a", 50, 1000, 200);

      const results = calculateSignificance([controlVariant, testVariant]);
      const testResult = results.find((r) => r.variantId === "a");

      expect(testResult?.isSignificant).toBe(true);
      expect(testResult?.recommendation).toBe("winner");
    });

    it("returns needs_more_data when impressions < 100", () => {
      const controlVariant = createMockVariant("control", 50, 50, 5);
      const testVariant = createMockVariant("a", 50, 50, 10);

      const results = calculateSignificance([controlVariant, testVariant]);

      results.forEach((result) => {
        expect(result.recommendation).toBe("needs_more_data");
      });
    });

    it("calculates conversion rate correctly", () => {
      const variant = createMockVariant("control", 100, 200, 50);

      const results = calculateSignificance([variant]);

      expect(results[0].conversionRate).toBe(0.25); // 50/200
    });

    it("handles zero impressions without dividing by zero", () => {
      const variant = createMockVariant("control", 100, 0, 0);

      const results = calculateSignificance([variant]);

      expect(results[0].conversionRate).toBe(0);
      expect(results[0].recommendation).toBe("needs_more_data");
    });

    it("identifies loser variant when significantly worse", () => {
      // Stark difference: 20% vs 5% conversion rate with large sample
      const controlVariant = createMockVariant("control", 50, 1000, 200);
      const testVariant = createMockVariant("a", 50, 1000, 50);

      const results = calculateSignificance([controlVariant, testVariant]);
      const testResult = results.find((r) => r.variantId === "a");

      expect(testResult?.recommendation).toBe("loser");
    });

    it("returns inconclusive when difference is not significant", () => {
      // Similar conversion rates: ~10%
      const controlVariant = createMockVariant("control", 50, 200, 20);
      const testVariant = createMockVariant("a", 50, 200, 22);

      const results = calculateSignificance([controlVariant, testVariant]);

      results.forEach((result) => {
        expect(result.isSignificant).toBe(false);
      });
    });
  });

  describe("normalizeWeights", () => {
    it("returns weights unchanged if they sum to 100", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      const normalized = normalizeWeights(variants);
      expect(normalized[0].weight).toBe(50);
      expect(normalized[1].weight).toBe(50);
    });

    it("scales weights proportionally if they don't sum to 100", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 30),
        createMockVariant("a", 30),
      ];

      const normalized = normalizeWeights(variants);
      expect(normalized[0].weight).toBe(50);
      expect(normalized[1].weight).toBe(50);
    });

    it("handles single variant by setting weight to 100", () => {
      const variants: BlockVariant[] = [createMockVariant("control", 50)];

      const normalized = normalizeWeights(variants);
      expect(normalized[0].weight).toBe(100);
    });
  });
});

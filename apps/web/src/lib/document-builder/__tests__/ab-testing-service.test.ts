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
  validateWeights,
  areWeightsValid,
  canDeclareWinner,
  getStatusLabel,
  // New lifecycle functions
  createExperiment,
  startExperiment,
  pauseExperiment,
  stopExperiment,
  rolloutWinner,
  detectWinner,
  hasMetMinimumDuration,
  getRemainingDuration,
  checkWinnerEligibility,
  calculateSignificanceWithProtection,
  getExperimentStatusLabel,
  MIN_IMPRESSIONS_FOR_SIGNIFICANCE,
  MIN_EXPERIMENT_DURATION_HOURS,
  type ABTestResult,
  type Experiment,
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

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();
      expect(result1!.id).toBe(result2!.id);
      expect(result2!.id).toBe(result3!.id);
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
        expect(variant).not.toBeNull();
        results.add(variant!.id);
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
        expect(variant).not.toBeNull();
        counts[variant!.id]++;
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
      expect(variant).not.toBeNull();
      expect(variants.map((v) => v.id)).toContain(variant!.id);
    });

    it("handles single variant", () => {
      const variants: BlockVariant[] = [createMockVariant("control", 100)];

      const result = getVariantForProspect("any-prospect", "any-block", variants);
      expect(result).not.toBeNull();
      expect(result!.id).toBe("control");
    });

    it("returns null for empty variants array", () => {
      const result = getVariantForProspect("prospect", "block", []);
      expect(result).toBeNull();
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

    it("returns needs_more_data when impressions < MIN_IMPRESSIONS_FOR_SIGNIFICANCE (250)", () => {
      const controlVariant = createMockVariant("control", 50, 100, 10);
      const testVariant = createMockVariant("a", 50, 100, 20);

      const results = calculateSignificance([controlVariant, testVariant]);

      results.forEach((result) => {
        expect(result.recommendation).toBe("needs_more_data");
      });
    });

    it("processes significance when impressions >= MIN_IMPRESSIONS_FOR_SIGNIFICANCE (250)", () => {
      const controlVariant = createMockVariant("control", 50, 300, 30);
      const testVariant = createMockVariant("a", 50, 300, 60);

      const results = calculateSignificance([controlVariant, testVariant]);

      // With enough impressions, it should calculate actual results
      results.forEach((result) => {
        expect(result.impressions).toBeGreaterThanOrEqual(MIN_IMPRESSIONS_FOR_SIGNIFICANCE);
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

    it("distributes equally when all weights are 0", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 0),
        createMockVariant("a", 0),
        createMockVariant("b", 0),
      ];

      const normalized = normalizeWeights(variants);
      const total = normalized.reduce((sum, v) => sum + v.weight, 0);
      expect(total).toBe(100);
      // Each should be ~33
      expect(normalized[0].weight).toBe(33);
      expect(normalized[1].weight).toBe(33);
      expect(normalized[2].weight).toBe(34); // Last gets remainder
    });

    it("handles three-way split (33/33/34)", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 33),
        createMockVariant("a", 33),
        createMockVariant("b", 34),
      ];

      const normalized = normalizeWeights(variants);
      const total = normalized.reduce((sum, v) => sum + v.weight, 0);
      expect(total).toBe(100);
    });
  });

  describe("validateWeights", () => {
    it("validates weights that sum to 100%", () => {
      const result = validateWeights({ control: 50, a: 50 });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects weights that do not sum to 100%", () => {
      const result = validateWeights({ control: 30, a: 30 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Weights must sum to 100% (current sum: 60.0%)");
    });

    it("rejects negative weights", () => {
      const result = validateWeights({ control: 110, a: -10 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Weights cannot be negative");
    });

    it("rejects individual weights over 100%", () => {
      const result = validateWeights({ control: 150, a: -50 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Individual weights cannot exceed 100%");
    });

    it("rejects all-zero weights (no traffic)", () => {
      const result = validateWeights({ control: 0, a: 0 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("At least one variant must have traffic allocation > 0");
    });

    it("rejects empty weights object", () => {
      const result = validateWeights({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("At least one variant is required");
    });

    it("accepts 100% on single variant", () => {
      const result = validateWeights({ control: 100 });
      expect(result.isValid).toBe(true);
    });

    it("accepts valid three-way split", () => {
      const result = validateWeights({ control: 33, a: 33, b: 34 });
      expect(result.isValid).toBe(true);
    });

    it("handles floating point sums correctly", () => {
      // 33.33 + 33.33 + 33.34 = 100.00
      const result = validateWeights({ control: 33.33, a: 33.33, b: 33.34 });
      expect(result.isValid).toBe(true);
    });
  });

  describe("areWeightsValid (legacy)", () => {
    it("returns boolean for backward compatibility", () => {
      expect(areWeightsValid({ control: 50, a: 50 })).toBe(true);
      expect(areWeightsValid({ control: 30, a: 30 })).toBe(false);
    });
  });

  describe("canDeclareWinner", () => {
    it("returns true for significant winner", () => {
      const result: ABTestResult = {
        variantId: "a",
        variantName: "Variant A",
        impressions: 1000,
        conversions: 200,
        conversionRate: 0.2,
        confidenceLevel: 98,
        isSignificant: true,
        recommendation: "winner",
      };
      expect(canDeclareWinner(result)).toBe(true);
    });

    it("returns false for non-significant winner recommendation", () => {
      const result: ABTestResult = {
        variantId: "a",
        variantName: "Variant A",
        impressions: 100,
        conversions: 20,
        conversionRate: 0.2,
        confidenceLevel: 80,
        isSignificant: false,
        recommendation: "winner",
      };
      expect(canDeclareWinner(result)).toBe(false);
    });

    it("returns false for significant loser", () => {
      const result: ABTestResult = {
        variantId: "a",
        variantName: "Variant A",
        impressions: 1000,
        conversions: 50,
        conversionRate: 0.05,
        confidenceLevel: 98,
        isSignificant: true,
        recommendation: "loser",
      };
      expect(canDeclareWinner(result)).toBe(false);
    });

    it("returns false for needs_more_data", () => {
      const result: ABTestResult = {
        variantId: "a",
        variantName: "Variant A",
        impressions: 50,
        conversions: 10,
        conversionRate: 0.2,
        confidenceLevel: 0,
        isSignificant: false,
        recommendation: "needs_more_data",
      };
      expect(canDeclareWinner(result)).toBe(false);
    });
  });

  describe("getStatusLabel", () => {
    it("returns correct labels for all statuses", () => {
      expect(getStatusLabel("active")).toBe("Active");
      expect(getStatusLabel("paused")).toBe("Paused");
      expect(getStatusLabel("winner")).toBe("Winner");
      expect(getStatusLabel("loser")).toBe("Stopped");
    });
  });

  describe("z-test correctness", () => {
    it("produces correct z-score for known data", () => {
      // Control: 100/1000 = 10% conversion
      // Variant: 150/1000 = 15% conversion
      // Expected z-score approximately 3.27
      const controlVariant = createMockVariant("control", 50, 1000, 100);
      const testVariant = createMockVariant("a", 50, 1000, 150);

      const results = calculateSignificance([controlVariant, testVariant]);
      const testResult = results.find((r) => r.variantId === "a");

      // With z=3.27, confidence should be ~99%
      expect(testResult?.confidenceLevel).toBeGreaterThan(95);
      expect(testResult?.isSignificant).toBe(true);
    });

    it("handles zero conversions gracefully", () => {
      const controlVariant = createMockVariant("control", 50, 500, 0);
      const testVariant = createMockVariant("a", 50, 500, 0);

      const results = calculateSignificance([controlVariant, testVariant]);

      // Both have 0% conversion rate - no difference
      expect(results[0].conversionRate).toBe(0);
      expect(results[1].conversionRate).toBe(0);
      // Should not crash and should return valid results
      expect(results).toHaveLength(2);
    });

    it("handles 100% conversion rate edge case", () => {
      const controlVariant = createMockVariant("control", 50, 500, 500);
      const testVariant = createMockVariant("a", 50, 500, 500);

      const results = calculateSignificance([controlVariant, testVariant]);

      // Both have 100% conversion rate - no difference
      expect(results[0].conversionRate).toBe(1);
      expect(results[1].conversionRate).toBe(1);
    });
  });

  describe("hash determinism", () => {
    it("same visitor+document always gets same variant (100 trials)", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      const visitorId = "visitor-abc-123";
      const documentId = "doc-xyz-789";
      const firstResult = getVariantForProspect(visitorId, documentId, variants);
      expect(firstResult).not.toBeNull();

      // Run 100 times - should always get same result
      for (let i = 0; i < 100; i++) {
        const result = getVariantForProspect(visitorId, documentId, variants);
        expect(result).not.toBeNull();
        expect(result!.id).toBe(firstResult!.id);
      }
    });

    it("different document IDs can produce different variants", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      const results = new Set<string>();
      const visitorId = "consistent-visitor";

      // Try many document IDs
      for (let i = 0; i < 50; i++) {
        const result = getVariantForProspect(visitorId, `doc-${i}`, variants);
        expect(result).not.toBeNull();
        results.add(result!.id);
      }

      // Should eventually see both variants
      expect(results.size).toBe(2);
    });
  });

  // =====================================
  // Experiment Lifecycle Tests
  // =====================================

  describe("experiment lifecycle", () => {
    const createMockExperiment = (
      overrides: Partial<Experiment> = {}
    ): Experiment => ({
      id: "exp_123",
      blockId: "block-1",
      name: "Test Experiment",
      status: "draft",
      variants: [
        createMockVariant("control", 50, 500, 50),
        createMockVariant("a", 50, 500, 75),
      ],
      createdAt: new Date().toISOString(),
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      winnerId: null,
      ...overrides,
    });

    describe("createExperiment", () => {
      it("creates experiment in draft status", () => {
        const variants = [
          createMockVariant("control", 50),
          createMockVariant("a", 50),
        ];

        const result = createExperiment("block-1", "My Test", variants);

        expect(result.success).toBe(true);
        expect(result.experiment?.status).toBe("draft");
        expect(result.experiment?.startedAt).toBeNull();
        expect(result.experiment?.winnerId).toBeNull();
      });

      it("fails with fewer than 2 variants", () => {
        const variants = [createMockVariant("control", 100)];

        const result = createExperiment("block-1", "My Test", variants);

        expect(result.success).toBe(false);
        expect(result.error).toContain("At least 2 variants");
      });

      it("sets all variants to paused status initially", () => {
        const variants = [
          createMockVariant("control", 50),
          createMockVariant("a", 50),
        ];

        const result = createExperiment("block-1", "My Test", variants);

        expect(result.success).toBe(true);
        result.experiment?.variants.forEach((v) => {
          expect(v.status).toBe("paused");
        });
      });
    });

    describe("startExperiment", () => {
      it("starts a draft experiment", () => {
        const experiment = createMockExperiment({ status: "draft" });

        const result = startExperiment(experiment);

        expect(result.success).toBe(true);
        expect(result.experiment?.status).toBe("running");
        expect(result.experiment?.startedAt).not.toBeNull();
      });

      it("resumes a paused experiment", () => {
        const originalStartTime = new Date(Date.now() - 3600000).toISOString();
        const experiment = createMockExperiment({
          status: "paused",
          startedAt: originalStartTime,
        });

        const result = startExperiment(experiment);

        expect(result.success).toBe(true);
        expect(result.experiment?.status).toBe("running");
        // Should preserve original start time
        expect(result.experiment?.startedAt).toBe(originalStartTime);
      });

      it("fails if already running", () => {
        const experiment = createMockExperiment({ status: "running" });

        const result = startExperiment(experiment);

        expect(result.success).toBe(false);
        expect(result.error).toContain("running");
      });

      it("fails if already completed", () => {
        const experiment = createMockExperiment({ status: "completed" });

        const result = startExperiment(experiment);

        expect(result.success).toBe(false);
        expect(result.error).toContain("completed");
      });

      it("fails with invalid weights", () => {
        const experiment = createMockExperiment({
          status: "draft",
          variants: [
            createMockVariant("control", 30),
            createMockVariant("a", 30), // Sum is 60, not 100
          ],
        });

        const result = startExperiment(experiment);

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid weights");
      });

      it("sets all variants to active", () => {
        const experiment = createMockExperiment({ status: "draft" });

        const result = startExperiment(experiment);

        expect(result.success).toBe(true);
        result.experiment?.variants.forEach((v) => {
          expect(v.status).toBe("active");
        });
      });
    });

    describe("pauseExperiment", () => {
      it("pauses a running experiment", () => {
        const experiment = createMockExperiment({
          status: "running",
          startedAt: new Date().toISOString(),
        });

        const result = pauseExperiment(experiment);

        expect(result.success).toBe(true);
        expect(result.experiment?.status).toBe("paused");
        expect(result.experiment?.pausedAt).not.toBeNull();
      });

      it("fails if not running", () => {
        const experiment = createMockExperiment({ status: "draft" });

        const result = pauseExperiment(experiment);

        expect(result.success).toBe(false);
        expect(result.error).toContain("running");
      });

      it("sets all variants to paused", () => {
        const experiment = createMockExperiment({
          status: "running",
          startedAt: new Date().toISOString(),
        });

        const result = pauseExperiment(experiment);

        expect(result.success).toBe(true);
        result.experiment?.variants.forEach((v) => {
          expect(v.status).toBe("paused");
        });
      });
    });

    describe("stopExperiment", () => {
      it("stops an experiment without declaring a winner", () => {
        const experiment = createMockExperiment({
          status: "running",
          startedAt: new Date().toISOString(),
        });

        const result = stopExperiment(experiment);

        expect(result.success).toBe(true);
        expect(result.experiment?.status).toBe("completed");
        expect(result.experiment?.completedAt).not.toBeNull();
        expect(result.experiment?.winnerId).toBeNull();
      });

      it("stops an experiment with a declared winner", () => {
        const experiment = createMockExperiment({
          status: "running",
          startedAt: new Date().toISOString(),
        });

        const result = stopExperiment(experiment, "a");

        expect(result.success).toBe(true);
        expect(result.experiment?.winnerId).toBe("a");
        expect(result.experiment?.variants.find((v) => v.id === "a")?.status).toBe("winner");
        expect(result.experiment?.variants.find((v) => v.id === "control")?.status).toBe("loser");
      });

      it("fails if already completed", () => {
        const experiment = createMockExperiment({ status: "completed" });

        const result = stopExperiment(experiment);

        expect(result.success).toBe(false);
        expect(result.error).toContain("already completed");
      });

      it("fails if winner variant not found", () => {
        const experiment = createMockExperiment({
          status: "running",
          startedAt: new Date().toISOString(),
        });

        const result = stopExperiment(experiment, "nonexistent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });
    });

    describe("hasMetMinimumDuration", () => {
      it("returns false if experiment never started", () => {
        const experiment = createMockExperiment({ startedAt: null });

        expect(hasMetMinimumDuration(experiment)).toBe(false);
      });

      it("returns false if started less than MIN_EXPERIMENT_DURATION_HOURS ago", () => {
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({ startedAt: oneHourAgo });

        expect(hasMetMinimumDuration(experiment)).toBe(false);
      });

      it("returns true if started more than MIN_EXPERIMENT_DURATION_HOURS ago", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({ startedAt: twoDaysAgo });

        expect(hasMetMinimumDuration(experiment)).toBe(true);
      });
    });

    describe("getRemainingDuration", () => {
      it("returns full duration if never started", () => {
        const experiment = createMockExperiment({ startedAt: null });

        const remaining = getRemainingDuration(experiment);

        expect(remaining).toBe(MIN_EXPERIMENT_DURATION_HOURS * 60 * 60 * 1000);
      });

      it("returns remaining time if partially elapsed", () => {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({ startedAt: twelveHoursAgo });

        const remaining = getRemainingDuration(experiment);

        // Should be approximately 12 hours remaining (24 - 12)
        const expectedRemaining = 12 * 60 * 60 * 1000;
        expect(remaining).toBeGreaterThan(expectedRemaining - 1000);
        expect(remaining).toBeLessThan(expectedRemaining + 1000);
      });

      it("returns 0 if duration exceeded", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({ startedAt: twoDaysAgo });

        expect(getRemainingDuration(experiment)).toBe(0);
      });
    });

    describe("checkWinnerEligibility", () => {
      it("returns canDeclare=false if not running", () => {
        const experiment = createMockExperiment({ status: "draft" });

        const result = checkWinnerEligibility(experiment);

        expect(result.canDeclare).toBe(false);
        expect(result.reasons).toContain("Experiment must be running (current: draft)");
      });

      it("returns canDeclare=false if minimum duration not met", () => {
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: oneHourAgo,
        });

        const result = checkWinnerEligibility(experiment);

        expect(result.canDeclare).toBe(false);
        expect(result.reasons.some((r) => r.includes("Minimum duration"))).toBe(true);
      });

      it("returns canDeclare=false if insufficient impressions", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 100, 10), // Below 250 threshold
            createMockVariant("a", 50, 100, 20),
          ],
        });

        const result = checkWinnerEligibility(experiment);

        expect(result.canDeclare).toBe(false);
        expect(result.reasons.some((r) => r.includes("Insufficient impressions"))).toBe(true);
      });

      it("returns canDeclare=true when all conditions met", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 500, 50),
            createMockVariant("a", 50, 500, 75),
          ],
        });

        const result = checkWinnerEligibility(experiment);

        expect(result.canDeclare).toBe(true);
        expect(result.reasons).toHaveLength(0);
      });
    });

    describe("calculateSignificanceWithProtection", () => {
      it("returns needs_more_data if minimum duration not met", () => {
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: oneHourAgo,
          variants: [
            createMockVariant("control", 50, 1000, 100),
            createMockVariant("a", 50, 1000, 200),
          ],
        });

        const results = calculateSignificanceWithProtection(experiment);

        // Even with enough impressions, should return needs_more_data due to duration
        results.forEach((result) => {
          expect(result.recommendation).toBe("needs_more_data");
          expect(result.isSignificant).toBe(false);
        });
      });

      it("calculates significance normally after minimum duration", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 1000, 100),
            createMockVariant("a", 50, 1000, 200),
          ],
        });

        const results = calculateSignificanceWithProtection(experiment);

        // Should calculate actual significance
        const testResult = results.find((r) => r.variantId === "a");
        expect(testResult?.isSignificant).toBe(true);
        expect(testResult?.recommendation).toBe("winner");
      });
    });

    describe("rolloutWinner", () => {
      it("rolls out winner with 100% traffic", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 1000, 100), // 10%
            createMockVariant("a", 50, 1000, 200), // 20%
          ],
        });

        const result = rolloutWinner(experiment, "a");

        expect(result.success).toBe(true);
        expect(result.experiment?.status).toBe("completed");
        expect(result.experiment?.winnerId).toBe("a");

        const winnerVariant = result.experiment?.variants.find((v) => v.id === "a");
        expect(winnerVariant?.weight).toBe(100);
        expect(winnerVariant?.status).toBe("winner");

        const loserVariant = result.experiment?.variants.find((v) => v.id === "control");
        expect(loserVariant?.weight).toBe(0);
        expect(loserVariant?.status).toBe("loser");
      });

      it("fails if variant not found", () => {
        const experiment = createMockExperiment({ status: "running" });

        const result = rolloutWinner(experiment, "nonexistent");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("fails if eligibility not met", () => {
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: oneHourAgo,
        });

        const result = rolloutWinner(experiment, "a");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Cannot roll out winner");
      });

      it("fails if variant is not statistically significant winner", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 500, 50), // 10%
            createMockVariant("a", 50, 500, 25), // 5% - this is the loser
          ],
        });

        const result = rolloutWinner(experiment, "a");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not a statistically significant winner");
      });
    });

    describe("detectWinner", () => {
      it("returns null if eligibility not met", () => {
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: oneHourAgo,
        });

        const winner = detectWinner(experiment);

        expect(winner).toBeNull();
      });

      it("returns winning variant when conditions are met", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 1000, 100), // 10%
            createMockVariant("a", 50, 1000, 200), // 20%
          ],
        });

        const winner = detectWinner(experiment);

        expect(winner).not.toBeNull();
        expect(winner?.id).toBe("a");
      });

      it("returns null if no clear winner", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const experiment = createMockExperiment({
          status: "running",
          startedAt: twoDaysAgo,
          variants: [
            createMockVariant("control", 50, 500, 50), // 10%
            createMockVariant("a", 50, 500, 52), // 10.4% - not significant difference
          ],
        });

        const winner = detectWinner(experiment);

        expect(winner).toBeNull();
      });
    });

    describe("getExperimentStatusLabel", () => {
      it("returns correct labels for all statuses", () => {
        expect(getExperimentStatusLabel("draft")).toBe("Draft");
        expect(getExperimentStatusLabel("running")).toBe("Running");
        expect(getExperimentStatusLabel("paused")).toBe("Paused");
        expect(getExperimentStatusLabel("completed")).toBe("Completed");
      });
    });
  });

  describe("constants", () => {
    it("MIN_IMPRESSIONS_FOR_SIGNIFICANCE is 250", () => {
      expect(MIN_IMPRESSIONS_FOR_SIGNIFICANCE).toBe(250);
    });

    it("MIN_EXPERIMENT_DURATION_HOURS is 24", () => {
      expect(MIN_EXPERIMENT_DURATION_HOURS).toBe(24);
    });
  });

  // =====================================
  // H-TEST-03: A/B Testing Edge Cases
  // =====================================

  describe("startExperiment edge cases", () => {
    const createMockExperiment = (
      overrides: Partial<Experiment> = {}
    ): Experiment => ({
      id: "exp_edge_case",
      blockId: "block-edge",
      name: "Edge Case Experiment",
      status: "draft",
      variants: [
        createMockVariant("control", 50, 0, 0),
        createMockVariant("a", 50, 0, 0),
      ],
      createdAt: new Date().toISOString(),
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      winnerId: null,
      ...overrides,
    });

    it("should reject single-variant experiment", () => {
      const experiment = createMockExperiment({
        variants: [createMockVariant("control", 100, 0, 0)],
      });

      const result = startExperiment(experiment);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at least 2 variants/i);
    });

    it("should reject empty variants array", () => {
      const experiment = createMockExperiment({
        variants: [],
      });

      const result = startExperiment(experiment);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at least 2 variants/i);
    });
  });

  describe("detectWinner edge cases", () => {
    const createMockExperiment = (
      overrides: Partial<Experiment> = {}
    ): Experiment => ({
      id: "exp_winner_edge",
      blockId: "block-winner-edge",
      name: "Winner Edge Case Experiment",
      status: "running",
      variants: [
        createMockVariant("control", 50, 500, 50),
        createMockVariant("a", 50, 500, 75),
      ],
      createdAt: new Date().toISOString(),
      startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
      pausedAt: null,
      completedAt: null,
      winnerId: null,
      ...overrides,
    });

    it("should handle control winning (control has higher conversion)", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 1000, 200), // 20% conversion - winner
          createMockVariant("a", 50, 1000, 100), // 10% conversion - loser
        ],
      });

      // Calculate significance to verify control is the winner
      const results = calculateSignificance(experiment.variants);
      const controlResult = results.find((r) => r.variantId === "control");
      const variantResult = results.find((r) => r.variantId === "a");

      // Control should be compared against best test variant (variant a)
      // Since control has higher conversion, it should be the winner
      expect(controlResult?.conversionRate).toBe(0.2);
      expect(variantResult?.conversionRate).toBe(0.1);
      expect(variantResult?.recommendation).toBe("loser");
    });

    it("should handle exact tie (same conversion rate)", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 1000, 100), // 10% conversion
          createMockVariant("a", 50, 1000, 100), // 10% conversion - exact tie
        ],
      });

      const results = calculateSignificance(experiment.variants);

      // With exact same conversion rates, neither should be a winner
      const controlResult = results.find((r) => r.variantId === "control");
      const variantResult = results.find((r) => r.variantId === "a");

      // Both should have same conversion rate
      expect(controlResult?.conversionRate).toBe(variantResult?.conversionRate);

      // Neither should be marked as winner since there's no difference
      expect(controlResult?.recommendation).not.toBe("winner");
      expect(variantResult?.recommendation).not.toBe("winner");

      // detectWinner should return null for a tie
      const winner = detectWinner(experiment);
      expect(winner).toBeNull();
    });

    it("should require minimum sample size to detect winner", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 100, 10), // Below 250 threshold
          createMockVariant("a", 50, 100, 30), // Below 250 threshold
        ],
      });

      const results = calculateSignificance(experiment.variants);

      // All results should be needs_more_data due to insufficient impressions
      results.forEach((result) => {
        expect(result.recommendation).toBe("needs_more_data");
        expect(result.isSignificant).toBe(false);
      });

      // detectWinner should also return null
      const winner = detectWinner(experiment);
      expect(winner).toBeNull();
    });

    it("should handle experiment with 0 impressions on all variants", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 0, 0), // 0 impressions
          createMockVariant("a", 50, 0, 0), // 0 impressions
        ],
      });

      const results = calculateSignificance(experiment.variants);

      results.forEach((result) => {
        expect(result.impressions).toBe(0);
        expect(result.conversionRate).toBe(0);
        expect(result.recommendation).toBe("needs_more_data");
      });

      // detectWinner should return null
      const winner = detectWinner(experiment);
      expect(winner).toBeNull();
    });

    it("should handle 100% conversion rate edge case with difference", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 500, 250), // 50% conversion
          createMockVariant("a", 50, 500, 500), // 100% conversion - winner
        ],
      });

      const results = calculateSignificance(experiment.variants);
      const variantResult = results.find((r) => r.variantId === "a");

      expect(variantResult?.conversionRate).toBe(1);
      expect(variantResult?.isSignificant).toBe(true);
      expect(variantResult?.recommendation).toBe("winner");

      const winner = detectWinner(experiment);
      expect(winner).not.toBeNull();
      expect(winner?.id).toBe("a");
    });

    it("should handle mixed 0 impressions (one variant has data, one does not)", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 500, 50), // Has data
          createMockVariant("a", 50, 0, 0), // No data
        ],
      });

      const results = calculateSignificance(experiment.variants);

      const controlResult = results.find((r) => r.variantId === "control");
      const variantResult = results.find((r) => r.variantId === "a");

      expect(controlResult?.impressions).toBe(500);
      expect(variantResult?.impressions).toBe(0);
      expect(variantResult?.recommendation).toBe("needs_more_data");
    });

    it("should handle very small difference (statistically insignificant)", () => {
      const experiment = createMockExperiment({
        variants: [
          createMockVariant("control", 50, 1000, 100), // 10.0% conversion
          createMockVariant("a", 50, 1000, 101), // 10.1% conversion
        ],
      });

      const results = calculateSignificance(experiment.variants);
      const variantResult = results.find((r) => r.variantId === "a");

      // Such a small difference should not be statistically significant
      expect(variantResult?.isSignificant).toBe(false);
      expect(variantResult?.recommendation).toBe("needs_more_data");

      const winner = detectWinner(experiment);
      expect(winner).toBeNull();
    });
  });

  // =====================================
  // M-TEST-05: Assignment Distribution Uniformity
  // =====================================

  describe("assignment distribution uniformity (chi-squared)", () => {
    /**
     * Chi-squared test for uniformity of assignment distribution.
     * Tests that variant assignment is statistically uniform.
     */
    it("should distribute evenly for 50/50 split (chi-squared test)", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      const counts: Record<string, number> = { control: 0, a: 0 };
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const variant = getVariantForProspect(
          `chi-squared-prospect-${i}`,
          "chi-squared-block",
          variants
        );
        expect(variant).not.toBeNull();
        counts[variant!.id]++;
      }

      // Expected count for each variant (50% of iterations)
      const expected = iterations / 2;

      // Calculate chi-squared statistic
      const chiSquared =
        Object.values(counts).reduce((sum, observed) => {
          const diff = observed - expected;
          return sum + (diff * diff) / expected;
        }, 0);

      // For 1 degree of freedom (2 categories - 1),
      // chi-squared critical value at 0.05 significance is 3.841
      // chi-squared critical value at 0.01 significance is 6.635
      // We use 0.01 to reduce flakiness
      const criticalValue = 6.635;

      expect(chiSquared).toBeLessThan(criticalValue);

      // Also verify counts are within reasonable bounds
      expect(counts.control).toBeGreaterThan(iterations * 0.45);
      expect(counts.control).toBeLessThan(iterations * 0.55);
      expect(counts.a).toBeGreaterThan(iterations * 0.45);
      expect(counts.a).toBeLessThan(iterations * 0.55);
    });

    it("should distribute according to 70/30 weights (chi-squared test)", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 70),
        createMockVariant("a", 30),
      ];

      const counts: Record<string, number> = { control: 0, a: 0 };
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const variant = getVariantForProspect(
          `chi-squared-70-30-${i}`,
          "chi-squared-block-70-30",
          variants
        );
        expect(variant).not.toBeNull();
        counts[variant!.id]++;
      }

      // Expected counts based on weights
      const expectedControl = iterations * 0.7;
      const expectedA = iterations * 0.3;

      // Calculate chi-squared statistic
      const chiSquared =
        Math.pow(counts.control - expectedControl, 2) / expectedControl +
        Math.pow(counts.a - expectedA, 2) / expectedA;

      // Critical value at 0.01 significance for 1 df
      const criticalValue = 6.635;

      expect(chiSquared).toBeLessThan(criticalValue);
    });

    it("should distribute evenly for 3-way split (chi-squared test)", () => {
      const variants: BlockVariant[] = [
        createMockVariant("control", 34),
        createMockVariant("a", 33),
        createMockVariant("b", 33),
      ];

      const counts: Record<string, number> = { control: 0, a: 0, b: 0 };
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const variant = getVariantForProspect(
          `chi-squared-3way-${i}`,
          "chi-squared-block-3way",
          variants
        );
        expect(variant).not.toBeNull();
        counts[variant!.id]++;
      }

      // Expected counts based on weights (normalized to 100)
      const expectedControl = iterations * 0.34;
      const expectedA = iterations * 0.33;
      const expectedB = iterations * 0.33;

      // Calculate chi-squared statistic
      const chiSquared =
        Math.pow(counts.control - expectedControl, 2) / expectedControl +
        Math.pow(counts.a - expectedA, 2) / expectedA +
        Math.pow(counts.b - expectedB, 2) / expectedB;

      // For 2 degrees of freedom (3 categories - 1),
      // chi-squared critical value at 0.01 significance is 9.210
      const criticalValue = 9.210;

      expect(chiSquared).toBeLessThan(criticalValue);
    });
  });

  // =====================================
  // M-TEST-06: Concurrent Experiment Management
  // =====================================

  describe("concurrent experiment management", () => {
    const createMockExperiment = (
      id: string,
      blockId: string,
      status: "draft" | "running" | "paused" | "completed" = "draft"
    ): Experiment => ({
      id,
      blockId,
      name: `Experiment ${id}`,
      status,
      variants: [
        createMockVariant("control", 50, 0, 0),
        createMockVariant("a", 50, 0, 0),
      ],
      createdAt: new Date().toISOString(),
      startedAt: status === "running" ? new Date().toISOString() : null,
      pausedAt: null,
      completedAt: null,
      winnerId: null,
    });

    it("should allow multiple experiments on different blocks", () => {
      const exp1 = createMockExperiment("exp_1", "block-1", "draft");
      const exp2 = createMockExperiment("exp_2", "block-2", "draft");

      const result1 = startExperiment(exp1);
      const result2 = startExperiment(exp2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.experiment?.blockId).toBe("block-1");
      expect(result2.experiment?.blockId).toBe("block-2");
    });

    it("should track experiments independently by block ID", () => {
      const exp1 = createMockExperiment("exp_1", "block-1", "running");
      const exp2 = createMockExperiment("exp_2", "block-2", "running");

      // Update variants with different data
      exp1.variants[0] = createMockVariant("control", 50, 1000, 100);
      exp1.variants[1] = createMockVariant("a", 50, 1000, 200);

      exp2.variants[0] = createMockVariant("control", 50, 500, 50);
      exp2.variants[1] = createMockVariant("a", 50, 500, 25);

      const results1 = calculateSignificance(exp1.variants);
      const results2 = calculateSignificance(exp2.variants);

      // Experiment 1: variant a is winning (20% vs 10%)
      expect(results1.find((r) => r.variantId === "a")?.recommendation).toBe("winner");

      // Experiment 2: control is winning (10% vs 5%)
      expect(results2.find((r) => r.variantId === "a")?.recommendation).toBe("loser");
    });

    it("should allow creating experiment even when another is running on different block", () => {
      const runningExp = createMockExperiment("exp_running", "block-1", "running");
      runningExp.startedAt = new Date().toISOString();

      // Create new experiment on different block
      const newVariants = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];
      const createResult = createExperiment("block-2", "New Experiment", newVariants);

      expect(createResult.success).toBe(true);
      expect(createResult.experiment?.blockId).toBe("block-2");
      expect(createResult.experiment?.status).toBe("draft");
    });

    it("should maintain separate lifecycle states for different experiments", () => {
      const exp1 = createMockExperiment("exp_1", "block-1", "draft");
      const exp2 = createMockExperiment("exp_2", "block-2", "draft");

      // Start exp1
      const started1 = startExperiment(exp1);
      expect(started1.success).toBe(true);
      expect(started1.experiment?.status).toBe("running");

      // exp2 should still be draft
      expect(exp2.status).toBe("draft");

      // Start exp2
      const started2 = startExperiment(exp2);
      expect(started2.success).toBe(true);
      expect(started2.experiment?.status).toBe("running");

      // Pause exp1 only
      const paused1 = pauseExperiment(started1.experiment!);
      expect(paused1.success).toBe(true);
      expect(paused1.experiment?.status).toBe("paused");

      // exp2 should still be running (separate state)
      expect(started2.experiment?.status).toBe("running");
    });

    it("should handle stopping one experiment while another continues", () => {
      const exp1 = createMockExperiment("exp_1", "block-1", "running");
      const exp2 = createMockExperiment("exp_2", "block-2", "running");
      exp1.startedAt = new Date().toISOString();
      exp2.startedAt = new Date().toISOString();

      // Stop exp1
      const stopped1 = stopExperiment(exp1);
      expect(stopped1.success).toBe(true);
      expect(stopped1.experiment?.status).toBe("completed");

      // exp2 should still be running
      expect(exp2.status).toBe("running");

      // Can still calculate significance for exp2
      exp2.variants[0] = createMockVariant("control", 50, 500, 50);
      exp2.variants[1] = createMockVariant("a", 50, 500, 75);
      const results = calculateSignificance(exp2.variants);
      expect(results).toHaveLength(2);
    });
  });

  // =====================================
  // Additional Edge Cases for Comprehensive Coverage
  // =====================================

  describe("z-test edge cases", () => {
    it("should handle when only control has 100% conversion", () => {
      const controlVariant = createMockVariant("control", 50, 500, 500); // 100%
      const testVariant = createMockVariant("a", 50, 500, 250); // 50%

      const results = calculateSignificance([controlVariant, testVariant]);
      const testResult = results.find((r) => r.variantId === "a");

      expect(testResult?.recommendation).toBe("loser");
    });

    it("should handle extremely uneven sample sizes", () => {
      const controlVariant = createMockVariant("control", 50, 10000, 1000); // 10%
      const testVariant = createMockVariant("a", 50, 300, 60); // 20%

      const results = calculateSignificance([controlVariant, testVariant]);

      // Both should have valid results even with different sample sizes
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.confidenceLevel).toBeGreaterThanOrEqual(0);
        expect(result.confidenceLevel).toBeLessThanOrEqual(100);
      });
    });

    it("should handle when both variants have 0% conversion", () => {
      const controlVariant = createMockVariant("control", 50, 500, 0);
      const testVariant = createMockVariant("a", 50, 500, 0);

      const results = calculateSignificance([controlVariant, testVariant]);

      expect(results[0].conversionRate).toBe(0);
      expect(results[1].conversionRate).toBe(0);
      // No difference should be detected
      results.forEach((result) => {
        expect(result.recommendation).not.toBe("winner");
      });
    });

    it("should handle single conversion difference", () => {
      const controlVariant = createMockVariant("control", 50, 500, 50);
      const testVariant = createMockVariant("a", 50, 500, 51); // Just 1 more conversion

      const results = calculateSignificance([controlVariant, testVariant]);
      const testResult = results.find((r) => r.variantId === "a");

      // Single conversion difference should not be significant
      expect(testResult?.isSignificant).toBe(false);
    });
  });

  describe("createExperiment edge cases", () => {
    it("should handle empty variants array", () => {
      const result = createExperiment("block-1", "Empty Test", []);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/At least 2 variants/i);
    });

    it("should generate unique experiment IDs", () => {
      const variants = [
        createMockVariant("control", 50),
        createMockVariant("a", 50),
      ];

      const result1 = createExperiment("block-1", "Test 1", variants);
      const result2 = createExperiment("block-1", "Test 2", variants);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.experiment?.id).not.toBe(result2.experiment?.id);
    });
  });
});

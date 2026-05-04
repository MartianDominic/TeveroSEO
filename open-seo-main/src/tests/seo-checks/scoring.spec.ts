/**
 * SEO Scoring System Test Suite
 * Phase 72-02: SEO Checks Validation
 *
 * Tests scoring calculations across all tiers:
 * - Tier weight verification
 * - Hard gate enforcement
 * - Quality gate evaluation
 */
import { describe, it, expect } from "vitest";
import {
  calculateOnPageScore,
  passesQualityGate,
  evaluateQualityGate,
  QUALITY_GATE_THRESHOLD,
} from "@/server/lib/audit/checks/scoring";
import type { CheckResult } from "@/server/lib/audit/checks/types";

// Import to trigger registration
import "@/server/lib/audit/checks";

describe("SEO Scoring System", () => {
  describe("Tier Weight Calculations", () => {
    it("should apply correct weight for Tier 1 (0.3 pts, max 20)", () => {
      // 10 T1 passes = 10 * 0.3 = 3 pts
      const results = createPassingChecks("T1", 10);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier1).toBeCloseTo(3, 1);
    });

    it("should cap Tier 1 at 20 points", () => {
      // 68 T1 passes = 68 * 0.3 = 20.4, capped at 20
      const results = createPassingChecks("T1", 68);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier1).toBe(20);
    });

    it("should apply correct weight for Tier 2 (0.5 pts, max 10)", () => {
      // 10 T2 passes = 10 * 0.5 = 5 pts
      const results = createPassingChecks("T2", 10);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier2).toBeCloseTo(5, 1);
    });

    it("should cap Tier 2 at 10 points", () => {
      // 21 T2 passes = 21 * 0.5 = 10.5, capped at 10
      const results = createPassingChecks("T2", 21);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier2).toBe(10);
    });

    it("should apply correct weight for Tier 3 (0.8 pts, max 6)", () => {
      // 5 T3 passes = 5 * 0.8 = 4 pts
      const results = createPassingChecks("T3", 5);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier3).toBeCloseTo(4, 1);
    });

    it("should cap Tier 3 at 6 points (normalized)", () => {
      // 13 T3 passes = 13 * 0.8 = 10.4, capped at 6
      const results = createPassingChecks("T3", 13);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier3).toBe(6);
    });

    it("should apply correct weight for Tier 4 (0.4 pts, max 4)", () => {
      // 5 T4 passes = 5 * 0.4 = 2 pts
      const results = createPassingChecks("T4", 5);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier4).toBeCloseTo(2, 1);
    });

    it("should cap Tier 4 at 4 points", () => {
      // 10 T4 passes = 10 * 0.4 = 4, capped at 4
      const results = createPassingChecks("T4", 10);
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier4).toBe(4);
    });
  });

  describe("Base Score", () => {
    it("should start with 60 point base score", () => {
      const score = calculateOnPageScore([]);
      expect(score.breakdown.base).toBe(60);
      expect(score.score).toBe(60);
    });

    it("should add tier contributions to base score", () => {
      const results = [
        ...createPassingChecks("T1", 10), // 3 pts
        ...createPassingChecks("T2", 4), // 2 pts
      ];
      const score = calculateOnPageScore(results);

      expect(score.score).toBe(60 + 3 + 2); // 65
    });
  });

  describe("Maximum Score", () => {
    it("should cap total score at 100", () => {
      // Max all tiers
      const results = [
        ...createPassingChecks("T1", 68),
        ...createPassingChecks("T2", 21),
        ...createPassingChecks("T3", 13),
        ...createPassingChecks("T4", 7),
      ];
      const score = calculateOnPageScore(results);

      expect(score.score).toBeLessThanOrEqual(100);
    });

    it("should reach exactly 100 with max passes", () => {
      // 60 base + 20 T1 + 10 T2 + 6 T3 + 4 T4 = 100
      const results = [
        ...createPassingChecks("T1", 68),
        ...createPassingChecks("T2", 21),
        ...createPassingChecks("T3", 13),
        ...createPassingChecks("T4", 10),
      ];
      const score = calculateOnPageScore(results);

      // Should be 100 (60+20+10+6+4)
      expect(score.score).toBe(100);
    });
  });

  describe("Hard Gates", () => {
    describe("Gate 1: noindex (T1-67)", () => {
      it("should cap score at 0 when noindex fails", () => {
        const results = [
          ...createPassingChecks("T1", 50),
          createFailingCheck("T1-67", "critical"),
        ];
        const score = calculateOnPageScore(results);

        expect(score.score).toBe(0);
        expect(score.gates).toContain("noindex");
      });

      it("should return immediately on noindex (highest priority)", () => {
        const results = [
          createFailingCheck("T1-67", "critical"), // noindex
          createFailingCheck("T1-68", "critical"), // YMYL
        ];
        const score = calculateOnPageScore(results);

        // Only noindex gate should be recorded
        expect(score.gates).toEqual(["noindex"]);
        expect(score.score).toBe(0);
      });
    });

    describe("Gate 2: Duplicate Content (T4-06 >60%)", () => {
      it("should cap score at 50 when duplicate >60%", () => {
        const results = [
          ...createPassingChecks("T1", 68), // Would give 80 points
          {
            checkId: "T4-06",
            passed: false,
            severity: "high" as const,
            message: "Duplicate content",
            details: { duplicatePercent: 65 },
            autoEditable: true,
          },
        ];
        const score = calculateOnPageScore(results);

        expect(score.score).toBe(50);
        expect(score.gates).toContain("duplicate-content");
      });

      it("should not trigger when duplicate <= 60%", () => {
        const results = [
          ...createPassingChecks("T1", 68),
          {
            checkId: "T4-06",
            passed: false,
            severity: "high" as const,
            message: "Some duplicate content",
            details: { duplicatePercent: 55 },
            autoEditable: true,
          },
        ];
        const score = calculateOnPageScore(results);

        expect(score.gates).not.toContain("duplicate-content");
      });
    });

    describe("Gate 3: YMYL No Author (T1-68)", () => {
      it("should cap score at 60 when YMYL has no author", () => {
        // Create 67 passing T1 checks (not 68, to avoid duplicating T1-68)
        const results = [
          ...createPassingChecks("T1", 67),
          ...createPassingChecks("T2", 21),
          createFailingCheck("T1-68", "critical"),
        ];
        const score = calculateOnPageScore(results);

        expect(score.score).toBe(60);
        expect(score.gates).toContain("ymyl-no-author");
      });
    });

    describe("Gate 4: CWV Poor (T3-01/02/03 critical)", () => {
      it("should cap score at 75 when CWV is poor", () => {
        const results = [
          ...createPassingChecks("T1", 68),
          ...createPassingChecks("T2", 21),
          createFailingCheck("T3-01", "critical"), // LCP poor
        ];
        const score = calculateOnPageScore(results);

        expect(score.score).toBe(75);
        expect(score.gates).toContain("cwv-poor");
      });

      it("should not trigger on high severity (only critical)", () => {
        const results = [
          ...createPassingChecks("T1", 68),
          createFailingCheck("T3-01", "high"), // Not poor, just needs improvement
        ];
        const score = calculateOnPageScore(results);

        expect(score.gates).not.toContain("cwv-poor");
      });
    });

    describe("Gate Precedence", () => {
      it("should apply gates in correct precedence order", () => {
        // noindex (0) > duplicate (50) > YMYL (60) > CWV (75)
        const results = [
          createFailingCheck("T1-68", "critical"), // YMYL - would cap at 60
          createFailingCheck("T3-01", "critical"), // CWV - would cap at 75
        ];
        const score = calculateOnPageScore(results);

        // YMYL gate has higher priority than CWV
        expect(score.score).toBe(60);
        expect(score.gates).toContain("ymyl-no-author");
      });
    });
  });

  describe("Skipped Check Handling", () => {
    it("should exclude skipped checks from scoring", () => {
      const results: CheckResult[] = [
        ...createPassingChecks("T1", 10),
        {
          checkId: "T3-01",
          passed: false,
          severity: "info",
          message: "Skipped: No API key",
          details: { skipped: true },
          autoEditable: false,
        },
      ];
      const score = calculateOnPageScore(results);

      // Skipped check should not contribute to tier3
      expect(score.breakdown.tier3).toBe(0);
    });

    it("should not trigger gates for skipped checks", () => {
      const results: CheckResult[] = [
        ...createPassingChecks("T1", 68),
        {
          checkId: "T3-01",
          passed: false,
          severity: "info",
          message: "Skipped: No CrUX data",
          details: { skipped: true },
          autoEditable: false,
        },
      ];
      const score = calculateOnPageScore(results);

      expect(score.gates).not.toContain("cwv-poor");
    });
  });

  describe("Quality Gate", () => {
    it("should pass when score >= 80", () => {
      expect(passesQualityGate(80)).toBe(true);
      expect(passesQualityGate(100)).toBe(true);
    });

    it("should fail when score < 80", () => {
      expect(passesQualityGate(79)).toBe(false);
      expect(passesQualityGate(0)).toBe(false);
    });

    it("should have threshold of 80", () => {
      expect(QUALITY_GATE_THRESHOLD).toBe(80);
    });
  });

  describe("evaluateQualityGate", () => {
    it("should return detailed result for passing score", () => {
      const scoreResult = calculateOnPageScore(createPassingChecks("T1", 68));
      const gate = evaluateQualityGate(scoreResult);

      expect(gate.passed).toBe(true);
      expect(gate.score).toBe(80);
      expect(gate.pointsNeeded).toBe(0);
      expect(gate.autoPublishEligible).toBe(true);
    });

    it("should return points needed for failing score", () => {
      const scoreResult = calculateOnPageScore([]);
      const gate = evaluateQualityGate(scoreResult);

      expect(gate.passed).toBe(false);
      expect(gate.score).toBe(60);
      expect(gate.pointsNeeded).toBe(20);
    });

    it("should mark auto-publish ineligible when gates active", () => {
      const results = [
        ...createPassingChecks("T1", 68),
        createFailingCheck("T3-01", "critical"),
      ];
      const scoreResult = calculateOnPageScore(results);
      const gate = evaluateQualityGate(scoreResult);

      // Score is 75 (capped by CWV), gates active
      expect(gate.passed).toBe(false);
      expect(gate.autoPublishEligible).toBe(false);
      expect(gate.gates).toContain("cwv-poor");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty results array", () => {
      const score = calculateOnPageScore([]);

      expect(score.score).toBe(60);
      expect(score.gates).toHaveLength(0);
      expect(score.breakdown.base).toBe(60);
    });

    it("should handle all checks failing", () => {
      const results = [
        createFailingCheck("T1-01", "high"),
        createFailingCheck("T1-02", "medium"),
        createFailingCheck("T2-01", "high"),
      ];
      const score = calculateOnPageScore(results);

      // Base score only, no tier contributions
      expect(score.score).toBe(60);
    });

    it("should handle mixed pass/fail without gates", () => {
      const results = [
        ...createPassingChecks("T1", 5),
        createFailingCheck("T1-06", "high"),
        ...createPassingChecks("T2", 3),
      ];
      const score = calculateOnPageScore(results);

      // 60 base + 1.5 T1 + 1.5 T2 = 63
      expect(score.score).toBeGreaterThan(60);
      expect(score.gates).toHaveLength(0);
    });

    it("should round score to integer", () => {
      // 33 T1 passes = 33 * 0.3 = 9.9
      const results = createPassingChecks("T1", 33);
      const score = calculateOnPageScore(results);

      expect(Number.isInteger(score.score)).toBe(true);
    });
  });
});

// Helper functions

function createPassingChecks(tierPrefix: string, count: number): CheckResult[] {
  return Array.from({ length: count }, (_, i) => ({
    checkId: `${tierPrefix}-${String(i + 1).padStart(2, "0")}`,
    passed: true,
    severity: "info" as const,
    message: "Check passed",
    autoEditable: false,
  }));
}

function createFailingCheck(
  checkId: string,
  severity: CheckResult["severity"]
): CheckResult {
  return {
    checkId,
    passed: false,
    severity,
    message: "Check failed",
    autoEditable: false,
  };
}

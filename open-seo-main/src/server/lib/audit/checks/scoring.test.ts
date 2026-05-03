/**
 * Tests for SEO score calculator.
 * Phase 32: 107 SEO Checks Implementation
 */
import { describe, it, expect } from "vitest";
import {
  calculateOnPageScore,
  passesQualityGate,
  evaluateQualityGate,
  QUALITY_GATE_THRESHOLD,
} from "./scoring";
import type { CheckResult } from "./types";

/** Helper to create a passing check result */
function passCheck(checkId: string): CheckResult {
  return {
    checkId,
    passed: true,
    severity: "low",
    message: "Check passed",
    autoEditable: false,
  };
}

/** Helper to create a failing check result */
function failCheck(checkId: string, severity: CheckResult["severity"] = "medium"): CheckResult {
  return {
    checkId,
    passed: false,
    severity,
    message: "Check failed",
    autoEditable: false,
  };
}

describe("calculateOnPageScore", () => {
  it("returns base score 60 when no checks provided", () => {
    const result = calculateOnPageScore([]);
    expect(result.score).toBe(60);
    expect(result.breakdown.base).toBe(60);
    expect(result.gates).toHaveLength(0);
  });

  it("adds +0.3 per Tier 1 pass, max 20 points", () => {
    // 10 Tier 1 passes = 10 * 0.3 = 3 points
    const tier1Checks = Array.from({ length: 10 }, (_, i) =>
      passCheck(`T1-${String(i + 1).padStart(2, "0")}`)
    );
    const result = calculateOnPageScore(tier1Checks);
    expect(result.breakdown.tier1).toBe(3);
    expect(result.score).toBe(63);

    // 67 Tier 1 passes = 67 * 0.3 = 20.1, capped at 20
    const maxTier1 = Array.from({ length: 67 }, (_, i) =>
      passCheck(`T1-${String(i + 1).padStart(2, "0")}`)
    );
    const maxResult = calculateOnPageScore(maxTier1);
    expect(maxResult.breakdown.tier1).toBe(20);
    expect(maxResult.score).toBe(80);
  });

  it("adds +0.5 per Tier 2 pass, max 10 points", () => {
    // 10 Tier 2 passes = 10 * 0.5 = 5 points
    const tier2Checks = Array.from({ length: 10 }, (_, i) =>
      passCheck(`T2-${String(i + 1).padStart(2, "0")}`)
    );
    const result = calculateOnPageScore(tier2Checks);
    expect(result.breakdown.tier2).toBe(5);
    expect(result.score).toBe(65);

    // 21 Tier 2 passes = 21 * 0.5 = 10.5, capped at 10
    const maxTier2 = Array.from({ length: 21 }, (_, i) =>
      passCheck(`T2-${String(i + 1).padStart(2, "0")}`)
    );
    const maxResult = calculateOnPageScore(maxTier2);
    expect(maxResult.breakdown.tier2).toBe(10);
    expect(maxResult.score).toBe(70);
  });

  it("adds +0.8 per Tier 3 pass, max 6 points (normalized)", () => {
    // 5 Tier 3 passes = 5 * 0.8 = 4 points
    const tier3Checks = Array.from({ length: 5 }, (_, i) =>
      passCheck(`T3-${String(i + 1).padStart(2, "0")}`)
    );
    const result = calculateOnPageScore(tier3Checks);
    expect(result.breakdown.tier3).toBe(4);
    expect(result.score).toBe(64);

    // 13 Tier 3 passes = 13 * 0.8 = 10.4, capped at 6 (normalized for max 100 total)
    const maxTier3 = Array.from({ length: 13 }, (_, i) =>
      passCheck(`T3-${String(i + 1).padStart(2, "0")}`)
    );
    const maxResult = calculateOnPageScore(maxTier3);
    expect(maxResult.breakdown.tier3).toBe(6);
    expect(maxResult.score).toBe(66);
  });

  it("caps at 75 when CWV is Poor (T3-01/02/03 critical fail)", () => {
    // Max score would be 100, but CWV poor caps at 75
    const checks: CheckResult[] = [
      ...Array.from({ length: 67 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      ...Array.from({ length: 21 }, (_, i) => passCheck(`T2-${String(i + 1).padStart(2, "0")}`)),
      ...Array.from({ length: 13 }, (_, i) => passCheck(`T3-${String(i + 1).padStart(2, "0")}`)),
      failCheck("T3-01", "critical"), // LCP Poor
    ];
    const result = calculateOnPageScore(checks);
    expect(result.score).toBe(75);
    expect(result.gates).toContain("cwv-poor");
  });

  it("caps at 0 when noindex (T1-67 fail)", () => {
    const checks: CheckResult[] = [
      ...Array.from({ length: 50 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      failCheck("T1-67", "critical"), // noindex (T1-67 is the noindex check)
    ];
    const result = calculateOnPageScore(checks);
    expect(result.score).toBe(0);
    expect(result.gates).toContain("noindex");
  });

  it("caps at 60 when no author on YMYL (T1-68 fail)", () => {
    // Generate T1 checks excluding T1-68 (YMYL author check)
    const tier1Checks = Array.from({ length: 67 }, (_, i) => {
      return passCheck(`T1-${String(i + 1).padStart(2, "0")}`);
    });

    const checks: CheckResult[] = [
      ...tier1Checks,
      ...Array.from({ length: 21 }, (_, i) => passCheck(`T2-${String(i + 1).padStart(2, "0")}`)),
      failCheck("T1-68", "critical"), // YMYL no author (T1-68 is the YMYL author check)
    ];
    const result = calculateOnPageScore(checks);
    expect(result.score).toBe(60);
    expect(result.gates).toContain("ymyl-no-author");
  });

  it("caps at 50 when duplicate content >60% (T4-06 fail)", () => {
    const checks: CheckResult[] = [
      ...Array.from({ length: 67 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      {
        checkId: "T4-06",
        passed: false,
        severity: "high",
        message: "Duplicate content detected",
        details: { duplicatePercent: 65 },
        autoEditable: false,
      },
    ];
    const result = calculateOnPageScore(checks);
    expect(result.score).toBe(50);
    expect(result.gates).toContain("duplicate-content");
  });

  it("excludes skipped checks from scoring", () => {
    const checks: CheckResult[] = [
      passCheck("T1-01"),
      passCheck("T1-02"),
      // Skipped check should not count toward score
      {
        checkId: "T3-01",
        passed: false,
        severity: "info",
        message: "Skipped: No CrUX data",
        details: { skipped: true, reason: "No CrUX data" },
        autoEditable: false,
      },
    ];
    const result = calculateOnPageScore(checks);
    // Base 60 + 2 T1 passes * 0.3 = 60.6, rounded to 61
    expect(result.breakdown.tier1).toBe(0.6);
    expect(result.breakdown.tier3).toBe(0);
    expect(result.gates).toHaveLength(0);
  });

  it("skipped CWV checks do not trigger cwv-poor gate", () => {
    const checks: CheckResult[] = [
      ...Array.from({ length: 67 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      // Skipped CWV checks (API key missing)
      {
        checkId: "T3-01",
        passed: false,
        severity: "info",
        message: "Skipped: GOOGLE_CWV_API_KEY not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      },
      {
        checkId: "T3-02",
        passed: false,
        severity: "info",
        message: "Skipped: GOOGLE_CWV_API_KEY not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      },
    ];
    const result = calculateOnPageScore(checks);
    // Should not trigger cwv-poor gate since checks were skipped
    expect(result.gates).not.toContain("cwv-poor");
    // Score should be base + max T1 = 60 + 20 = 80
    expect(result.score).toBe(80);
  });

  it("normalizes score to never exceed 100", () => {
    // Create maximum passing checks for all tiers
    const checks: CheckResult[] = [
      ...Array.from({ length: 68 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      ...Array.from({ length: 21 }, (_, i) => passCheck(`T2-${String(i + 1).padStart(2, "0")}`)),
      ...Array.from({ length: 13 }, (_, i) => passCheck(`T3-${String(i + 1).padStart(2, "0")}`)),
      ...Array.from({ length: 7 }, (_, i) => passCheck(`T4-${String(i + 1).padStart(2, "0")}`)),
    ];
    const result = calculateOnPageScore(checks);
    // Score should be capped at 100
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("passesQualityGate", () => {
  it("returns true when score >= 80", () => {
    expect(passesQualityGate(80)).toBe(true);
    expect(passesQualityGate(100)).toBe(true);
    expect(passesQualityGate(85)).toBe(true);
  });

  it("returns false when score < 80", () => {
    expect(passesQualityGate(79)).toBe(false);
    expect(passesQualityGate(0)).toBe(false);
    expect(passesQualityGate(60)).toBe(false);
  });
});

describe("evaluateQualityGate", () => {
  it("returns detailed quality gate result for passing score", () => {
    const scoreResult = calculateOnPageScore(
      Array.from({ length: 68 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`))
    );
    const gateResult = evaluateQualityGate(scoreResult);

    expect(gateResult.passed).toBe(true);
    expect(gateResult.threshold).toBe(QUALITY_GATE_THRESHOLD);
    expect(gateResult.pointsNeeded).toBe(0);
    expect(gateResult.autoPublishEligible).toBe(true);
  });

  it("returns detailed quality gate result for failing score", () => {
    const scoreResult = calculateOnPageScore([]);
    const gateResult = evaluateQualityGate(scoreResult);

    expect(gateResult.passed).toBe(false);
    expect(gateResult.score).toBe(60);
    expect(gateResult.pointsNeeded).toBe(20);
    expect(gateResult.autoPublishEligible).toBe(false);
  });

  it("marks auto-publish ineligible when gates are active", () => {
    const checks: CheckResult[] = [
      ...Array.from({ length: 68 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      failCheck("T3-01", "critical"), // LCP Poor
    ];
    const scoreResult = calculateOnPageScore(checks);
    const gateResult = evaluateQualityGate(scoreResult);

    // Score is 75 due to CWV gate, which is below 80
    expect(gateResult.passed).toBe(false);
    expect(gateResult.gates).toContain("cwv-poor");
    expect(gateResult.autoPublishEligible).toBe(false);
  });
});

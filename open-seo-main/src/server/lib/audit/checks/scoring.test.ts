/**
 * Tests for SEO score calculator.
 * Phase 32: 107 SEO Checks Implementation
 */
import { describe, it, expect } from "vitest";
import { calculateOnPageScore } from "./scoring";
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

  it("adds +0.8 per Tier 3 pass, max 10 points", () => {
    // 5 Tier 3 passes = 5 * 0.8 = 4 points
    const tier3Checks = Array.from({ length: 5 }, (_, i) =>
      passCheck(`T3-${String(i + 1).padStart(2, "0")}`)
    );
    const result = calculateOnPageScore(tier3Checks);
    expect(result.breakdown.tier3).toBe(4);
    expect(result.score).toBe(64);

    // 13 Tier 3 passes = 13 * 0.8 = 10.4, capped at 10
    const maxTier3 = Array.from({ length: 13 }, (_, i) =>
      passCheck(`T3-${String(i + 1).padStart(2, "0")}`)
    );
    const maxResult = calculateOnPageScore(maxTier3);
    expect(maxResult.breakdown.tier3).toBe(10);
    expect(maxResult.score).toBe(70);
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

  it("caps at 0 when noindex (T1-55 fail)", () => {
    const checks: CheckResult[] = [
      ...Array.from({ length: 50 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      failCheck("T1-55", "critical"), // noindex
    ];
    const result = calculateOnPageScore(checks);
    expect(result.score).toBe(0);
    expect(result.gates).toContain("noindex");
  });

  it("caps at 60 when no author on YMYL (T2-17 fail)", () => {
    // Generate T2 checks excluding T2-17
    const tier2Checks = Array.from({ length: 21 }, (_, i) => {
      const num = i + 1;
      if (num === 17) return null; // Skip T2-17
      return passCheck(`T2-${String(num).padStart(2, "0")}`);
    }).filter(Boolean) as CheckResult[];

    const checks: CheckResult[] = [
      ...Array.from({ length: 67 }, (_, i) => passCheck(`T1-${String(i + 1).padStart(2, "0")}`)),
      ...tier2Checks,
      failCheck("T2-17", "high"), // YMYL no author
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
});

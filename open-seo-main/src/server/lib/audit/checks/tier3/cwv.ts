/**
 * Tier 3 Core Web Vitals Checks (T3-01 to T3-03)
 * Phase 32: 107 SEO Checks Implementation
 * Phase 95-12: CWV Consolidation (migrated to CwvCheckAdapter)
 *
 * These checks use the unified CwvService via CwvCheckAdapter.
 * Supports:
 * - CrUX API (origin and URL level)
 * - PSI fallback when CrUX data unavailable
 * - Shared cache across checks
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getCwvCheckAdapter, resetCwvCheckAdapter, type CwvCheckResult } from "./CwvCheckAdapter";
import { CWV_THRESHOLDS, type CwvMetricName } from "@/server/features/scraping/cwv/types";

// =============================================================================
// Legacy API Compatibility (deprecated, will be removed in next release)
// =============================================================================

/**
 * @deprecated Use getCwvCheckAdapter() instead.
 * Maintained for backwards compatibility during migration.
 */
let currentClientId: string | null = null;

/**
 * @deprecated Use getCwvCheckAdapter() with clientId parameter instead.
 * Set the current client context for cache namespacing.
 */
export function setCruxClientContext(clientId: string | null): void {
  currentClientId = clientId;
  // Reset adapter to pick up new client context
  if (clientId === null) {
    resetCwvCheckAdapter();
  }
}

/**
 * @deprecated CwvCheckAdapter manages its own cache.
 * Clear the CrUX cache. Call at the start of each audit run.
 */
export function clearCruxCache(_clientId?: string): void {
  resetCwvCheckAdapter();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get API key from environment.
 */
function getCruxApiKey(): string | undefined {
  return typeof process !== "undefined" ? process.env.GOOGLE_CWV_API_KEY : undefined;
}

/**
 * Create a skipped check result when API key is missing.
 */
function createSkippedResult(checkId: string, reason: string): CheckResult {
  return {
    checkId,
    passed: false,
    severity: "info",
    message: `Skipped: ${reason}`,
    details: { skipped: true, reason },
    autoEditable: false,
  };
}

/**
 * Create a check result from CwvCheckResult.
 */
function createCheckResult(
  checkId: string,
  metricName: string,
  result: CwvCheckResult,
  targetValue: number,
  unit: string
): CheckResult {
  const passed = result.rating === "good";
  const severity = passed ? "info" : result.rating === "poor" ? "critical" : "high";

  // Format value based on metric type
  const formattedValue = metricName === "CLS"
    ? result.value.toFixed(3)
    : `${result.value.toLocaleString()}${unit}`;

  return {
    checkId,
    passed,
    severity,
    message: passed
      ? `${metricName} is ${formattedValue} (target: <= ${targetValue}${unit})`
      : `${metricName} is ${formattedValue}, exceeds ${targetValue}${unit} threshold`,
    details: {
      [`${metricName.toLowerCase()}${unit === "ms" ? "Ms" : ""}`]: result.value,
      ...(unit === "ms" && { [`${metricName.toLowerCase()}Seconds`]: Math.round((result.value / 1000) * 100) / 100 }),
      threshold: targetValue,
      rating: result.rating,
      score: result.score,
      source: result.source,
      distribution: {
        good: result.details.goodPercent,
        needsImprovement: result.details.needsImprovementPercent,
        poor: result.details.poorPercent,
      },
    },
    autoEditable: false,
  };
}

// =============================================================================
// Check Implementations (using CwvCheckAdapter)
// =============================================================================

/**
 * T3-01: LCP <= 2.5s
 * Largest Contentful Paint should be under 2.5 seconds for "good" rating.
 */
registerCheck({
  id: "T3-01",
  name: "LCP <= 2.5s",
  tier: 3,
  category: "cwv",
  severity: "critical",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getCruxApiKey();
    if (!apiKey) {
      return createSkippedResult("T3-01", "GOOGLE_CWV_API_KEY not configured");
    }

    const adapter = getCwvCheckAdapter({ apiKey });
    const result = await adapter.runCwvCheck(ctx.url, "lcp", ctx.clientId);

    if (!result) {
      return createSkippedResult("T3-01", "No CrUX/PSI data available for this origin");
    }

    return createCheckResult("T3-01", "LCP", result, CWV_THRESHOLDS.lcp.good / 1000, "s");
  },
});

/**
 * T3-02: INP <= 200ms
 * Interaction to Next Paint should be under 200ms for "good" rating.
 * INP replaced FID as a Core Web Vital in March 2024.
 */
registerCheck({
  id: "T3-02",
  name: "INP <= 200ms",
  tier: 3,
  category: "cwv",
  severity: "critical",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getCruxApiKey();
    if (!apiKey) {
      return createSkippedResult("T3-02", "GOOGLE_CWV_API_KEY not configured");
    }

    const adapter = getCwvCheckAdapter({ apiKey });
    const result = await adapter.runCwvCheck(ctx.url, "inp", ctx.clientId);

    if (!result) {
      return createSkippedResult("T3-02", "No INP data available (replaced FID in March 2024)");
    }

    return createCheckResult("T3-02", "INP", result, CWV_THRESHOLDS.inp.good, "ms");
  },
});

/**
 * T3-03: CLS <= 0.1
 * Cumulative Layout Shift should be under 0.1 for "good" rating.
 */
registerCheck({
  id: "T3-03",
  name: "CLS <= 0.1",
  tier: 3,
  category: "cwv",
  severity: "critical",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getCruxApiKey();
    if (!apiKey) {
      return createSkippedResult("T3-03", "GOOGLE_CWV_API_KEY not configured");
    }

    const adapter = getCwvCheckAdapter({ apiKey });
    const result = await adapter.runCwvCheck(ctx.url, "cls", ctx.clientId);

    if (!result) {
      return createSkippedResult("T3-03", "No CLS data available for this origin");
    }

    // CLS uses different formatting (no unit suffix, more decimals)
    const passed = result.rating === "good";
    const severity = passed ? "info" : result.rating === "poor" ? "critical" : "high";

    return {
      checkId: "T3-03",
      passed,
      severity,
      message: passed
        ? `CLS is ${result.value.toFixed(3)} (target: <= ${CWV_THRESHOLDS.cls.good})`
        : `CLS is ${result.value.toFixed(3)}, exceeds ${CWV_THRESHOLDS.cls.good} threshold`,
      details: {
        cls: Math.round(result.value * 1000) / 1000,
        threshold: CWV_THRESHOLDS.cls.good,
        rating: result.rating,
        score: result.score,
        source: result.source,
        distribution: {
          good: result.details.goodPercent,
          needsImprovement: result.details.needsImprovementPercent,
          poor: result.details.poorPercent,
        },
      },
      autoEditable: false,
    };
  },
});

// =============================================================================
// Standalone Check Functions (for direct invocation)
// =============================================================================

/**
 * Run LCP check directly (for use outside registry).
 */
export async function checkLCP(ctx: CheckContext): Promise<CheckResult> {
  const apiKey = getCruxApiKey();
  if (!apiKey) {
    return createSkippedResult("T3-01", "GOOGLE_CWV_API_KEY not configured");
  }

  const adapter = getCwvCheckAdapter({ apiKey });
  const result = await adapter.runCwvCheck(ctx.url, "lcp", ctx.clientId);

  if (!result) {
    return createSkippedResult("T3-01", "No CrUX/PSI data available for this origin");
  }

  return createCheckResult("T3-01", "LCP", result, CWV_THRESHOLDS.lcp.good / 1000, "s");
}

/**
 * Run INP check directly (for use outside registry).
 */
export async function checkINP(ctx: CheckContext): Promise<CheckResult> {
  const apiKey = getCruxApiKey();
  if (!apiKey) {
    return createSkippedResult("T3-02", "GOOGLE_CWV_API_KEY not configured");
  }

  const adapter = getCwvCheckAdapter({ apiKey });
  const result = await adapter.runCwvCheck(ctx.url, "inp", ctx.clientId);

  if (!result) {
    return createSkippedResult("T3-02", "No INP data available (replaced FID in March 2024)");
  }

  return createCheckResult("T3-02", "INP", result, CWV_THRESHOLDS.inp.good, "ms");
}

/**
 * Run CLS check directly (for use outside registry).
 */
export async function checkCLS(ctx: CheckContext): Promise<CheckResult> {
  const apiKey = getCruxApiKey();
  if (!apiKey) {
    return createSkippedResult("T3-03", "GOOGLE_CWV_API_KEY not configured");
  }

  const adapter = getCwvCheckAdapter({ apiKey });
  const result = await adapter.runCwvCheck(ctx.url, "cls", ctx.clientId);

  if (!result) {
    return createSkippedResult("T3-03", "No CLS data available for this origin");
  }

  const passed = result.rating === "good";
  const severity = passed ? "info" : result.rating === "poor" ? "critical" : "high";

  return {
    checkId: "T3-03",
    passed,
    severity,
    message: passed
      ? `CLS is ${result.value.toFixed(3)} (target: <= ${CWV_THRESHOLDS.cls.good})`
      : `CLS is ${result.value.toFixed(3)}, exceeds ${CWV_THRESHOLDS.cls.good} threshold`,
    details: {
      cls: Math.round(result.value * 1000) / 1000,
      threshold: CWV_THRESHOLDS.cls.good,
      rating: result.rating,
      score: result.score,
      source: result.source,
      distribution: {
        good: result.details.goodPercent,
        needsImprovement: result.details.needsImprovementPercent,
        poor: result.details.poorPercent,
      },
    },
    autoEditable: false,
  };
}

// =============================================================================
// Aggregate CWV Check Runner
// =============================================================================

/**
 * Result from running all CWV checks.
 */
export interface CwvCheckResults {
  overall: CheckResult;
  lcp: CheckResult;
  inp: CheckResult;
  cls: CheckResult;
}

/**
 * Weights for overall CWV score calculation.
 * INP weighted highest as it's the primary interactivity metric.
 * LCP and CLS weighted equally as the other two Core Web Vitals.
 */
const CWV_WEIGHTS = {
  lcp: 0.33,  // Largest Contentful Paint
  inp: 0.34,  // Interaction to Next Paint (highest weight)
  cls: 0.33,  // Cumulative Layout Shift
} as const;

/**
 * Extract score from check result details.
 */
function extractScore(result: CheckResult): number {
  const score = result.details?.score;
  if (typeof score === "number") {
    return score;
  }
  // Fallback: passed = 100, failed = 0
  return result.passed ? 100 : 0;
}

/**
 * Run all CWV checks in parallel and calculate overall score.
 * Checks share cache via CwvCheckAdapter singleton.
 */
export async function runCwvChecks(ctx: CheckContext): Promise<CwvCheckResults> {
  // Run all checks in parallel (cache is shared)
  const [lcp, inp, cls] = await Promise.all([
    checkLCP(ctx),
    checkINP(ctx),
    checkCLS(ctx),
  ]);

  // Calculate weighted overall score
  const scores = {
    lcp: extractScore(lcp),
    inp: extractScore(inp),
    cls: extractScore(cls),
  };

  const overallScore = Math.round(
    scores.lcp * CWV_WEIGHTS.lcp +
    scores.inp * CWV_WEIGHTS.inp +
    scores.cls * CWV_WEIGHTS.cls
  );

  // Determine overall pass/fail and severity
  const passed = overallScore >= 50;
  const severity = overallScore >= 75 ? "info" : overallScore >= 50 ? "medium" : "critical";

  const overall: CheckResult = {
    checkId: "T3-CWV-OVERALL",
    passed,
    severity,
    message: `Core Web Vitals score: ${overallScore}/100`,
    details: {
      overallScore,
      breakdown: scores,
      weights: CWV_WEIGHTS,
      ratings: {
        lcp: lcp.details?.rating ?? "unknown",
        inp: inp.details?.rating ?? "unknown",
        cls: cls.details?.rating ?? "unknown",
      },
    },
    autoEditable: false,
  };

  return { overall, lcp, inp, cls };
}

// =============================================================================
// Exports
// =============================================================================

/** IDs of all CWV checks for external reference */
export const cwvCheckIds = ["T3-01", "T3-02", "T3-03"];

/** Re-export adapter for direct usage */
export { getCwvCheckAdapter, resetCwvCheckAdapter } from "./CwvCheckAdapter";
export type { CwvCheckResult } from "./CwvCheckAdapter";

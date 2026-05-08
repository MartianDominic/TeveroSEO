/**
 * Tier 3 Core Web Vitals Checks (T3-01 to T3-03)
 * Phase 32: 107 SEO Checks Implementation
 * Phase 95-12: CWV Consolidation - Now uses CwvCheckAdapter
 *
 * These checks use the unified CwvService via CwvCheckAdapter.
 * Benefits:
 * - PSI fallback when CrUX data unavailable
 * - Shared cache across all CWV operations
 * - Tiered lookup: Cache → CrUX origin → CrUX URL → PSI
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getCwvCheckAdapter, type CwvCheckResult } from "./CwvCheckAdapter";

/**
 * Current client ID for cache namespacing (maintained for backward compatibility).
 * @deprecated Use clientId from CheckContext instead.
 */
let currentClientId: string | null = null;

/**
 * Set the current client context for CWV cache namespacing.
 * @deprecated Client context is now handled via CheckContext.
 */
export function setCruxClientContext(clientId: string | null): void {
  currentClientId = clientId;
}

/**
 * Clear the CrUX cache.
 * @deprecated Cache is now managed by CwvService. This is a no-op for backward compatibility.
 */
export function clearCruxCache(_clientId?: string): void {
  // No-op: cache is managed by CwvCheckAdapter/CwvService
}

/**
 * Helper to create a "skipped" result when API key is missing.
 */
function createSkippedResult(
  checkId: string,
  reason: string,
  detailReason: string
): CheckResult {
  return {
    checkId,
    passed: false,
    severity: "info",
    message: `Skipped: ${reason}`,
    details: { skipped: true, reason: detailReason },
    autoEditable: false,
  };
}

/**
 * Helper to create a "no data" result when CWV data is unavailable.
 */
function createNoDataResult(checkId: string, metricName: string): CheckResult {
  return {
    checkId,
    passed: false,
    severity: "info",
    message: `Skipped: No ${metricName} data available for this origin`,
    details: { skipped: true, reason: "No CrUX/PSI data" },
    autoEditable: false,
  };
}

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
    const adapter = getCwvCheckAdapter();
    const clientId = ctx.clientId ?? currentClientId ?? undefined;

    // Run check via adapter (handles API key, caching, PSI fallback)
    const result = await adapter.runCwvCheck(ctx.url, "lcp", clientId);

    if (result === null) {
      // Check if API key is missing
      const apiKey = process.env.GOOGLE_CWV_API_KEY;
      if (!apiKey) {
        return createSkippedResult(
          "T3-01",
          "GOOGLE_CWV_API_KEY not configured",
          "API key missing"
        );
      }
      return createNoDataResult("T3-01", "LCP");
    }

    return formatLcpResult(result);
  },
});

/**
 * Format LCP check result.
 */
function formatLcpResult(result: CwvCheckResult): CheckResult {
  const lcpMs = result.value;
  const lcpSeconds = lcpMs / 1000;
  const passed = result.rating === "good";
  const severity = passed
    ? "info"
    : result.rating === "poor"
      ? "critical"
      : "high";

  return {
    checkId: "T3-01",
    passed,
    severity,
    message: passed
      ? `LCP is ${lcpSeconds.toFixed(2)}s (target: <= 2.5s)`
      : `LCP is ${lcpSeconds.toFixed(2)}s, exceeds 2.5s threshold`,
    details: {
      lcpMs,
      lcpSeconds: Math.round(lcpSeconds * 100) / 100,
      threshold: 2.5,
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

/**
 * T3-02: INP <= 200ms
 * Interaction to Next Paint should be under 200ms for "good" rating.
 */
registerCheck({
  id: "T3-02",
  name: "INP <= 200ms",
  tier: 3,
  category: "cwv",
  severity: "critical",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const adapter = getCwvCheckAdapter();
    const clientId = ctx.clientId ?? currentClientId ?? undefined;

    const result = await adapter.runCwvCheck(ctx.url, "inp", clientId);

    if (result === null) {
      const apiKey = process.env.GOOGLE_CWV_API_KEY;
      if (!apiKey) {
        return createSkippedResult(
          "T3-02",
          "GOOGLE_CWV_API_KEY not configured",
          "API key missing"
        );
      }
      return createNoDataResult("T3-02", "INP");
    }

    return formatInpResult(result);
  },
});

/**
 * Format INP check result.
 */
function formatInpResult(result: CwvCheckResult): CheckResult {
  const inpMs = result.value;
  const passed = result.rating === "good";
  const severity = passed
    ? "info"
    : result.rating === "poor"
      ? "critical"
      : "high";

  return {
    checkId: "T3-02",
    passed,
    severity,
    message: passed
      ? `INP is ${inpMs}ms (target: <= 200ms)`
      : `INP is ${inpMs}ms, exceeds 200ms threshold`,
    details: {
      inpMs,
      threshold: 200,
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
    const adapter = getCwvCheckAdapter();
    const clientId = ctx.clientId ?? currentClientId ?? undefined;

    const result = await adapter.runCwvCheck(ctx.url, "cls", clientId);

    if (result === null) {
      const apiKey = process.env.GOOGLE_CWV_API_KEY;
      if (!apiKey) {
        return createSkippedResult(
          "T3-03",
          "GOOGLE_CWV_API_KEY not configured",
          "API key missing"
        );
      }
      return createNoDataResult("T3-03", "CLS");
    }

    return formatClsResult(result);
  },
});

/**
 * Format CLS check result.
 */
function formatClsResult(result: CwvCheckResult): CheckResult {
  const cls = result.value;
  const passed = result.rating === "good";
  const severity = passed
    ? "info"
    : result.rating === "poor"
      ? "critical"
      : "high";

  return {
    checkId: "T3-03",
    passed,
    severity,
    message: passed
      ? `CLS is ${cls.toFixed(3)} (target: <= 0.1)`
      : `CLS is ${cls.toFixed(3)}, exceeds 0.1 threshold`,
    details: {
      cls: Math.round(cls * 1000) / 1000,
      threshold: 0.1,
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

export const cwvCheckIds = ["T3-01", "T3-02", "T3-03"];

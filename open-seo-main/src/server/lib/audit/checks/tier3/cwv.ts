/**
 * Tier 3 Core Web Vitals Checks (T3-01 to T3-03)
 * Phase 32: 107 SEO Checks Implementation
 *
 * These checks require CrUX API access.
 * API: https://chromeuxreport.googleapis.com/v1/records:queryRecord
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/** CrUX API response structure */
interface CruxMetric {
  histogram: Array<{ start: number; end?: number; density: number }>;
  percentiles: { p75: number };
}

interface CruxResponse {
  record?: {
    metrics?: {
      largest_contentful_paint?: CruxMetric;
      interaction_to_next_paint?: CruxMetric;
      cumulative_layout_shift?: CruxMetric;
    };
  };
  error?: { message: string };
}

/** CrUX API key from environment */
function getCruxApiKey(): string | undefined {
  return typeof process !== "undefined" ? process.env.GOOGLE_CWV_API_KEY : undefined;
}

/**
 * Fetch CrUX data for a URL.
 */
async function fetchCruxData(url: string, apiKey: string): Promise<CruxResponse | null> {
  try {
    const origin = new URL(url).origin;
    const response = await fetch(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin }),
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CruxResponse;
  } catch {
    return null;
  }
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
  severity: "high",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getCruxApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-01",
        passed: false,
        severity: "info",
        message: "Skipped: GOOGLE_CWV_API_KEY not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    const data = await fetchCruxData(ctx.url, apiKey);

    if (!data?.record?.metrics?.largest_contentful_paint) {
      return {
        checkId: "T3-01",
        passed: false,
        severity: "info",
        message: "Skipped: No CrUX data available for this origin",
        details: { skipped: true, reason: "No CrUX data" },
        autoEditable: false,
      };
    }

    const lcp = data.record.metrics.largest_contentful_paint.percentiles.p75;
    const lcpSeconds = lcp / 1000;
    const passed = lcpSeconds <= 2.5;

    return {
      checkId: "T3-01",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? `LCP is ${lcpSeconds.toFixed(2)}s (target: <= 2.5s)`
        : `LCP is ${lcpSeconds.toFixed(2)}s, exceeds 2.5s threshold`,
      details: {
        lcpMs: lcp,
        lcpSeconds: Math.round(lcpSeconds * 100) / 100,
        threshold: 2.5,
        rating: lcpSeconds <= 2.5 ? "good" : lcpSeconds <= 4 ? "needs-improvement" : "poor",
      },
      autoEditable: false,
    };
  },
});

/**
 * T3-02: INP <= 200ms
 * Interaction to Next Paint should be under 200ms for "good" rating.
 */
registerCheck({
  id: "T3-02",
  name: "INP <= 200ms",
  tier: 3,
  category: "cwv",
  severity: "high",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getCruxApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-02",
        passed: false,
        severity: "info",
        message: "Skipped: GOOGLE_CWV_API_KEY not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    const data = await fetchCruxData(ctx.url, apiKey);

    if (!data?.record?.metrics?.interaction_to_next_paint) {
      return {
        checkId: "T3-02",
        passed: false,
        severity: "info",
        message: "Skipped: No INP data available for this origin",
        details: { skipped: true, reason: "No CrUX data" },
        autoEditable: false,
      };
    }

    const inp = data.record.metrics.interaction_to_next_paint.percentiles.p75;
    const passed = inp <= 200;

    return {
      checkId: "T3-02",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? `INP is ${inp}ms (target: <= 200ms)`
        : `INP is ${inp}ms, exceeds 200ms threshold`,
      details: {
        inpMs: inp,
        threshold: 200,
        rating: inp <= 200 ? "good" : inp <= 500 ? "needs-improvement" : "poor",
      },
      autoEditable: false,
    };
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
  severity: "high",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getCruxApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-03",
        passed: false,
        severity: "info",
        message: "Skipped: GOOGLE_CWV_API_KEY not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    const data = await fetchCruxData(ctx.url, apiKey);

    if (!data?.record?.metrics?.cumulative_layout_shift) {
      return {
        checkId: "T3-03",
        passed: false,
        severity: "info",
        message: "Skipped: No CLS data available for this origin",
        details: { skipped: true, reason: "No CrUX data" },
        autoEditable: false,
      };
    }

    const cls = data.record.metrics.cumulative_layout_shift.percentiles.p75;
    const passed = cls <= 0.1;

    return {
      checkId: "T3-03",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? `CLS is ${cls.toFixed(3)} (target: <= 0.1)`
        : `CLS is ${cls.toFixed(3)}, exceeds 0.1 threshold`,
      details: {
        cls: Math.round(cls * 1000) / 1000,
        threshold: 0.1,
        rating: cls <= 0.1 ? "good" : cls <= 0.25 ? "needs-improvement" : "poor",
      },
      autoEditable: false,
    };
  },
});

export const cwvCheckIds = ["T3-01", "T3-02", "T3-03"];

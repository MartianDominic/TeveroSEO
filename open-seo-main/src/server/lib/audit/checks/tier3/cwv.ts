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
 * Cache entry with TTL support.
 */
interface CruxCacheEntry {
  data: CruxResponse | null;
  timestamp: number;
}

/**
 * Origin-level cache for CrUX data with TTL, size limit, and client isolation.
 * CrUX data is per-origin (not per-page), so we cache to avoid redundant API calls.
 * Cache entries expire after CRUX_CACHE_TTL_MS (default: 1 hour).
 * Cache is also cleared at the start of each audit run via clearCruxCache().
 *
 * MED-PERF-02: Added max size limit to prevent unbounded memory growth.
 * LRU eviction uses Map insertion order for O(1) performance.
 *
 * FIX-13 (HIGH-SEO-03): Cache keys are now namespaced by clientId to prevent
 * data leakage between clients in multi-tenant deployments.
 */
const cruxOriginCache = new Map<string, CruxCacheEntry>();

/**
 * Cache TTL in milliseconds. CrUX data is aggregated over 28 days,
 * so 1 hour TTL is reasonable for within-audit deduplication while
 * ensuring fresh data across audit runs.
 */
const CRUX_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Maximum number of origins to cache.
 * MED-PERF-02: Prevents unbounded memory growth.
 * 1000 origins is generous for typical audit workloads.
 */
const CRUX_CACHE_MAX_SIZE = 1000;

/**
 * FIX-13 (MED-SEO-03): Rate limiting for CrUX API calls.
 * Google CrUX API allows 400 requests per minute.
 * We track request timestamps in a sliding window.
 */
const CRUX_RATE_LIMIT_PER_MINUTE = 400;
const cruxRequestTimestamps: number[] = [];

/**
 * Current client ID for cache namespacing.
 * FIX-13 (HIGH-SEO-03): Set via setCruxClientContext() before running checks.
 */
let currentClientId: string | null = null;

/**
 * Set the current client context for CrUX cache namespacing.
 * FIX-13 (HIGH-SEO-03): Call this before running CrUX checks to ensure
 * cache isolation between clients.
 */
export function setCruxClientContext(clientId: string | null): void {
  currentClientId = clientId;
}

/**
 * Get cache key with client namespace.
 * FIX-13 (HIGH-SEO-03): Prevents data leakage between clients.
 */
function getCacheKey(origin: string): string {
  return currentClientId ? `${currentClientId}:${origin}` : origin;
}

/**
 * Clear the CrUX cache. Call at the start of each audit run.
 * FIX-13: Optionally clear only for a specific client.
 */
export function clearCruxCache(clientId?: string): void {
  if (clientId) {
    // Clear only entries for this client
    const prefix = `${clientId}:`;
    for (const key of cruxOriginCache.keys()) {
      if (key.startsWith(prefix)) {
        cruxOriginCache.delete(key);
      }
    }
  } else {
    cruxOriginCache.clear();
  }
}

/**
 * FIX-13 (MED-SEO-03): Check if we can make a CrUX API request without exceeding rate limit.
 * Returns true if request is allowed, false if rate limited.
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;

  // Remove timestamps older than 1 minute
  while (cruxRequestTimestamps.length > 0 && cruxRequestTimestamps[0] < oneMinuteAgo) {
    cruxRequestTimestamps.shift();
  }

  // Check if under limit
  if (cruxRequestTimestamps.length >= CRUX_RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  // Record this request
  cruxRequestTimestamps.push(now);
  return true;
}

/**
 * Check if a cache entry is still valid (not expired).
 */
function isCacheValid(entry: CruxCacheEntry): boolean {
  return Date.now() - entry.timestamp < CRUX_CACHE_TTL_MS;
}

/**
 * Evict oldest entries if cache exceeds max size.
 * MED-PERF-02: LRU eviction using Map insertion order.
 */
function evictIfNeeded(): void {
  while (cruxOriginCache.size >= CRUX_CACHE_MAX_SIZE) {
    const oldestKey = cruxOriginCache.keys().next().value;
    if (oldestKey !== undefined) {
      cruxOriginCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

/**
 * Fetch CrUX data for a URL with origin-level caching, TTL, and rate limiting.
 * CrUX API returns origin-level metrics, so all pages from the same origin share data.
 *
 * FIX-13 (HIGH-SEO-03): Cache is now namespaced by client ID.
 * FIX-13 (MED-SEO-03): Rate limiting applied (400 req/min).
 */
async function fetchCruxData(url: string, apiKey: string): Promise<CruxResponse | null> {
  const origin = new URL(url).origin;
  const cacheKey = getCacheKey(origin); // FIX-13: Client-namespaced key

  // Check cache first with TTL validation
  const cached = cruxOriginCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return cached.data;
  }

  // Remove expired entry if exists
  if (cached) {
    cruxOriginCache.delete(cacheKey);
  }

  // FIX-13 (MED-SEO-03): Check rate limit before making request
  if (!checkRateLimit()) {
    // Rate limited - return null without caching to allow retry later
    return null;
  }

  try {
    const response = await fetch(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin }),
        signal: AbortSignal.timeout(10000), // 10 second timeout (MED-SEO-04)
      }
    );

    if (!response.ok) {
      // Cache the null result with TTL to avoid retrying failed origins too frequently
      evictIfNeeded();
      cruxOriginCache.set(cacheKey, { data: null, timestamp: Date.now() });
      return null;
    }

    const data = (await response.json()) as CruxResponse;
    evictIfNeeded();
    cruxOriginCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch {
    // Cache failures with TTL to prevent repeated failed requests
    evictIfNeeded();
    cruxOriginCache.set(cacheKey, { data: null, timestamp: Date.now() });
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
  severity: "critical",
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
    const rating = lcpSeconds <= 2.5 ? "good" : lcpSeconds <= 4 ? "needs-improvement" : "poor";

    // Return "critical" severity for poor CWV (triggers scoring gate)
    const severity = passed ? "info" : rating === "poor" ? "critical" : "high";

    return {
      checkId: "T3-01",
      passed,
      severity,
      message: passed
        ? `LCP is ${lcpSeconds.toFixed(2)}s (target: <= 2.5s)`
        : `LCP is ${lcpSeconds.toFixed(2)}s, exceeds 2.5s threshold`,
      details: {
        lcpMs: lcp,
        lcpSeconds: Math.round(lcpSeconds * 100) / 100,
        threshold: 2.5,
        rating,
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
  severity: "critical",
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
    const rating = inp <= 200 ? "good" : inp <= 500 ? "needs-improvement" : "poor";

    // Return "critical" severity for poor CWV (triggers scoring gate)
    const severity = passed ? "info" : rating === "poor" ? "critical" : "high";

    return {
      checkId: "T3-02",
      passed,
      severity,
      message: passed
        ? `INP is ${inp}ms (target: <= 200ms)`
        : `INP is ${inp}ms, exceeds 200ms threshold`,
      details: {
        inpMs: inp,
        threshold: 200,
        rating,
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
  severity: "critical",
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
    const rating = cls <= 0.1 ? "good" : cls <= 0.25 ? "needs-improvement" : "poor";

    // Return "critical" severity for poor CWV (triggers scoring gate)
    const severity = passed ? "info" : rating === "poor" ? "critical" : "high";

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
        rating,
      },
      autoEditable: false,
    };
  },
});

export const cwvCheckIds = ["T3-01", "T3-02", "T3-03"];

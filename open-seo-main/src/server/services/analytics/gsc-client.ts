/**
 * Google Search Console API client for analytics sync.
 *
 * Wraps googleapis searchconsole v1 with typed interfaces.
 * Uses OAuth2 access token from internal API.
 *
 * IMPORTANT per RESEARCH.md Pitfall 1 (GSC Data Delay):
 * - GSC data is delayed 2-3 days
 * - For incremental: end_date = today - 3 days, start_date = end_date - 2 days
 * - For backfill: end_date = today - 3 days, start_date = end_date - 87 days (90 total)
 */
import { google } from "googleapis";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { withRetry } from "@/server/lib/retry";

const log = createLogger({ module: "gsc-client" });

/** Timeout for GSC API requests (30 seconds) */
const GSC_TIMEOUT_MS = 30000;

/** Retry configuration for GSC API calls */
const GSC_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  isRetryable: (error: Error): boolean => {
    const message = error.message.toLowerCase();
    // Retry on transient Google API errors (5xx, rate limits, network issues)
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("429") ||
      message.includes("rate") ||
      message.includes("quota") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("econnrefused")
    ) {
      return true;
    }
    // Don't retry client errors (4xx except 429)
    if (message.includes("400") || message.includes("401") || message.includes("403") || message.includes("404")) {
      return false;
    }
    return false;
  },
};

/**
 * Wrap a promise with a timeout.
 * @param promise - Promise to wrap
 * @param ms - Timeout in milliseconds
 * @returns Promise that rejects if timeout is exceeded
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export interface GSCDateMetrics {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQueryMetrics extends GSCDateMetrics {
  query: string;
}

/**
 * Fetch daily aggregate GSC metrics for a site.
 *
 * @param accessToken - Valid OAuth2 access token
 * @param siteUrl - GSC site URL (e.g., "sc-domain:example.com")
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 */
export async function fetchGSCDateMetrics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GSCDateMetrics[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({ version: "v1", auth });

    const response = await withRetry(
      () => withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["date"],
            rowLimit: 1000,
          },
        }),
        GSC_TIMEOUT_MS
      ),
      GSC_RETRY_OPTIONS
    );

    return (response.data.rows || []).map((row) => ({
      date: row.keys?.[0] || "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }));
  } catch (error) {
    log.error("GSC fetchGSCDateMetrics failed", error instanceof Error ? error : new Error(String(error)), {
      siteUrl,
      startDate,
      endDate,
    });
    throw new AppError("GSC_API_ERROR", `Failed to fetch GSC date metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch top queries per day for a site.
 *
 * Per CONTEXT.md: Top 50 queries per day stored in gsc_query_snapshots.
 * We fetch more (50 * days) and filter client-side to ensure top 50 per day.
 *
 * @param accessToken - Valid OAuth2 access token
 * @param siteUrl - GSC site URL
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param topN - Number of top queries per day (default 50)
 */
export async function fetchGSCTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  topN: number = 50,
): Promise<GSCQueryMetrics[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({ version: "v1", auth });

    // Request more rows to ensure we get top N per day
    // For 90 days * 50 queries = 4500 rows max
    const response = await withRetry(
      () => withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["date", "query"],
            rowLimit: 5000,
          },
        }),
        GSC_TIMEOUT_MS
      ),
      GSC_RETRY_OPTIONS
    );

    const allRows = (response.data.rows || []).map((row) => ({
      date: row.keys?.[0] || "",
      query: row.keys?.[1] || "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }));

    // Group by date and take top N by clicks
    const byDate = new Map<string, GSCQueryMetrics[]>();
    for (const row of allRows) {
      const existing = byDate.get(row.date) || [];
      existing.push(row);
      byDate.set(row.date, existing);
    }

    const result: GSCQueryMetrics[] = [];
    for (const [, rows] of byDate) {
      // Sort by clicks descending, take top N
      rows.sort((a, b) => b.clicks - a.clicks);
      result.push(...rows.slice(0, topN));
    }

    return result;
  } catch (error) {
    log.error("GSC fetchGSCTopQueries failed", error instanceof Error ? error : new Error(String(error)), {
      siteUrl,
      startDate,
      endDate,
    });
    throw new AppError("GSC_API_ERROR", `Failed to fetch GSC top queries: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate date range for GSC sync.
 * Accounts for 3-day data delay.
 */
export function getGSCDateRange(mode: "incremental" | "backfill"): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  // GSC data delayed 3 days
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(endDate);
  if (mode === "backfill") {
    startDate.setDate(startDate.getDate() - 87); // 90 days total
  } else {
    startDate.setDate(startDate.getDate() - 2); // 3 days overlap
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

/**
 * Query-page metrics for cannibalization detection.
 */
export interface GSCQueryPageMetrics {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  position: number;
}

/**
 * Fetch query-page metrics for cannibalization detection.
 * Returns all query-page combinations with their aggregate metrics.
 *
 * @param accessToken - Valid OAuth2 access token
 * @param siteUrl - GSC site URL (e.g., "sc-domain:example.com")
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 */
export async function fetchGSCQueryPageMetrics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GSCQueryPageMetrics[]> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const searchconsole = google.searchconsole({ version: "v1", auth });

    const response = await withRetry(
      () => withTimeout(
        searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ["query", "page"],
            rowLimit: 25000,
          },
        }),
        GSC_TIMEOUT_MS
      ),
      GSC_RETRY_OPTIONS
    );

    return (response.data.rows || []).map((row) => ({
      query: row.keys?.[0] || "",
      pageUrl: row.keys?.[1] || "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      position: row.position ?? 0,
    }));
  } catch (error) {
    log.error("GSC fetchGSCQueryPageMetrics failed", error instanceof Error ? error : new Error(String(error)), {
      siteUrl,
      startDate,
      endDate,
    });
    throw new AppError("GSC_API_ERROR", `Failed to fetch GSC query-page metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

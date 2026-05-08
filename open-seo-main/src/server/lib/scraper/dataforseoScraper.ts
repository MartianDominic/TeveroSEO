/**
 * DataForSEO-based website scraper for prospect analysis.
 *
 * Uses DataForSEO's content_parsing/live + raw_html endpoints to fetch
 * rendered HTML (with JS execution), then parses it with the existing
 * page-analyzer.
 *
 * Two-step flow:
 * 1. POST /v3/on_page/content_parsing/live → returns task ID
 * 2. POST /v3/on_page/raw_html with task ID → returns raw HTML
 *
 * Cost: ~$0.02/page for JS-rendered HTML
 */

import { analyzeHtml } from "@/server/lib/audit/page-analyzer";

// ---------------------------------------------------------------------------
// SSRF Protection - Use shared validator
// ---------------------------------------------------------------------------

import { validateScrapableUrl } from "@/server/lib/ssrf-validator";

// Re-export for backward compatibility with existing consumers
export { validateScrapableUrl };

import type { DataforseoApiResponse } from "@/server/lib/dataforseoCost";
import { AppError } from "@/server/lib/errors";
import {
  dataforseoResponseSchema,
  onPageContentParsingLiveItemSchema,
  onPageRawHtmlItemSchema,
  type OnPageContentParsingLiveItem,
  type OnPageRawHtmlItem,
} from "@/server/lib/dataforseoSchemas";
import type { RawHtmlResult, ScrapeResponse } from "./types";

// ---------------------------------------------------------------------------
// SDK client (uses centralized auth from dataforseo-auth.ts)
// ---------------------------------------------------------------------------

import { createDataForSEOFetch } from "@/server/lib/dataforseo-auth";
import { dataForSeoRateLimiter } from "@/server/lib/dataforseo";

const API_BASE = "https://api.dataforseo.com";

// Use centralized auth - throws if DATAFORSEO_API_KEY is not set
const createAuthenticatedFetch = createDataForSEOFetch;

async function postDataforseo(
  path: string,
  payload: unknown,
): Promise<unknown> {
  // Wait for rate limit token before making API call
  await dataForSeoRateLimiter.acquire();

  const authenticatedFetch = createAuthenticatedFetch();
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO HTTP ${response.status} on ${path}. Response: ${rawText.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO ${path} returned non-JSON response`,
    );
  }
}

// ---------------------------------------------------------------------------
// Response helpers (reuse pattern from dataforseoProspect.ts)
// ---------------------------------------------------------------------------

function assertOk(response: unknown): {
  path: string[];
  cost: number;
  result_count: number | null;
  result: unknown[];
} {
  const parsed = dataforseoResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response parse failed");
  }

  const data = parsed.data;
  if (data.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      data.status_message || "DataForSEO request failed",
    );
  }

  const task = data.tasks?.[0];
  if (!task) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response missing task");
  }
  if (task.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || "DataForSEO task failed",
    );
  }

  return {
    path: task.path ?? [],
    cost: task.cost ?? 0,
    result_count: task.result_count ?? null,
    result: task.result ?? [],
  };
}

function buildTaskBilling(task: {
  path: string[];
  cost: number;
  result_count: number | null;
}) {
  return {
    path: task.path,
    costUsd: task.cost,
    resultCount: task.result_count,
  };
}

// ---------------------------------------------------------------------------
// Raw HTML Fetching (Two-Step API Flow)
// ---------------------------------------------------------------------------

/**
 * Step 1: Trigger content parsing with JS rendering
 */
async function triggerContentParsing(
  url: string,
): Promise<DataforseoApiResponse<OnPageContentParsingLiveItem>> {
  const responseRaw = await postDataforseo(
    "/v3/on_page/content_parsing/live",
    [
      {
        url,
        enable_javascript: true,
        store_raw_html: true,
      },
    ],
  );

  const task = assertOk(responseRaw);

  // Parse task ID from result
  const firstResult = task.result[0];
  if (
    !firstResult ||
    typeof firstResult !== "object" ||
    !("items" in firstResult) ||
    !Array.isArray(firstResult.items) ||
    firstResult.items.length === 0
  ) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO content_parsing/live returned no items",
    );
  }

  const parsed = onPageContentParsingLiveItemSchema.safeParse(
    firstResult.items[0],
  );
  if (!parsed.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO content_parsing/live returned invalid response shape",
    );
  }

  return {
    data: parsed.data,
    billing: buildTaskBilling(task),
  };
}

/**
 * Step 2: Fetch raw HTML using task ID
 */
async function fetchRawHtmlByTaskId(
  taskId: string,
): Promise<DataforseoApiResponse<OnPageRawHtmlItem>> {
  const responseRaw = await postDataforseo("/v3/on_page/raw_html", [
    {
      id: taskId,
    },
  ]);

  const task = assertOk(responseRaw);

  // Parse HTML from result
  const firstResult = task.result[0];
  if (
    !firstResult ||
    typeof firstResult !== "object" ||
    !("items" in firstResult) ||
    !Array.isArray(firstResult.items) ||
    firstResult.items.length === 0
  ) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO raw_html returned no items",
    );
  }

  const parsed = onPageRawHtmlItemSchema.safeParse(firstResult.items[0]);
  if (!parsed.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO raw_html returned invalid response shape",
    );
  }

  return {
    data: parsed.data,
    billing: buildTaskBilling(task),
  };
}

/**
 * Fetch raw HTML for a URL using DataForSEO's two-step API flow.
 *
 * @param url - URL to fetch (must be publicly accessible)
 * @returns Raw HTML, status code, timing, and billing info
 * @throws AppError if URL fails SSRF validation
 *
 * Cost: ~$0.02/page for JS-rendered HTML
 */
export async function fetchRawHtml(
  url: string,
): Promise<DataforseoApiResponse<RawHtmlResult>> {
  // SSRF protection: validate URL before making any external calls
  validateScrapableUrl(url);

  // Step 1: Trigger content parsing
  const parsingResult = await triggerContentParsing(url);

  // Step 2: Fetch raw HTML
  const htmlResult = await fetchRawHtmlByTaskId(parsingResult.data.id);

  return {
    data: {
      html: htmlResult.data.html,
      statusCode: htmlResult.data.status_code,
      responseTimeMs:
        htmlResult.data.page_timing?.time_to_interactive ?? 0,
      redirectUrl: htmlResult.data.redirect_url ?? null,
    },
    billing: parsingResult.billing, // Cost is from the first call
  };
}

// ---------------------------------------------------------------------------
// High-Level Scraper
// ---------------------------------------------------------------------------

/**
 * Scrape a prospect's website page and analyze its SEO characteristics.
 *
 * Combines DataForSEO's raw HTML fetching with the existing page-analyzer
 * to extract all SEO-relevant data.
 *
 * @param url - URL to scrape
 * @returns PageAnalysis or error with cost info
 */
export async function scrapeProspectPage(url: string): Promise<ScrapeResponse> {
  try {
    const rawHtml = await fetchRawHtml(url);

    const analysis = analyzeHtml(
      rawHtml.data.html,
      url,
      rawHtml.data.statusCode,
      rawHtml.data.responseTimeMs,
      rawHtml.data.redirectUrl,
    );

    return {
      success: true,
      page: analysis,
      costCents: rawHtml.billing.costUsd * 100,
    };
  } catch (error) {
    // Extract cost from error if available (API errors may still charge)
    let costCents = 0;
    if (error instanceof AppError && error.message.includes("DataForSEO")) {
      // For now, assume no cost on error (DataForSEO typically doesn't charge for failed requests)
      costCents = 0;
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      costCents,
    };
  }
}

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
// SSRF Protection
// ---------------------------------------------------------------------------

/**
 * Validates that a URL is safe to scrape (not internal/private).
 *
 * Rejects:
 * - Private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
 * - Localhost: 127.0.0.1, ::1, localhost
 * - AWS metadata endpoint: 169.254.169.254
 * - Link-local addresses: 169.254.x.x
 * - Non-HTTP(S) schemes
 *
 * @param url - URL to validate
 * @throws AppError if URL is not safe to scrape
 */
export function validateScrapableUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("VALIDATION_ERROR", `Invalid URL format: ${url}`);
  }

  // Reject non-HTTP(S) schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid URL scheme: ${parsed.protocol} - only http and https are allowed`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Cannot scrape localhost addresses",
    );
  }

  // Check if hostname is an IP address
  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const [a, b, c, d] = octets;

    // Validate octets are in valid range
    if (octets.some((o) => o > 255)) {
      throw new AppError("VALIDATION_ERROR", `Invalid IP address: ${hostname}`);
    }

    // Reject private IP ranges
    // 10.0.0.0/8
    if (a === 10) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape private IP addresses (10.x.x.x)",
      );
    }

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape private IP addresses (172.16-31.x.x)",
      );
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape private IP addresses (192.168.x.x)",
      );
    }

    // 127.0.0.0/8 (loopback)
    if (a === 127) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape loopback addresses (127.x.x.x)",
      );
    }

    // 169.254.0.0/16 (link-local, includes AWS metadata 169.254.169.254)
    if (a === 169 && b === 254) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape link-local or metadata addresses (169.254.x.x)",
      );
    }

    // 0.0.0.0/8
    if (a === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape reserved addresses (0.x.x.x)",
      );
    }
  }

  // Check for IPv6 localhost or private addresses in brackets
  if (hostname.startsWith("[")) {
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    // Reject ::1 (localhost)
    if (ipv6 === "::1" || ipv6 === "0:0:0:0:0:0:0:1") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape IPv6 localhost addresses",
      );
    }
    // Reject fc00::/7 (unique local) and fe80::/10 (link-local)
    if (ipv6.startsWith("fc") || ipv6.startsWith("fd") || ipv6.startsWith("fe80")) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot scrape private IPv6 addresses",
      );
    }
  }
}
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

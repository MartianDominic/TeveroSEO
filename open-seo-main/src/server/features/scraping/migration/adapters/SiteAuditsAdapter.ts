/**
 * SiteAudits Consumer Adapter
 * Phase 95-06: Consumer Migration Wiring
 * Gap: MIG-02
 *
 * Bridges site audit workflows to unified ScrapingService via MigrationRouter.
 * Feature flag: siteAudits
 *
 * Site audits involve batch crawling of up to 10K pages with:
 * - HtmlTempStorage for audit-scoped HTML caching (Redis)
 * - Tier 1-5 SEO checks per page
 * - Lighthouse performance audits
 * - Link graph analysis
 *
 * This adapter handles the scraping portion of site audits, coordinating
 * with HtmlTempStorage to stream HTML to Redis instead of holding in memory.
 */

import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapingFeature } from "../../config";
import { HtmlTempStorage } from "@/server/lib/audit/html-temp-storage";

// =============================================================================
// Types
// =============================================================================

/**
 * Page data structure from site audit crawl.
 */
export interface AuditPageData {
  title: string;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  canonicalUrl: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  internalLinks: string[];
  externalLinks: string[];
  wordCount: number;
  hasStructuredData: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
}

/**
 * Input type for SiteAudits operations.
 */
export interface SiteAuditsInput {
  url: string;
  /** Audit ID for HtmlTempStorage coordination */
  auditId: string;
  /** Page ID for tracking within the audit */
  pageId?: string;
  /** Origin domain for same-origin checks */
  origin: string;
  /** Request timeout in ms */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Scraping provider preference */
  provider?: "auto" | "direct" | "dataforseo" | "playwright" | "tiered";
  /** Client ID for cost tracking */
  clientId?: string;
  /** Workspace ID for cost tracking */
  workspaceId?: string;
  /** Job ID for cost tracking */
  jobId?: string;
  /** Store HTML in Redis via HtmlTempStorage */
  storeHtml?: boolean;
}

/**
 * Output type for site audit page scraping.
 */
export interface SiteAuditsOutput {
  status: "success" | "blocked" | "error" | "requires_upgrade" | "non_html";
  method?: "fetch" | "dataforseo" | "playwright" | "tiered";
  url: string;
  finalUrl?: string;
  statusCode: number;
  data?: AuditPageData;
  html?: string;
  responseTimeMs: number;
  reason?: string;
  error?: string;
  guidance?: string;
  /** Whether HTML was stored in HtmlTempStorage */
  htmlStored?: boolean;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Adapter that bridges site audit workflows to ScrapingService.
 * Coordinates with HtmlTempStorage for audit-scoped HTML caching.
 */
export const siteAuditsAdapter: ConsumerAdapter<
  SiteAuditsInput,
  SiteAuditsOutput
> = {
  feature: "siteAudits" as ScrapingFeature,

  toScrapeOptions(input: SiteAuditsInput): ScrapeOptions & { url: string } {
    const headers: Record<string, string> = {};

    if (input.userAgent) {
      headers["User-Agent"] = input.userAgent;
    }

    // Map provider to forceTier
    let forceTier: string | undefined;
    if (input.provider === "direct") {
      forceTier = "direct";
    } else if (input.provider === "dataforseo") {
      forceTier = "dfs_basic";
    } else if (input.provider === "playwright") {
      forceTier = "camoufox";
    }

    return {
      url: input.url,
      timeoutMs: input.timeout ?? 30000,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      forceTier: forceTier as any,
      clientId: input.clientId,
      jobId: input.jobId,
      feature: "siteAudits",
      includeHtml: true,
      includeParsedData: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, input: SiteAuditsInput): SiteAuditsOutput {
    if (!result.success) {
      return mapErrorToOutput(result, input);
    }

    // Check content type - skip non-HTML
    const contentType = (result as { contentType?: string }).contentType ?? "text/html";
    if (!contentType.includes("text/html")) {
      return {
        status: "non_html",
        url: input.url,
        finalUrl: result.url,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        reason: `Non-HTML content type: ${contentType}`,
      };
    }

    // Extract page data from parsed data or raw HTML
    const data = extractPageData(result);

    return {
      status: "success",
      method: mapTierToMethod(result.tierUsed),
      url: input.url,
      finalUrl: result.url !== input.url ? result.url : undefined,
      statusCode: result.statusCode,
      data,
      html: result.html,
      responseTimeMs: result.responseTimeMs,
      htmlStored: false, // Will be set by caller after storing
    };
  },

  compareOutputs(legacy: SiteAuditsOutput, adapted: SiteAuditsOutput): ComparisonResult {
    const differences: Array<{ field: string; legacy: unknown; new: unknown }> = [];

    // Compare status
    if (legacy.status !== adapted.status) {
      differences.push({
        field: "status",
        legacy: legacy.status,
        new: adapted.status,
      });
    }

    // Compare status code
    if (legacy.statusCode !== adapted.statusCode) {
      differences.push({
        field: "statusCode",
        legacy: legacy.statusCode,
        new: adapted.statusCode,
      });
    }

    // Compare HTML length with 10% tolerance (formatting may differ)
    const legacyHtmlLen = legacy.html?.length ?? 0;
    const adaptedHtmlLen = adapted.html?.length ?? 0;
    const lengthDiff = Math.abs(legacyHtmlLen - adaptedHtmlLen);
    const lengthThreshold = Math.max(legacyHtmlLen, adaptedHtmlLen) * 0.1;

    if (lengthDiff > lengthThreshold && lengthDiff > 1000) {
      differences.push({
        field: "htmlLength",
        legacy: legacyHtmlLen,
        new: adaptedHtmlLen,
      });
    }

    // Compare data fields if both successful
    if (legacy.data && adapted.data) {
      if (legacy.data.title !== adapted.data.title) {
        differences.push({
          field: "data.title",
          legacy: legacy.data.title,
          new: adapted.data.title,
        });
      }

      if (legacy.data.metaDescription !== adapted.data.metaDescription) {
        differences.push({
          field: "data.metaDescription",
          legacy: legacy.data.metaDescription,
          new: adapted.data.metaDescription,
        });
      }

      // Compare h1 count (not exact text, as parsing may differ)
      if (legacy.data.h1.length !== adapted.data.h1.length) {
        differences.push({
          field: "data.h1.length",
          legacy: legacy.data.h1.length,
          new: adapted.data.h1.length,
        });
      }

      // Compare word count with 10% tolerance
      const wordCountDiff = Math.abs(legacy.data.wordCount - adapted.data.wordCount);
      const wordCountThreshold = Math.max(legacy.data.wordCount, adapted.data.wordCount) * 0.1;
      if (wordCountDiff > wordCountThreshold && wordCountDiff > 50) {
        differences.push({
          field: "data.wordCount",
          legacy: legacy.data.wordCount,
          new: adapted.data.wordCount,
        });
      }

      // Compare internal links count (significant differences only)
      const linkDiff = Math.abs(
        legacy.data.internalLinks.length - adapted.data.internalLinks.length
      );
      if (linkDiff > 5) {
        differences.push({
          field: "data.internalLinks.length",
          legacy: legacy.data.internalLinks.length,
          new: adapted.data.internalLinks.length,
        });
      }

      // Compare structured data detection
      if (legacy.data.hasStructuredData !== adapted.data.hasStructuredData) {
        differences.push({
          field: "data.hasStructuredData",
          legacy: legacy.data.hasStructuredData,
          new: adapted.data.hasStructuredData,
        });
      }
    }

    // Compare timing (large discrepancies only - 5 second threshold)
    if (Math.abs(legacy.responseTimeMs - adapted.responseTimeMs) > 5000) {
      differences.push({
        field: "responseTimeMs",
        legacy: legacy.responseTimeMs,
        new: adapted.responseTimeMs,
      });
    }

    return {
      match: differences.length === 0,
      differences,
    };
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Map scrape tier to audit method.
 */
function mapTierToMethod(tier: string): "fetch" | "dataforseo" | "playwright" | "tiered" {
  switch (tier) {
    case "direct":
    case "webshare":
    case "geonode":
      return "fetch";
    case "dfs_basic":
    case "dfs_js":
    case "dfs_browser":
      return "dataforseo";
    case "camoufox":
      return "playwright";
    default:
      return "tiered";
  }
}

/**
 * Map error result to SiteAuditsOutput.
 */
function mapErrorToOutput(result: ScrapeResult, input: SiteAuditsInput): SiteAuditsOutput {
  if (result.statusCode === 403 || result.statusCode === 429) {
    return {
      status: "blocked",
      url: input.url,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      reason: result.error ?? "Access blocked",
      error: result.error,
    };
  }

  if (result.quality && !result.quality.acceptable) {
    return {
      status: "requires_upgrade",
      url: input.url,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      reason: "Page requires JavaScript rendering",
      guidance:
        "Options: 1) Connect via OAuth 2) Configure DataForSEO OnPage API 3) Use Playwright tier",
      error: result.error,
    };
  }

  return {
    status: "error",
    url: input.url,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error ?? "Unknown error",
  };
}

/**
 * Extract AuditPageData from ScrapeResult.
 * Uses parsed data for basic fields and HTML parsing for extended fields
 * (robotsMeta, ogTitle, ogDescription, ogImage, hasStructuredData).
 */
function extractPageData(result: ScrapeResult): AuditPageData {
  // Always parse HTML for extended fields not in ParsedPageData
  const htmlData = result.html ? parseHtmlToPageData(result.html, result.url) : null;

  // Use parsed data if available for basic fields
  if (result.parsedData) {
    return {
      title: result.parsedData.title ?? htmlData?.title ?? "",
      metaDescription: result.parsedData.metaDescription ?? htmlData?.metaDescription ?? null,
      h1: result.parsedData.h1 ?? htmlData?.h1 ?? [],
      h2: result.parsedData.h2 ?? htmlData?.h2 ?? [],
      canonicalUrl: result.parsedData.canonical ?? htmlData?.canonicalUrl ?? null,
      // Extended fields from HTML parsing (not in ParsedPageData)
      robotsMeta: htmlData?.robotsMeta ?? null,
      ogTitle: htmlData?.ogTitle ?? null,
      ogDescription: htmlData?.ogDescription ?? null,
      ogImage: htmlData?.ogImage ?? null,
      internalLinks: (result.parsedData.internalLinks ?? []).map((l) =>
        typeof l === "string" ? l : l.url
      ),
      externalLinks: (result.parsedData.externalLinks ?? []).map((l) =>
        typeof l === "string" ? l : l.url
      ),
      wordCount: result.parsedData.wordCount ?? htmlData?.wordCount ?? 0,
      hasStructuredData: htmlData?.hasStructuredData ?? false,
      imagesTotal: result.parsedData.images?.length ?? htmlData?.imagesTotal ?? 0,
      imagesMissingAlt:
        result.parsedData.images?.filter(
          (img: { alt?: string }) => !img.alt || img.alt === ""
        ).length ?? htmlData?.imagesMissingAlt ?? 0,
    };
  }

  // Fallback: use HTML parsed data entirely
  if (htmlData) {
    return htmlData;
  }

  // Empty result
  return {
    title: "",
    metaDescription: null,
    h1: [],
    h2: [],
    canonicalUrl: null,
    robotsMeta: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    internalLinks: [],
    externalLinks: [],
    wordCount: 0,
    hasStructuredData: false,
    imagesTotal: 0,
    imagesMissingAlt: 0,
  };
}

/**
 * Parse HTML to extract audit page data.
 * Extended from CrawlWorkflowAdapter with additional fields for audits.
 */
function parseHtmlToPageData(html: string, url: string): AuditPageData {
  const getMatch = (regex: RegExp): string | null => {
    const match = html.match(regex);
    return match?.[1]?.trim() ?? null;
  };

  const getAllMatches = (regex: RegExp): string[] => {
    const matches: string[] = [];
    let match;
    const clonedRegex = new RegExp(regex.source, regex.flags);
    while ((match = clonedRegex.exec(html)) !== null) {
      if (match[1]) {
        matches.push(match[1].trim());
      }
    }
    return matches;
  };

  // Extract links
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = "";
  }

  const linkRegex = /href=["']([^"']+)["']/gi;
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    if (href.startsWith("/") || href.startsWith(origin)) {
      internalLinks.push(href);
    } else if (href.startsWith("http")) {
      externalLinks.push(href);
    }
  }

  // Count images
  const imgRegex = /<img[^>]*>/gi;
  const images: string[] = [];
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    images.push(imgMatch[0]);
  }
  const imagesMissingAlt = images.filter(
    (img) => !img.includes("alt=") || /alt=["']\s*["']/.test(img)
  ).length;

  // Word count (simple approximation)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textContent.split(" ").filter((w) => w.length > 0).length;

  // Check for structured data
  const hasStructuredData =
    html.includes("application/ld+json") ||
    html.includes('itemtype="http://schema.org') ||
    html.includes('itemtype="https://schema.org');

  return {
    title: getMatch(/<title[^>]*>([^<]+)<\/title>/i) ?? "",
    metaDescription:
      getMatch(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      ) ??
      getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
      ),
    h1: getAllMatches(/<h1[^>]*>([^<]+)<\/h1>/gi),
    h2: getAllMatches(/<h2[^>]*>([^<]+)<\/h2>/gi),
    canonicalUrl:
      getMatch(
        /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
      ) ??
      getMatch(
        /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i
      ),
    robotsMeta:
      getMatch(
        /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i
      ) ??
      getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']robots["']/i
      ),
    ogTitle:
      getMatch(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
      ) ??
      getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
      ),
    ogDescription:
      getMatch(
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
      ) ??
      getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i
      ),
    ogImage:
      getMatch(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      ) ??
      getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
      ),
    internalLinks,
    externalLinks,
    wordCount,
    hasStructuredData,
    imagesTotal: images.length,
    imagesMissingAlt,
  };
}

/**
 * Store HTML in HtmlTempStorage for audit-scoped caching.
 * Call this after receiving output to persist HTML to Redis.
 */
export async function storeAuditPageHtml(
  auditId: string,
  pageId: string,
  html: string
): Promise<void> {
  await HtmlTempStorage.storePageHtml(auditId, pageId, html);
}

/**
 * Store HTML for multiple pages in a batch.
 * More efficient than individual stores for bulk crawling.
 */
export async function storeAuditPageHtmlBatch(
  auditId: string,
  pages: Array<{ pageId: string; html: string }>
): Promise<void> {
  await HtmlTempStorage.storePageHtmlBatch(auditId, pages);
}

/**
 * Retrieve HTML from HtmlTempStorage for audit pages.
 */
export async function getAuditPageHtml(
  auditId: string,
  pageId: string
): Promise<string | null> {
  return HtmlTempStorage.getPageHtml(auditId, pageId);
}

/**
 * Retrieve HTML for multiple pages in a batch.
 */
export async function getAuditPageHtmlBatch(
  auditId: string,
  pageIds: string[]
): Promise<Map<string, string | null>> {
  return HtmlTempStorage.getPageHtmlBatch(auditId, pageIds);
}

/**
 * Clear all HTML for an audit (call after audit completes).
 */
export async function clearAuditHtml(auditId: string): Promise<void> {
  await HtmlTempStorage.clearAuditHtml(auditId);
}

/**
 * Create a SiteAuditsAdapter instance for custom configuration.
 */
export function createSiteAuditsAdapter(): ConsumerAdapter<
  SiteAuditsInput,
  SiteAuditsOutput
> {
  return { ...siteAuditsAdapter };
}

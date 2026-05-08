import { analyzeHtml } from "@/server/lib/audit/page-analyzer";
import type { StepPageResult } from "@/server/lib/audit/types";
import { isSameOrigin, normalizeUrl } from "@/server/lib/audit/url-utils";
import { createLogger } from "@/server/lib/logger";
import { scrapingService, type ScrapeTier } from "@/server/features/scraping";

const log = createLogger({ module: "site-audit-workflow" });

/** Extended page result that includes raw HTML for Tier 1 checks */
export interface CrawlPageResultWithHtml {
  page: StepPageResult;
  html: string | null;
}

/**
 * Options for crawlPage with cost attribution support.
 * Phase 95 Gap Closure: GAP-O2 - Migrate to ScrapingService
 */
export interface CrawlPageOptions {
  /** Client ID for cost attribution */
  clientId?: string;
  /** Workspace ID for cost attribution */
  workspaceId?: string;
  /** Job ID for correlation */
  jobId?: string;
  /** Request timeout in milliseconds (default: 15000) */
  timeout?: number;
  /** Starting tier for discovery (default: 'direct') */
  startTier?: ScrapeTier;
  /** Maximum tier to try (default: 'geonode' - cost-conscious for audits) */
  maxTier?: ScrapeTier;
}

export async function crawlPage(
  url: string,
  crawlOrigin: string,
  options: CrawlPageOptions = {},
): Promise<CrawlPageResultWithHtml | null> {
  const startTime = Date.now();

  const {
    clientId,
    workspaceId,
    jobId,
    timeout = 15_000,
    startTier = "direct",
    maxTier = "geonode", // Cost-conscious: don't use expensive DFS tiers for audits by default
  } = options;

  // Try ScrapingService first (preferred path with tiered escalation, caching, cost tracking)
  if (scrapingService.isInitialized()) {
    try {
      const result = await scrapingService.scrape(url, {
        feature: "crawlWorkflow",
        clientId,
        workspaceId,
        jobId,
        timeoutMs: timeout,
        startTier,
        maxTier,
        includeHtml: true,
        headers: {
          "User-Agent": "OpenSEO-Audit/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const responseTimeMs = Date.now() - startTime;

      if (!result.success) {
        log.warn("ScrapingService failed to crawl URL", {
          url,
          error: result.error,
          tierUsed: result.tierUsed,
        });
        return { page: emptyPageResult(url, result.statusCode || 0, null, responseTimeMs), html: null };
      }

      const finalUrl = normalizeUrl(result.url) ?? result.url;
      if (!isSameOrigin(finalUrl, crawlOrigin)) return null;

      const redirectUrl = result.url !== url ? result.url : null;
      const html = result.html ?? "";

      // Skip non-HTML content
      if (!html || html.length === 0) {
        return { page: emptyPageResult(finalUrl, result.statusCode, redirectUrl, responseTimeMs), html: null };
      }

      return processHtmlResponse(html, finalUrl, result.statusCode, responseTimeMs, redirectUrl);
    } catch (error) {
      // ScrapingService threw an exception - fall back to direct fetch
      log.warn("ScrapingService exception, falling back to direct fetch", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback: Direct fetch (legacy behavior for graceful degradation)
  return crawlPageDirect(url, crawlOrigin, timeout, startTime);
}

/**
 * Legacy direct fetch implementation - used as fallback when ScrapingService unavailable.
 */
async function crawlPageDirect(
  url: string,
  crawlOrigin: string,
  timeout: number,
  startTime: number,
): Promise<CrawlPageResultWithHtml | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "OpenSEO-Audit/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });

    const responseTimeMs = Date.now() - startTime;
    const statusCode = response.status;
    const finalUrl = normalizeUrl(response.url) ?? response.url;
    if (!isSameOrigin(finalUrl, crawlOrigin)) return null;

    const redirectUrl =
      response.redirected && response.url !== url ? response.url : null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { page: emptyPageResult(finalUrl, statusCode, redirectUrl, responseTimeMs), html: null };
    }

    const html = await response.text();
    return processHtmlResponse(html, finalUrl, statusCode, responseTimeMs, redirectUrl);
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    log.warn("Failed to crawl URL (direct)", { url, error: error instanceof Error ? error.message : String(error) });
    return { page: emptyPageResult(url, 0, null, responseTimeMs), html: null };
  }
}

/**
 * Process HTML response and extract SEO metadata.
 * Shared by both ScrapingService and direct fetch paths.
 */
function processHtmlResponse(
  html: string,
  finalUrl: string,
  statusCode: number,
  responseTimeMs: number,
  redirectUrl: string | null,
): CrawlPageResultWithHtml {
  const analysis = analyzeHtml(
    html,
    finalUrl,
    statusCode,
    responseTimeMs,
    redirectUrl,
  );
  const isIndexable = !(
    analysis.robotsMeta?.toLowerCase().includes("noindex") ?? false
  );
  const h2Count = analysis.headingOrder.filter((h) => h === 2).length;
  const h3Count = analysis.headingOrder.filter((h) => h === 3).length;
  const h4Count = analysis.headingOrder.filter((h) => h === 4).length;
  const h5Count = analysis.headingOrder.filter((h) => h === 5).length;
  const h6Count = analysis.headingOrder.filter((h) => h === 6).length;

  return {
    page: {
      id: crypto.randomUUID(),
      url: finalUrl,
      statusCode,
      redirectUrl,
      title: analysis.title,
      metaDescription: analysis.metaDescription,
      canonicalUrl: analysis.canonical,
      robotsMeta: analysis.robotsMeta,
      ogTitle: analysis.ogTitle,
      ogDescription: analysis.ogDescription,
      ogImage: analysis.ogImage,
      h1Count: analysis.h1s.length,
      h2Count,
      h3Count,
      h4Count,
      h5Count,
      h6Count,
      headingOrder: analysis.headingOrder,
      wordCount: analysis.wordCount,
      imagesTotal: analysis.images.length,
      imagesMissingAlt: analysis.images.filter(
        (img) => !img.alt || img.alt === "",
      ).length,
      images: analysis.images,
      internalLinks: analysis.internalLinks,
      externalLinks: analysis.externalLinks,
      hasStructuredData: analysis.hasStructuredData,
      hreflangTags: analysis.hreflangTags,
      isIndexable,
      responseTimeMs,
    },
    html,
  };
}

function emptyPageResult(
  url: string,
  statusCode: number,
  redirectUrl: string | null,
  responseTimeMs: number,
): StepPageResult {
  return {
    id: crypto.randomUUID(),
    url,
    statusCode,
    redirectUrl,
    title: "",
    metaDescription: "",
    canonicalUrl: null,
    robotsMeta: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    h1Count: 0,
    h2Count: 0,
    h3Count: 0,
    h4Count: 0,
    h5Count: 0,
    h6Count: 0,
    headingOrder: [],
    wordCount: 0,
    imagesTotal: 0,
    imagesMissingAlt: 0,
    images: [],
    internalLinks: [],
    externalLinks: [],
    hasStructuredData: false,
    hreflangTags: [],
    isIndexable: false,
    responseTimeMs,
  };
}

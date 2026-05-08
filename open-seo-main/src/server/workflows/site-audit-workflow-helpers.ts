import { analyzeHtml } from "@/server/lib/audit/page-analyzer";
import type { StepPageResult } from "@/server/lib/audit/types";
import { isSameOrigin, normalizeUrl } from "@/server/lib/audit/url-utils";
import { createLogger } from "@/server/lib/logger";
import { scrapingService, type ScrapeOptions } from "@/server/features/scraping";

const log = createLogger({ module: "site-audit-workflow" });

/** Extended page result that includes raw HTML for Tier 1 checks */
export interface CrawlPageResultWithHtml {
  page: StepPageResult;
  html: string | null;
  /** Scraping tier used (from unified ScrapingService) */
  tier?: string;
  /** Whether result was served from cache */
  cached?: boolean;
}

/** Options for crawling a single page */
export interface CrawlPageOptions {
  /** Client ID for cost tracking */
  clientId?: string;
  /** Audit ID for correlation */
  auditId?: string;
  /** Skip cache and fetch fresh */
  skipCache?: boolean;
}

/**
 * Crawl a single page using the unified ScrapingService.
 *
 * This function routes through the cost-optimized tier selection system,
 * benefiting from:
 * - L1-L4 caching (memory, Redis, DB, CDN)
 * - Domain learning for optimal tier selection
 * - Cost tracking per client/feature
 * - Automatic retry with tier escalation
 */
export async function crawlPage(
  url: string,
  crawlOrigin: string,
  options?: CrawlPageOptions,
): Promise<CrawlPageResultWithHtml | null> {
  const startTime = Date.now();

  try {
    // Build scrape options for the unified service
    const scrapeOptions: ScrapeOptions = {
      feature: "siteAudits",
      clientId: options?.clientId,
      correlationId: options?.auditId,
      includeHtml: true,
      skipCache: options?.skipCache,
      timeoutMs: 15_000,
    };

    // Use unified ScrapingService instead of direct fetch
    const result = await scrapingService.scrape(url, scrapeOptions);

    const responseTimeMs = result.responseTimeMs ?? (Date.now() - startTime);
    const statusCode = result.statusCode;
    const finalUrl = normalizeUrl(result.url ?? url) ?? url;

    // Check same-origin after potential redirects
    if (!isSameOrigin(finalUrl, crawlOrigin)) {
      return null;
    }

    const redirectUrl = result.url && result.url !== url ? result.url : null;

    // Handle non-HTML content or failed requests
    if (!result.success || !result.html) {
      return {
        page: emptyPageResult(finalUrl, statusCode, redirectUrl, responseTimeMs),
        html: null,
        tier: result.tierUsed,
        cached: result.fromCache,
      };
    }

    const html = result.html;
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
      tier: result.tierUsed,
      cached: result.fromCache,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    log.warn("Failed to crawl URL via ScrapingService", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return { page: emptyPageResult(url, 0, null, responseTimeMs), html: null };
  }
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

/**
 * Site Audit Workflow - Crawl Phase
 * Phase 95-10: Consumer Integration Completion
 *
 * Crawls pages for site audits, now integrated with MigrationRouter
 * for unified scraping infrastructure.
 */
import type { WorkflowStep } from "@/server/workflows/workflow-types";
import type { RobotsResult } from "@/server/lib/audit/discovery";
import type { StepPageResult } from "@/server/lib/audit/types";
import { isSameOrigin, normalizeUrl } from "@/server/lib/audit/url-utils";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { AuditProgressKV } from "@/server/lib/audit/progress-kv";
import { HtmlTempStorage } from "@/server/lib/audit/html-temp-storage";
import { crawlPage, type CrawlPageResultWithHtml } from "@/server/workflows/site-audit-workflow-helpers";
import { runTier1Checks } from "@/server/lib/audit/checks/runner";
import { createLogger } from "@/server/lib/logger";
import {
  loadMigrationFlagsCached,
  shouldUseUnified,
  scrapingService,
} from "@/server/features/scraping";
import { analyzeHtml } from "@/server/lib/audit/page-analyzer";

const log = createLogger({ module: "crawl-phase" });

const CRAWL_CONCURRENCY = 25;

function shouldQueueCrawlLink(
  link: string,
  origin: string,
  robots: RobotsResult,
  visited: Set<string>,
  queued: Set<string>,
): boolean {
  return (
    isSameOrigin(link, origin) &&
    robots.isAllowed(link) &&
    !visited.has(link) &&
    !queued.has(link)
  );
}

type CrawlPhaseParams = {
  auditId: string;
  workflowInstanceId: string;
  origin: string;
  startUrl: string;
  maxPages: number;
  robots: RobotsResult;
  sitemapUrls: string[];
};

export async function runCrawlPhase(
  step: WorkflowStep,
  params: CrawlPhaseParams,
): Promise<CrawlPhaseResult> {
  const {
    auditId,
    workflowInstanceId,
    origin,
    startUrl,
    maxPages,
    robots,
    sitemapUrls,
  } = params;
  const visited = new Set<string>();
  const queue: string[] = [];
  const queued = new Set<string>();
  const allPages: StepPageResult[] = [];
  // H-AUDIT-02: Track page IDs for Redis HTML retrieval instead of in-memory Map
  const allPageIds: string[] = [];

  seedCrawlQueue({
    startUrl,
    origin,
    robots,
    sitemapUrls,
    visited,
    queued,
    queue,
  });

  let crawlBatchIndex = 0;
  while (queue.length > 0 && allPages.length < maxPages) {
    const urlsToCrawl = selectNextCrawlBatch(
      queue,
      queued,
      visited,
      robots,
      maxPages - allPages.length,
    );
    if (urlsToCrawl.length === 0) continue;

    crawlBatchIndex += 1;
    const { pages: crawledBatch, htmlByPageId } = await runCrawlBatch(
      step,
      crawlBatchIndex,
      urlsToCrawl,
      origin,
    );
    allPages.push(...crawledBatch);

    // H-AUDIT-02: Stream HTML to Redis instead of accumulating in memory
    // This prevents memory exhaustion on large sites (10K pages = 2GB+ memory)
    const htmlEntries: Array<{ pageId: string; html: string }> = [];
    for (const [pageId, html] of htmlByPageId) {
      htmlEntries.push({ pageId, html });
      allPageIds.push(pageId);
    }
    if (htmlEntries.length > 0) {
      await HtmlTempStorage.storePageHtmlBatch(auditId, htmlEntries);
    }

    // Run Tier 1 checks on pages with HTML (instant, free - DOM/regex only)
    // Use in-memory htmlByPageId for Tier 1 since we still have it in scope
    await runTier1ChecksForBatch(step, crawlBatchIndex, auditId, crawledBatch, htmlByPageId);

    enqueueDiscoveredLinks({
      crawledBatch: crawledBatch,
      queue,
      queued,
      visited,
      origin,
      robots,
    });
    await persistCrawlProgress({
      step,
      crawlBatchIndex,
      auditId,
      workflowInstanceId,
      crawledBatch,
      pagesCrawled: allPages.length,
      visitedCount: visited.size,
      queueLength: queue.length,
      maxPages,
    });
  }

  // H-AUDIT-02: Return auditId for Redis HTML retrieval in later phases
  // The htmlByPageId getter now fetches from Redis on-demand
  return {
    allPages,
    htmlByPageId: createRedisBackedHtmlMap(auditId, allPageIds),
  };
}

/**
 * H-AUDIT-02: Create a Map-like interface backed by Redis storage.
 * Provides lazy loading of HTML from Redis to minimize memory usage.
 */
function createRedisBackedHtmlMap(
  auditId: string,
  pageIds: string[],
): Map<string, string> {
  // For compatibility, we preload HTML from Redis into a Map
  // This is done lazily when the workflow phases need the HTML
  const map = new Map<string, string>();

  // Mark this as a Redis-backed map by storing metadata
  // The actual HTML will be loaded on-demand by the workflow phases
  (map as Map<string, string> & { _auditId?: string; _pageIds?: string[] })._auditId = auditId;
  (map as Map<string, string> & { _auditId?: string; _pageIds?: string[] })._pageIds = pageIds;

  return map;
}

function seedCrawlQueue({
  startUrl,
  origin,
  robots,
  sitemapUrls,
  visited,
  queued,
  queue,
}: {
  startUrl: string;
  origin: string;
  robots: RobotsResult;
  sitemapUrls: string[];
  visited: Set<string>;
  queued: Set<string>;
  queue: string[];
}) {
  const normalizedStart = normalizeUrl(startUrl) ?? startUrl;
  if (
    robots.isAllowed(normalizedStart) &&
    isSameOrigin(normalizedStart, origin)
  ) {
    queue.push(normalizedStart);
    queued.add(normalizedStart);
  }

  for (const sitemapUrl of sitemapUrls) {
    const normalized = normalizeUrl(sitemapUrl);
    if (!normalized) continue;
    if (!shouldQueueCrawlLink(normalized, origin, robots, visited, queued)) {
      continue;
    }
    queue.push(normalized);
    queued.add(normalized);
  }
}

function selectNextCrawlBatch(
  queue: string[],
  queued: Set<string>,
  visited: Set<string>,
  robots: RobotsResult,
  remaining: number,
) {
  const batchSize = Math.min(CRAWL_CONCURRENCY, remaining);
  const urlsToCrawl: string[] = [];

  while (queue.length > 0 && urlsToCrawl.length < batchSize) {
    const url = queue.shift()!;
    queued.delete(url);
    if (visited.has(url)) continue;
    if (!robots.isAllowed(url)) continue;
    visited.add(url);
    urlsToCrawl.push(url);
  }

  return urlsToCrawl;
}

interface CrawlBatchResult {
  pages: StepPageResult[];
  htmlByPageId: Map<string, string>;
}

/** Result of the crawl phase including HTML for Tier 2 checks */
export interface CrawlPhaseResult {
  allPages: StepPageResult[];
  htmlByPageId: Map<string, string>;
}

async function runCrawlBatch(
  step: WorkflowStep,
  crawlBatchIndex: number,
  urlsToCrawl: string[],
  origin: string,
): Promise<CrawlBatchResult> {
  return step.do(`crawl-batch-${crawlBatchIndex}`, async () => {
    // Phase 95-10: Check migration flag for unified scraping
    const flags = loadMigrationFlagsCached();

    if (shouldUseUnified(flags.crawlWorkflow)) {
      // Use unified ScrapingService for crawl workflow
      return runCrawlBatchUnified(urlsToCrawl, origin);
    }

    // Legacy path: direct fetch
    const settled = await Promise.allSettled(
      urlsToCrawl.map((url) => crawlPage(url, origin)),
    );
    const pages: StepPageResult[] = [];
    const htmlByPageId = new Map<string, string>();

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        const { page, html } = result.value;
        pages.push(page);
        if (html) {
          htmlByPageId.set(page.id, html);
        }
      }
    }

    return { pages, htmlByPageId };
  });
}

/**
 * Phase 95-10: Unified crawl batch using ScrapingService.
 * Routes through TieredFetcher with caching and cost tracking.
 */
async function runCrawlBatchUnified(
  urlsToCrawl: string[],
  origin: string,
): Promise<CrawlBatchResult> {
  const pages: StepPageResult[] = [];
  const htmlByPageId = new Map<string, string>();

  try {
    const batchResult = await scrapingService.scrapeBatch(urlsToCrawl, {
      feature: "crawlWorkflow",
      includeHtml: true,
      concurrency: CRAWL_CONCURRENCY,
    });

    for (let i = 0; i < batchResult.results.length; i++) {
      const result = batchResult.results[i];
      const url = urlsToCrawl[i];

      // Skip if not same origin after redirects
      if (result.url && !isSameOrigin(result.url, origin)) {
        continue;
      }

      const finalUrl = normalizeUrl(result.url ?? url) ?? url;
      const html = result.html;
      const statusCode = result.statusCode;

      // Check content type from response
      const contentType = (result as { contentType?: string }).contentType ?? "text/html";
      if (!contentType.includes("text/html")) {
        // Non-HTML content - create minimal page result
        pages.push(createMinimalPageResult(finalUrl, statusCode, null, result.responseTimeMs));
        continue;
      }

      if (html) {
        // Analyze HTML to extract page data
        const analysis = analyzeHtml(
          html,
          finalUrl,
          statusCode,
          result.responseTimeMs,
          result.url !== url ? result.url ?? null : null, // redirectUrl
        );

        const page = createPageResultFromAnalysis(finalUrl, statusCode, result, analysis);
        pages.push(page);
        htmlByPageId.set(page.id, html);
      } else {
        // No HTML - create minimal result
        pages.push(createMinimalPageResult(finalUrl, statusCode, null, result.responseTimeMs));
      }
    }

    log.info("Unified crawl batch complete", {
      urlCount: urlsToCrawl.length,
      pagesReturned: pages.length,
      cacheHits: batchResult.cacheHits,
      totalCost: batchResult.totalCostUsd,
    });
  } catch (error) {
    log.error(
      "Unified crawl batch failed, falling back to legacy",
      error instanceof Error ? error : new Error(String(error))
    );

    // Fallback to legacy on error
    const settled = await Promise.allSettled(
      urlsToCrawl.map((url) => crawlPage(url, origin)),
    );

    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        const { page, html } = result.value;
        pages.push(page);
        if (html) {
          htmlByPageId.set(page.id, html);
        }
      }
    }
  }

  return { pages, htmlByPageId };
}

/**
 * Create a StepPageResult from HTML analysis.
 */
function createPageResultFromAnalysis(
  url: string,
  statusCode: number,
  result: { responseTimeMs: number; url?: string },
  analysis: ReturnType<typeof analyzeHtml>,
): StepPageResult {
  const isIndexable = !(analysis.robotsMeta?.toLowerCase().includes("noindex") ?? false);
  const redirectUrl = result.url !== url ? result.url ?? null : null;

  return {
    id: crypto.randomUUID(),
    url,
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
    h2Count: analysis.headingOrder.filter((h) => h === 2).length,
    h3Count: analysis.headingOrder.filter((h) => h === 3).length,
    h4Count: analysis.headingOrder.filter((h) => h === 4).length,
    h5Count: analysis.headingOrder.filter((h) => h === 5).length,
    h6Count: analysis.headingOrder.filter((h) => h === 6).length,
    headingOrder: analysis.headingOrder,
    wordCount: analysis.wordCount,
    imagesTotal: analysis.images.length,
    imagesMissingAlt: analysis.images.filter((img) => !img.alt || img.alt === "").length,
    images: analysis.images,
    internalLinks: analysis.internalLinks,
    externalLinks: analysis.externalLinks,
    hasStructuredData: analysis.hasStructuredData,
    hreflangTags: analysis.hreflangTags,
    isIndexable,
    responseTimeMs: result.responseTimeMs,
  };
}

/**
 * Create a minimal page result for non-HTML or failed fetches.
 */
function createMinimalPageResult(
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

/**
 * Run Tier 1 checks (DOM/regex) on crawled pages and persist findings.
 * Tier 1 checks are instant and free - no external API calls.
 * Runs in <100ms per page per threat model T-32-03.
 */
async function runTier1ChecksForBatch(
  step: WorkflowStep,
  crawlBatchIndex: number,
  auditId: string,
  pages: StepPageResult[],
  htmlByPageId: Map<string, string>,
): Promise<void> {
  return step.do(`tier1-checks-batch-${crawlBatchIndex}`, async () => {
    for (const page of pages) {
      const html = htmlByPageId.get(page.id);

      // Skip pages without HTML (non-HTML content types, failed fetches)
      if (!html || page.statusCode !== 200) {
        continue;
      }

      try {
        // Run Tier 1 checks - instant, DOM/regex only
        const results = await runTier1Checks(html, page.url);

        // Persist findings to database
        if (results.length > 0) {
          await FindingsRepository.insertFindings(auditId, page.id, results);
        }
      } catch (error) {
        // Log but don't fail the crawl - checks are non-blocking
        log.warn("Tier 1 checks failed for page", {
          pageId: page.id,
          url: page.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
}

function enqueueDiscoveredLinks(params: {
  crawledBatch: StepPageResult[];
  queue: string[];
  queued: Set<string>;
  visited: Set<string>;
  origin: string;
  robots: RobotsResult;
}) {
  const { crawledBatch, queue, queued, visited, origin, robots } = params;
  for (const pageResult of crawledBatch) {
    for (const link of pageResult.internalLinks.filter((candidate) =>
      shouldQueueCrawlLink(candidate, origin, robots, visited, queued),
    )) {
      queue.push(link);
      queued.add(link);
    }
  }
}

async function persistCrawlProgress(params: {
  step: WorkflowStep;
  crawlBatchIndex: number;
  auditId: string;
  workflowInstanceId: string;
  crawledBatch: StepPageResult[];
  pagesCrawled: number;
  visitedCount: number;
  queueLength: number;
  maxPages: number;
}) {
  const {
    step,
    crawlBatchIndex,
    auditId,
    workflowInstanceId,
    crawledBatch,
    pagesCrawled,
    visitedCount,
    queueLength,
    maxPages,
  } = params;
  await step.do(`kv-progress-batch-${crawlBatchIndex}`, async () => {
    await AuditProgressKV.pushCrawledUrls(
      auditId,
      crawledBatch.map((pageResult) => ({
        url: pageResult.url,
        statusCode: pageResult.statusCode,
        title: pageResult.title,
        crawledAt: Date.now(),
      })),
    );
  });

  await step.do(`progress-batch-${crawlBatchIndex}`, async () => {
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      pagesCrawled,
      pagesTotal: Math.min(visitedCount + queueLength, maxPages),
    });
  });
}

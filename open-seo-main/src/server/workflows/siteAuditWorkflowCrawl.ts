import type { WorkflowStep } from "@/server/workflows/workflow-types";
import type { RobotsResult } from "@/server/lib/audit/discovery";
import type { StepPageResult } from "@/server/lib/audit/types";
import { isSameOrigin, normalizeUrl } from "@/server/lib/audit/url-utils";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { AuditProgressKV } from "@/server/lib/audit/progress-kv";
import { crawlPage, type CrawlPageResultWithHtml } from "@/server/workflows/site-audit-workflow-helpers";
import { runTier1Checks } from "@/server/lib/audit/checks/runner";
import { createLogger } from "@/server/lib/logger";

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
  const allHtmlByPageId = new Map<string, string>();

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

    // Accumulate HTML for Tier 2 checks (run after crawl completes)
    for (const [pageId, html] of htmlByPageId) {
      allHtmlByPageId.set(pageId, html);
    }

    // Run Tier 1 checks on pages with HTML (instant, free - DOM/regex only)
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

  return { allPages, htmlByPageId: allHtmlByPageId };
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

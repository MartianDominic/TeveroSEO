import type { WorkflowStep } from "@/server/workflows/workflow-types";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { discoverUrls, fetchRobotsTxt } from "@/server/lib/audit/discovery";
import {
  fetchAndStoreLighthouseResult,
  selectLighthouseSample,
} from "@/server/lib/audit/lighthouse";
import { getOrigin } from "@/server/lib/audit/url-utils";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { AuditProgressKV } from "@/server/lib/audit/progress-kv";
import { HtmlTempStorage } from "@/server/lib/audit/html-temp-storage";
import type {
  AuditConfig,
  LighthouseResult,
  StepPageResult,
} from "@/server/lib/audit/types";
import type { SiteContext } from "@/server/lib/audit/checks/types";
import { captureServerEvent } from "@/server/lib/posthog";
import { runCrawlPhase, type CrawlPhaseResult } from "@/server/workflows/siteAuditWorkflowCrawl";
import { runTier2Checks, runTier3Checks, runTier4Checks, runTier5ChecksWithContext } from "@/server/lib/audit/checks/runner";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { createLogger } from "@/server/lib/logger";
import { getVerticalClassifierService } from "@/server/features/onpage-mastery/services/VerticalClassifier";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";
import { getRuleEngineService } from "@/server/features/onpage-mastery/services/RuleEngineService";
import type { Classification } from "@/server/features/onpage-mastery/types";

const log = createLogger({ module: "audit-phases" });

const LIGHTHOUSE_URL_BATCH_SIZE = 10;

/** DoS mitigation limits per threat model T-32-07, T-32-08 */
const MAX_CLICK_DEPTH = 10;
const MAX_BFS_ITERATIONS = 10_000;
const MAX_LINK_GRAPH_SIZE = 50_000;

/**
 * Build SiteContext from crawled pages for Tier 4 checks.
 * Constructs link graph and calculates click depths via BFS from homepage.
 */
function buildSiteContext(pages: StepPageResult[]): SiteContext {
  const linkGraph = new Map<string, string[]>();

  // Build link graph from internal links (limit per T-32-08)
  let totalLinks = 0;
  for (const page of pages) {
    if (page.internalLinks && totalLinks < MAX_LINK_GRAPH_SIZE) {
      const linksToAdd = page.internalLinks.slice(
        0,
        MAX_LINK_GRAPH_SIZE - totalLinks
      );
      linkGraph.set(page.url, linksToAdd);
      totalLinks += linksToAdd.length;
    }
  }

  // Calculate click depths via BFS from homepage
  const clickDepths = new Map<string, number>();
  const homepage = pages.find((p) => {
    try {
      return new URL(p.url).pathname === "/";
    } catch {
      return false;
    }
  });

  if (homepage) {
    clickDepths.set(homepage.url, 0);
    const queue: Array<{ url: string; depth: number }> = [
      { url: homepage.url, depth: 0 },
    ];
    let iterations = 0;

    while (queue.length > 0 && iterations < MAX_BFS_ITERATIONS) {
      iterations++;
      const item = queue.shift();
      if (!item) break;

      const { url, depth } = item;

      // Stop at max depth per threat model T-32-07
      if (depth >= MAX_CLICK_DEPTH) continue;

      const links = linkGraph.get(url) ?? [];
      for (const link of links) {
        if (!clickDepths.has(link)) {
          clickDepths.set(link, depth + 1);
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  return {
    totalPages: pages.length,
    linkGraph,
    clickDepths,
  };
}

function countLighthouseBatchResults(results: LighthouseResult[]): {
  completed: number;
  failed: number;
} {
  let completed = 0;
  let failed = 0;
  for (const result of results) {
    if (result.errorMessage) {
      failed += 1;
      continue;
    }
    completed += 1;
  }
  return { completed, failed };
}

type AuditPhasesParams = {
  auditId: string;
  workflowInstanceId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
};

export async function runAuditPhases(
  step: WorkflowStep,
  params: AuditPhasesParams,
) {
  const {
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    startUrl,
    config,
  } = params;
  const origin = getOrigin(startUrl);
  const maxPages = config.maxPages;

  const discovery = await runDiscoveryPhase(
    step,
    auditId,
    workflowInstanceId,
    origin,
    maxPages,
  );
  const robots = await fetchRobotsTxt(origin);
  const crawlResult = await runCrawlPhase(step, {
    auditId,
    workflowInstanceId,
    origin,
    startUrl,
    maxPages,
    robots,
    sitemapUrls: discovery.sitemapUrls,
  });
  const { allPages, htmlByPageId } = crawlResult;

  // Run Tier 2 checks after crawl completes (light calculations)
  await runTier2ChecksPhase(step, auditId, workflowInstanceId, allPages, htmlByPageId);

  const lighthouseResults = await runLighthousePhase(step, {
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    startUrl,
    config,
    allPages,
  });

  // Run Tier 3 checks (API-based: CrUX CWV, GSC, GA4)
  // These checks use data from Lighthouse results when available
  await runTier3ChecksPhase(step, auditId, workflowInstanceId, allPages, htmlByPageId);

  // Run Tier 4 checks (crawl-based: site architecture, differentiation)
  // These checks require site-wide context built from crawl data
  await runTier4ChecksPhase(step, auditId, workflowInstanceId, allPages, htmlByPageId);

  // Run Tier 5 checks (content quality intelligence with vertical classification)
  // These checks use VerticalClassifier, QualityGateService, and RuleEngineService
  const tier5Results = await runTier5ChecksPhase(step, auditId, workflowInstanceId, allPages, htmlByPageId, origin);

  await finalizeAudit({
    step,
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    config,
    allPages,
    lighthouseResults,
  });
}

async function runDiscoveryPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  origin: string,
  maxPages: number,
) {
  return step.do("discover-urls", async () => {
    const result = await discoverUrls(origin, maxPages);
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      pagesTotal: Math.min(result.urls.length + 1, maxPages),
      currentPhase: "crawling",
    });
    return { sitemapUrls: result.urls };
  });
}

/**
 * Run Tier 2 checks (light calculations) after crawl completes.
 * Tier 2 includes: reading level, keyword density, word count analysis,
 * schema completeness, anchor analysis, freshness signals, and mobile checks.
 * Runs in <500ms per page per threat model requirements.
 *
 * H-AUDIT-02: Fetches HTML from Redis in batches to minimize memory usage.
 */
async function runTier2ChecksPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  allPages: StepPageResult[],
  htmlByPageId: Map<string, string>,
): Promise<void> {
  return step.do("run-tier2-checks", async () => {
    // Update phase to analyzing
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      currentPhase: "analyzing",
    });

    // H-AUDIT-02: Process pages in batches to limit memory usage
    const BATCH_SIZE = 50;
    for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
      const batch = allPages.slice(i, i + BATCH_SIZE);
      const pageIds = batch.map((p) => p.id);

      // H-AUDIT-02: Fetch HTML from Redis for this batch
      // First check in-memory map, then fall back to Redis
      const htmlMap = new Map<string, string | null>();
      const idsToFetch: string[] = [];

      for (const pageId of pageIds) {
        const inMemoryHtml = htmlByPageId.get(pageId);
        if (inMemoryHtml) {
          htmlMap.set(pageId, inMemoryHtml);
        } else {
          idsToFetch.push(pageId);
        }
      }

      // Fetch missing HTML from Redis
      if (idsToFetch.length > 0) {
        const redisHtml = await HtmlTempStorage.getPageHtmlBatch(auditId, idsToFetch);
        for (const [pageId, html] of redisHtml) {
          htmlMap.set(pageId, html);
        }
      }

      // Run Tier 2 checks for each page in batch
      for (const page of batch) {
        const html = htmlMap.get(page.id);

        // Skip pages without HTML (non-HTML content types, failed fetches)
        if (!html || page.statusCode !== 200) {
          continue;
        }

        try {
          // Run Tier 2 checks - light calculations
          const results = await runTier2Checks(html, page.url);

          // Persist findings to database
          if (results.length > 0) {
            await FindingsRepository.insertFindings(auditId, page.id, results);
          }
        } catch (error) {
          // Log but don't fail the audit - checks are non-blocking
          log.warn("Tier 2 checks failed for page", {
            pageId: page.id,
            url: page.url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  });
}

/**
 * Run Tier 3 checks (API-based) after Lighthouse completes.
 * Tier 3 includes: CrUX Core Web Vitals, entity/NLP analysis,
 * backlink metrics, and engagement proxies (CTR, scroll depth, bounce rate).
 * These checks gracefully skip when API data is unavailable.
 *
 * H-AUDIT-02: Fetches HTML from Redis in batches to minimize memory usage.
 */
async function runTier3ChecksPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  allPages: StepPageResult[],
  htmlByPageId: Map<string, string>,
): Promise<void> {
  return step.do("run-tier3-checks", async () => {
    // H-AUDIT-02: Process pages in batches to limit memory usage
    const BATCH_SIZE = 50;
    for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
      const batch = allPages.slice(i, i + BATCH_SIZE);
      const pageIds = batch.map((p) => p.id);

      // H-AUDIT-02: Fetch HTML from Redis for this batch
      const htmlMap = new Map<string, string | null>();
      const idsToFetch: string[] = [];

      for (const pageId of pageIds) {
        const inMemoryHtml = htmlByPageId.get(pageId);
        if (inMemoryHtml) {
          htmlMap.set(pageId, inMemoryHtml);
        } else {
          idsToFetch.push(pageId);
        }
      }

      if (idsToFetch.length > 0) {
        const redisHtml = await HtmlTempStorage.getPageHtmlBatch(auditId, idsToFetch);
        for (const [pageId, html] of redisHtml) {
          htmlMap.set(pageId, html);
        }
      }

      // Run Tier 3 checks for each page in batch
      for (const page of batch) {
        const html = htmlMap.get(page.id);

        // Skip pages without HTML
        if (!html || page.statusCode !== 200) {
          continue;
        }

        try {
          // Run Tier 3 checks - API-based (CrUX, GSC, GA4)
          const results = await runTier3Checks(html, page.url);

          // Persist findings to database
          if (results.length > 0) {
            await FindingsRepository.insertFindings(auditId, page.id, results);
          }
        } catch (error) {
          // Log but don't fail the audit - checks are non-blocking
          log.warn("Tier 3 checks failed for page", {
            pageId: page.id,
            url: page.url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  });
}

/**
 * Run Tier 4 checks (crawl-based) after Tier 3 completes.
 * Tier 4 includes: site architecture (click depth, orphan pages, hub-spoke),
 * and content differentiation (unique content ratio, scaled content detection).
 * Requires site-wide context from crawl data.
 *
 * H-AUDIT-02: Fetches HTML from Redis in batches to minimize memory usage.
 */
async function runTier4ChecksPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  allPages: StepPageResult[],
  htmlByPageId: Map<string, string>,
): Promise<void> {
  return step.do("run-tier4-checks", async () => {
    // Build site-wide context for Tier 4 checks
    const siteContext = buildSiteContext(allPages);

    // H-AUDIT-02: Process pages in batches to limit memory usage
    const BATCH_SIZE = 50;
    for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
      const batch = allPages.slice(i, i + BATCH_SIZE);
      const pageIds = batch.map((p) => p.id);

      // H-AUDIT-02: Fetch HTML from Redis for this batch
      const htmlMap = new Map<string, string | null>();
      const idsToFetch: string[] = [];

      for (const pageId of pageIds) {
        const inMemoryHtml = htmlByPageId.get(pageId);
        if (inMemoryHtml) {
          htmlMap.set(pageId, inMemoryHtml);
        } else {
          idsToFetch.push(pageId);
        }
      }

      if (idsToFetch.length > 0) {
        const redisHtml = await HtmlTempStorage.getPageHtmlBatch(auditId, idsToFetch);
        for (const [pageId, html] of redisHtml) {
          htmlMap.set(pageId, html);
        }
      }

      // Run Tier 4 checks for each page in batch
      for (const page of batch) {
        const html = htmlMap.get(page.id);

        // Skip pages without HTML
        if (!html || page.statusCode !== 200) {
          continue;
        }

        try {
          // Run Tier 4 checks - crawl-based with site context
          const results = await runTier4Checks(html, page.url, siteContext);

          // Persist findings to database
          if (results.length > 0) {
            await FindingsRepository.insertFindings(auditId, page.id, results);
          }
        } catch (error) {
          // Log but don't fail the audit - checks are non-blocking
          log.warn("Tier 4 checks failed for page", {
            pageId: page.id,
            url: page.url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  });
}

/**
 * Tier 5 checks phase result with quality gate evaluation.
 */
interface Tier5PhaseResult {
  /** Total pages evaluated */
  pagesEvaluated: number;
  /** Pages that passed quality gate */
  pagesPassed: number;
  /** Pages blocked by quality gate */
  pagesBlocked: number;
  /** Classification cache hits (cost savings) */
  classificationCacheHits: number;
}

/**
 * Run Tier 5 checks (content quality intelligence) with vertical classification.
 *
 * This phase:
 * 1. Classifies each page's vertical using VerticalClassifier (heuristic-first, LLM fallback)
 * 2. Runs T5-01 to T5-13 quality checks with vertical context
 * 3. Evaluates RuleEngineService scorecard for vertical-specific rules
 * 4. Reports blocking failures that would prevent publication
 *
 * H-AUDIT-02: Fetches HTML from Redis in batches to minimize memory usage.
 */
async function runTier5ChecksPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  allPages: StepPageResult[],
  htmlByPageId: Map<string, string>,
  origin: string,
): Promise<Tier5PhaseResult> {
  return step.do("run-tier5-checks", async () => {
    let pagesEvaluated = 0;
    let pagesPassed = 0;
    let pagesBlocked = 0;
    let classificationCacheHits = 0;

    // Initialize services
    let verticalClassifier: ReturnType<typeof getVerticalClassifierService> | null = null;
    let qualityGateService: ReturnType<typeof getQualityGateService> | null = null;

    try {
      verticalClassifier = getVerticalClassifierService();
    } catch (error) {
      // XAI_API_KEY not configured - skip Tier 5 checks
      log.info("Tier 5 checks skipped: VerticalClassifier not configured", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { pagesEvaluated: 0, pagesPassed: 0, pagesBlocked: 0, classificationCacheHits: 0 };
    }

    try {
      qualityGateService = getQualityGateService();
    } catch (error) {
      log.info("Tier 5 quality gate skipped: QualityGateService not configured", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Extract domain from origin for classification caching
    const domain = new URL(origin).hostname;
    // Use auditId as clientId for classification caching (audit-scoped)
    const clientId = auditId;

    // H-AUDIT-02: Process pages in batches to limit memory usage
    const BATCH_SIZE = 25; // Smaller batches for Tier 5 (LLM calls)
    for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
      const batch = allPages.slice(i, i + BATCH_SIZE);
      const pageIds = batch.map((p) => p.id);

      // H-AUDIT-02: Fetch HTML from Redis for this batch
      const htmlMap = new Map<string, string | null>();
      const idsToFetch: string[] = [];

      for (const pageId of pageIds) {
        const inMemoryHtml = htmlByPageId.get(pageId);
        if (inMemoryHtml) {
          htmlMap.set(pageId, inMemoryHtml);
        } else {
          idsToFetch.push(pageId);
        }
      }

      if (idsToFetch.length > 0) {
        const redisHtml = await HtmlTempStorage.getPageHtmlBatch(auditId, idsToFetch);
        for (const [pageId, html] of redisHtml) {
          htmlMap.set(pageId, html);
        }
      }

      // Run Tier 5 checks for each page in batch
      for (const page of batch) {
        const html = htmlMap.get(page.id);

        // Skip pages without HTML
        if (!html || page.statusCode !== 200) {
          continue;
        }

        try {
          // 1. Classify the page vertical
          const path = new URL(page.url).pathname;
          const classification: Classification = await verticalClassifier.classify(
            domain,
            path,
            html,
            clientId,
          );

          // Track cache hits (method !== 'llm' means heuristic or cache hit)
          if (classification.method !== "llm") {
            classificationCacheHits++;
          }

          log.debug("Page classified for Tier 5 checks", {
            pageId: page.id,
            url: page.url,
            vertical: classification.vertical,
            isYmyl: classification.isYmyl,
            confidence: classification.confidence,
            method: classification.method,
          });

          // 2. Run Tier 5 checks with vertical context
          const results = await runTier5ChecksWithContext(html, page.url, {
            vertical: classification.vertical,
            clientId,
          });

          pagesEvaluated++;

          // 3. Check for blocking failures
          const blockingFailures = results.filter((r) => !r.passed && r.blocking);
          if (blockingFailures.length > 0) {
            pagesBlocked++;
            log.info("Page blocked by Tier 5 quality gate", {
              pageId: page.id,
              url: page.url,
              blockingChecks: blockingFailures.map((r) => r.checkId),
            });
          } else {
            pagesPassed++;
          }

          // 4. Persist findings to database
          if (results.length > 0) {
            await FindingsRepository.insertFindings(auditId, page.id, results);
          }
        } catch (error) {
          // Log but don't fail the audit - Tier 5 checks are opt-in
          log.warn("Tier 5 checks failed for page", {
            pageId: page.id,
            url: page.url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    log.info("Tier 5 checks phase complete", {
      auditId,
      pagesEvaluated,
      pagesPassed,
      pagesBlocked,
      classificationCacheHits,
    });

    return {
      pagesEvaluated,
      pagesPassed,
      pagesBlocked,
      classificationCacheHits,
    };
  });
}

type LighthousePhaseParams = {
  auditId: string;
  workflowInstanceId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
  allPages: StepPageResult[];
};

async function runLighthousePhase(
  step: WorkflowStep,
  params: LighthousePhaseParams,
): Promise<LighthouseResult[]> {
  const {
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    startUrl,
    config,
    allPages,
  } = params;
  if (config.lighthouseStrategy === "none") return [];

  const lighthouseWork = await selectLighthousePages({
    step,
    auditId,
    workflowInstanceId,
    allPages,
    startUrl,
    strategy: config.lighthouseStrategy,
  });

  const lighthouseResults: LighthouseResult[] = [];
  let completedChecks = 0;
  let failedChecks = 0;
  let lighthouseBatchIndex = 0;

  for (let i = 0; i < lighthouseWork.length; i += LIGHTHOUSE_URL_BATCH_SIZE) {
    const batch = lighthouseWork.slice(i, i + LIGHTHOUSE_URL_BATCH_SIZE);
    lighthouseBatchIndex += 1;
    const lighthouseBatchResults = await runLighthouseBatch({
      step,
      lighthouseBatchIndex,
      batch,
      billingCustomer,
      projectId,
      auditId,
    });

    lighthouseResults.push(...lighthouseBatchResults);
    const counts = countLighthouseBatchResults(lighthouseBatchResults);
    failedChecks += counts.failed;
    completedChecks += counts.completed;
    await step.do(
      `lighthouse-progress-batch-${lighthouseBatchIndex}`,
      async () => {
        await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
          lighthouseCompleted: completedChecks,
          lighthouseFailed: failedChecks,
        });
      },
    );
  }

  return lighthouseResults;
}

async function selectLighthousePages(params: {
  step: WorkflowStep;
  auditId: string;
  workflowInstanceId: string;
  allPages: StepPageResult[];
  startUrl: string;
  strategy: AuditConfig["lighthouseStrategy"];
}) {
  const { step, auditId, workflowInstanceId, allPages, startUrl, strategy } =
    params;
  return step.do("select-lighthouse-sample", async () => {
    const sample = selectLighthouseSample(allPages, startUrl, strategy);
    const selectedUrls = new Set(sample);

    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      currentPhase: "lighthouse",
      lighthouseTotal: sample.length * 2,
      lighthouseCompleted: 0,
      lighthouseFailed: 0,
    });
    return allPages.flatMap((page) =>
      selectedUrls.has(page.url) ? [{ url: page.url, pageId: page.id }] : [],
    );
  });
}

async function runLighthouseBatch(params: {
  step: WorkflowStep;
  lighthouseBatchIndex: number;
  batch: Array<{ url: string; pageId: string }>;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  auditId: string;
}) {
  const {
    step,
    lighthouseBatchIndex,
    batch,
    billingCustomer,
    projectId,
    auditId,
  } = params;
  return step.do(`lighthouse-batch-${lighthouseBatchIndex}`, async () => {
    const perUrlResults = await Promise.all(
      batch.map(async ({ url, pageId }) => {
        const [mobileResult, desktopResult] = await Promise.all([
          fetchAndStoreLighthouseResult({
            url,
            pageId,
            strategy: "mobile",
            billingCustomer,
            projectId,
            auditId,
          }),
          fetchAndStoreLighthouseResult({
            url,
            pageId,
            strategy: "desktop",
            billingCustomer,
            projectId,
            auditId,
          }),
        ]);
        return [mobileResult, desktopResult];
      }),
    );

    return perUrlResults.flat();
  });
}

async function finalizeAudit(args: {
  step: WorkflowStep;
  auditId: string;
  workflowInstanceId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  config: AuditConfig;
  allPages: StepPageResult[];
  lighthouseResults: LighthouseResult[];
}) {
  const {
    step,
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    config,
    allPages,
    lighthouseResults,
  } = args;

  await step.do("finalize", async () => {
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      currentPhase: "finalizing",
    });
    await AuditRepository.batchWriteResults(
      auditId,
      allPages,
      lighthouseResults,
    );
    await AuditRepository.completeAudit(auditId, workflowInstanceId, {
      pagesCrawled: allPages.length,
      pagesTotal: allPages.length,
    });
    await captureServerEvent({
      distinctId: billingCustomer.userId,
      event: "site_audit:complete",
      organizationId: billingCustomer.organizationId,
      properties: {
        project_id: projectId,
        status: "completed",
        pages_crawled: allPages.length,
        pages_total: allPages.length,
        run_lighthouse: config.lighthouseStrategy !== "none",
      },
    });
    await AuditProgressKV.clear(auditId);
    // H-AUDIT-02: Clean up HTML from Redis storage
    await HtmlTempStorage.clearAuditHtml(auditId);
  });
}

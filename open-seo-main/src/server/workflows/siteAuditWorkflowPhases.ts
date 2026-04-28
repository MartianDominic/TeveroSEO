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
import type {
  AuditConfig,
  LighthouseResult,
  StepPageResult,
} from "@/server/lib/audit/types";
import type { SiteContext } from "@/server/lib/audit/checks/types";
import { captureServerEvent } from "@/server/lib/posthog";
import { runCrawlPhase, type CrawlPhaseResult } from "@/server/workflows/siteAuditWorkflowCrawl";
import { runTier2Checks, runTier3Checks, runTier4Checks } from "@/server/lib/audit/checks/runner";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { createLogger } from "@/server/lib/logger";

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

    // Run Tier 2 checks for each crawled page
    // Tier 2 requires more computation but still no external APIs
    for (const page of allPages) {
      const html = htmlByPageId.get(page.id);

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
  });
}

/**
 * Run Tier 3 checks (API-based) after Lighthouse completes.
 * Tier 3 includes: CrUX Core Web Vitals, entity/NLP analysis,
 * backlink metrics, and engagement proxies (CTR, scroll depth, bounce rate).
 * These checks gracefully skip when API data is unavailable.
 */
async function runTier3ChecksPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  allPages: StepPageResult[],
  htmlByPageId: Map<string, string>,
): Promise<void> {
  return step.do("run-tier3-checks", async () => {
    // Tier 3 checks use external APIs (CrUX, GSC, GA4)
    // They gracefully skip when API credentials not configured
    for (const page of allPages) {
      const html = htmlByPageId.get(page.id);

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
  });
}

/**
 * Run Tier 4 checks (crawl-based) after Tier 3 completes.
 * Tier 4 includes: site architecture (click depth, orphan pages, hub-spoke),
 * and content differentiation (unique content ratio, scaled content detection).
 * Requires site-wide context from crawl data.
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

    // Tier 4 checks analyze site architecture and content uniqueness
    for (const page of allPages) {
      const html = htmlByPageId.get(page.id);

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
  });
}

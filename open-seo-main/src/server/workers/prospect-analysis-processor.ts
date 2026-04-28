/**
 * Sandboxed processor for prospect analysis jobs.
 *
 * Runs in a separate Node.js process via BullMQ sandboxed worker.
 * Calls DataForSEO APIs with rate limiting (100ms between calls).
 */
import type { Job } from "bullmq";
import { db } from "@/db/index";
import { eq } from "drizzle-orm";
import { prospects } from "@/db/prospect-schema";
import {
  fetchKeywordsForSiteRaw,
  fetchCompetitorsDomainRaw,
} from "@/server/lib/dataforseoProspect";
import { fetchDomainRankOverviewRaw } from "@/server/lib/dataforseo";
import {
  fetchDomainIntersectionRaw,
  enrichGapsWithAchievability,
} from "@/server/lib/dataforseoKeywordGap";
import {
  AnalysisService,
  LOCATION_CODES,
} from "@/server/features/prospects/services/AnalysisService";
import type { ProspectAnalysisJobData } from "@/server/queues/prospectAnalysisQueue";
import { createLogger } from "@/server/lib/logger";
import { scrapeProspectSite } from "@/server/lib/scraper/multiPageScraper";
import {
  extractBusinessInfo,
  type ScrapedContent,
} from "@/server/lib/scraper/businessExtractor";
import { OpportunityDiscoveryService } from "@/server/lib/opportunity/OpportunityDiscoveryService";
import { calculatePriorityScore } from "@/server/lib/priority/calculatePriorityScore";
import { PipelineService } from "@/server/features/prospects/services/PipelineService";

const log = createLogger({ module: "prospect-analysis-processor" });

// Rate limit delay between DataForSEO API calls (100ms)
const API_RATE_LIMIT_MS = 100;

// Limits per analysis type
const ANALYSIS_LIMITS = {
  quick_scan: { keywords: 50, competitors: 10 },
  deep_dive: { keywords: 200, competitors: 20 },
  opportunity_discovery: { keywords: 500, competitors: 30 },
} as const;

/**
 * Sleep helper for rate limiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a prospect analysis job.
 */
export default async function processProspectAnalysis(
  job: Job<ProspectAnalysisJobData>,
): Promise<void> {
  const { prospectId, analysisId, analysisType, targetRegion, targetLanguage } =
    job.data;

  log.info("Starting prospect analysis", {
    jobId: job.id,
    prospectId,
    analysisId,
    analysisType,
  });

  try {
    // Mark analysis as running
    await AnalysisService.markRunning(analysisId);

    // Get prospect domain
    const [prospect] = await db
      .select({ domain: prospects.domain })
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new Error(`Prospect not found: ${prospectId}`);
    }

    const domain = prospect.domain;
    const locationCode = LOCATION_CODES[targetRegion ?? "US"] ?? 2840;
    const languageCode = targetLanguage ?? "en";
    const limits = ANALYSIS_LIMITS[analysisType];

    let totalCostCents = 0;

    // Step 1: Fetch domain rank overview
    log.info("Fetching domain rank overview", { domain });
    const domainOverview = await fetchDomainRankOverviewRaw(
      domain,
      locationCode,
      languageCode,
    );
    totalCostCents += Math.round(domainOverview.billing.costUsd * 100);
    await sleep(API_RATE_LIMIT_MS);

    // Extract domain metrics from the overview
    const overviewItem = domainOverview.data[0];
    const domainMetrics = overviewItem
      ? {
          domainRank: undefined, // Not directly available in this endpoint
          organicTraffic: overviewItem.metrics?.organic?.etv ?? undefined,
          organicKeywords: overviewItem.metrics?.organic?.count ?? undefined,
          backlinks: undefined, // Would need separate backlinks API call
          referringDomains: undefined,
        }
      : undefined;

    // Step 2: Fetch keywords the domain ranks for
    log.info("Fetching keywords for site", { domain, limit: limits.keywords });
    const keywordsResult = await fetchKeywordsForSiteRaw({
      target: domain,
      locationCode,
      languageCode,
      limit: limits.keywords,
    });
    totalCostCents += Math.round(keywordsResult.billing.costUsd * 100);
    await sleep(API_RATE_LIMIT_MS);

    const organicKeywords = keywordsResult.data.map((item) => ({
      keyword: item.keyword,
      position: item.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
      searchVolume: item.keyword_info?.search_volume ?? 0,
      cpc: item.keyword_info?.cpc ?? undefined,
      url: item.ranked_serp_element?.serp_item?.url ?? undefined,
    }));

    // Step 3: Fetch competitor domains
    log.info("Fetching competitor domains", { domain, limit: limits.competitors });
    const competitorsResult = await fetchCompetitorsDomainRaw({
      target: domain,
      locationCode,
      languageCode,
      limit: limits.competitors,
    });
    totalCostCents += Math.round(competitorsResult.billing.costUsd * 100);

    const competitorDomains = competitorsResult.data.map((item) => item.domain);

    // Step 4: Fetch keyword gaps from top competitor (if available)
    let keywordGaps: Awaited<ReturnType<typeof fetchDomainIntersectionRaw>>["data"] = [];
    if (competitorDomains.length > 0) {
      log.info("Fetching keyword gaps", { domain, competitor: competitorDomains[0] });
      await sleep(API_RATE_LIMIT_MS);

      const gapsResult = await fetchDomainIntersectionRaw({
        target1: competitorDomains[0], // Competitor has keywords
        target2: domain, // Prospect is missing them
        locationCode,
        languageCode,
        limit: limits.keywords,
      });
      totalCostCents += Math.round(gapsResult.billing.costUsd * 100);

      // Get DA from domain metrics and enrich gaps with achievability
      const domainAuthority = domainMetrics?.domainRank ?? 0;
      keywordGaps = enrichGapsWithAchievability(gapsResult.data, domainAuthority);

      log.info("Keyword gaps enriched with achievability", {
        domain,
        gapCount: keywordGaps.length,
        domainAuthority,
      });
    }

    // Step 5: Website scraping and business info extraction
    let scrapedContent: ScrapedContent | undefined;
    try {
      log.info("Scraping prospect website", { domain });
      const multiPageResult = await scrapeProspectSite(domain);

      // Combine homepage and additional pages into single array
      const allPages = [multiPageResult.homepage, ...multiPageResult.additionalPages];

      if (allPages.length > 0) {
        log.info("Extracting business information", { domain, pageCount: allPages.length });
        const businessInfo = await extractBusinessInfo(allPages, domain);

        scrapedContent = {
          pages: allPages,
          businessLinks: multiPageResult.businessLinks,
          businessInfo,
          totalCostCents: multiPageResult.totalCostCents,
          scrapedAt: new Date().toISOString(),
        };

        totalCostCents += multiPageResult.totalCostCents;

        log.info("Business info extracted successfully", {
          domain,
          productsCount: businessInfo.products.length,
          brandsCount: businessInfo.brands.length,
          servicesCount: businessInfo.services.length,
          confidence: businessInfo.confidence,
        });
      }
    } catch (error) {
      log.warn("Website scraping failed, continuing without scraped data", {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without scraped content - it's not critical for the analysis
    }

    // Step 6: AI Opportunity Discovery (if we have business info)
    let opportunityKeywords: Awaited<
      ReturnType<typeof OpportunityDiscoveryService.discoverOpportunities>
    >["keywords"] = [];
    if (scrapedContent?.businessInfo) {
      try {
        log.info("Running AI opportunity discovery", { domain });
        const discoveryResult = await OpportunityDiscoveryService.discoverOpportunities({
          businessInfo: scrapedContent.businessInfo,
          locationCode,
          languageCode,
        });
        opportunityKeywords = discoveryResult.keywords;
        totalCostCents += Math.round(discoveryResult.costUsd * 100);

        log.info("Opportunity discovery completed", {
          domain,
          keywordsDiscovered: opportunityKeywords.length,
          totalVolume: discoveryResult.summary.totalVolume,
          avgScore: discoveryResult.summary.avgOpportunityScore,
        });
      } catch (error) {
        log.warn("Opportunity discovery failed, continuing without AI keywords", {
          domain,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue without opportunity keywords - not critical for analysis
      }
    }

    // Update analysis with results
    await AnalysisService.updateAnalysisResult(analysisId, {
      domainMetrics,
      organicKeywords,
      competitorDomains,
      competitorKeywords: [], // Legacy field, gaps now in keywordGaps
      keywordGaps, // Enriched with achievability scores
      scrapedContent,
      opportunityKeywords, // AI-discovered opportunities (Phase 29)
      costCents: totalCostCents,
    });

    // Step 7: Calculate and store priority score (Phase 30.5-03)
    const priorityScore = calculatePriorityScore({
      domainMetrics,
      keywordGaps,
      opportunityKeywords,
      analysisCompletedAt: new Date(),
    });

    if (priorityScore !== null) {
      await db
        .update(prospects)
        .set({ priorityScore, updatedAt: new Date() })
        .where(eq(prospects.id, prospectId));

      log.info("Priority score calculated", {
        prospectId,
        priorityScore,
      });
    }

    // Phase 30.5-04: Auto-transition pipeline stage after analysis
    try {
      await PipelineService.handleAnalysisComplete(prospectId, priorityScore);
      log.info("Pipeline stage transition completed", {
        prospectId,
        priorityScore,
      });
    } catch (pipelineError) {
      // Don't fail the job if pipeline transition fails
      log.warn("Pipeline stage transition failed", {
        prospectId,
        error:
          pipelineError instanceof Error
            ? pipelineError.message
            : String(pipelineError),
      });
    }

    log.info("Prospect analysis completed", {
      jobId: job.id,
      prospectId,
      analysisId,
      keywordCount: organicKeywords.length,
      competitorCount: competitorDomains.length,
      totalCostCents,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    log.error(
      "Prospect analysis failed",
      error instanceof Error ? error : new Error(errorMessage),
      {
        jobId: job.id,
        prospectId,
        analysisId,
      },
    );

    await AnalysisService.markFailed(analysisId, errorMessage);

    // Re-throw to let BullMQ handle retries
    throw error;
  }
}

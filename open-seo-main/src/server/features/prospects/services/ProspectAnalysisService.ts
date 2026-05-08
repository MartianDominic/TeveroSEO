/**
 * Prospect Analysis Service - Keyword Gap Analysis
 * Phase 28: Keyword Gap Analysis - Task 28-02
 *
 * Orchestrates competitor discovery and domain intersection analysis
 * to identify keyword gaps - keywords where competitors rank but
 * the target domain doesn't.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import {
  prospects,
  prospectAnalyses,
  type KeywordGap,
} from "@/db/prospect-schema";
import { createDataforseoClient } from "@/server/lib/dataforseoClient";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { LOCATION_CODES } from "./AnalysisService";

const log = createLogger({ module: "ProspectAnalysisService" });

// Minimum keyword intersections for a competitor to be considered relevant
const MIN_INTERSECTIONS = 10;

// Default location code (US)
const DEFAULT_LOCATION_CODE = 2840;

export interface CompetitorDiscoveryResult {
  competitors: Array<{
    domain: string;
    avgPosition: number;
    intersections: number;
    relevance: number;
  }>;
  totalFound: number;
}

export interface KeywordGapAnalysisResult {
  gaps: KeywordGap[];
  totalGaps: number;
}

export interface GapAnalysisSummary {
  totalGaps: number;
  competitorsAnalyzed: number;
  avgOpportunityScore: number;
  topGaps: KeywordGap[];
}

export const ProspectAnalysisService = {
  /**
   * Discover competitors for a prospect.
   * Calls DataForSEO competitors_domain endpoint and filters by relevance.
   *
   * @param workspaceId - Workspace ID for authorization
   * @param prospectId - Prospect to analyze
   * @param customer - Billing context for DataForSEO API
   * @param limit - Maximum number of competitors to return (default 3)
   * @returns Filtered and sorted competitors
   */
  async discoverCompetitors(
    workspaceId: string,
    prospectId: string,
    customer: BillingCustomerContext,
    limit = 3,
  ): Promise<CompetitorDiscoveryResult> {
    // Get prospect and latest analysis
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${prospectId}`);
    }

    // Authorization: verify prospect belongs to workspace
    if (prospect.workspaceId !== workspaceId) {
      throw new AppError("FORBIDDEN", "Access denied to this prospect");
    }

    // Get latest analysis for target region/language
    const [analysis] = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.prospectId, prospectId))
      .limit(1);

    const targetRegion = analysis?.targetRegion ?? "US";
    const targetLanguage = analysis?.targetLanguage ?? "en";
    const locationCode = LOCATION_CODES[targetRegion] ?? DEFAULT_LOCATION_CODE;

    // Call DataForSEO competitors_domain
    const client = createDataforseoClient(customer);
    const rawCompetitors = await client.prospect.competitorsDomain({
      target: prospect.domain,
      locationCode,
      languageCode: targetLanguage,
      limit: 10, // Fetch more than needed for filtering
    });

    // Filter by intersection count (relevance)
    const filtered = rawCompetitors
      .filter((c) => (c.intersections ?? 0) >= MIN_INTERSECTIONS)
      .map((c) => ({
        domain: c.domain,
        avgPosition: c.avg_position ?? 0,
        intersections: c.intersections ?? 0,
        relevance: c.full_domain_metrics?.organic?.etv ?? 0,
      }))
      .sort((a, b) => b.intersections - a.intersections) // Sort by intersections desc
      .slice(0, limit); // Limit to requested count

    log.info("Competitors discovered", {
      prospectId,
      domain: prospect.domain,
      totalFound: rawCompetitors.length,
      afterFilter: filtered.length,
      limit,
    });

    return {
      competitors: filtered,
      totalFound: rawCompetitors.length,
    };
  },

  /**
   * Analyze keyword gaps between prospect and competitors.
   * Calls domain_intersection for each competitor and aggregates results.
   *
   * @param workspaceId - Workspace ID for authorization
   * @param analysisId - Analysis record to update
   * @param competitorDomains - Competitor domains to analyze
   * @param customer - Billing context for DataForSEO API
   * @param locationCode - Location code for analysis
   * @param languageCode - Language code for analysis
   * @returns Aggregated and deduplicated keyword gaps
   */
  async analyzeKeywordGaps(
    workspaceId: string,
    analysisId: string,
    competitorDomains: string[],
    customer: BillingCustomerContext,
    locationCode: number,
    languageCode: string,
  ): Promise<KeywordGapAnalysisResult> {
    // Verify analysis exists
    const [analysis] = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.id, analysisId))
      .limit(1);

    if (!analysis) {
      throw new AppError("NOT_FOUND", `Analysis not found: ${analysisId}`);
    }

    // Get prospect domain
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, analysis.prospectId))
      .limit(1);

    if (!prospect) {
      throw new AppError(
        "NOT_FOUND",
        `Prospect not found: ${analysis.prospectId}`,
      );
    }

    // Authorization: verify prospect belongs to workspace
    if (prospect.workspaceId !== workspaceId) {
      throw new AppError("FORBIDDEN", "Access denied to this prospect");
    }

    const client = createDataforseoClient(customer);
    const allGaps: KeywordGap[] = [];

    // Fetch gaps for all competitors in parallel using Promise.allSettled
    // This allows partial success - we collect results from successful calls
    // and log failures without stopping the entire analysis
    const intersectionPromises = competitorDomains.map((competitorDomain) =>
      client.prospect
        .domainIntersection({
          target1: competitorDomain, // Competitor has the keywords
          target2: prospect.domain, // Prospect is missing them
          locationCode,
          languageCode,
          limit: 100, // Limit per competitor
        })
        .then((gaps) => ({ competitorDomain, gaps, success: true as const }))
        .catch((error) => ({
          competitorDomain,
          error: error as Error,
          success: false as const,
        })),
    );

    const results = await Promise.all(intersectionPromises);

    // Process results and handle partial failures
    let successCount = 0;
    let failureCount = 0;

    for (const result of results) {
      if (result.success) {
        allGaps.push(...result.gaps);
        successCount++;
        log.info("Domain intersection completed", {
          analysisId,
          competitorDomain: result.competitorDomain,
          gapsFound: result.gaps.length,
        });
      } else {
        failureCount++;
        log.error("Domain intersection failed", result.error, {
          analysisId,
          competitorDomain: result.competitorDomain,
        });
      }
    }

    // If all competitors failed, throw an error
    if (successCount === 0 && competitorDomains.length > 0) {
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        `All domain intersection calls failed for analysis: ${analysisId}`,
      );
    }

    // Log summary if there were partial failures
    if (failureCount > 0) {
      log.warn("Some domain intersections failed", {
        analysisId,
        successCount,
        failureCount,
        totalCompetitors: competitorDomains.length,
      });
    }

    // Deduplicate by keyword (keep highest opportunity score)
    const gapsByKeyword = new Map<string, KeywordGap>();
    for (const gap of allGaps) {
      const existing = gapsByKeyword.get(gap.keyword);
      if (
        !existing ||
        gap.trafficPotential > existing.trafficPotential
      ) {
        gapsByKeyword.set(gap.keyword, gap);
      }
    }

    // Sort by opportunity score descending
    const deduplicatedGaps = Array.from(gapsByKeyword.values()).sort(
      (a, b) => b.trafficPotential - a.trafficPotential,
    );

    log.info("Keyword gaps aggregated", {
      analysisId,
      totalGaps: allGaps.length,
      afterDeduplication: deduplicatedGaps.length,
      competitorsAnalyzed: competitorDomains.length,
    });

    return {
      gaps: deduplicatedGaps,
      totalGaps: deduplicatedGaps.length,
    };
  },

  /**
   * Run full gap analysis workflow.
   * Step 1: Discover top 3 competitors
   * Step 2: Analyze keyword gaps for each
   * Step 3: Aggregate and score results
   * Step 4: Update analysis record
   *
   * @param workspaceId - Workspace ID for authorization
   * @param prospectId - Prospect to analyze
   * @param customer - Billing context for DataForSEO API
   * @returns Summary statistics
   */
  async runGapAnalysis(
    workspaceId: string,
    prospectId: string,
    customer: BillingCustomerContext,
  ): Promise<GapAnalysisSummary> {
    // Get prospect and latest analysis
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${prospectId}`);
    }

    // Authorization: verify prospect belongs to workspace
    if (prospect.workspaceId !== workspaceId) {
      throw new AppError("FORBIDDEN", "Access denied to this prospect");
    }

    const [analysis] = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.prospectId, prospectId))
      .limit(1);

    if (!analysis) {
      throw new AppError(
        "NOT_FOUND",
        `No analysis found for prospect: ${prospectId}`,
      );
    }

    const targetRegion = analysis.targetRegion ?? "US";
    const targetLanguage = analysis.targetLanguage ?? "en";
    const locationCode = LOCATION_CODES[targetRegion] ?? DEFAULT_LOCATION_CODE;

    log.info("Starting gap analysis workflow", {
      prospectId,
      analysisId: analysis.id,
      domain: prospect.domain,
      targetRegion,
    });

    // Step 1: Discover competitors (top 3)
    const { competitors } = await this.discoverCompetitors(
      workspaceId,
      prospectId,
      customer,
      3,
    );

    if (competitors.length === 0) {
      log.warn("No competitors found", { prospectId });
      return {
        totalGaps: 0,
        competitorsAnalyzed: 0,
        avgOpportunityScore: 0,
        topGaps: [],
      };
    }

    // Step 2 & 3: Analyze keyword gaps and aggregate
    const competitorDomains = competitors.map((c) => c.domain);
    const { gaps } = await this.analyzeKeywordGaps(
      workspaceId,
      analysis.id,
      competitorDomains,
      customer,
      locationCode,
      targetLanguage,
    );

    // Step 4: Update analysis record
    await db
      .update(prospectAnalyses)
      .set({
        competitorDomains,
        keywordGaps: gaps,
      })
      .where(eq(prospectAnalyses.id, analysis.id));

    // Calculate summary stats
    const avgOpportunityScore =
      gaps.length > 0
        ? Math.round(
            gaps.reduce((sum, g) => sum + g.trafficPotential, 0) / gaps.length,
          )
        : 0;

    const topGaps = gaps.slice(0, 10); // Top 10 opportunities

    log.info("Gap analysis workflow completed", {
      prospectId,
      analysisId: analysis.id,
      totalGaps: gaps.length,
      competitorsAnalyzed: competitors.length,
      avgOpportunityScore,
    });

    return {
      totalGaps: gaps.length,
      competitorsAnalyzed: competitors.length,
      avgOpportunityScore,
      topGaps,
    };
  },
};

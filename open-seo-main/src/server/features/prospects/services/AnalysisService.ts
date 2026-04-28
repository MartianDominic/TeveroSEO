/**
 * Analysis service for triggering and managing prospect analyses.
 * Phase 26: Prospect Data Model
 *
 * Enforces rate limiting (max 10 analyses/day per workspace).
 * Creates analysis records and submits BullMQ jobs.
 */
import { eq, and, count } from "drizzle-orm";
import { db } from "@/db/index";
import {
  prospects,
  prospectAnalyses,
  type ProspectAnalysisSelect,
  type DomainMetrics,
  type OrganicKeywordItem,
  type CompetitorKeywordItem,
  type KeywordGap,
  type ScrapedContent,
  type OpportunityKeyword,
} from "@/db/prospect-schema";
import {
  submitProspectAnalysis,
  getWorkspaceAnalysisCountToday,
  type ProspectAnalysisType,
} from "@/server/queues/prospectAnalysisQueue";
export type { ProspectAnalysisType } from "@/server/queues/prospectAnalysisQueue";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AnalysisService" });

// Rate limit: max 10 analyses per day per workspace
const MAX_ANALYSES_PER_DAY = 10;

// Location codes for common regions (DataForSEO location codes)
export const LOCATION_CODES: Record<string, number> = {
  US: 2840,
  UK: 2826,
  DE: 2276,
  FR: 2250,
  NL: 2528,
  AU: 2036,
  CA: 2124,
  FI: 2246,
  SE: 2752,
  NO: 2578,
  DK: 2208,
};

export interface TriggerAnalysisInput {
  prospectId: string;
  workspaceId: string;
  analysisType: ProspectAnalysisType;
  targetRegion?: string;
  targetLanguage?: string;
  triggeredBy: string;
}

export interface AnalysisResults {
  domainMetrics?: DomainMetrics;
  organicKeywords?: OrganicKeywordItem[];
  competitorDomains?: string[];
  competitorKeywords?: CompetitorKeywordItem[];
  keywordGaps?: KeywordGap[]; // Enriched with achievability scores (Phase 28-02)
  scrapedContent?: ScrapedContent;
  opportunityKeywords?: OpportunityKeyword[]; // AI-discovered opportunities (Phase 29)
  costCents: number;
}

export const AnalysisService = {
  /**
   * Trigger a new analysis for a prospect.
   * Creates the analysis record and submits the BullMQ job.
   *
   * @throws RATE_LIMITED if workspace has exceeded daily limit
   * @throws NOT_FOUND if prospect doesn't exist
   */
  async triggerAnalysis(input: TriggerAnalysisInput): Promise<{
    analysisId: string;
    jobId: string;
  }> {
    // Check rate limit
    const todayCount = await getWorkspaceAnalysisCountToday(input.workspaceId);
    if (todayCount >= MAX_ANALYSES_PER_DAY) {
      throw new AppError(
        "RATE_LIMITED",
        `Workspace has reached the daily analysis limit of ${MAX_ANALYSES_PER_DAY}. Try again tomorrow.`,
      );
    }

    // Verify prospect exists and belongs to workspace
    const [prospect] = await db
      .select({ id: prospects.id, domain: prospects.domain })
      .from(prospects)
      .where(
        and(
          eq(prospects.id, input.prospectId),
          eq(prospects.workspaceId, input.workspaceId),
        ),
      )
      .limit(1);

    if (!prospect) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${input.prospectId}`);
    }

    // Create analysis record
    const analysisId = nanoid();
    const now = new Date();

    await db.insert(prospectAnalyses).values({
      id: analysisId,
      prospectId: input.prospectId,
      analysisType: input.analysisType,
      status: "pending",
      targetRegion: input.targetRegion,
      targetLanguage: input.targetLanguage ?? "en",
      createdAt: now,
    });

    // Update prospect status to analyzing
    await db
      .update(prospects)
      .set({ status: "analyzing", updatedAt: now })
      .where(eq(prospects.id, input.prospectId));

    // Submit job to queue
    const jobId = await submitProspectAnalysis({
      prospectId: input.prospectId,
      workspaceId: input.workspaceId,
      analysisType: input.analysisType,
      analysisId,
      targetRegion: input.targetRegion,
      targetLanguage: input.targetLanguage ?? "en",
      triggeredAt: now.toISOString(),
      triggeredBy: input.triggeredBy,
    });

    log.info("Analysis triggered", {
      analysisId,
      jobId,
      prospectId: input.prospectId,
      domain: prospect.domain,
      analysisType: input.analysisType,
    });

    return { analysisId, jobId };
  },

  /**
   * Update analysis status to running.
   */
  async markRunning(analysisId: string): Promise<void> {
    await db
      .update(prospectAnalyses)
      .set({ status: "running" })
      .where(eq(prospectAnalyses.id, analysisId));
  },

  /**
   * Update analysis with results on completion.
   */
  async updateAnalysisResult(
    analysisId: string,
    results: AnalysisResults,
  ): Promise<void> {
    const now = new Date();

    await db
      .update(prospectAnalyses)
      .set({
        status: "completed",
        domainMetrics: results.domainMetrics,
        organicKeywords: results.organicKeywords,
        competitorDomains: results.competitorDomains,
        competitorKeywords: results.competitorKeywords,
        keywordGaps: results.keywordGaps,
        scrapedContent: results.scrapedContent,
        opportunityKeywords: results.opportunityKeywords,
        costCents: results.costCents,
        completedAt: now,
      })
      .where(eq(prospectAnalyses.id, analysisId));

    // Get prospect ID to update status
    const [analysis] = await db
      .select({ prospectId: prospectAnalyses.prospectId })
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.id, analysisId))
      .limit(1);

    if (analysis) {
      await db
        .update(prospects)
        .set({ status: "analyzed", updatedAt: now })
        .where(eq(prospects.id, analysis.prospectId));
    }

    log.info("Analysis completed", {
      analysisId,
      keywordCount: results.organicKeywords?.length ?? 0,
      competitorCount: results.competitorDomains?.length ?? 0,
      costCents: results.costCents,
    });
  },

  /**
   * Mark analysis as failed.
   */
  async markFailed(analysisId: string, error: string): Promise<void> {
    await db
      .update(prospectAnalyses)
      .set({ status: "failed" })
      .where(eq(prospectAnalyses.id, analysisId));

    // Get prospect ID to update status back to new (or analyzed if had previous analysis)
    const [analysis] = await db
      .select({ prospectId: prospectAnalyses.prospectId })
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.id, analysisId))
      .limit(1);

    if (analysis) {
      // Check if prospect has any completed analyses
      const [completedCount] = await db
        .select({ count: count() })
        .from(prospectAnalyses)
        .where(
          and(
            eq(prospectAnalyses.prospectId, analysis.prospectId),
            eq(prospectAnalyses.status, "completed"),
          ),
        );

      const newStatus = (completedCount?.count ?? 0) > 0 ? "analyzed" : "new";

      await db
        .update(prospects)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(prospects.id, analysis.prospectId));
    }

    log.error("Analysis failed", new Error(error), { analysisId });
  },

  /**
   * Get analysis by ID.
   */
  async findById(analysisId: string): Promise<ProspectAnalysisSelect | null> {
    const [analysis] = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.id, analysisId))
      .limit(1);

    return analysis ?? null;
  },

  /**
   * Get remaining analyses for workspace today.
   */
  async getRemainingAnalysesToday(workspaceId: string): Promise<number> {
    const used = await getWorkspaceAnalysisCountToday(workspaceId);
    return Math.max(0, MAX_ANALYSES_PER_DAY - used);
  },

  /**
   * Bulk queue analysis for multiple prospects.
   * Respects daily quota - queues up to remaining limit.
   *
   * @returns Count of queued and skipped prospects
   */
  async bulkQueueAnalysis(input: {
    prospectIds: string[];
    workspaceId: string;
    analysisType: ProspectAnalysisType;
    targetRegion?: string;
    targetLanguage?: string;
    triggeredBy: string;
  }): Promise<{
    queuedCount: number;
    skippedCount: number;
    queuedIds: string[];
    skippedIds: string[];
    remainingQuota: number;
  }> {
    // Check remaining quota
    const todayCount = await getWorkspaceAnalysisCountToday(input.workspaceId);
    const remainingQuota = Math.max(0, MAX_ANALYSES_PER_DAY - todayCount);

    if (remainingQuota === 0) {
      return {
        queuedCount: 0,
        skippedCount: input.prospectIds.length,
        queuedIds: [],
        skippedIds: input.prospectIds,
        remainingQuota: 0,
      };
    }

    // Verify prospects exist and belong to workspace
    const validProspects = await db
      .select({ id: prospects.id, domain: prospects.domain, status: prospects.status })
      .from(prospects)
      .where(
        and(
          eq(prospects.workspaceId, input.workspaceId),
        ),
      );

    const validProspectIds = new Set(validProspects.map((p) => p.id));
    const requestedIds = input.prospectIds.filter((id) => validProspectIds.has(id));

    // Filter out prospects already analyzing
    const analyzingIds = new Set(
      validProspects
        .filter((p) => p.status === "analyzing")
        .map((p) => p.id),
    );
    const eligibleIds = requestedIds.filter((id) => !analyzingIds.has(id));

    // Queue up to remaining quota
    const toQueue = eligibleIds.slice(0, remainingQuota);
    const skipped = eligibleIds.slice(remainingQuota);

    // Also add invalid/analyzing IDs to skipped
    const invalidIds = input.prospectIds.filter((id) => !validProspectIds.has(id));
    const analyzingRequestedIds = requestedIds.filter((id) => analyzingIds.has(id));

    const queuedIds: string[] = [];

    for (const prospectId of toQueue) {
      try {
        const { analysisId } = await this.triggerAnalysis({
          prospectId,
          workspaceId: input.workspaceId,
          analysisType: input.analysisType,
          targetRegion: input.targetRegion,
          targetLanguage: input.targetLanguage,
          triggeredBy: input.triggeredBy,
        });
        queuedIds.push(prospectId);
        log.info("Bulk queued analysis", { prospectId, analysisId });
      } catch (error) {
        log.warn("Failed to queue analysis in bulk", { prospectId, error });
        skipped.push(prospectId);
      }
    }

    const allSkipped = [...skipped, ...invalidIds, ...analyzingRequestedIds];
    const newRemainingQuota = Math.max(0, remainingQuota - queuedIds.length);

    log.info("Bulk analysis queuing complete", {
      requested: input.prospectIds.length,
      queued: queuedIds.length,
      skipped: allSkipped.length,
      remainingQuota: newRemainingQuota,
    });

    return {
      queuedCount: queuedIds.length,
      skippedCount: allSkipped.length,
      queuedIds,
      skippedIds: allSkipped,
      remainingQuota: newRemainingQuota,
    };
  },
};

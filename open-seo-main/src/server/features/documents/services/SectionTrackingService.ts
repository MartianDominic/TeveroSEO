/**
 * Section Tracking Service
 * Phase 101: Document Management (D-04)
 *
 * Provides section-level engagement tracking for proposals and documents.
 * Aggregates time spent per section for heatmap visualization (PandaDoc-style).
 */
import { db } from "@/db";
import { documentSectionViews } from "@/db/document-tracking-schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "SectionTrackingService" });

// ============================================================================
// Types
// ============================================================================

export interface SectionViewInput {
  proposalId: string;
  viewId: string;
  sectionId: string;
  sectionName: string;
  timeSpentMs: number;
  scrollDepth?: number;
  enteredAt: Date;
  exitedAt?: Date;
}

export interface HeatmapData {
  sectionId: string;
  sectionName: string;
  totalTimeMs: number;
  avgTimeMs: number;
  viewCount: number;
  avgScrollDepth: number | null;
}

// ============================================================================
// Service Implementation
// ============================================================================

export const SectionTrackingService = {
  /**
   * Record a section view event.
   */
  async recordSectionView(input: SectionViewInput): Promise<void> {
    await db.insert(documentSectionViews).values({
      id: nanoid(),
      proposalId: input.proposalId,
      viewId: input.viewId,
      sectionId: input.sectionId,
      sectionName: input.sectionName,
      timeSpentMs: input.timeSpentMs,
      scrollDepth: input.scrollDepth,
      enteredAt: input.enteredAt,
      exitedAt: input.exitedAt,
    });

    log.debug("Recorded section view", {
      proposalId: input.proposalId,
      sectionId: input.sectionId,
      timeSpentMs: input.timeSpentMs,
    });
  },

  /**
   * Record multiple section views in batch (from client beacon).
   */
  async recordSectionViewsBatch(views: SectionViewInput[]): Promise<void> {
    if (views.length === 0) return;

    await db.insert(documentSectionViews).values(
      views.map((v) => ({
        id: nanoid(),
        proposalId: v.proposalId,
        viewId: v.viewId,
        sectionId: v.sectionId,
        sectionName: v.sectionName,
        timeSpentMs: v.timeSpentMs,
        scrollDepth: v.scrollDepth,
        enteredAt: v.enteredAt,
        exitedAt: v.exitedAt,
      }))
    );

    log.debug("Recorded batch section views", {
      count: views.length,
      proposalId: views[0].proposalId,
    });
  },

  /**
   * Get aggregated heatmap data for a proposal.
   * Used for PandaDoc-style section engagement visualization.
   */
  async getHeatmapData(proposalId: string): Promise<HeatmapData[]> {
    const result = await db
      .select({
        sectionId: documentSectionViews.sectionId,
        sectionName: documentSectionViews.sectionName,
        totalTimeMs: sql<number>`SUM(${documentSectionViews.timeSpentMs})`,
        avgTimeMs: sql<number>`AVG(${documentSectionViews.timeSpentMs})`,
        viewCount: sql<number>`COUNT(*)`,
        avgScrollDepth: sql<number | null>`AVG(${documentSectionViews.scrollDepth})`,
      })
      .from(documentSectionViews)
      .where(eq(documentSectionViews.proposalId, proposalId))
      .groupBy(documentSectionViews.sectionId, documentSectionViews.sectionName)
      .orderBy(sql`SUM(${documentSectionViews.timeSpentMs}) DESC`);

    return result.map((row) => ({
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      totalTimeMs: Number(row.totalTimeMs),
      avgTimeMs: Number(row.avgTimeMs),
      viewCount: Number(row.viewCount),
      avgScrollDepth: row.avgScrollDepth ? Number(row.avgScrollDepth) : null,
    }));
  },

  /**
   * Get section-level timeline for a specific view.
   */
  async getViewTimeline(
    viewId: string
  ): Promise<
    Array<{
      sectionId: string;
      sectionName: string;
      timeSpentMs: number;
      enteredAt: Date;
      exitedAt: Date | null;
    }>
  > {
    const result = await db
      .select({
        sectionId: documentSectionViews.sectionId,
        sectionName: documentSectionViews.sectionName,
        timeSpentMs: documentSectionViews.timeSpentMs,
        enteredAt: documentSectionViews.enteredAt,
        exitedAt: documentSectionViews.exitedAt,
      })
      .from(documentSectionViews)
      .where(eq(documentSectionViews.viewId, viewId))
      .orderBy(documentSectionViews.enteredAt);

    return result;
  },

  /**
   * Get total engagement time for a proposal.
   */
  async getTotalEngagementTime(proposalId: string): Promise<number> {
    const [result] = await db
      .select({
        totalMs: sql<number>`COALESCE(SUM(${documentSectionViews.timeSpentMs}), 0)`,
      })
      .from(documentSectionViews)
      .where(eq(documentSectionViews.proposalId, proposalId));

    return Number(result?.totalMs ?? 0);
  },

  /**
   * Get most viewed sections across all proposals in a workspace.
   * Useful for content optimization insights.
   */
  async getMostViewedSections(
    proposalIds: string[],
    limit: number = 10
  ): Promise<
    Array<{
      sectionId: string;
      sectionName: string;
      totalTimeMs: number;
      proposalCount: number;
    }>
  > {
    if (proposalIds.length === 0) return [];

    const result = await db
      .select({
        sectionId: documentSectionViews.sectionId,
        sectionName: documentSectionViews.sectionName,
        totalTimeMs: sql<number>`SUM(${documentSectionViews.timeSpentMs})`,
        proposalCount: sql<number>`COUNT(DISTINCT ${documentSectionViews.proposalId})`,
      })
      .from(documentSectionViews)
      .where(
        sql`${documentSectionViews.proposalId} IN (${sql.join(
          proposalIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .groupBy(documentSectionViews.sectionId, documentSectionViews.sectionName)
      .orderBy(sql`SUM(${documentSectionViews.timeSpentMs}) DESC`)
      .limit(limit);

    return result.map((row) => ({
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      totalTimeMs: Number(row.totalTimeMs),
      proposalCount: Number(row.proposalCount),
    }));
  },
};

/**
 * ResearchSessionService
 * Phase 93-01: Keyword Coverage Intelligence
 *
 * Manages research session tracking for:
 * - Audit trail of research operations
 * - Coverage dashboard data
 * - Cost attribution and deduplication metrics
 *
 * Append-only pattern: NO updates, always INSERT
 */

import { db } from "@/db";
import {
  researchSessions,
  type ResearchSessionInsert,
  type ResearchMode,
  type SessionMetadata,
} from "@/db/research-session-schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface RecordSessionParams {
  prospectId: string;
  mode: ResearchMode;
  seedKeywords: string[];
  locationCode: number;
  languageCode: string;
  newKeywordsCount: number;
  duplicateCount: number;
  totalCostUsd: number;
  triggeredBy: string;
  metadata?: SessionMetadata;
}

export class ResearchSessionService {
  /**
   * Record a research session (append-only).
   * Per 93-RESEARCH.md: NO updates, always INSERT for audit trail.
   */
  async recordSession(params: RecordSessionParams): Promise<string> {
    const id = nanoid();

    const sessionData: ResearchSessionInsert = {
      id,
      prospectId: params.prospectId,
      mode: params.mode,
      seedKeywords: params.seedKeywords,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      newKeywordsCount: params.newKeywordsCount,
      duplicateCount: params.duplicateCount,
      totalCostUsd: params.totalCostUsd,
      triggeredBy: params.triggeredBy,
      metadata: params.metadata,
    };

    await db.insert(researchSessions).values(sessionData);
    return id;
  }

  /**
   * Get last research date for a prospect.
   * Used by coverage dashboard to show "last researched" timestamp.
   */
  async getLastResearchDate(prospectId: string): Promise<Date | null> {
    const result = await db
      .select({ createdAt: researchSessions.createdAt })
      .from(researchSessions)
      .where(eq(researchSessions.prospectId, prospectId))
      .orderBy(desc(researchSessions.createdAt))
      .limit(1);

    return result[0]?.createdAt || null;
  }

  /**
   * Get all sessions for a prospect.
   * Returns sessions ordered by date descending (newest first).
   * Enforces tenant isolation via prospectId filter.
   */
  async getSessionsByProspect(prospectId: string) {
    return db
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.prospectId, prospectId))
      .orderBy(desc(researchSessions.createdAt));
  }
}

export const researchSessionService = new ResearchSessionService();

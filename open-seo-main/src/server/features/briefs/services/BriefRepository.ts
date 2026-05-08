/**
 * Repository for content brief CRUD operations.
 * Phase 36: Content Brief Generation
 */

import { db } from "@/db";
import { contentBriefs } from "@/db/brief-schema";
import { keywordPageMapping } from "@/db/mapping-schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  ContentBriefInsert,
  ContentBriefSelect,
  BriefStatus,
} from "@/db/brief-schema";

export type CreateBriefInput = Omit<ContentBriefInsert, "id" | "createdAt" | "updatedAt">;

export class BriefRepository {
  /**
   * Create a new content brief with generated ID.
   */
  async create(input: CreateBriefInput): Promise<ContentBriefSelect> {
    const id = nanoid();
    const now = new Date();

    const [brief] = await db
      .insert(contentBriefs)
      .values({
        id,
        ...input,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return brief;
  }

  /**
   * Find a brief by ID.
   */
  async findById(id: string): Promise<ContentBriefSelect | null> {
    const [brief] = await db
      .select()
      .from(contentBriefs)
      .where(eq(contentBriefs.id, id));

    return brief ?? null;
  }

  /**
   * Find all briefs for a project (via keyword mapping join).
   */
  async findByProjectId(projectId: string): Promise<ContentBriefSelect[]> {
    const briefs = await db
      .select({
        id: contentBriefs.id,
        mappingId: contentBriefs.mappingId,
        keyword: contentBriefs.keyword,
        targetWordCount: contentBriefs.targetWordCount,
        voiceMode: contentBriefs.voiceMode,
        status: contentBriefs.status,
        serpAnalysis: contentBriefs.serpAnalysis,
        articleId: contentBriefs.articleId,
        isDeleted: contentBriefs.isDeleted,
        deletedAt: contentBriefs.deletedAt,
        createdAt: contentBriefs.createdAt,
        updatedAt: contentBriefs.updatedAt,
        // P2.G16: Include scraping cost for cost attribution
        scrapingCostUsd: contentBriefs.scrapingCostUsd,
      })
      .from(contentBriefs)
      .innerJoin(
        keywordPageMapping,
        eq(contentBriefs.mappingId, keywordPageMapping.id)
      )
      .where(eq(keywordPageMapping.projectId, projectId));

    return briefs;
  }

  /**
   * Find brief by keyword mapping ID.
   */
  async findByMappingId(mappingId: string): Promise<ContentBriefSelect | null> {
    const [brief] = await db
      .select()
      .from(contentBriefs)
      .where(eq(contentBriefs.mappingId, mappingId));

    return brief ?? null;
  }

  /**
   * Update brief status.
   */
  async updateStatus(
    id: string,
    status: BriefStatus
  ): Promise<ContentBriefSelect | null> {
    const [brief] = await db
      .update(contentBriefs)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(contentBriefs.id, id))
      .returning();

    return brief ?? null;
  }

  /**
   * Link brief to generated article.
   */
  async updateArticleId(
    id: string,
    articleId: string
  ): Promise<ContentBriefSelect | null> {
    const [brief] = await db
      .update(contentBriefs)
      .set({
        articleId,
        updatedAt: new Date(),
      })
      .where(eq(contentBriefs.id, id))
      .returning();

    return brief ?? null;
  }

  /**
   * Delete a brief by ID.
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(contentBriefs)
      .where(eq(contentBriefs.id, id));

    return (result.rowCount ?? 0) > 0;
  }
}

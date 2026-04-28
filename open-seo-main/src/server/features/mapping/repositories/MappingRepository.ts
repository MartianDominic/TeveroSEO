/**
 * Data access layer for keyword_page_mapping table.
 * Handles CRUD operations and bulk upserts for mapping data.
 */
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  keywordPageMapping,
  type KeywordPageMappingInsert,
  type KeywordPageMappingSelect,
} from "@/db/schema";

/**
 * Upsert a single mapping (insert or update on conflict).
 */
async function upsertMapping(mapping: KeywordPageMappingInsert): Promise<void> {
  await db
    .insert(keywordPageMapping)
    .values(mapping)
    .onConflictDoUpdate({
      target: [keywordPageMapping.projectId, keywordPageMapping.keyword],
      set: {
        targetUrl: mapping.targetUrl,
        action: mapping.action,
        relevanceScore: mapping.relevanceScore,
        reason: mapping.reason,
        searchVolume: mapping.searchVolume,
        difficulty: mapping.difficulty,
        currentPosition: mapping.currentPosition,
        currentUrl: mapping.currentUrl,
        isManualOverride: mapping.isManualOverride ?? false,
        updatedAt: new Date(),
      },
    });
}

/**
 * Bulk upsert mappings (efficient for suggest-all operations).
 */
async function bulkUpsertMappings(
  mappings: KeywordPageMappingInsert[],
): Promise<void> {
  if (mappings.length === 0) return;

  // Process in batches of 100 to avoid statement size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(upsertMapping));
  }
}

/**
 * Get all mappings for a project.
 */
async function getMappingsByProject(
  projectId: string,
  opts?: { action?: string },
): Promise<KeywordPageMappingSelect[]> {
  const conditions = [eq(keywordPageMapping.projectId, projectId)];

  if (opts?.action) {
    conditions.push(eq(keywordPageMapping.action, opts.action));
  }

  return db
    .select()
    .from(keywordPageMapping)
    .where(and(...conditions))
    .orderBy(desc(keywordPageMapping.updatedAt));
}

/**
 * Get a single mapping by project and keyword.
 */
async function getMappingByKeyword(
  projectId: string,
  keyword: string,
): Promise<KeywordPageMappingSelect | undefined> {
  return db.query.keywordPageMapping.findFirst({
    where: and(
      eq(keywordPageMapping.projectId, projectId),
      eq(keywordPageMapping.keyword, keyword),
    ),
  });
}

/**
 * Get mappings by target URL (find all keywords mapped to a page).
 */
async function getMappingsByTargetUrl(
  projectId: string,
  targetUrl: string,
): Promise<KeywordPageMappingSelect[]> {
  return db
    .select()
    .from(keywordPageMapping)
    .where(
      and(
        eq(keywordPageMapping.projectId, projectId),
        eq(keywordPageMapping.targetUrl, targetUrl),
      ),
    );
}

/**
 * Update a mapping's target URL (manual override).
 */
async function updateMappingTarget(
  projectId: string,
  keyword: string,
  newTargetUrl: string | null,
  newAction: "optimize" | "create",
): Promise<void> {
  await db
    .update(keywordPageMapping)
    .set({
      targetUrl: newTargetUrl,
      action: newAction,
      isManualOverride: true,
      reason: "Manual override",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(keywordPageMapping.projectId, projectId),
        eq(keywordPageMapping.keyword, keyword),
      ),
    );
}

/**
 * Delete a mapping.
 */
async function deleteMapping(
  projectId: string,
  keyword: string,
): Promise<void> {
  await db
    .delete(keywordPageMapping)
    .where(
      and(
        eq(keywordPageMapping.projectId, projectId),
        eq(keywordPageMapping.keyword, keyword),
      ),
    );
}

/**
 * Delete all mappings for a project (for re-mapping).
 */
async function deleteAllMappings(projectId: string): Promise<void> {
  await db
    .delete(keywordPageMapping)
    .where(eq(keywordPageMapping.projectId, projectId));
}

/**
 * Count mappings by action type.
 */
async function countMappingsByAction(projectId: string): Promise<{
  optimize: number;
  create: number;
  total: number;
}> {
  const rows = await db
    .select()
    .from(keywordPageMapping)
    .where(eq(keywordPageMapping.projectId, projectId));

  const optimize = rows.filter((r) => r.action === "optimize").length;
  const create = rows.filter((r) => r.action === "create").length;

  return { optimize, create, total: rows.length };
}

export const MappingRepository = {
  upsertMapping,
  bulkUpsertMappings,
  getMappingsByProject,
  getMappingByKeyword,
  getMappingsByTargetUrl,
  updateMappingTarget,
  deleteMapping,
  deleteAllMappings,
  countMappingsByAction,
} as const;

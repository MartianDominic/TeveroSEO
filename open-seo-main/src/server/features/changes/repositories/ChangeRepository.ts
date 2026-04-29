/**
 * Change Repository
 * Phase 33: Auto-Fix System
 *
 * CRUD operations for site_changes table.
 */
import { eq, and, inArray, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { siteChanges, type SiteChangeInsert, type SiteChangeSelect } from '@/db/change-schema';

/**
 * Insert a new change record.
 */
export async function insertChange(change: SiteChangeInsert): Promise<SiteChangeSelect> {
  const [inserted] = await db.insert(siteChanges).values(change).returning();
  return inserted;
}

/**
 * Insert multiple changes in a batch.
 */
export async function insertChanges(changes: SiteChangeInsert[]): Promise<SiteChangeSelect[]> {
  if (changes.length === 0) return [];
  return await db.insert(siteChanges).values(changes).returning();
}

/**
 * Get a change by ID (excludes soft-deleted by default).
 */
export async function getChangeById(
  changeId: string,
  includeDeleted = false
): Promise<SiteChangeSelect | undefined> {
  const conditions = [eq(siteChanges.id, changeId)];
  if (!includeDeleted) {
    conditions.push(eq(siteChanges.isDeleted, false));
  }
  const [change] = await db
    .select()
    .from(siteChanges)
    .where(and(...conditions))
    .limit(1);
  return change;
}

/**
 * Get changes for a client with filters.
 * All filters are applied at the database level to avoid in-memory filtering.
 * Excludes soft-deleted records by default.
 */
export async function getChangesByClient(
  clientId: string,
  options?: {
    status?: string;
    category?: string;
    resourceType?: string;
    triggeredBy?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }
): Promise<SiteChangeSelect[]> {
  const conditions = [eq(siteChanges.clientId, clientId)];

  // Filter out soft-deleted records unless explicitly requested
  if (!options?.includeDeleted) {
    conditions.push(eq(siteChanges.isDeleted, false));
  }

  if (options?.status) {
    conditions.push(eq(siteChanges.status, options.status));
  }

  if (options?.category) {
    conditions.push(eq(siteChanges.category, options.category));
  }

  // FIX: Push resourceType filter to database instead of in-memory filtering
  if (options?.resourceType) {
    conditions.push(eq(siteChanges.resourceType, options.resourceType));
  }

  // FIX: Push triggeredBy filter to database instead of in-memory filtering
  if (options?.triggeredBy) {
    conditions.push(eq(siteChanges.triggeredBy, options.triggeredBy));
  }

  // FIX: Push date range filters to database instead of in-memory filtering
  if (options?.dateFrom) {
    conditions.push(gte(siteChanges.createdAt, options.dateFrom));
  }

  if (options?.dateTo) {
    conditions.push(lte(siteChanges.createdAt, options.dateTo));
  }

  return await db
    .select()
    .from(siteChanges)
    .where(and(...conditions))
    .orderBy(desc(siteChanges.createdAt))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);
}

/**
 * Get changes by batch ID (excludes soft-deleted by default).
 */
export async function getChangesByBatch(
  batchId: string,
  includeDeleted = false
): Promise<SiteChangeSelect[]> {
  const conditions = [eq(siteChanges.batchId, batchId)];
  if (!includeDeleted) {
    conditions.push(eq(siteChanges.isDeleted, false));
  }
  return await db
    .select()
    .from(siteChanges)
    .where(and(...conditions))
    .orderBy(siteChanges.batchSequence);
}

/**
 * Get changes by resource ID (excludes soft-deleted by default).
 */
export async function getChangesByResource(
  resourceId: string,
  resourceType?: string,
  includeDeleted = false
): Promise<SiteChangeSelect[]> {
  const conditions = [eq(siteChanges.resourceId, resourceId)];
  if (resourceType) {
    conditions.push(eq(siteChanges.resourceType, resourceType));
  }
  if (!includeDeleted) {
    conditions.push(eq(siteChanges.isDeleted, false));
  }

  return await db
    .select()
    .from(siteChanges)
    .where(and(...conditions))
    .orderBy(desc(siteChanges.createdAt));
}

/**
 * Update change status.
 */
export async function updateChangeStatus(
  changeId: string,
  status: string,
  additionalFields?: Partial<Pick<SiteChangeSelect, 'appliedAt' | 'verifiedAt' | 'revertedAt' | 'revertedByChangeId'>>
): Promise<SiteChangeSelect | undefined> {
  const [updated] = await db
    .update(siteChanges)
    .set({
      status,
      updatedAt: new Date(),
      ...additionalFields,
    })
    .where(eq(siteChanges.id, changeId))
    .returning();
  return updated;
}

/**
 * Mark a change as applied and verified.
 */
export async function markChangeVerified(changeId: string): Promise<SiteChangeSelect | undefined> {
  return updateChangeStatus(changeId, 'verified', {
    appliedAt: new Date(),
    verifiedAt: new Date(),
  });
}

/**
 * Mark a change as reverted.
 */
export async function markChangeReverted(
  changeId: string,
  revertedByChangeId: string
): Promise<SiteChangeSelect | undefined> {
  return updateChangeStatus(changeId, 'reverted', {
    revertedAt: new Date(),
    revertedByChangeId,
  });
}

/**
 * Mark a change as failed.
 */
export async function markChangeFailed(changeId: string): Promise<SiteChangeSelect | undefined> {
  return updateChangeStatus(changeId, 'failed');
}

/**
 * Get the latest change for a specific field on a resource (excludes soft-deleted).
 */
export async function getLatestChangeForField(
  resourceId: string,
  field: string
): Promise<SiteChangeSelect | undefined> {
  const [change] = await db
    .select()
    .from(siteChanges)
    .where(and(
      eq(siteChanges.resourceId, resourceId),
      eq(siteChanges.field, field),
      eq(siteChanges.isDeleted, false)
    ))
    .orderBy(desc(siteChanges.createdAt))
    .limit(1);
  return change;
}

/**
 * Hard delete changes by IDs (for testing/cleanup only).
 * Use softDeleteChanges for production deletions.
 */
export async function deleteChanges(changeIds: string[]): Promise<void> {
  if (changeIds.length === 0) return;
  await db.delete(siteChanges).where(inArray(siteChanges.id, changeIds));
}

/**
 * Soft delete a change by ID.
 * Preserves the record for rollback and audit purposes.
 */
export async function softDeleteChange(changeId: string): Promise<SiteChangeSelect | undefined> {
  const [updated] = await db
    .update(siteChanges)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(siteChanges.id, changeId))
    .returning();
  return updated;
}

/**
 * Soft delete multiple changes by IDs.
 */
export async function softDeleteChanges(changeIds: string[]): Promise<number> {
  if (changeIds.length === 0) return 0;
  const result = await db
    .update(siteChanges)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(siteChanges.id, changeIds));
  return result.rowCount ?? 0;
}

/**
 * Restore a soft-deleted change.
 */
export async function restoreChange(changeId: string): Promise<SiteChangeSelect | undefined> {
  const [updated] = await db
    .update(siteChanges)
    .set({
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(siteChanges.id, changeId))
    .returning();
  return updated;
}

export const ChangeRepository = {
  insertChange,
  insertChanges,
  getChangeById,
  getChangesByClient,
  getChangesByBatch,
  getChangesByResource,
  updateChangeStatus,
  markChangeVerified,
  markChangeReverted,
  markChangeFailed,
  getLatestChangeForField,
  deleteChanges,
  softDeleteChange,
  softDeleteChanges,
  restoreChange,
};

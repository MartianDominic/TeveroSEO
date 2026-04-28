/**
 * Change Repository
 * Phase 33: Auto-Fix System
 *
 * CRUD operations for site_changes table.
 */
import { eq, and, inArray, desc } from 'drizzle-orm';
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
 * Get a change by ID.
 */
export async function getChangeById(changeId: string): Promise<SiteChangeSelect | undefined> {
  const [change] = await db
    .select()
    .from(siteChanges)
    .where(eq(siteChanges.id, changeId))
    .limit(1);
  return change;
}

/**
 * Get all changes for a client.
 */
export async function getChangesByClient(
  clientId: string,
  options?: {
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<SiteChangeSelect[]> {
  const conditions = [eq(siteChanges.clientId, clientId)];

  if (options?.status) {
    conditions.push(eq(siteChanges.status, options.status));
  }

  if (options?.category) {
    conditions.push(eq(siteChanges.category, options.category));
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
 * Get changes by batch ID.
 */
export async function getChangesByBatch(batchId: string): Promise<SiteChangeSelect[]> {
  return await db
    .select()
    .from(siteChanges)
    .where(eq(siteChanges.batchId, batchId))
    .orderBy(siteChanges.batchSequence);
}

/**
 * Get changes by resource ID.
 */
export async function getChangesByResource(
  resourceId: string,
  resourceType?: string
): Promise<SiteChangeSelect[]> {
  const conditions = [eq(siteChanges.resourceId, resourceId)];
  if (resourceType) {
    conditions.push(eq(siteChanges.resourceType, resourceType));
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
 * Get the latest change for a specific field on a resource.
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
      eq(siteChanges.field, field)
    ))
    .orderBy(desc(siteChanges.createdAt))
    .limit(1);
  return change;
}

/**
 * Delete changes by IDs (for testing/cleanup).
 */
export async function deleteChanges(changeIds: string[]): Promise<void> {
  if (changeIds.length === 0) return;
  await db.delete(siteChanges).where(inArray(siteChanges.id, changeIds));
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
};

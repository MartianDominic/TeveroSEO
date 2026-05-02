/**
 * FollowUp Repository
 * Phase 62-02: Follow-up system with rules engine
 *
 * CRUD operations for follow_ups table.
 * Supports polymorphic entity references and workspace scoping.
 */
import { eq, and, asc, desc, lte, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  followUps,
  type FollowUpSelect,
  type FollowUpInsert,
  type EntityType,
  type FollowUpStatus,
} from "@/db/follow-up-schema";

/**
 * Filter options for querying follow-ups.
 */
export interface FollowUpFilters {
  status?: FollowUpStatus | FollowUpStatus[];
  entityType?: EntityType;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Find a follow-up by ID.
 */
export async function findById(id: string): Promise<FollowUpSelect | null> {
  const [result] = await db
    .select()
    .from(followUps)
    .where(eq(followUps.id, id))
    .limit(1);

  return result ?? null;
}

/**
 * Find follow-ups by workspace with optional filters.
 */
export async function findByWorkspace(
  workspaceId: string,
  filters?: FollowUpFilters
): Promise<FollowUpSelect[]> {
  const conditions = [eq(followUps.workspaceId, workspaceId)];

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(followUps.status, filters.status));
    } else {
      conditions.push(eq(followUps.status, filters.status));
    }
  }

  if (filters?.entityType) {
    conditions.push(eq(followUps.entityType, filters.entityType));
  }

  if (filters?.assignedTo) {
    conditions.push(eq(followUps.assignedTo, filters.assignedTo));
  }

  const baseQuery = db
    .select()
    .from(followUps)
    .where(and(...conditions))
    .orderBy(asc(followUps.scheduledAt))
    .$dynamic();

  // Apply pagination if provided
  const limitValue = filters?.limit ?? 100;
  const offsetValue = filters?.offset ?? 0;

  return await baseQuery.limit(limitValue).offset(offsetValue);
}

/**
 * Find all follow-ups for a specific entity.
 */
export async function findByEntity(
  entityType: EntityType,
  entityId: string
): Promise<FollowUpSelect[]> {
  return await db
    .select()
    .from(followUps)
    .where(
      and(eq(followUps.entityType, entityType), eq(followUps.entityId, entityId))
    )
    .orderBy(desc(followUps.createdAt));
}

/**
 * Find upcoming pending follow-ups for a workspace.
 */
export async function findUpcoming(
  workspaceId: string,
  limit: number = 10
): Promise<FollowUpSelect[]> {
  return await db
    .select()
    .from(followUps)
    .where(
      and(
        eq(followUps.workspaceId, workspaceId),
        eq(followUps.status, "pending"),
        gte(followUps.scheduledAt, new Date())
      )
    )
    .orderBy(asc(followUps.scheduledAt))
    .limit(limit);
}

/**
 * Find overdue follow-ups (pending, scheduled_at < now).
 */
export async function findOverdue(
  workspaceId: string,
  limit: number = 50
): Promise<FollowUpSelect[]> {
  return await db
    .select()
    .from(followUps)
    .where(
      and(
        eq(followUps.workspaceId, workspaceId),
        eq(followUps.status, "pending"),
        lte(followUps.scheduledAt, new Date())
      )
    )
    .orderBy(asc(followUps.scheduledAt))
    .limit(limit);
}

/**
 * Find follow-ups due today.
 */
export async function findDueToday(
  workspaceId: string
): Promise<FollowUpSelect[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return await db
    .select()
    .from(followUps)
    .where(
      and(
        eq(followUps.workspaceId, workspaceId),
        eq(followUps.status, "pending"),
        gte(followUps.scheduledAt, todayStart),
        lte(followUps.scheduledAt, todayEnd)
      )
    )
    .orderBy(asc(followUps.scheduledAt));
}

/**
 * Find snoozed follow-ups that are due to be unsnoozed.
 */
export async function findDueForUnsnooze(
  limit: number = 100
): Promise<FollowUpSelect[]> {
  return await db
    .select()
    .from(followUps)
    .where(
      and(
        eq(followUps.status, "snoozed"),
        lte(followUps.snoozedUntil, new Date())
      )
    )
    .orderBy(asc(followUps.snoozedUntil))
    .limit(limit);
}

/**
 * Create a new follow-up.
 */
export async function create(data: FollowUpInsert): Promise<FollowUpSelect> {
  const [result] = await db.insert(followUps).values(data).returning();
  return result;
}

/**
 * Update a follow-up.
 */
export async function update(
  id: string,
  data: Partial<FollowUpInsert>
): Promise<FollowUpSelect | null> {
  const [result] = await db
    .update(followUps)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(followUps.id, id))
    .returning();

  return result ?? null;
}

/**
 * Delete a follow-up.
 */
export async function deleteFollowUp(id: string): Promise<void> {
  await db.delete(followUps).where(eq(followUps.id, id));
}

/**
 * Count follow-ups by status for a workspace.
 */
export async function countByStatus(
  workspaceId: string
): Promise<Record<FollowUpStatus, number>> {
  const result = await db
    .select({
      status: followUps.status,
      count: sql<number>`count(*)::int`,
    })
    .from(followUps)
    .where(eq(followUps.workspaceId, workspaceId))
    .groupBy(followUps.status);

  const counts: Record<FollowUpStatus, number> = {
    pending: 0,
    snoozed: 0,
    completed: 0,
    cancelled: 0,
    auto_resolved: 0,
  };

  for (const row of result) {
    counts[row.status as FollowUpStatus] = row.count;
  }

  return counts;
}

export const FollowUpRepository = {
  findById,
  findByWorkspace,
  findByEntity,
  findUpcoming,
  findOverdue,
  findDueToday,
  findDueForUnsnooze,
  create,
  update,
  delete: deleteFollowUp,
  countByStatus,
};

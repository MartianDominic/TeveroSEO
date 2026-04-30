/**
 * Activity Repository
 * Phase 45: Data Foundation
 *
 * CRUD operations for pipeline_activities table with polymorphic queries.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  pipelineActivities,
  type PipelineActivityInsert,
  type PipelineActivitySelect,
  type EntityType,
  type ActivityType,
} from "@/db/activity-schema";

/**
 * Insert a new activity.
 */
export async function insertActivity(
  activity: PipelineActivityInsert,
): Promise<PipelineActivitySelect> {
  const [inserted] = await db
    .insert(pipelineActivities)
    .values(activity)
    .returning();
  return inserted;
}

/**
 * Get an activity by ID.
 */
export async function getActivityById(
  activityId: string,
): Promise<PipelineActivitySelect | undefined> {
  const [activity] = await db
    .select()
    .from(pipelineActivities)
    .where(eq(pipelineActivities.id, activityId))
    .limit(1);
  return activity;
}

/**
 * Get activities for a specific entity (polymorphic query).
 */
export async function getActivitiesByEntity(
  entityType: EntityType,
  entityId: string,
  options?: {
    activityType?: ActivityType;
    limit?: number;
    offset?: number;
  },
): Promise<PipelineActivitySelect[]> {
  const conditions = [
    eq(pipelineActivities.entityType, entityType),
    eq(pipelineActivities.entityId, entityId),
  ];

  if (options?.activityType) {
    conditions.push(eq(pipelineActivities.activityType, options.activityType));
  }

  return await db
    .select()
    .from(pipelineActivities)
    .where(and(...conditions))
    .orderBy(desc(pipelineActivities.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

/**
 * Get activities for a workspace (activity feed).
 */
export async function getActivitiesByWorkspace(
  workspaceId: string,
  options?: {
    entityType?: EntityType;
    activityType?: ActivityType;
    limit?: number;
    offset?: number;
  },
): Promise<PipelineActivitySelect[]> {
  const conditions = [eq(pipelineActivities.workspaceId, workspaceId)];

  if (options?.entityType) {
    conditions.push(eq(pipelineActivities.entityType, options.entityType));
  }

  if (options?.activityType) {
    conditions.push(eq(pipelineActivities.activityType, options.activityType));
  }

  return await db
    .select()
    .from(pipelineActivities)
    .where(and(...conditions))
    .orderBy(desc(pipelineActivities.createdAt))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);
}

/**
 * Get activities by actor (user-specific feed).
 */
export async function getActivitiesByActor(
  actorId: string,
  options?: {
    limit?: number;
    offset?: number;
  },
): Promise<PipelineActivitySelect[]> {
  return await db
    .select()
    .from(pipelineActivities)
    .where(eq(pipelineActivities.actorId, actorId))
    .orderBy(desc(pipelineActivities.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

/**
 * Record a status change activity.
 * Convenience wrapper for common activity pattern.
 */
export async function recordStatusChange(
  workspaceId: string,
  entityType: EntityType,
  entityId: string,
  fromStatus: string,
  toStatus: string,
  actorId?: string,
): Promise<PipelineActivitySelect> {
  return insertActivity({
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 21), // nanoid-like
    workspaceId,
    entityType,
    entityId,
    activityType: "status_changed",
    activityData: { fromStatus, toStatus },
    actorId: actorId ?? null,
  });
}

/**
 * Delete activities for an entity (cleanup).
 */
export async function deleteActivitiesByEntity(
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  await db
    .delete(pipelineActivities)
    .where(
      and(
        eq(pipelineActivities.entityType, entityType),
        eq(pipelineActivities.entityId, entityId),
      ),
    );
}

export const ActivityRepository = {
  insertActivity,
  getActivityById,
  getActivitiesByEntity,
  getActivitiesByWorkspace,
  getActivitiesByActor,
  recordStatusChange,
  deleteActivitiesByEntity,
};

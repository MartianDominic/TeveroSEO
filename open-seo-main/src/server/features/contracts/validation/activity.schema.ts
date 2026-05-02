/**
 * Activity validation schemas.
 * Phase 45: Data Foundation
 */
import { z } from "zod";
import { ENTITY_TYPES, ACTIVITY_TYPES } from "@/db/activity-schema";

export const createActivitySchema = z.object({
  entityType: z.enum(ENTITY_TYPES as unknown as readonly [string, ...string[]]),
  entityId: z.string().min(1, "Entity ID is required"),
  activityType: z.enum(ACTIVITY_TYPES as unknown as readonly [string, ...string[]]),
  activityData: z.record(z.string(), z.unknown()),
  actorId: z.string().optional().nullable(),
});

export const getActivitiesSchema = z.object({
  entityType: z.enum(ENTITY_TYPES as unknown as readonly [string, ...string[]]).optional(),
  entityId: z.string().optional(),
  activityType: z.enum(ACTIVITY_TYPES as unknown as readonly [string, ...string[]]).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type GetActivitiesInput = z.infer<typeof getActivitiesSchema>;

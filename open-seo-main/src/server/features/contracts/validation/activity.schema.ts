/**
 * Activity validation schemas.
 * Phase 45: Data Foundation
 */
import { z } from "zod";
import { ENTITY_TYPES, ACTIVITY_TYPES } from "@/db/activity-schema";

export const createActivitySchema = z.object({
  entityType: z.enum(ENTITY_TYPES, {
    errorMap: () => ({ message: "Invalid entity type" }),
  }),
  entityId: z.string().min(1, "Entity ID is required"),
  activityType: z.enum(ACTIVITY_TYPES, {
    errorMap: () => ({ message: "Invalid activity type" }),
  }),
  activityData: z.record(z.unknown()).default({}),
  actorId: z.string().optional().nullable(),
});

export const getActivitiesSchema = z.object({
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.string().optional(),
  activityType: z.enum(ACTIVITY_TYPES).optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type GetActivitiesInput = z.infer<typeof getActivitiesSchema>;

/**
 * Pipeline activities schema for agency pipeline.
 * Phase 45: Data Foundation - Activity Feed
 *
 * Provides a polymorphic activity feed for tracking all pipeline events
 * across prospects, contracts, invoices, and clients.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * Entity types for polymorphic activity feed.
 * Each entity type can have activities recorded against it.
 */
export const ENTITY_TYPES = [
  "prospect",
  "contract",
  "invoice",
  "client",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Activity types enum for categorizing events.
 */
export const ACTIVITY_TYPES = [
  "created",
  "status_changed",
  "viewed",
  "sent",
  "signed",
  "paid",
  "note_added",
  "reminder_set",
  "archived",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * pipeline_activities table - polymorphic activity feed.
 *
 * Uses entityType + entityId pattern for polymorphic references,
 * allowing activities to be recorded against any pipeline entity.
 */
export const pipelineActivities = pgTable(
  "pipeline_activities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    activityType: text("activity_type").notNull(),
    activityData: jsonb("activity_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    actorId: text("actor_id"), // nullable for system events
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_activities_workspace_created").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("ix_activities_entity").on(table.entityType, table.entityId),
    index("ix_activities_actor").on(table.actorId),
    index("ix_activities_type").on(table.activityType),
  ],
);

/**
 * Relations for type-safe queries with joins.
 */
export const pipelineActivitiesRelations = relations(
  pipelineActivities,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [pipelineActivities.workspaceId],
      references: [organization.id],
    }),
  }),
);

/**
 * Type exports for select and insert operations.
 */
export type PipelineActivitySelect = typeof pipelineActivities.$inferSelect;
export type PipelineActivityInsert = typeof pipelineActivities.$inferInsert;

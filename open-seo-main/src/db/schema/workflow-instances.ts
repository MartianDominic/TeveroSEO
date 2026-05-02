/**
 * Workflow Instances Schema
 * Phase 62-01: Agency Command Center - Database Schema
 *
 * Tracks active engagement workflows with state machine and event logging.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "../user-schema";
import { workflowTemplates, type EntityType } from "./workflow-templates";

// Workflow status state machine
export const WORKFLOW_STATUS = [
  "pending",
  "active",
  "paused",
  "snoozed",
  "completed",
  "cancelled",
  "won",
  "lost",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUS)[number];

// Event types for workflow audit log
export const WORKFLOW_EVENT_TYPES = [
  "started",
  "step_executed",
  "step_skipped",
  "paused",
  "resumed",
  "snoozed",
  "unsnoozed",
  "response_detected",
  "completed",
  "cancelled",
  "error",
] as const;
export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];

/**
 * workflow_instances table - tracks active engagements.
 */
export const workflowInstances = pgTable(
  "workflow_instances",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => workflowTemplates.id),

    // Target entity
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: text("entity_id").notNull(),

    // State machine
    status: text("status").$type<WorkflowStatus>().default("active").notNull(),
    currentStep: integer("current_step").default(0).notNull(),

    // Snooze support
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "date",
    }),
    snoozeReason: text("snooze_reason"),

    // Tracking
    touchesThisWeek: integer("touches_this_week").default(0).notNull(),
    lastTouchAt: timestamp("last_touch_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastResponseAt: timestamp("last_response_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Outcome
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    outcomeReason: text("outcome_reason"),

    // Metadata
    context: jsonb("context").$type<Record<string, unknown>>().default({}),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ix_workflow_instances_workspace_status").on(
      table.workspaceId,
      table.status
    ),
    index("ix_workflow_instances_entity").on(table.entityType, table.entityId),
    index("ix_workflow_instances_snoozed").on(table.snoozedUntil),
    index("ix_workflow_instances_active").on(table.workspaceId),
  ]
);

/**
 * workflow_events table - audit log for workflow execution.
 */
export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id")
      .notNull()
      .references(() => workflowInstances.id, { onDelete: "cascade" }),

    // Event details
    eventType: text("event_type").$type<WorkflowEventType>().notNull(),
    stepIndex: integer("step_index"),

    // Execution details
    actionTaken: text("action_taken"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),

    // Metadata
    triggeredBy: text("triggered_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_workflow_events_instance").on(table.instanceId, table.createdAt),
  ]
);

// Relations
export const workflowInstancesRelations = relations(
  workflowInstances,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [workflowInstances.workspaceId],
      references: [organization.id],
    }),
    template: one(workflowTemplates, {
      fields: [workflowInstances.templateId],
      references: [workflowTemplates.id],
    }),
    events: many(workflowEvents),
  })
);

export const workflowEventsRelations = relations(workflowEvents, ({ one }) => ({
  instance: one(workflowInstances, {
    fields: [workflowEvents.instanceId],
    references: [workflowInstances.id],
  }),
}));

// Type exports
export type WorkflowInstanceSelect = typeof workflowInstances.$inferSelect;
export type WorkflowInstanceInsert = typeof workflowInstances.$inferInsert;
export type WorkflowEventSelect = typeof workflowEvents.$inferSelect;
export type WorkflowEventInsert = typeof workflowEvents.$inferInsert;

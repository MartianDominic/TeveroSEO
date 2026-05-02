/**
 * Workflow Instances Schema - Active workflow tracking and event log
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-04, D-05: Workflow instances with state machine and audit log.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "../user-schema";
import { workflowTemplates } from "./workflow-templates";

// Workflow instance status (state machine)
export const WORKFLOW_INSTANCE_STATUS = [
  "pending",
  "active",
  "paused",
  "snoozed",
  "completed",
  "cancelled",
  "won",
  "lost",
] as const;
export type WorkflowInstanceStatus = (typeof WORKFLOW_INSTANCE_STATUS)[number];

// Workflow event types
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
 * Workflow instance context - dynamic data for step personalization
 */
export interface WorkflowContext {
  [key: string]: unknown;
}

/**
 * Workflow event result - step execution details
 */
export interface WorkflowEventResult {
  [key: string]: unknown;
}

/**
 * Workflow instances table - tracks active engagements.
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
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),

    // State machine
    status: text("status").notNull().default("active"),
    currentStep: integer("current_step").notNull().default(0),

    // Snooze support ("follow up on May 27th")
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "date",
    }),
    snoozeReason: text("snooze_reason"),

    // Tracking
    touchesThisWeek: integer("touches_this_week").default(0),
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
    context: jsonb("context").$type<WorkflowContext>().default({}),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_workflow_instances_workspace_status").on(
      table.workspaceId,
      table.status
    ),
    index("ix_workflow_instances_entity").on(table.entityType, table.entityId),
    index("ix_workflow_instances_snoozed").on(table.snoozedUntil),
    index("ix_workflow_instances_active").on(table.workspaceId),
    check(
      "chk_workflow_instances_entity_type",
      sql`entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')`
    ),
    check(
      "chk_workflow_instances_status",
      sql`status IN ('pending', 'active', 'paused', 'snoozed', 'completed', 'cancelled', 'won', 'lost')`
    ),
  ]
);

/**
 * Workflow events table - execution audit log.
 */
export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id")
      .notNull()
      .references(() => workflowInstances.id, { onDelete: "cascade" }),

    // Event details
    eventType: text("event_type").notNull(),
    stepIndex: integer("step_index"),

    // Execution details
    actionTaken: text("action_taken"),
    result: jsonb("result").$type<WorkflowEventResult>(),
    errorMessage: text("error_message"),

    // Metadata
    triggeredBy: text("triggered_by"), // 'system', 'user:{id}', 'webhook'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_workflow_events_instance_created").on(
      table.instanceId,
      table.createdAt
    ),
    check(
      "chk_workflow_events_event_type",
      sql`event_type IN ('started', 'step_executed', 'step_skipped', 'paused', 'resumed', 'snoozed', 'unsnoozed', 'response_detected', 'completed', 'cancelled', 'error')`
    ),
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

// Inferred types
export type WorkflowInstanceSelect = typeof workflowInstances.$inferSelect;
export type WorkflowInstanceInsert = typeof workflowInstances.$inferInsert;
export type WorkflowEventSelect = typeof workflowEvents.$inferSelect;
export type WorkflowEventInsert = typeof workflowEvents.$inferInsert;

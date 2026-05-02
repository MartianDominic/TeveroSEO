/**
 * Workflow Templates Schema
 * Phase 62-01: Agency Command Center - Database Schema
 *
 * Defines reusable engagement sequences with anti-annoyance safeguards.
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "../user-schema";
// Import EntityType from activity-schema (canonical source)
import { ENTITY_TYPES, type EntityType } from "../activity-schema";
// Re-export for consumers that import from workflow-templates
export { ENTITY_TYPES, type EntityType };

// Workflow step types
export const STEP_TYPES = [
  "wait",
  "email",
  "task",
  "condition",
  "webhook",
  "alert",
] as const;
export type StepType = (typeof STEP_TYPES)[number];

// Step configuration interfaces
export interface WaitConfig {
  duration: { value: number; unit: "hours" | "days" | "weeks" };
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

export interface EmailConfig {
  templateId: string;
  subject: string;
  bodyTemplate: string;
  replyTo?: string;
}

export interface TaskConfig {
  title: string;
  description?: string;
  assignTo: "owner" | string;
  dueIn: { value: number; unit: "hours" | "days" };
  priority: "low" | "medium" | "high";
}

export interface ConditionConfig {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: unknown;
  onTrue: "continue" | "skip" | "complete" | { goto: number };
  onFalse: "continue" | "skip" | "complete" | { goto: number };
}

export interface WebhookConfig {
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
  bodyTemplate: string;
}

export interface AlertConfig {
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  notifyUsers: string[];
}

export type StepConfig =
  | WaitConfig
  | EmailConfig
  | TaskConfig
  | ConditionConfig
  | WebhookConfig
  | AlertConfig;

export interface WorkflowStep {
  index: number;
  type: StepType;
  config: StepConfig;
}

/**
 * workflow_templates table - reusable engagement sequences.
 */
export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "cascade",
    }),

    // Template definition
    name: text("name").notNull(),
    description: text("description"),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    triggerEvent: text("trigger_event").notNull(),

    // Anti-annoyance safeguards
    maxTouchesPerWeek: integer("max_touches_per_week").default(3).notNull(),
    cooldownHours: integer("cooldown_hours").default(48).notNull(),
    skipOnResponse: boolean("skip_on_response").default(true).notNull(),
    pauseOnNegativeSignal: boolean("pause_on_negative_signal")
      .default(true)
      .notNull(),

    // Step configuration
    steps: jsonb("steps").$type<WorkflowStep[]>().notNull(),

    // State
    isActive: boolean("is_active").default(true).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),

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
    index("ix_workflow_templates_workspace").on(table.workspaceId, table.isActive),
    index("ix_workflow_templates_trigger").on(
      table.entityType,
      table.triggerEvent,
      table.isActive
    ),
  ]
);

// Relations
export const workflowTemplatesRelations = relations(
  workflowTemplates,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [workflowTemplates.workspaceId],
      references: [organization.id],
    }),
  })
);

// Type exports
export type WorkflowTemplateSelect = typeof workflowTemplates.$inferSelect;
export type WorkflowTemplateInsert = typeof workflowTemplates.$inferInsert;

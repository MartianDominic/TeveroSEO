/**
 * Workflow Templates Schema - Reusable engagement sequence definitions
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-03: Workflow templates with anti-annoyance safeguards.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "../user-schema";
import { ENTITY_TYPES, type EntityType } from "./follow-ups";

// Trigger events that can start a workflow
export const WORKFLOW_TRIGGER_EVENTS = [
  "proposal_sent",
  "proposal_viewed",
  "contract_sent",
  "contract_awaiting_signature",
  "contract_signed",
  "invoice_sent",
  "invoice_overdue",
  "prospect_qualified",
  "prospect_contacted",
  "client_onboarded",
] as const;
export type WorkflowTriggerEvent = (typeof WORKFLOW_TRIGGER_EVENTS)[number];

/**
 * Workflow step types
 */
export type WorkflowStepType =
  | "wait"
  | "email"
  | "task"
  | "condition"
  | "webhook"
  | "alert";

/**
 * Wait configuration
 */
export interface WaitConfig {
  duration: { value: number; unit: "hours" | "days" | "weeks" };
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  templateId: string;
  subject: string;
  bodyTemplate: string;
  replyTo?: string;
}

/**
 * Task configuration
 */
export interface TaskConfig {
  title: string;
  description?: string;
  assignTo: "owner" | string;
  dueIn: { value: number; unit: "hours" | "days" };
  priority: "low" | "medium" | "high";
}

/**
 * Condition configuration
 */
export interface ConditionConfig {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: unknown;
  onTrue: "continue" | "skip" | "complete" | { goto: number };
  onFalse: "continue" | "skip" | "complete" | { goto: number };
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
  bodyTemplate: string;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  notifyUsers: string[];
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  index: number;
  type: WorkflowStepType;
  config:
    | WaitConfig
    | EmailConfig
    | TaskConfig
    | ConditionConfig
    | WebhookConfig
    | AlertConfig;
}

/**
 * Workflow templates table - defines reusable engagement sequences.
 */
export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: text("id").primaryKey(),
    // NULL workspace_id means system template (available to all)
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "cascade",
    }),

    // Template definition
    name: text("name").notNull(),
    description: text("description"),
    entityType: text("entity_type").notNull(),
    triggerEvent: text("trigger_event").notNull(),

    // Anti-annoyance safeguards
    maxTouchesPerWeek: integer("max_touches_per_week").default(3).notNull(),
    cooldownHours: integer("cooldown_hours").default(48).notNull(),
    skipOnResponse: boolean("skip_on_response").default(true).notNull(),
    pauseOnNegativeSignal: boolean("pause_on_negative_signal")
      .default(true)
      .notNull(),

    // Configuration
    steps: jsonb("steps").$type<WorkflowStep[]>().notNull(),

    // State
    isActive: boolean("is_active").default(true).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_workflow_templates_workspace_active").on(
      table.workspaceId,
      table.isActive
    ),
    index("ix_workflow_templates_trigger").on(
      table.entityType,
      table.triggerEvent,
      table.isActive
    ),
    check(
      "chk_workflow_templates_entity_type",
      sql`entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')`
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

// Inferred types
export type WorkflowTemplateSelect = typeof workflowTemplates.$inferSelect;
export type WorkflowTemplateInsert = typeof workflowTemplates.$inferInsert;

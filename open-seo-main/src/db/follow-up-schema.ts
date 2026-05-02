/**
 * Follow-up and Rules schema for Agency Command Center
 * Phase 62-02: Follow-up system with rules engine
 *
 * Implements polymorphic entity reference pattern for follow-ups
 * across prospects, proposals, contracts, invoices, and clients.
 *
 * Follow-up types:
 * - reminder: General reminder
 * - check_in: Periodic check-in
 * - escalation: Issue escalation
 * - deadline: Deadline reminder
 * - custom: User-defined type
 *
 * Status state machine:
 * - pending: Scheduled, waiting for due date
 * - snoozed: Temporarily deferred
 * - completed: Manually or automatically completed
 * - cancelled: Cancelled by user
 * - auto_resolved: System resolved (entity status changed)
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization, users } from "./user-schema";

// Entity types for polymorphic reference
export const ENTITY_TYPES = [
  "prospect",
  "proposal",
  "contract",
  "invoice",
  "client",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Follow-up types
export const FOLLOW_UP_TYPES = [
  "reminder",
  "check_in",
  "escalation",
  "deadline",
  "custom",
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

// Follow-up statuses
export const FOLLOW_UP_STATUSES = [
  "pending",
  "snoozed",
  "completed",
  "cancelled",
  "auto_resolved",
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

// Priority levels
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

// Action types for rules
export const ACTION_TYPES = [
  "create_follow_up",
  "send_notification",
  "escalate",
  "auto_reminder",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * Trigger conditions JSONB structure for follow-up rules.
 */
export interface TriggerConditions {
  status_changed_to?: string;
  status_equals?: string;
  days_since?: number;
  days_overdue_gte?: number;
  value_gte_cents?: number;
}

/**
 * Action config JSONB structure for rules.
 */
export interface ActionConfig {
  follow_up_type: FollowUpType;
  priority: Priority;
  assign_to: "owner" | string; // user ID
  title_template?: string;
}

/**
 * Follow-ups table - tracks reminders and tasks for entities.
 *
 * Threat mitigations:
 * - T-62-02-01: workspace_id validated in service layer
 */
export const followUps = pgTable(
  "follow_ups",
  {
    id: text("id").primaryKey(),

    // Workspace scoping
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Polymorphic entity reference
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),

    // Follow-up details
    followUpType: text("follow_up_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Scheduling
    scheduledAt: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Status
    status: text("status").notNull().default("pending"),

    // Assignment
    assignedTo: text("assigned_to").references(() => users.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),

    // Priority
    priority: text("priority").notNull().default("medium"),

    // Automation
    isAutomated: boolean("is_automated").default(false),
    ruleId: text("rule_id"),

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_follow_ups_workspace_status").on(
      table.workspaceId,
      table.status
    ),
    index("idx_follow_ups_scheduled").on(table.workspaceId, table.scheduledAt),
    index("idx_follow_ups_entity").on(table.entityType, table.entityId),
    index("idx_follow_ups_assigned").on(table.assignedTo, table.status),

    // Status constraint
    check(
      "chk_follow_up_status_valid",
      sql`status IN ('pending', 'snoozed', 'completed', 'cancelled', 'auto_resolved')`
    ),

    // Entity type constraint
    check(
      "chk_follow_up_entity_type_valid",
      sql`entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')`
    ),

    // Follow-up type constraint
    check(
      "chk_follow_up_type_valid",
      sql`follow_up_type IN ('reminder', 'check_in', 'escalation', 'deadline', 'custom')`
    ),

    // Priority constraint
    check(
      "chk_follow_up_priority_valid",
      sql`priority IN ('low', 'medium', 'high', 'critical')`
    ),
  ]
);

/**
 * Follow-up rules table - configurable automation rules.
 *
 * Threat mitigations:
 * - T-62-02-02: trigger_conditions validated via Zod before storage
 */
export const followUpRules = pgTable(
  "follow_up_rules",
  {
    id: text("id").primaryKey(),

    // Workspace scoping
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Rule definition
    name: text("name").notNull(),
    description: text("description"),
    entityType: text("entity_type").notNull(),

    // Trigger conditions (JSONB for flexibility)
    triggerConditions: jsonb("trigger_conditions")
      .$type<TriggerConditions>()
      .notNull(),

    // Action configuration
    actionType: text("action_type").notNull(),
    actionConfig: jsonb("action_config").$type<ActionConfig>().notNull(),

    // Timing
    delayHours: integer("delay_hours").default(0),
    repeatIntervalHours: integer("repeat_interval_hours"),
    maxRepeats: integer("max_repeats").default(1),

    // State
    isActive: boolean("is_active").default(true),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_follow_up_rules_workspace").on(table.workspaceId, table.isActive),
    index("idx_follow_up_rules_entity").on(table.entityType, table.isActive),

    // Entity type constraint
    check(
      "chk_rule_entity_type_valid",
      sql`entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')`
    ),

    // Action type constraint
    check(
      "chk_rule_action_type_valid",
      sql`action_type IN ('create_follow_up', 'send_notification', 'escalate', 'auto_reminder')`
    ),
  ]
);

// Relations
export const followUpsRelations = relations(followUps, ({ one }) => ({
  workspace: one(organization, {
    fields: [followUps.workspaceId],
    references: [organization.id],
  }),
  assignedUser: one(users, {
    fields: [followUps.assignedTo],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [followUps.createdBy],
    references: [users.id],
  }),
}));

export const followUpRulesRelations = relations(followUpRules, ({ one }) => ({
  workspace: one(organization, {
    fields: [followUpRules.workspaceId],
    references: [organization.id],
  }),
}));

// Type exports
export type FollowUpSelect = typeof followUps.$inferSelect;
export type FollowUpInsert = typeof followUps.$inferInsert;
export type FollowUpRuleSelect = typeof followUpRules.$inferSelect;
export type FollowUpRuleInsert = typeof followUpRules.$inferInsert;

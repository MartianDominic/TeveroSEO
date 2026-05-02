/**
 * Follow-ups Schema - Core follow-up tracking and rules
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-01, D-02: Polymorphic follow-up tracking with
 * configurable automation rules.
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
import { organization, user } from "../user-schema";

// Entity types for polymorphic entity reference
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

// Follow-up status
export const FOLLOW_UP_STATUS = [
  "pending",
  "snoozed",
  "completed",
  "cancelled",
  "auto_resolved",
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUS)[number];

// Follow-up priority
export const FOLLOW_UP_PRIORITY = ["low", "medium", "high", "critical"] as const;
export type FollowUpPriority = (typeof FOLLOW_UP_PRIORITY)[number];

// Rule action types
export const RULE_ACTION_TYPES = [
  "create_follow_up",
  "send_notification",
  "escalate",
  "auto_reminder",
] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

/**
 * Follow-up metadata structure
 */
export interface FollowUpMetadata {
  notes?: string;
  linkedEntityIds?: string[];
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Rule trigger conditions structure
 */
export interface TriggerConditions {
  status_changed_to?: string;
  status_equals?: string;
  days_since?: number;
  days_overdue_gte?: number;
  [key: string]: unknown;
}

/**
 * Rule action config structure
 */
export interface ActionConfig {
  follow_up_type?: FollowUpType;
  priority?: FollowUpPriority;
  assign_to?: "owner" | string;
  notification_type?: string;
  escalate_to?: string;
  [key: string]: unknown;
}

/**
 * Follow-up rules table - configurable automation rules.
 * Defined first because follow_ups references it.
 */
export const followUpRules = pgTable(
  "follow_up_rules",
  {
    id: text("id").primaryKey(),
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
    isActive: boolean("is_active").default(true).notNull(),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_follow_up_rules_workspace_active").on(
      table.workspaceId,
      table.isActive
    ),
    index("ix_follow_up_rules_entity_active").on(
      table.entityType,
      table.isActive
    ),
    check(
      "chk_follow_up_rules_entity_type",
      sql`entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')`
    ),
    check(
      "chk_follow_up_rules_action_type",
      sql`action_type IN ('create_follow_up', 'send_notification', 'escalate', 'auto_reminder')`
    ),
  ]
);

/**
 * Follow-ups table - core follow-up tracking with polymorphic entity reference.
 */
export const followUps = pgTable(
  "follow_ups",
  {
    id: text("id").primaryKey(),
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

    // Status tracking
    status: text("status").notNull().default("pending"),

    // Assignment
    assignedTo: text("assigned_to").references(() => user.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),

    // Priority
    priority: text("priority").notNull().default("medium"),

    // Automation
    isAutomated: boolean("is_automated").default(false),
    ruleId: text("rule_id").references(() => followUpRules.id),

    // Metadata
    metadata: jsonb("metadata").$type<FollowUpMetadata>().default({}),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_follow_ups_workspace_status").on(table.workspaceId, table.status),
    index("ix_follow_ups_scheduled_pending").on(
      table.workspaceId,
      table.scheduledAt
    ),
    index("ix_follow_ups_entity").on(table.entityType, table.entityId),
    index("ix_follow_ups_assigned_status").on(table.assignedTo, table.status),
    check(
      "chk_follow_ups_entity_type",
      sql`entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')`
    ),
    check(
      "chk_follow_ups_type",
      sql`follow_up_type IN ('reminder', 'check_in', 'escalation', 'deadline', 'custom')`
    ),
    check(
      "chk_follow_ups_status",
      sql`status IN ('pending', 'snoozed', 'completed', 'cancelled', 'auto_resolved')`
    ),
    check(
      "chk_follow_ups_priority",
      sql`priority IN ('low', 'medium', 'high', 'critical')`
    ),
  ]
);

// Relations
export const followUpsRelations = relations(followUps, ({ one }) => ({
  workspace: one(organization, {
    fields: [followUps.workspaceId],
    references: [organization.id],
  }),
  assignedUser: one(user, {
    fields: [followUps.assignedTo],
    references: [user.id],
  }),
  createdByUser: one(user, {
    fields: [followUps.createdBy],
    references: [user.id],
  }),
  rule: one(followUpRules, {
    fields: [followUps.ruleId],
    references: [followUpRules.id],
  }),
}));

export const followUpRulesRelations = relations(
  followUpRules,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [followUpRules.workspaceId],
      references: [organization.id],
    }),
    followUps: many(followUps),
  })
);

// Inferred types
export type FollowUpSelect = typeof followUps.$inferSelect;
export type FollowUpInsert = typeof followUps.$inferInsert;
export type FollowUpRuleSelect = typeof followUpRules.$inferSelect;
export type FollowUpRuleInsert = typeof followUpRules.$inferInsert;

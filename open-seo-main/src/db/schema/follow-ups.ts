/**
 * Follow-ups Schema
 * Phase 62-01: Agency Command Center - Database Schema
 *
 * Tracks follow-up tasks and configurable rules for automation.
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
import { organization, user } from "../user-schema";
import { type EntityType } from "./workflow-templates";

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

// Priority levels
export const PRIORITY_LEVELS = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITY_LEVELS)[number];

// Action types for rules
export const ACTION_TYPES = [
  "create_follow_up",
  "send_notification",
  "escalate",
  "auto_reminder",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

// Trigger conditions interface
export interface TriggerConditions {
  status_changed_to?: string;
  status_equals?: string;
  days_since?: number;
  days_overdue_gte?: number;
  value_gte_cents?: number;
}

// Action config interface
export interface ActionConfig {
  follow_up_type: FollowUpType;
  priority: Priority;
  assign_to: "owner" | string;
  title_template?: string;
}

/**
 * follow_ups table - individual follow-up tasks.
 */
export const followUps = pgTable(
  "follow_ups",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Polymorphic entity reference
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: text("entity_id").notNull(),

    // Follow-up details
    followUpType: text("follow_up_type").$type<FollowUpType>().notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Scheduling
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" })
      .notNull(),
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Status tracking
    status: text("status").$type<FollowUpStatus>().default("pending").notNull(),

    // Assignment
    assignedTo: text("assigned_to").references(() => user.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),

    // Priority
    priority: text("priority").$type<Priority>().default("medium").notNull(),

    // Automation
    isAutomated: boolean("is_automated").default(false).notNull(),
    ruleId: text("rule_id"),

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

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
    index("ix_follow_ups_workspace_status").on(table.workspaceId, table.status),
    index("ix_follow_ups_scheduled").on(table.workspaceId, table.scheduledAt),
    index("ix_follow_ups_entity").on(table.entityType, table.entityId),
    index("ix_follow_ups_assigned").on(table.assignedTo, table.status),
  ]
);

/**
 * follow_up_rules table - configurable automation rules.
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
    entityType: text("entity_type").$type<EntityType>().notNull(),

    // Trigger conditions
    triggerConditions: jsonb("trigger_conditions")
      .$type<TriggerConditions>()
      .notNull(),

    // Action configuration
    actionType: text("action_type").$type<ActionType>().notNull(),
    actionConfig: jsonb("action_config").$type<ActionConfig>().notNull(),

    // Timing
    delayHours: integer("delay_hours").default(0).notNull(),
    repeatIntervalHours: integer("repeat_interval_hours"),
    maxRepeats: integer("max_repeats").default(1).notNull(),

    // State
    isActive: boolean("is_active").default(true).notNull(),

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
    index("ix_follow_up_rules_workspace").on(table.workspaceId, table.isActive),
    index("ix_follow_up_rules_entity").on(table.entityType, table.isActive),
  ]
);

// Relations
export const followUpsRelations = relations(followUps, ({ one }) => ({
  workspace: one(organization, {
    fields: [followUps.workspaceId],
    references: [organization.id],
  }),
  assignee: one(user, {
    fields: [followUps.assignedTo],
    references: [user.id],
    relationName: "assignee",
  }),
  creator: one(user, {
    fields: [followUps.createdBy],
    references: [user.id],
    relationName: "creator",
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

// Type exports
export type FollowUpSelect = typeof followUps.$inferSelect;
export type FollowUpInsert = typeof followUps.$inferInsert;
export type FollowUpRuleSelect = typeof followUpRules.$inferSelect;
export type FollowUpRuleInsert = typeof followUpRules.$inferInsert;

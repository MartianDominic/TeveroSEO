/**
 * Tasks schema for Today's Tasks feed.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements:
 * - D-09: Task sources (checklist, pipeline, follow_up, expiring, seo, manual)
 * - D-10: Full task system with assignees, priority, due date, reminders
 * - D-11: 5-layer priority system support (pinnedAt, snoozedUntil for user overrides)
 */
import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";

/**
 * D-09: Task sources enum.
 * Tasks can come from multiple sources in the pipeline.
 */
export const TASK_SOURCES = [
  "checklist", // Overdue checklist items
  "pipeline", // Stale pipeline cards
  "follow_up", // Scheduled follow-ups
  "expiring", // Expiring proposals/contracts
  "seo", // SEO tasks stuck on human action
  "manual", // Manually added tasks
] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

/**
 * D-10: Priority levels enum.
 * Used for urgency scoring and visual indicators.
 */
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Task categories for grouping and filtering.
 */
export const TASK_CATEGORIES = [
  "onboarding",
  "sales",
  "content",
  "technical",
  "billing",
  "other",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/**
 * Tasks table - unified task feed for agency command center.
 *
 * Supports both manually created tasks and aggregated tasks from
 * various sources (D-09). Includes fields for the 5-layer priority
 * system (D-11).
 */
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    // Task content
    title: text("title").notNull(),
    description: text("description"),

    // Source tracking (D-09)
    source: text("source").notNull().default("manual"),
    entityType: text("entity_type"), // "prospect", "contract", "checklist", etc.
    entityId: text("entity_id"), // ID of source entity

    // Assignment and priority (D-10)
    assignedTo: text("assigned_to"),
    priority: text("priority").default("medium"),
    category: text("category").default("other"),

    // Scheduling (D-10)
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    reminderAt: timestamp("reminder_at", { withTimezone: true, mode: "date" }),

    // D-11 Layer 2: User overrides
    pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: "date" }),
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "date",
    }),

    // Completion
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    completedBy: text("completed_by"),

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
    index("ix_tasks_workspace").on(table.workspaceId),
    index("ix_tasks_client").on(table.clientId),
    index("ix_tasks_assigned").on(table.assignedTo),
    index("ix_tasks_due").on(table.dueAt),
    index("ix_tasks_pinned").on(table.pinnedAt),
    index("ix_tasks_source_entity").on(table.source, table.entityId),
    // Index for active tasks (not completed)
    index("ix_tasks_active").on(table.workspaceId, table.completedAt),
    // D-09: Task source must be valid enum value
    check(
      "chk_task_source_valid",
      sql`source IN ('checklist', 'pipeline', 'follow_up', 'expiring', 'seo', 'manual')`
    ),
    // D-10: Task priority must be valid enum value
    check(
      "chk_task_priority_valid",
      sql`priority IN ('high', 'medium', 'low')`
    ),
  ]
);

/**
 * Relations for type-safe queries with joins.
 */
export const tasksRelations = relations(tasks, ({ one }) => ({
  workspace: one(organization, {
    fields: [tasks.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
}));

/**
 * Type exports for select and insert operations.
 */
export type TaskSelect = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;

/**
 * Schema for goal-based metrics tracking.
 * Phase 22: Goal-Based Metrics System
 */
import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";
import { organization } from "./user-schema";
import { softDeleteColumns } from "./soft-delete-columns";

/**
 * System-level goal templates.
 * Pre-defined goal types that agencies can select for clients.
 */
export const goalTemplates = pgTable(
  "goal_templates",
  {
    id: text("id").primaryKey(),
    goalType: text("goal_type").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit"), // 'keywords', 'clicks', '%', 'impressions'
    defaultTarget: numeric("default_target"),
    hasDenominator: boolean("has_denominator").default(false), // For "X out of Y" goals
    computationMethod: text("computation_method").notNull(),
    isActive: boolean("is_active").default(true),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    // SCHEMA-SOFTDELETE: Standard soft delete column
    ...softDeleteColumns,
  },
  (table) => [index("idx_goal_templates_soft_deleted").on(table.softDeletedAt)]
);

/**
 * Per-client goal configurations.
 * Links a client to a goal template with specific target values.
 */
export const clientGoals = pgTable(
  "client_goals",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // SCHEMA-FK: Added FK constraint to organization
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => goalTemplates.id, { onDelete: "restrict" }),

    // User-configured values
    targetValue: numeric("target_value").notNull(),
    targetDenominator: integer("target_denominator"),
    customName: text("custom_name"),
    customDescription: text("custom_description"),

    // Computed state (updated by worker)
    currentValue: numeric("current_value"),
    attainmentPct: numeric("attainment_pct"),
    trendDirection: text("trend_direction"), // 'up', 'down', 'flat'
    trendValue: numeric("trend_value"),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),

    // Configuration
    isPrimary: boolean("is_primary").default(false),
    isClientVisible: boolean("is_client_visible").default(true),
    notifyOnRegression: boolean("notify_on_regression").default(true),
    regressionThreshold: numeric("regression_threshold").default("10"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_client_goals_client").on(table.clientId),
    index("idx_client_goals_workspace").on(table.workspaceId),
    index("idx_client_goals_template").on(table.templateId),
    // C-07: Prevent duplicate goals of same type per client
    uniqueIndex("uq_client_goals_client_template").on(table.clientId, table.templateId),
  ]
);

/**
 * Historical goal progress tracking.
 * One snapshot per goal per day for trend analysis.
 */
export const goalSnapshots = pgTable(
  "goal_snapshots",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => clientGoals.id, { onDelete: "cascade" }),
    snapshotDate: timestamp("snapshot_date", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    currentValue: numeric("current_value"),
    attainmentPct: numeric("attainment_pct"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_goal_snapshots_goal_date").on(table.goalId, table.snapshotDate),
  ]
);

// Type exports
export type GoalTemplateSelect = typeof goalTemplates.$inferSelect;
export type GoalTemplateInsert = typeof goalTemplates.$inferInsert;
export type ClientGoalSelect = typeof clientGoals.$inferSelect;
export type ClientGoalInsert = typeof clientGoals.$inferInsert;
export type GoalSnapshotSelect = typeof goalSnapshots.$inferSelect;
export type GoalSnapshotInsert = typeof goalSnapshots.$inferInsert;

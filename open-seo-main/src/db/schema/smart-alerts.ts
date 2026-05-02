/**
 * Smart Alerts Schema
 * Phase 62-01: Agency Command Center - Database Schema
 *
 * Tracks AI-detected anomalies and at-risk deals.
 */
import {
  pgTable,
  text,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "../user-schema";
import { type EntityType } from "./workflow-templates";

// Alert severity levels
export const ALERT_SEVERITY = ["critical", "high", "medium", "low"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITY)[number];

/**
 * smart_alerts table - AI-detected anomalies and at-risk deals.
 */
export const smartAlerts = pgTable(
  "smart_alerts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Alert definition
    alertType: text("alert_type").notNull(),
    severity: text("severity").$type<AlertSeverity>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),

    // Related entity (optional)
    entityType: text("entity_type").$type<EntityType>(),
    entityId: text("entity_id"),

    // Metrics comparison
    metricCurrent: numeric("metric_current"),
    metricPrevious: numeric("metric_previous"),
    metricUnit: text("metric_unit"),

    // Action guidance
    suggestedAction: text("suggested_action"),
    actionUrl: text("action_url"),

    // State
    isDismissed: boolean("is_dismissed").default(false).notNull(),
    dismissedBy: text("dismissed_by").references(() => user.id),
    dismissedAt: timestamp("dismissed_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Lifecycle
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_smart_alerts_workspace").on(table.workspaceId, table.isDismissed),
    index("ix_smart_alerts_active").on(table.workspaceId),
    index("ix_smart_alerts_type").on(table.workspaceId, table.alertType),
  ]
);

// Relations
export const smartAlertsRelations = relations(smartAlerts, ({ one }) => ({
  workspace: one(organization, {
    fields: [smartAlerts.workspaceId],
    references: [organization.id],
  }),
  dismisser: one(user, {
    fields: [smartAlerts.dismissedBy],
    references: [user.id],
  }),
}));

// Type exports
export type SmartAlertSelect = typeof smartAlerts.$inferSelect;
export type SmartAlertInsert = typeof smartAlerts.$inferInsert;

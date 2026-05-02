/**
 * Smart Alerts Schema - AI-detected anomalies and at-risk deals
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-08: Alert detection with dismissal tracking.
 */
import {
  pgTable,
  text,
  numeric,
  timestamp,
  boolean,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization, user } from "../user-schema";

// Alert severity levels
export const ALERT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/**
 * Smart alerts table - AI-detected anomalies and at-risk deals.
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
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),

    // Related entity (optional)
    entityType: text("entity_type"),
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
    index("ix_smart_alerts_workspace_dismissed").on(
      table.workspaceId,
      table.isDismissed
    ),
    index("ix_smart_alerts_active").on(table.workspaceId),
    index("ix_smart_alerts_type").on(table.workspaceId, table.alertType),
    check(
      "chk_smart_alerts_severity",
      sql`severity IN ('critical', 'high', 'medium', 'low')`
    ),
  ]
);

// Relations
export const smartAlertsRelations = relations(smartAlerts, ({ one }) => ({
  workspace: one(organization, {
    fields: [smartAlerts.workspaceId],
    references: [organization.id],
  }),
  dismissedByUser: one(user, {
    fields: [smartAlerts.dismissedBy],
    references: [user.id],
  }),
}));

// Inferred types
export type SmartAlertSelect = typeof smartAlerts.$inferSelect;
export type SmartAlertInsert = typeof smartAlerts.$inferInsert;

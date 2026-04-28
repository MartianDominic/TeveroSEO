/**
 * Schema for alerts and alert rules.
 * Phase 18: Monitoring & Alerts
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";

/**
 * Alert rules configure thresholds and notifications per client.
 */
export const alertRules = pgTable(
  "alert_rules",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    alertType: text("alert_type", {
      enum: ["ranking_drop", "sync_failure", "connection_expiry"],
    }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    threshold: integer("threshold"), // For ranking drops: minimum drop to alert
    severity: text("severity", {
      enum: ["info", "warning", "critical"],
    }).notNull().default("warning"),
    emailNotify: boolean("email_notify").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_alert_rules_client_type").on(table.clientId, table.alertType),
    index("ix_alert_rules_client").on(table.clientId),
  ],
);

/**
 * Alerts are triggered events that need attention.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
    alertType: text("alert_type").notNull(),
    severity: text("severity", {
      enum: ["info", "warning", "critical"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "acknowledged", "resolved", "dismissed"],
    }).notNull().default("pending"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    sourceEventId: text("source_event_id"), // Links to rank_drop_events.id or other event tables
    emailSentAt: timestamp("email_sent_at", { withTimezone: true, mode: "date" }),
    emailError: text("email_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_alerts_client_status").on(table.clientId, table.status),
    index("ix_alerts_client_created").on(table.clientId, table.createdAt),
    index("ix_alerts_source_event").on(table.sourceEventId),
  ],
);

export type AlertRuleSelect = typeof alertRules.$inferSelect;
export type AlertRuleInsert = typeof alertRules.$inferInsert;
export type AlertSelect = typeof alerts.$inferSelect;
export type AlertInsert = typeof alerts.$inferInsert;

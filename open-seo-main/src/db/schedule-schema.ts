/**
 * Drizzle ORM schema for report schedules.
 *
 * Schedules define when to automatically generate reports for clients.
 * Uses cron expressions with timezone support.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";

/**
 * Report schedule type enum values.
 * - monthly-seo: Monthly SEO performance report
 * - weekly-summary: Weekly summary report
 */
export type ScheduleReportType = "monthly-seo" | "weekly-summary";

/**
 * Report schedules table.
 * Stores schedule configuration for automated report generation.
 *
 * Indexes:
 * - ix_schedules_client_id: Quick lookup by client
 * - ix_schedules_next_run_enabled: Scheduler query for due schedules
 * - uq_schedules_client_type: One schedule per type per client
 */
export const reportSchedules = pgTable(
  "report_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // UUID reference to clients.id.
    // FK-02: CASCADE on delete removes schedules when client is deleted.
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    cronExpression: text("cron_expression").notNull(), // e.g., "0 6 * * 1" (Mondays 6am)
    timezone: text("timezone").notNull(), // e.g., "Europe/Vilnius"
    reportType: text("report_type").notNull(), // "monthly-seo", "weekly-summary"
    locale: text("locale").notNull().default("en"),
    recipients: jsonb("recipients").$type<string[]>().notNull(), // Array of email addresses
    enabled: boolean("enabled").notNull().default(true),
    lastRun: timestamp("last_run", { withTimezone: true }),
    nextRun: timestamp("next_run", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_schedules_client_id").on(table.clientId),
    index("ix_schedules_next_run_enabled").on(table.nextRun, table.enabled),
    uniqueIndex("uq_schedules_client_type").on(table.clientId, table.reportType),
  ],
);

// Type exports for use in queries
export type ReportScheduleSelect = typeof reportSchedules.$inferSelect;
export type ReportScheduleInsert = typeof reportSchedules.$inferInsert;

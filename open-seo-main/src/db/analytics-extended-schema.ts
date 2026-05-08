/**
 * Extended Analytics Schema
 * Phase 96-05: Client Portal
 *
 * Tables for client visibility controls, brand term tracking, and report scheduling.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";
import { organization } from "./user-schema";

/**
 * Visibility configuration interface
 * Controls which metrics clients can see in their portal
 */
export interface VisibilityConfig {
  showClicks: boolean;
  showImpressions: boolean;
  showPosition: boolean;
  showCtr: boolean;
  showQueries: boolean;
  showPages: boolean;
  showCompetitors: boolean;
  canViewGrowing: boolean;
  canViewDecaying: boolean;
  canViewCannibalization: boolean;
  canExport: boolean;
}

/**
 * Default visibility configuration
 * - Metrics visible by default except queries (privacy) and competitors (upsell)
 * - Reports visible by default except cannibalization (advanced)
 * - Export disabled by default (premium feature)
 */
export const DEFAULT_VISIBILITY: VisibilityConfig = {
  showClicks: true,
  showImpressions: true,
  showPosition: true,
  showCtr: true,
  showQueries: false, // Hidden by default - privacy
  showPages: true,
  showCompetitors: false, // Hidden by default - premium feature
  canViewGrowing: true,
  canViewDecaying: true,
  canViewCannibalization: false, // Hidden by default - advanced feature
  canExport: false, // Disabled by default - premium feature
};

/**
 * Client visibility table
 * Per-metric visibility controls for client portal access
 *
 * Unique constraint on (clientId, workspaceId) ensures one config per client per workspace
 */
export const clientVisibility = pgTable(
  "client_visibility",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Per-metric visibility
    showClicks: boolean("show_clicks").notNull().default(true),
    showImpressions: boolean("show_impressions").notNull().default(true),
    showPosition: boolean("show_position").notNull().default(true),
    showCtr: boolean("show_ctr").notNull().default(true),
    showQueries: boolean("show_queries").notNull().default(false), // Hidden by default
    showPages: boolean("show_pages").notNull().default(true),
    showCompetitors: boolean("show_competitors").notNull().default(false), // Hidden by default

    // Report access
    canViewGrowing: boolean("can_view_growing").notNull().default(true),
    canViewDecaying: boolean("can_view_decaying").notNull().default(true),
    canViewCannibalization: boolean("can_view_cannibalization")
      .notNull()
      .default(false), // Hidden by default
    canExport: boolean("can_export").notNull().default(false), // Disabled by default

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Unique constraint ensures one config per client per workspace
    unique("uq_client_visibility_client_workspace").on(
      table.clientId,
      table.workspaceId
    ),
    index("ix_client_visibility_client").on(table.clientId),
    index("ix_client_visibility_workspace").on(table.workspaceId),
  ]
);

/**
 * Brand term type for type exports
 */
export interface BrandTerm {
  id: string;
  clientId: string;
  term: string;
  isAutoDetected: boolean;
  createdAt: Date;
}

/**
 * Brand terms table
 * Stores brand-related keywords for branded vs non-branded split
 *
 * Auto-detected terms come from domain/site name extraction
 * Manual terms can be added by agencies
 */
export const brandTerms = pgTable(
  "brand_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    isAutoDetected: boolean("is_auto_detected").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ix_brand_terms_client").on(table.clientId),
    // Unique constraint prevents duplicate terms per client
    unique("uq_brand_terms_client_term").on(table.clientId, table.term),
  ]
);

/**
 * Analytics report schedule type for type exports
 * Different from schedule-schema.ts reportSchedules which is for client-level reports
 * This is for portfolio-level analytics reports with workspace scope
 */
export interface AnalyticsReportSchedule {
  id: string;
  workspaceId: string;
  clientId: string | null;
  frequency: "weekly" | "monthly";
  recipients: string[];
  nextRunAt: Date;
  lastRunAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Analytics report schedules table
 * Stores scheduled analytics report delivery configurations for portfolios
 *
 * Different from report_schedules in schedule-schema.ts:
 * - This supports workspace-level (portfolio) reports via nullable clientId
 * - Simplified frequency model (weekly/monthly vs cron)
 * - Focuses on analytics metrics exports
 *
 * clientId is nullable - null means workspace-wide portfolio report
 * recipients is JSONB array of email strings
 */
export const analyticsReportSchedules = pgTable(
  "analytics_report_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }), // null = workspace-wide report

    // Schedule configuration
    frequency: text("frequency").notNull(), // 'weekly' | 'monthly'
    recipients: jsonb("recipients").$type<string[]>().notNull().default([]),

    // Execution tracking
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ix_analytics_report_schedules_workspace").on(table.workspaceId),
    index("ix_analytics_report_schedules_client").on(table.clientId),
    index("ix_analytics_report_schedules_next_run").on(table.nextRunAt),
    index("ix_analytics_report_schedules_active").on(table.isActive),
  ]
);

// Type exports for database operations
export type ClientVisibility = typeof clientVisibility.$inferSelect;
export type ClientVisibilityInsert = typeof clientVisibility.$inferInsert;

export type BrandTermSelect = typeof brandTerms.$inferSelect;
export type BrandTermInsert = typeof brandTerms.$inferInsert;

export type AnalyticsReportScheduleSelect = typeof analyticsReportSchedules.$inferSelect;
export type AnalyticsReportScheduleInsert = typeof analyticsReportSchedules.$inferInsert;

// Re-export interface as ReportSchedule for backwards compatibility with plan
export type ReportSchedule = AnalyticsReportSchedule;

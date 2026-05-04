/**
 * Schema for agency dashboard metrics and views.
 * Phase 21: Agency Command Center
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";
import { audits, auditPages } from "./app.schema";

/**
 * Pre-computed dashboard metrics for each client.
 * Updated every 5 minutes by BullMQ worker.
 */
export const clientDashboardMetrics = pgTable(
  "client_dashboard_metrics",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .unique()
      .references(() => clients.id, { onDelete: "cascade" }),
    healthScore: integer("health_score").notNull().default(100),
    healthBreakdown: jsonb("health_breakdown").$type<{
      traffic: number;
      rankings: number;
      technical: number;
      backlinks: number;
      content: number;
    }>(),
    trafficCurrent: integer("traffic_current").default(0),
    trafficPrevious: integer("traffic_previous").default(0),
    trafficTrendPct: text("traffic_trend_pct"), // stored as text, convert to decimal in app
    keywordsTotal: integer("keywords_total").default(0),
    keywordsTop10: integer("keywords_top_10").default(0),
    keywordsTop3: integer("keywords_top_3").default(0),
    keywordsPosition1: integer("keywords_position_1").default(0),
    keywordsDistribution: jsonb("keywords_distribution").$type<Record<string, number>>(),
    backlinksTotal: integer("backlinks_total").default(0),
    backlinksNewMonth: integer("backlinks_new_month").default(0),
    alertsOpen: integer("alerts_open").default(0),
    alertsCritical: integer("alerts_critical").default(0),
    lastReportAt: timestamp("last_report_at", { withTimezone: true, mode: "date" }),
    lastAuditAt: timestamp("last_audit_at", { withTimezone: true, mode: "date" }),
    // Goal-based metrics (Phase 22)
    goalAttainmentPct: numeric("goal_attainment_pct"),
    goalsMetCount: integer("goals_met_count").default(0),
    goalsTotalCount: integer("goals_total_count").default(0),
    primaryGoalName: text("primary_goal_name"),
    primaryGoalPct: numeric("primary_goal_pct"),
    primaryGoalTrend: text("primary_goal_trend"),
    priorityScore: integer("priority_score").default(0),
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_dashboard_metrics_computed").on(table.computedAt),
  ],
);

/**
 * Portfolio-level activity feed for real-time updates.
 */
export const portfolioActivity = pgTable(
  "portfolio_activity",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }), // nullable for workspace-level events
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_activity_workspace_created").on(table.workspaceId, table.createdAt),
    index("ix_activity_client").on(table.clientId),
  ],
);

/**
 * Saved dashboard views (filters, layout, card order).
 */
export const dashboardViews = pgTable(
  "dashboard_views",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id"), // nullable for shared views
    name: text("name").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
    layout: jsonb("layout").$type<{ cardOrder: string[] }>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_views_workspace_user").on(table.workspaceId, table.userId),
    index("ix_views_default").on(table.workspaceId, table.isDefault),
  ],
);

export type ClientDashboardMetricsSelect = typeof clientDashboardMetrics.$inferSelect;
export type ClientDashboardMetricsInsert = typeof clientDashboardMetrics.$inferInsert;
export type PortfolioActivitySelect = typeof portfolioActivity.$inferSelect;
export type PortfolioActivityInsert = typeof portfolioActivity.$inferInsert;
export type DashboardViewSelect = typeof dashboardViews.$inferSelect;
export type DashboardViewInsert = typeof dashboardViews.$inferInsert;

/**
 * Pre-computed portfolio-level aggregates.
 * Updated by worker every 5 minutes.
 * Phase 23: Performance & Scale
 */
export const portfolioAggregates = pgTable(
  "portfolio_aggregates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().unique(),

    // Client counts
    totalClients: integer("total_clients").default(0),
    clientsOnTrack: integer("clients_on_track").default(0), // Goal >= 80%
    clientsWatching: integer("clients_watching").default(0), // Goal 60-79%
    clientsCritical: integer("clients_critical").default(0), // Goal < 60%
    clientsNoGoals: integer("clients_no_goals").default(0),

    // Goal aggregates
    totalGoals: integer("total_goals").default(0),
    goalsMet: integer("goals_met").default(0),
    avgGoalAttainment: numeric("avg_goal_attainment"),
    avgGoalAttainmentTrend: numeric("avg_goal_attainment_trend"),

    // Traffic aggregates
    totalClicks30d: integer("total_clicks_30d").default(0),
    totalImpressions30d: integer("total_impressions_30d").default(0),
    avgCtr: numeric("avg_ctr"),
    totalClicksTrend: numeric("total_clicks_trend"), // % change WoW

    // Keyword aggregates
    totalKeywordsTracked: integer("total_keywords_tracked").default(0),
    keywordsTop10: integer("keywords_top_10").default(0),
    keywordsTop3: integer("keywords_top_3").default(0),
    keywordsPosition1: integer("keywords_position_1").default(0),
    keywordsTop10Trend: integer("keywords_top_10_trend").default(0),

    // Alert aggregates
    alertsCriticalTotal: integer("alerts_critical_total").default(0),
    alertsWarningTotal: integer("alerts_warning_total").default(0),
    clientsWithCriticalAlerts: integer("clients_with_critical_alerts").default(0),

    // Team metrics
    unassignedClients: integer("unassigned_clients").default(0),
    avgDaysSinceTouch: numeric("avg_days_since_touch"),
    clientsNeglected: integer("clients_neglected").default(0), // > 7 days

    // Computation metadata
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).defaultNow(),
    computationDurationMs: integer("computation_duration_ms"),
  },
  (table) => [index("idx_portfolio_aggregates_workspace").on(table.workspaceId)],
);

export type PortfolioAggregatesSelect = typeof portfolioAggregates.$inferSelect;
export type PortfolioAggregatesInsert = typeof portfolioAggregates.$inferInsert;

/**
 * Granular SEO check findings per page.
 * Phase 32: 107 SEO Checks Implementation
 */
export const auditFindings = pgTable(
  "audit_findings",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    checkId: text("check_id").notNull(), // e.g., "T1-01"
    tier: integer("tier").notNull(), // 1-4
    category: text("category").notNull(),
    passed: boolean("passed").notNull(),
    severity: text("severity").notNull(), // critical/high/medium/low/info
    message: text("message").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    autoEditable: boolean("auto_editable").notNull().default(false),
    editRecipe: text("edit_recipe"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_findings_audit").on(table.auditId),
    index("ix_findings_page").on(table.pageId),
    index("ix_findings_check").on(table.checkId),
    index("ix_findings_severity_passed").on(table.severity, table.passed),
    // FIX-04 (C8): Index for cursor-based pagination using ID ordering
    index("ix_findings_audit_id").on(table.auditId, table.id),
    index("ix_findings_page_id").on(table.pageId, table.id),
  ]
);

export type AuditFindingSelect = typeof auditFindings.$inferSelect;
export type AuditFindingInsert = typeof auditFindings.$inferInsert;

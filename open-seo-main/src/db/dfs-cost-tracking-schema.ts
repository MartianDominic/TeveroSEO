/**
 * DataForSEO Cost Tracking Schema
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Tracks DataForSEO API costs for:
 * - Per-request attribution (client, job)
 * - Daily aggregates for dashboard
 * - Budget monitoring and alerts
 *
 * Cost savings from Standard Queue adoption should be visible here.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  real,
  boolean,
  index,
  date,
  bigint,
} from "drizzle-orm/pg-core";

// =============================================================================
// DFS Mode Types
// =============================================================================

/**
 * DataForSEO fetch modes in order of capability/cost.
 */
export const DFS_MODES = ["basic", "js", "browser"] as const;
export type DfsMode = (typeof DFS_MODES)[number];

/**
 * Queue types - Standard (async, cheaper) vs Live (sync, expensive).
 */
export const DFS_QUEUE_TYPES = ["standard", "live"] as const;
export type DfsQueueType = (typeof DFS_QUEUE_TYPES)[number];

/**
 * Import centralized pricing from single source of truth.
 * See: src/server/features/scraping/cost/dfs-pricing.ts
 */
import {
  DFS_STANDARD_COSTS as CENTRAL_STANDARD_COSTS,
  DFS_LIVE_COSTS as CENTRAL_LIVE_COSTS,
} from "@/server/features/scraping/cost";

/**
 * Cost per page by mode (Standard Queue pricing).
 * Imported from centralized pricing constants.
 */
export const DFS_STANDARD_COSTS: Record<DfsMode, number> = {
  basic: CENTRAL_STANDARD_COSTS.basic,
  js: CENTRAL_STANDARD_COSTS.js,
  browser: CENTRAL_STANDARD_COSTS.browser,
};

/**
 * Cost per page by mode (Live API pricing).
 * Imported from centralized pricing constants.
 */
export const DFS_LIVE_COSTS: Record<DfsMode, number> = {
  basic: CENTRAL_LIVE_COSTS.basic,
  js: CENTRAL_LIVE_COSTS.js,
  browser: CENTRAL_LIVE_COSTS.browser,
};

// =============================================================================
// DFS Cost Records Table
// =============================================================================

/**
 * Individual cost records for each DataForSEO API call.
 * Used for detailed cost attribution and debugging.
 */
export const dfsCostRecords = pgTable(
  "dfs_cost_records",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    // =========================================================================
    // Attribution
    // =========================================================================

    /** Client ID for multi-tenant cost allocation */
    clientId: text("client_id"),

    /** Job ID for correlation (audit ID, crawl batch, etc.) */
    jobId: text("job_id"),

    /** Workspace ID for organizational grouping */
    workspaceId: text("workspace_id"),

    // =========================================================================
    // Request Details
    // =========================================================================

    /** URL that was fetched */
    url: text("url").notNull(),

    /** Domain extracted from URL */
    domain: text("domain").notNull(),

    /** Mode used: basic, js, or browser */
    mode: text("mode").notNull().$type<DfsMode>(),

    /** Whether Standard Queue was used (vs Live API) */
    usedStandardQueue: boolean("used_standard_queue").notNull().default(false),

    /** DFS task ID (for Standard Queue polling) */
    taskId: text("task_id"),

    // =========================================================================
    // Cost
    // =========================================================================

    /** Estimated cost at time of request */
    estimatedCost: real("estimated_cost").notNull(),

    /** Actual cost returned by DFS API */
    actualCost: real("actual_cost"),

    // =========================================================================
    // Result
    // =========================================================================

    /** Whether the request succeeded */
    success: boolean("success").notNull().default(false),

    /** HTTP status code returned */
    statusCode: integer("status_code"),

    /** DFS-specific error code */
    dfsErrorCode: integer("dfs_error_code"),

    /** Error message if failed */
    errorMessage: text("error_message"),

    /** Response size in bytes */
    responseSizeBytes: integer("response_size_bytes"),

    /** Response time in milliseconds */
    responseTimeMs: integer("response_time_ms"),

    // =========================================================================
    // Timestamps
    // =========================================================================

    /** When the request was made */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Per-client cost analysis
    index("ix_dfs_cost_records_client").on(table.clientId, table.createdAt),

    // Per-workspace cost analysis
    index("ix_dfs_cost_records_workspace").on(table.workspaceId, table.createdAt),

    // Per-job correlation
    index("ix_dfs_cost_records_job").on(table.jobId),

    // Time-based aggregation
    index("ix_dfs_cost_records_created").on(table.createdAt),

    // Mode distribution analysis
    index("ix_dfs_cost_records_mode").on(table.mode, table.createdAt),

    // Queue type analysis
    index("ix_dfs_cost_records_queue").on(table.usedStandardQueue, table.createdAt),

    // Domain frequency analysis
    index("ix_dfs_cost_records_domain").on(table.domain, table.createdAt),

    // Failure analysis
    index("ix_dfs_cost_records_failures").on(table.success, table.dfsErrorCode),
  ]
);

// =============================================================================
// DFS Cost Daily Aggregates Table
// =============================================================================

/**
 * Pre-computed daily aggregates for fast dashboard queries.
 * Updated by cron job after each day ends.
 */
export const dfsCostDailyAggregates = pgTable(
  "dfs_cost_daily_aggregates",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /** Date of aggregation (UTC) */
    date: date("date", { mode: "string" }).notNull(),

    /** Client ID (null = all clients aggregate) */
    clientId: text("client_id"),

    /** Workspace ID (null = all workspaces aggregate) */
    workspaceId: text("workspace_id"),

    // =========================================================================
    // Totals
    // =========================================================================

    /** Total cost for the day */
    totalCost: real("total_cost").notNull().default(0),

    /** Total request count */
    requestCount: integer("request_count").notNull().default(0),

    /** Successful request count */
    successCount: integer("success_count").notNull().default(0),

    /** Failed request count */
    failureCount: integer("failure_count").notNull().default(0),

    // =========================================================================
    // By Mode
    // =========================================================================

    /** Basic mode cost */
    basicCost: real("basic_cost").notNull().default(0),

    /** Basic mode request count */
    basicCount: integer("basic_count").notNull().default(0),

    /** JS mode cost */
    jsCost: real("js_cost").notNull().default(0),

    /** JS mode request count */
    jsCount: integer("js_count").notNull().default(0),

    /** Browser mode cost */
    browserCost: real("browser_cost").notNull().default(0),

    /** Browser mode request count */
    browserCount: integer("browser_count").notNull().default(0),

    // =========================================================================
    // By Queue Type
    // =========================================================================

    /** Standard Queue cost */
    standardQueueCost: real("standard_queue_cost").notNull().default(0),

    /** Standard Queue request count */
    standardQueueCount: integer("standard_queue_count").notNull().default(0),

    /** Live API cost */
    liveCost: real("live_cost").notNull().default(0),

    /** Live API request count */
    liveCount: integer("live_count").notNull().default(0),

    // =========================================================================
    // Calculated Savings
    // =========================================================================

    /** What it would have cost using Live API only */
    hypotheticalLiveCost: real("hypothetical_live_cost").notNull().default(0),

    /** Savings from Standard Queue adoption */
    savingsFromStandardQueue: real("savings_from_standard_queue").notNull().default(0),

    // =========================================================================
    // Performance Metrics
    // =========================================================================

    /** Average response time in milliseconds */
    avgResponseTimeMs: integer("avg_response_time_ms"),

    /** Total bytes transferred */
    totalBytesTransferred: bigint("total_bytes_transferred", { mode: "number" }),

    // =========================================================================
    // Timestamps
    // =========================================================================

    /** When this aggregate was computed */
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    /** Standard audit timestamps */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Date + client lookup (most common query)
    index("ix_dfs_daily_date_client").on(table.date, table.clientId),

    // Date + workspace lookup
    index("ix_dfs_daily_date_workspace").on(table.date, table.workspaceId),

    // Date-only for global dashboard
    index("ix_dfs_daily_date").on(table.date),

    // Find days with high spend
    index("ix_dfs_daily_cost").on(table.totalCost),
  ]
);

// =============================================================================
// Budget Alert Records Table
// =============================================================================

/**
 * Tracks budget alert events to prevent duplicate notifications.
 */
export const dfsBudgetAlerts = pgTable(
  "dfs_budget_alerts",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /** Alert type: daily or monthly */
    alertType: text("alert_type").notNull().$type<"daily" | "monthly">(),

    /** Threshold that was crossed (0.5, 0.8, 0.95, 1.0) */
    threshold: real("threshold").notNull(),

    /** Spend amount when alert triggered */
    spendAmount: real("spend_amount").notNull(),

    /** Budget limit that was approached/exceeded */
    budgetLimit: real("budget_limit").notNull(),

    /** Workspace ID (null = global) */
    workspaceId: text("workspace_id"),

    /** Whether the alert was successfully sent */
    sentSuccessfully: boolean("sent_successfully").notNull().default(false),

    /** Alert delivery method used */
    deliveryMethod: text("delivery_method").$type<"webhook" | "email" | "both">(),

    /** Error message if delivery failed */
    deliveryError: text("delivery_error"),

    /** When this alert was created */
    alertedAt: timestamp("alerted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Find alerts for deduplication
    index("ix_dfs_budget_alerts_lookup").on(
      table.alertType,
      table.threshold,
      table.workspaceId,
      table.alertedAt
    ),

    // Time-based cleanup
    index("ix_dfs_budget_alerts_time").on(table.alertedAt),
  ]
);

// =============================================================================
// Inferred Types
// =============================================================================

export type DfsCostRecordSelect = typeof dfsCostRecords.$inferSelect;
export type DfsCostRecordInsert = typeof dfsCostRecords.$inferInsert;

export type DfsCostDailyAggregateSelect = typeof dfsCostDailyAggregates.$inferSelect;
export type DfsCostDailyAggregateInsert = typeof dfsCostDailyAggregates.$inferInsert;

export type DfsBudgetAlertSelect = typeof dfsBudgetAlerts.$inferSelect;
export type DfsBudgetAlertInsert = typeof dfsBudgetAlerts.$inferInsert;

// =============================================================================
// Budget Configuration
// =============================================================================

/**
 * Default budget configuration.
 * Can be overridden via environment variables.
 */
export const DEFAULT_DFS_BUDGET_CONFIG = {
  /** Daily budget limit in USD */
  dailyLimit: 10.0,

  /** Monthly budget limit in USD */
  monthlyLimit: 100.0,

  /** Alert thresholds (percentage of budget) */
  alertThresholds: [0.5, 0.8, 0.95, 1.0] as const,

  /** Minimum time between alerts for same threshold (hours) */
  alertCooldownHours: 24,
} as const;

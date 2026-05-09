/**
 * Tenant Isolation Schema
 * Database tables for multi-tenant isolation, cost tracking, and GDPR compliance.
 *
 * Tables:
 * - tenant_usage_daily: Daily cost aggregates per workspace/client
 * - tenant_usage_monthly: Monthly billing data
 * - data_deletion_log: GDPR deletion audit trail
 * - tenant_rate_limits: Custom rate limit configurations
 */

import {
  pgTable,
  text,
  uuid,
  date,
  bigint,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";

// --- Types ---

/**
 * Cost breakdown by operation type.
 */
export interface CostByOperation {
  chat_message?: number;
  content_generation?: number;
  seo_audit?: number;
  keyword_analysis?: number;
  serp_api?: number;
  gsc_api?: number;
  export?: number;
  image_generation?: number;
}

/**
 * Operation counts by type.
 */
export interface OperationCounts {
  [key: string]: number;
}

/**
 * Billing status for monthly usage.
 */
export const BILLING_STATUS = [
  "pending",
  "invoiced",
  "paid",
  "waived",
] as const;
export type BillingStatus = (typeof BILLING_STATUS)[number];

/**
 * Data deletion reasons.
 */
export const DELETION_REASONS = [
  "gdpr_request",
  "client_request",
  "churn",
  "test_data",
  "other",
] as const;
export type DeletionReason = (typeof DELETION_REASONS)[number];

/**
 * Deletion status.
 */
export const DELETION_STATUS = [
  "pending",
  "in_progress",
  "completed",
  "failed",
] as const;
export type DeletionStatus = (typeof DELETION_STATUS)[number];

/**
 * Rate limit categories.
 */
export const RATE_LIMIT_CATEGORIES = [
  "chat",
  "content_generation",
  "seo_audit",
  "api_call",
  "export",
  "bulk_operation",
] as const;
export type RateLimitCategory = (typeof RATE_LIMIT_CATEGORIES)[number];

// --- Tenant Usage Daily ---

/**
 * Daily usage aggregates per workspace/client.
 * Used for real-time cost monitoring and daily reports.
 */
export const tenantUsageDaily = pgTable(
  "tenant_usage_daily",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    // Date for this usage record
    usageDate: date("usage_date").notNull().defaultNow(),

    // Cost in microdollars (1/1,000,000 of a dollar)
    totalCostMicros: bigint("total_cost_micros", { mode: "number" })
      .notNull()
      .default(0),

    // Breakdown by operation type
    costByOperation: jsonb("cost_by_operation")
      .$type<CostByOperation>()
      .notNull()
      .default({}),

    // Token usage for LLM operations
    totalInputTokens: bigint("total_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalOutputTokens: bigint("total_output_tokens", { mode: "number" })
      .notNull()
      .default(0),

    // Operation counts
    operationCounts: jsonb("operation_counts")
      .$type<OperationCounts>()
      .notNull()
      .default({}),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ix_tenant_usage_daily_workspace").on(table.workspaceId),
    index("ix_tenant_usage_daily_workspace_date").on(
      table.workspaceId,
      table.usageDate
    ),
    index("ix_tenant_usage_daily_client").on(table.clientId),
    uniqueIndex("ix_tenant_usage_daily_unique").on(
      table.workspaceId,
      table.clientId,
      table.usageDate
    ),
  ]
);

export const tenantUsageDailyRelations = relations(
  tenantUsageDaily,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [tenantUsageDaily.workspaceId],
      references: [organization.id],
    }),
    client: one(clients, {
      fields: [tenantUsageDaily.clientId],
      references: [clients.id],
    }),
  })
);

export type TenantUsageDailySelect = typeof tenantUsageDaily.$inferSelect;
export type TenantUsageDailyInsert = typeof tenantUsageDaily.$inferInsert;

// --- Tenant Usage Monthly ---

/**
 * Monthly usage aggregates for billing.
 * Summarizes daily usage for invoice generation.
 */
export const tenantUsageMonthly = pgTable(
  "tenant_usage_monthly",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    // Month for this usage record (first day of month)
    usageMonth: date("usage_month").notNull(),

    // Cost in microdollars
    totalCostMicros: bigint("total_cost_micros", { mode: "number" })
      .notNull()
      .default(0),

    // Breakdown by operation type
    costByOperation: jsonb("cost_by_operation")
      .$type<CostByOperation>()
      .notNull()
      .default({}),

    // Token usage
    totalInputTokens: bigint("total_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalOutputTokens: bigint("total_output_tokens", { mode: "number" })
      .notNull()
      .default(0),

    // Operation counts
    operationCounts: jsonb("operation_counts")
      .$type<OperationCounts>()
      .notNull()
      .default({}),

    // Billing status
    billingStatus: text("billing_status")
      .$type<BillingStatus>()
      .notNull()
      .default("pending"),
    invoiceId: text("invoice_id"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ix_tenant_usage_monthly_workspace").on(table.workspaceId),
    index("ix_tenant_usage_monthly_workspace_month").on(
      table.workspaceId,
      table.usageMonth
    ),
    index("ix_tenant_usage_monthly_billing").on(table.billingStatus),
    uniqueIndex("ix_tenant_usage_monthly_unique").on(
      table.workspaceId,
      table.clientId,
      table.usageMonth
    ),
    check(
      "chk_billing_status_valid",
      sql`billing_status IN ('pending', 'invoiced', 'paid', 'waived')`
    ),
  ]
);

export const tenantUsageMonthlyRelations = relations(
  tenantUsageMonthly,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [tenantUsageMonthly.workspaceId],
      references: [organization.id],
    }),
    client: one(clients, {
      fields: [tenantUsageMonthly.clientId],
      references: [clients.id],
    }),
  })
);

export type TenantUsageMonthlySelect = typeof tenantUsageMonthly.$inferSelect;
export type TenantUsageMonthlyInsert = typeof tenantUsageMonthly.$inferInsert;

// --- Data Deletion Log ---

/**
 * GDPR Article 17 compliance: audit log of data deletion requests.
 * Preserves anonymized records of deletions for compliance verification.
 */
export const dataDeletionLog = pgTable(
  "data_deletion_log",
  {
    id: text("id").primaryKey(),

    // Request details
    workspaceId: text("workspace_id").notNull(),
    clientId: uuid("client_id").notNull(), // Not FK since client will be deleted
    clientNameHash: text("client_name_hash").notNull(), // Anonymized

    // Actor information
    requestedBy: text("requested_by").notNull(),

    // Deletion details
    reason: text("reason").$type<DeletionReason>().notNull(),
    notes: text("notes"),

    // Counts of deleted records
    deletedCounts: jsonb("deleted_counts")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),

    // Status
    status: text("status").$type<DeletionStatus>().notNull().default("pending"),
    errorMessage: text("error_message"),

    // Timestamps
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_data_deletion_log_workspace").on(table.workspaceId),
    index("ix_data_deletion_log_status").on(table.status),
    index("ix_data_deletion_log_requested_at").on(table.requestedAt),
    check(
      "chk_deletion_reason_valid",
      sql`reason IN ('gdpr_request', 'client_request', 'churn', 'test_data', 'other')`
    ),
    check(
      "chk_deletion_status_valid",
      sql`status IN ('pending', 'in_progress', 'completed', 'failed')`
    ),
  ]
);

export type DataDeletionLogSelect = typeof dataDeletionLog.$inferSelect;
export type DataDeletionLogInsert = typeof dataDeletionLog.$inferInsert;

// --- Tenant Rate Limits ---

/**
 * Custom rate limit configurations per workspace.
 * Allows overriding default limits for specific workspaces.
 */
export const tenantRateLimits = pgTable(
  "tenant_rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Limit category
    category: text("category").$type<RateLimitCategory>().notNull(),

    // Limit configuration
    maxRequests: integer("max_requests").notNull(),
    windowSeconds: integer("window_seconds").notNull(),

    // Whether this overrides the default
    isCustom: boolean("is_custom").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ix_tenant_rate_limits_workspace").on(table.workspaceId),
    uniqueIndex("ix_tenant_rate_limits_unique").on(
      table.workspaceId,
      table.category
    ),
    check(
      "chk_rate_limit_category_valid",
      sql`category IN ('chat', 'content_generation', 'seo_audit', 'api_call', 'export', 'bulk_operation')`
    ),
  ]
);

export const tenantRateLimitsRelations = relations(
  tenantRateLimits,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [tenantRateLimits.workspaceId],
      references: [organization.id],
    }),
  })
);

export type TenantRateLimitsSelect = typeof tenantRateLimits.$inferSelect;
export type TenantRateLimitsInsert = typeof tenantRateLimits.$inferInsert;

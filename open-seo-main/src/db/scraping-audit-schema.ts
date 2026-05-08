/**
 * Scraping Audit Log Schema
 * Phase 95-14: Security & Authentication
 *
 * Stores audit trail for all admin actions on scraping infrastructure:
 * - Who performed the action (IP, user agent, API key prefix)
 * - What action was performed
 * - When it occurred
 * - Success/failure result
 * - Duration for performance monitoring
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";

// =============================================================================
// Action Types
// =============================================================================

/**
 * Audit action types for admin operations.
 */
export const SCRAPING_AUDIT_ACTIONS = [
  "emergency_stop",
  "resume",
  "circuit_force_open",
  "circuit_force_close",
  "circuit_reset",
  "migration_advance",
  "migration_rollback",
  "cache_warm",
  "cache_invalidate",
  "queue_drain",
  "domain_reset",
  "feedback_flush",
  "feedback_clear",
  "config_change",
] as const;

export type ScrapingAuditAction = (typeof SCRAPING_AUDIT_ACTIONS)[number];

/**
 * Audit severity levels.
 */
export const SCRAPING_AUDIT_SEVERITIES = ["info", "warning", "critical"] as const;

export type ScrapingAuditSeverity = (typeof SCRAPING_AUDIT_SEVERITIES)[number];

/**
 * Mapping of actions to their severity levels.
 */
export const ACTION_SEVERITY_MAP: Record<ScrapingAuditAction, ScrapingAuditSeverity> = {
  emergency_stop: "critical",
  resume: "warning",
  circuit_force_open: "warning",
  circuit_force_close: "warning",
  circuit_reset: "warning",
  migration_advance: "warning",
  migration_rollback: "critical",
  cache_warm: "info",
  cache_invalidate: "warning",
  queue_drain: "critical",
  domain_reset: "info",
  feedback_flush: "info",
  feedback_clear: "warning",
  config_change: "warning",
};

// =============================================================================
// Schema Definition
// =============================================================================

/**
 * Scraping audit log table.
 *
 * Records all admin actions for:
 * - Compliance auditing
 * - Incident investigation
 * - Performance monitoring
 * - Security analysis
 */
export const scrapingAuditLogs = pgTable(
  "scraping_audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Action classification
    action: text("action").notNull(),
    severity: text("severity").notNull(),

    // Actor information
    actorIp: text("actor_ip").notNull(),
    actorUserAgent: text("actor_user_agent"),
    actorApiKeyPrefix: text("actor_api_key_prefix"), // First 8 chars for identification

    // Target information (what was acted upon)
    targetType: text("target_type"), // 'circuit', 'migration', 'cache', 'queue', 'domain'
    targetId: text("target_id"),

    // Action details (flexible JSON for action-specific data)
    parameters: jsonb("parameters").$type<Record<string, unknown>>(),

    // Result
    result: text("result").notNull(), // 'success' | 'failure'
    errorMessage: text("error_message"),

    // Performance
    durationMs: integer("duration_ms"),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Query patterns:
    // 1. Recent actions by severity (for alerts dashboard)
    index("ix_scraping_audit_severity_created").on(
      table.severity,
      table.createdAt
    ),

    // 2. Actions by actor IP (for security investigation)
    index("ix_scraping_audit_actor_ip").on(table.actorIp, table.createdAt),

    // 3. Actions by type (for specific action history)
    index("ix_scraping_audit_action").on(table.action, table.createdAt),

    // 4. Failed actions (for error analysis)
    index("ix_scraping_audit_failures").on(table.result, table.createdAt),

    // 5. Cleanup old logs (for retention policies)
    index("ix_scraping_audit_created_at").on(table.createdAt),

    // 6. Actions by target (for tracking changes to specific resources)
    index("ix_scraping_audit_target").on(
      table.targetType,
      table.targetId,
      table.createdAt
    ),
  ]
);

// =============================================================================
// Types
// =============================================================================

export type ScrapingAuditLogSelect = typeof scrapingAuditLogs.$inferSelect;
export type ScrapingAuditLogInsert = typeof scrapingAuditLogs.$inferInsert;

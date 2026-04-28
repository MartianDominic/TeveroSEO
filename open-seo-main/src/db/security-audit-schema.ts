/**
 * Security audit log schema for tracking auth events.
 * Phase 40: Observability improvements.
 *
 * Stores security-relevant events for audit trails:
 * - Authentication failures (invalid keys, expired tokens)
 * - Permission denied (insufficient scopes)
 * - Suspicious activity (rate limit violations, repeated failures)
 */
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Security event types.
 */
export const SECURITY_EVENT_TYPES = [
  "auth_failure", // Invalid credentials, missing token
  "permission_denied", // Valid auth but insufficient permissions
  "rate_limit_exceeded", // Too many requests
  "suspicious_activity", // Patterns indicating potential attack
  "token_expired", // Expired JWT or API key
  "webhook_verification_failed", // Invalid webhook signature
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/**
 * Security audit log table.
 *
 * Records security events with contextual information for:
 * - Compliance auditing
 * - Incident investigation
 * - Pattern detection
 */
export const securityAuditLog = pgTable(
  "security_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Event classification
    eventType: text("event_type").notNull(),

    // Optional user context (may be null for failed auth)
    userId: text("user_id"),
    organizationId: text("organization_id"),

    // Request context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    path: text("path"),
    method: text("method"),
    requestId: text("request_id"),

    // Event details (flexible JSON for event-specific data)
    details: jsonb("details").$type<Record<string, unknown>>(),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_security_audit_event_type").on(table.eventType),
    index("ix_security_audit_user").on(table.userId),
    index("ix_security_audit_org").on(table.organizationId),
    index("ix_security_audit_ip").on(table.ipAddress),
    index("ix_security_audit_created").on(table.createdAt),
    index("ix_security_audit_request").on(table.requestId),
  ],
);

// Inferred types
export type SecurityAuditLogSelect = typeof securityAuditLog.$inferSelect;
export type SecurityAuditLogInsert = typeof securityAuditLog.$inferInsert;

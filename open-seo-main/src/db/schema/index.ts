/**
 * Schema index - re-exports all schema definitions
 * Phase 62-01: Agency Command Center
 *
 * =============================================================================
 * MED-17: ID Type Decisions (text vs uuid)
 * =============================================================================
 * This codebase uses TWO ID types intentionally:
 *
 * 1. text("id") - Used for:
 *    - Tables created early in the project (legacy)
 *    - Tables using external IDs (e.g., Clerk user IDs)
 *    - Tables using nanoid/cuid for shorter, URL-friendly IDs
 *    Examples: prospects, audits, proposals, workflow_instances
 *
 * 2. uuid("id").defaultRandom() - Used for:
 *    - Tables with high insert volume (better distribution)
 *    - Tables requiring strong uniqueness guarantees
 *    - Tables where ID format doesn't matter to users
 *    Examples: clients, invoices
 *
 * When joining text/uuid columns, ensure explicit casting in queries:
 *   WHERE clients.id::text = prospects.converted_client_id
 *
 * =============================================================================
 * MED-19: Soft Delete Semantics (isDeleted vs isArchived)
 * =============================================================================
 * This codebase uses TWO soft delete patterns with different semantics:
 *
 * 1. isDeleted (boolean) - True deletion intent:
 *    - User explicitly deleted the record
 *    - Should NOT appear in ANY UI or queries
 *    - Can be permanently purged after retention period
 *    - Used for: clients, projects, analytics snapshots, site changes
 *
 * 2. isArchived (boolean) - Preserved but inactive:
 *    - Record is complete/closed/no longer active
 *    - MAY appear in historical views, reports, analytics
 *    - Should NOT be permanently deleted
 *    - Used for: organizations, audits, voice profiles, proposal templates
 *
 * Query patterns:
 *   Active records: WHERE is_deleted = false (or is_archived = false)
 *   Include archived: WHERE is_deleted = false (archives visible)
 *   Everything: No filter (admin/audit views only)
 */
export * from "./follow-ups";
export * from "./workflow-templates";
export * from "./workflow-instances";
export * from "./smart-alerts";
export * from "./proposal-versions";
export * from "./deal-outcomes";
export * from "./pipeline-metrics";
export * from "./notification-preferences";
export * from "./dashboard-views";
export * from "./agreement-signers-schema";

// Phase 67-01: Database Consolidation - Unified schemas with namespace prefixes
export * from "./shared-clients";
export * from "./shared-voice-profiles";
export * from "./seo-gsc-snapshots";
export * from "./seo-ga4-snapshots";

// Phase 82: Chat Integration
export * from "./analysis-sessions";

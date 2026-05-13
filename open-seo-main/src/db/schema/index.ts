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
 *
 * =============================================================================
 * DBS-005/006/007: Soft Delete Pattern Standardization (Phase 96)
 * =============================================================================
 * MIGRATION IN PROGRESS: Moving from isDeleted+deletedAt to softDeletedAt
 *
 * NEW STANDARD PATTERN:
 *   Column: soft_deleted_at TIMESTAMPTZ DEFAULT NULL
 *   Query:  WHERE soft_deleted_at IS NULL
 *   Mixin:  import { softDeleteColumns } from "./soft-delete-columns"
 *
 * Tables already using new pattern:
 *   - site_tags, client_tags
 *   - content_groups, analytics_topic_clusters
 *   - page_index_status, indexing_requests
 *   - analytics_annotations
 *
 * Tables with BOTH patterns (migration in progress):
 *   - clients, projects, reports, content_briefs
 *   - seo_gsc_snapshots, seo_ga4_snapshots
 *   - site_changes, proposals
 *
 * After migration 0082 completes, legacy columns will be removed.
 * Use softDeleteColumns mixin for all new tables.
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

// Phase 98: SEO Chat
export * from "./seo-chat";

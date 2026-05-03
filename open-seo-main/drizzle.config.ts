import { defineConfig } from "drizzle-kit";

/**
 * Drizzle ORM configuration for database consolidation.
 * Phase 67-01: Schema Design (Database Consolidation)
 *
 * ORM Boundary:
 *   - Drizzle owns: shared_*, seo_*, biz_*, analytics_* tables
 *   - SQLAlchemy owns: content_* tables
 *
 * The tablesFilter ensures Drizzle only manages its owned namespaces,
 * preventing conflicts with AI-Writer's SQLAlchemy migrations.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // ORM boundary: Drizzle manages these namespaces only
  // Excludes content_* tables which are owned by SQLAlchemy/Alembic
  tablesFilter: [
    "shared_*",     // Unified client/voice tables
    "seo_*",        // SEO audit, analytics, checks
    "biz_*",        // Business/prospect pipeline
    "analytics_*",  // Analytics snapshots
    // Legacy tables (non-prefixed) for backwards compatibility
    // These will be migrated to namespaced versions in future phases
    "clients",
    "voice_profiles",
    "projects",
    "audits",
    "prospects",
    "proposals",
    "contracts",
    "invoices",
    "organizations",
    "users",
    "sessions",
    "api_keys",
    "connections",
    "reports",
    "schedules",
    "branding",
    "mappings",
    "changes",
    "goals",
    "alerts",
    "dashboards",
    "links",
    "briefs",
    "embeddings",
    "crawls",
    "rankings",
    "patterns",
    "pipeline_*",
    "workflow_*",
    "follow_*",
    "deal_*",
    "smart_*",
    "notification_*",
    "onboarding_*",
    "magic_*",
    "activity_*",
    "tasks",
    "report_*",
    "payment_*",
    "translation_*",
    "agreement_*",
    "proposal_*",
    "variable_*",
    "service_*",
    "pixel_*",
    "api_*",
    "platform_*",
    "oauth_*",
    "gsc_*",
    "ga4_*",
  ],
});

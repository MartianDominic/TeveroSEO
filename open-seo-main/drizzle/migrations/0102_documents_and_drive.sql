-- Phase 101: Document Management (D-04)
-- Migration: 0102_documents_and_drive.sql
--
-- Creates document management tables with Google Drive integration:
-- - documents: File metadata with sync modes
-- - document_versions: Version history for imported files
-- - document_reminders: Smart automation scheduling

-- ============================================================================
-- Documents Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "documents" (
    "id" TEXT PRIMARY KEY,

    -- Workspace scoping (tenant isolation)
    "workspace_id" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,

    -- Entity links (all nullable for flexibility)
    "client_id" TEXT REFERENCES "clients"("id") ON DELETE SET NULL,
    "prospect_id" TEXT REFERENCES "prospects"("id") ON DELETE SET NULL,
    "proposal_id" TEXT REFERENCES "proposals"("id") ON DELETE SET NULL,

    -- File metadata
    "name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,

    -- Google Drive integration
    "drive_file_id" TEXT,
    "drive_folder_id" TEXT,
    "sync_mode" TEXT NOT NULL DEFAULT 'link_only',

    -- Local storage (for import_copy mode)
    "local_path" TEXT,

    -- External URL (for link_only mode)
    "external_url" TEXT,

    -- Sync tracking
    "last_synced_at" TIMESTAMPTZ,

    -- View tracking
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMPTZ,

    -- Standard timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Audit trail
    "created_by" TEXT,

    -- Soft delete (7-year retention for audit compliance)
    "soft_deleted_at" TIMESTAMPTZ,

    -- Check constraint for sync mode
    CONSTRAINT "chk_document_sync_mode" CHECK (sync_mode IN ('two_way_sync', 'import_copy', 'link_only'))
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS "ix_documents_workspace" ON "documents"("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_documents_client" ON "documents"("client_id");
CREATE INDEX IF NOT EXISTS "ix_documents_proposal" ON "documents"("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_documents_drive_file" ON "documents"("drive_file_id");
CREATE INDEX IF NOT EXISTS "ix_documents_soft_deleted" ON "documents"("soft_deleted_at");

-- ============================================================================
-- Document Versions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "document_versions" (
    "id" TEXT PRIMARY KEY,

    -- Parent document
    "document_id" TEXT NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,

    -- Version info
    "version_number" INTEGER NOT NULL,
    "drive_revision_id" TEXT,

    -- File data
    "size_bytes" INTEGER,
    "snapshot_path" TEXT,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_by" TEXT,

    -- Unique constraint on document + version
    CONSTRAINT "uq_doc_versions_document_version" UNIQUE ("document_id", "version_number")
);

-- Indexes for document_versions
CREATE INDEX IF NOT EXISTS "ix_doc_versions_document" ON "document_versions"("document_id");

-- ============================================================================
-- Document Reminders Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "document_reminders" (
    "id" TEXT PRIMARY KEY,

    -- Parent document
    "document_id" TEXT NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,

    -- Reminder configuration
    "reminder_type" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ NOT NULL,

    -- Execution tracking
    "sent_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'pending',

    -- Extra context (jsonb for flexibility)
    "metadata" JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Check constraints
    CONSTRAINT "chk_reminder_type" CHECK (reminder_type IN ('unopened', 'expiring', 'follow_up', 're_engagement')),
    CONSTRAINT "chk_reminder_status" CHECK (status IN ('pending', 'sent', 'cancelled'))
);

-- Indexes for document_reminders
CREATE INDEX IF NOT EXISTS "ix_doc_reminders_document" ON "document_reminders"("document_id");
CREATE INDEX IF NOT EXISTS "ix_doc_reminders_scheduled" ON "document_reminders"("scheduled_for", "status");

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE "documents" IS 'Document metadata with Google Drive integration (Phase 101 D-04)';
COMMENT ON COLUMN "documents"."sync_mode" IS 'two_way_sync: changes reflect in both places; import_copy: file copied locally; link_only: just store URL';
COMMENT ON TABLE "document_versions" IS 'Version history for imported documents';
COMMENT ON TABLE "document_reminders" IS 'Smart automation reminders for document follow-ups';

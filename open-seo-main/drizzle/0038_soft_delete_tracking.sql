-- Migration: 0038_soft_delete_tracking.sql
-- Purpose: Add soft delete pattern to tracking entities (siteChanges, voiceProfiles, analytics)
-- Rationale:
--   - siteChanges cascade delete destroys SEO change history, making rollback impossible
--   - voiceProfiles cascade delete destroys expensive learned brand voice data
--   - Analytics snapshots are irreplaceable (can't re-sync historical GSC/GA4 data)

-- ============================================================================
-- 1. Add soft delete columns to site_changes
-- ============================================================================
ALTER TABLE site_changes
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering active records efficiently
CREATE INDEX IF NOT EXISTS ix_site_changes_deleted ON site_changes (is_deleted);

-- Change FK cascade behavior from CASCADE to SET NULL to preserve orphan records
-- First drop the existing constraints, then recreate with SET NULL
ALTER TABLE site_changes
  DROP CONSTRAINT IF EXISTS site_changes_client_id_clients_id_fk;

ALTER TABLE site_changes
  ADD CONSTRAINT site_changes_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE site_changes
  DROP CONSTRAINT IF EXISTS site_changes_connection_id_site_connections_id_fk;

ALTER TABLE site_changes
  ADD CONSTRAINT site_changes_connection_id_site_connections_id_fk
  FOREIGN KEY (connection_id) REFERENCES site_connections(id) ON DELETE SET NULL;

-- Allow NULL for clientId and connectionId now that we use SET NULL
ALTER TABLE site_changes
  ALTER COLUMN client_id DROP NOT NULL,
  ALTER COLUMN connection_id DROP NOT NULL;

-- ============================================================================
-- 2. Add soft delete columns to voice_profiles
-- ============================================================================
ALTER TABLE voice_profiles
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index for filtering active profiles efficiently
CREATE INDEX IF NOT EXISTS ix_voice_profiles_archived ON voice_profiles (is_archived);

-- Change FK cascade behavior from CASCADE to SET NULL
ALTER TABLE voice_profiles
  DROP CONSTRAINT IF EXISTS voice_profiles_client_id_clients_id_fk;

ALTER TABLE voice_profiles
  ADD CONSTRAINT voice_profiles_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Allow NULL for clientId now that we use SET NULL
ALTER TABLE voice_profiles
  ALTER COLUMN client_id DROP NOT NULL;

-- ============================================================================
-- 3. Add soft delete columns to seo_gsc_snapshots
-- ============================================================================
ALTER TABLE seo_gsc_snapshots
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering active snapshots efficiently
CREATE INDEX IF NOT EXISTS ix_seo_gsc_snapshots_deleted ON seo_gsc_snapshots (is_deleted);

-- ============================================================================
-- 4. Add soft delete columns to seo_ga4_snapshots
-- ============================================================================
ALTER TABLE seo_ga4_snapshots
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering active snapshots efficiently
CREATE INDEX IF NOT EXISTS ix_seo_ga4_snapshots_deleted ON seo_ga4_snapshots (is_deleted);

-- ============================================================================
-- 5. Add soft delete columns to gsc_query_snapshots (also irreplaceable)
-- ============================================================================
ALTER TABLE gsc_query_snapshots
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering active query snapshots efficiently
CREATE INDEX IF NOT EXISTS ix_gsc_query_snapshots_deleted ON gsc_query_snapshots (is_deleted);

-- ============================================================================
-- Note: Analytics tables (seo_gsc_snapshots, seo_ga4_snapshots, gsc_query_snapshots)
-- keep CASCADE on client FK because:
-- 1. We rarely delete clients
-- 2. Analytics data without a client has no business context
-- 3. The soft delete flag handles normal "deletion" use cases
-- ============================================================================

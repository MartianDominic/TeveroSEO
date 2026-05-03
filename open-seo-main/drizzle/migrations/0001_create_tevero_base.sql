-- ============================================================================
-- Phase 67-02: Migration Scripts
-- 0001_create_tevero_base.sql - Base migration for database consolidation
-- ============================================================================
--
-- Creates the foundation for database consolidation:
--   1. Database if not exists (must be run as superuser)
--   2. Required PostgreSQL extensions
--   3. Migration tracking tables
--   4. ORM ownership registry
--
-- Idempotent: All statements use IF NOT EXISTS
-- Rollback: Use scripts/db/rollback_base.sql
-- ============================================================================

-- Note: CREATE DATABASE must be run outside a transaction.
-- Run this command manually if the database doesn't exist:
-- CREATE DATABASE tevero;

-- Connect to the tevero database before running the rest of this script.

-- ============================================================================
-- Extensions
-- ============================================================================

-- UUID generation support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram indexing for full-text search and fuzzy matching
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- Migration Tracking Tables
-- ============================================================================

-- _migration_log: Tracks all migration executions with status
CREATE TABLE IF NOT EXISTS _migration_log (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
    error_message TEXT,
    rows_affected INTEGER DEFAULT 0,
    duration_ms INTEGER,
    executed_by TEXT DEFAULT current_user
);

-- Index for querying migration history
CREATE INDEX IF NOT EXISTS ix_migration_log_name ON _migration_log(migration_name);
CREATE INDEX IF NOT EXISTS ix_migration_log_status ON _migration_log(status);
CREATE INDEX IF NOT EXISTS ix_migration_log_started_at ON _migration_log(started_at DESC);

-- ============================================================================
-- ORM Ownership Registry
-- ============================================================================

-- _migration_ownership: Tracks which ORM owns each table
-- Prevents accidental schema modifications by the wrong ORM
CREATE TABLE IF NOT EXISTS _migration_ownership (
    table_name TEXT PRIMARY KEY,
    owner_orm TEXT NOT NULL CHECK (owner_orm IN ('drizzle', 'sqlalchemy', 'shared')),
    namespace TEXT, -- e.g., 'shared_', 'seo_', 'alwrity_'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-populate ownership for consolidated tables (Phase 67)
INSERT INTO _migration_ownership (table_name, owner_orm, namespace, description)
VALUES
    ('shared_clients', 'drizzle', 'shared_', 'Unified client data from open_seo and alwrity'),
    ('shared_voice_profiles', 'drizzle', 'shared_', 'Unified voice profiles and writing personas'),
    ('seo_gsc_snapshots', 'drizzle', 'seo_', 'Google Search Console analytics'),
    ('seo_ga4_snapshots', 'drizzle', 'seo_', 'Google Analytics 4 snapshots'),
    ('_migration_log', 'shared', NULL, 'Migration tracking (both ORMs)'),
    ('_migration_ownership', 'shared', NULL, 'ORM ownership registry (both ORMs)')
ON CONFLICT (table_name) DO UPDATE SET
    owner_orm = EXCLUDED.owner_orm,
    namespace = EXCLUDED.namespace,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to log migration start
CREATE OR REPLACE FUNCTION migration_start(p_name TEXT) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO _migration_log (migration_name, status)
    VALUES (p_name, 'started')
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log migration completion
CREATE OR REPLACE FUNCTION migration_complete(p_id INTEGER, p_rows INTEGER DEFAULT 0) RETURNS VOID AS $$
BEGIN
    UPDATE _migration_log
    SET
        status = 'completed',
        completed_at = NOW(),
        rows_affected = p_rows,
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log migration failure
CREATE OR REPLACE FUNCTION migration_fail(p_id INTEGER, p_error TEXT) RETURNS VOID AS $$
BEGIN
    UPDATE _migration_log
    SET
        status = 'failed',
        completed_at = NOW(),
        error_message = p_error,
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a migration has been completed
CREATE OR REPLACE FUNCTION migration_completed(p_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM _migration_log
        WHERE migration_name = p_name
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Log this migration
-- ============================================================================

DO $$
DECLARE
    v_migration_id INTEGER;
BEGIN
    -- Skip if already completed
    IF migration_completed('0001_create_tevero_base') THEN
        RAISE NOTICE 'Migration 0001_create_tevero_base already completed, skipping.';
        RETURN;
    END IF;

    v_migration_id := migration_start('0001_create_tevero_base');

    -- Migration logic is the DDL above (already executed)

    PERFORM migration_complete(v_migration_id, 6); -- 6 rows in _migration_ownership

    RAISE NOTICE 'Migration 0001_create_tevero_base completed successfully.';
END $$;

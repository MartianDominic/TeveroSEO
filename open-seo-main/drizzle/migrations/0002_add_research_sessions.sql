-- ============================================================================
-- Phase 93-01: Keyword Coverage Intelligence
-- 0002_add_research_sessions.sql - Research session tracking table
-- ============================================================================
--
-- Creates research_sessions table for:
--   1. Audit trail of all keyword research operations
--   2. Coverage dashboard data source
--   3. Cost attribution and deduplication metrics
--
-- Append-only pattern: NO updates, only inserts (audit trail)
-- Idempotent: Uses IF NOT EXISTS
-- ============================================================================

-- Create research_sessions table
CREATE TABLE IF NOT EXISTS research_sessions (
    id TEXT PRIMARY KEY,
    prospect_id TEXT NOT NULL,

    -- Research parameters
    mode TEXT NOT NULL,
    seed_keywords JSONB NOT NULL,
    location_code INTEGER NOT NULL,
    language_code TEXT NOT NULL,

    -- Results
    new_keywords_count INTEGER NOT NULL,
    duplicate_count INTEGER NOT NULL,
    total_cost_usd REAL NOT NULL,

    -- Audit trail
    triggered_by TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign key to prospects (cascade delete)
    CONSTRAINT fk_research_sessions_prospect
        FOREIGN KEY (prospect_id)
        REFERENCES prospects(id)
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS ix_research_sessions_prospect
    ON research_sessions(prospect_id);

CREATE INDEX IF NOT EXISTS ix_research_sessions_created
    ON research_sessions(created_at);

CREATE INDEX IF NOT EXISTS ix_research_sessions_mode
    ON research_sessions(mode);

-- Add comment for documentation
COMMENT ON TABLE research_sessions IS 'Phase 93-01: Tracks keyword research operations for coverage analysis and cost attribution. Append-only audit trail pattern.';

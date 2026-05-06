-- Phase 86-07: Proposal Edits Table for Undo/Redo
-- Stores immutable edit history with version snapshots

CREATE TABLE IF NOT EXISTS proposal_edits (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  -- Version tracking
  version INTEGER NOT NULL,
  previous_version INTEGER,

  -- Edit type and data
  edit_type TEXT NOT NULL CHECK (edit_type IN ('remove_cluster', 'add_keyword', 'remove_keyword', 'change_distribution')),
  edit_data JSONB NOT NULL,

  -- AI-generated summary for display
  ai_summary TEXT NOT NULL,

  -- State snapshot (for undo - stores full state at this version)
  state_snapshot JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast version-based queries
CREATE INDEX IF NOT EXISTS idx_proposal_edits_proposal_version
  ON proposal_edits (proposal_id, version DESC);

-- Index for undo/redo navigation
CREATE INDEX IF NOT EXISTS idx_proposal_edits_proposal_id
  ON proposal_edits (proposal_id);

-- Comments
COMMENT ON TABLE proposal_edits IS 'Phase 86-07: Immutable edit history for proposal undo/redo';
COMMENT ON COLUMN proposal_edits.state_snapshot IS 'Full proposal state at this version for instant restore';
COMMENT ON COLUMN proposal_edits.ai_summary IS 'Human-readable description of the edit';

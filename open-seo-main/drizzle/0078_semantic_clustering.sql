-- Phase 86: Semantic Clustering Schema Extension
-- Adds cluster-based keyword structure to existing proposals table

-- Add new columns for semantic clustering
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS clusters JSONB,
  ADD COLUMN IF NOT EXISTS backfill_pool JSONB,
  ADD COLUMN IF NOT EXISTS blacklist JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS distribution JSONB,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- GIN index for fast JSONB queries on clusters
-- Enables efficient queries like: WHERE clusters @> '[{"tier": "pillar"}]'
CREATE INDEX IF NOT EXISTS idx_proposals_clusters_gin
  ON proposals USING GIN (clusters);

-- Index for version-based queries (undo/redo)
CREATE INDEX IF NOT EXISTS idx_proposals_version
  ON proposals (id, version);

-- Comment for documentation
COMMENT ON COLUMN proposals.clusters IS 'Phase 86: Scored clusters with selected keywords (ScoredCluster[])';
COMMENT ON COLUMN proposals.backfill_pool IS 'Phase 86: 200-keyword pool for editing without re-clustering';
COMMENT ON COLUMN proposals.blacklist IS 'Phase 86: Keywords removed by user, excluded from future proposals';
COMMENT ON COLUMN proposals.distribution IS 'Phase 86: Funnel distribution targets {bofu, mofu, tofu}';
COMMENT ON COLUMN proposals.version IS 'Phase 86: Edit version for undo/redo history';

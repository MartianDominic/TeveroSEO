-- Proposal Backfill Pool Table
-- Phase 86-09: Backfill Pool + Learning
--
-- Stores exactly 200 backup keywords per proposal for editing operations.
-- When clusters are removed, keywords from this pool replace them.
-- Pool is replenished asynchronously via BullMQ worker.

CREATE TABLE IF NOT EXISTS "proposal_backfill" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "proposal_id" uuid NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,

  -- Keyword data
  "keyword" text NOT NULL,
  "volume" integer NOT NULL,
  "difficulty" integer NOT NULL,
  "funnel_stage" text NOT NULL,

  -- Cluster context
  "cluster_id" uuid NOT NULL,
  "cluster_label" text NOT NULL,

  -- Embedding for semantic matching (768-dim, stored as JSONB)
  "embedding" jsonb NOT NULL,

  -- Relevance for prioritization (higher = consumed first)
  "relevance_score" real NOT NULL DEFAULT 0,

  -- Metadata
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "proposal_backfill_proposal_id_idx"
  ON "proposal_backfill" ("proposal_id");

-- Composite index for getting highest relevance keywords per proposal
CREATE INDEX IF NOT EXISTS "proposal_backfill_relevance_idx"
  ON "proposal_backfill" ("proposal_id", "relevance_score" DESC);

COMMENT ON TABLE "proposal_backfill" IS
  'Backfill pool: exactly 200 backup keywords per proposal. Consumed during editing, replenished via BullMQ.';

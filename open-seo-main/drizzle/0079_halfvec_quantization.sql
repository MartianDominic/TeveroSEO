-- Halfvec Quantization Migration
-- Phase 86-08: Storage Optimization
--
-- Converts embedding columns from vector(768) to halfvec(768)
-- for 50% storage reduction with minimal accuracy loss.
--
-- IMPORTANT: Requires pgvector extension version 0.5.0+ for halfvec support

-- Ensure pgvector extension is enabled and supports halfvec
DO $$
BEGIN
  -- Check if pgvector extension exists
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE EXTENSION vector;
  END IF;

  -- Verify pgvector version supports halfvec (0.5.0+)
  -- halfvec was added in pgvector 0.5.0
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'halfvec'
  ) THEN
    RAISE EXCEPTION 'pgvector version does not support halfvec. Please upgrade to pgvector 0.5.0+';
  END IF;
END $$;

-- Add halfvec column to keyword_embeddings
ALTER TABLE keyword_embeddings
  ADD COLUMN IF NOT EXISTS embedding_hv halfvec(768);

-- Migrate existing data (FP32 -> FP16)
-- The cast to halfvec automatically handles the precision reduction
UPDATE keyword_embeddings
SET embedding_hv = embedding::halfvec(768)
WHERE embedding_hv IS NULL AND embedding IS NOT NULL;

-- Create HNSW index on halfvec column for cosine similarity
-- Parameters tuned for 768-dim embeddings:
-- - m = 16: connections per layer (default, good for high-dim)
-- - ef_construction = 64: build quality (higher = better recall, slower build)
CREATE INDEX IF NOT EXISTS keyword_embeddings_hv_idx
  ON keyword_embeddings
  USING hnsw (embedding_hv halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add halfvec column to cluster_centroids (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cluster_centroids') THEN
    ALTER TABLE cluster_centroids
      ADD COLUMN IF NOT EXISTS centroid_hv halfvec(768);

    -- Migrate centroid data
    UPDATE cluster_centroids
    SET centroid_hv = centroid::halfvec(768)
    WHERE centroid_hv IS NULL AND centroid IS NOT NULL;

    -- Index for centroid similarity search
    CREATE INDEX IF NOT EXISTS cluster_centroids_hv_idx
      ON cluster_centroids
      USING hnsw (centroid_hv halfvec_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- Note: Keep original vector columns until migration verified
-- Drop commands to be executed manually after validation:
-- ALTER TABLE keyword_embeddings DROP COLUMN embedding;
-- ALTER TABLE cluster_centroids DROP COLUMN centroid;

COMMENT ON COLUMN keyword_embeddings.embedding_hv IS 'halfvec(768) - 50% storage vs FP32, pgvector 0.5.0+ required';

-- Migration: Add idempotency_keys table
-- Purpose: Store idempotency keys to prevent duplicate operations
-- Each key has a TTL after which it expires and can be reused

-- Create the idempotency_keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for cleanup queries (finding expired keys)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
ON idempotency_keys (expires_at);

-- Add comment for documentation
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations. Keys expire after TTL.';
COMMENT ON COLUMN idempotency_keys.key IS 'Unique idempotency key (e.g., "change:apply:client123:resource456:recipe789")';
COMMENT ON COLUMN idempotency_keys.result IS 'JSON-serialized result of the operation';
COMMENT ON COLUMN idempotency_keys.created_at IS 'When this key was created';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'When this key expires and can be reused';

-- Cleanup job (run periodically via cron or pg_cron)
-- Example: Run every hour to clean up expired keys
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 * * * *', 'DELETE FROM idempotency_keys WHERE expires_at < NOW()');

-- Manual cleanup command:
-- DELETE FROM idempotency_keys WHERE expires_at < NOW();

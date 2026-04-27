/**
 * Migration: Add idempotency_keys table
 *
 * Creates table for storing idempotency keys to prevent duplicate operations.
 * Each key has a TTL after which it expires and can be reused.
 */

import { sql, type InferInsertModel } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export const up = async (db: NodePgDatabase) => {
  // Create the idempotency_keys table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key VARCHAR(255) PRIMARY KEY,
      result JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `);

  // Create index for cleanup queries (finding expired keys)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
    ON idempotency_keys (expires_at);
  `);

  // Add comment for documentation
  await db.execute(sql`
    COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate operations. Keys expire after TTL.';
  `);

  console.log("[Migration] Created idempotency_keys table");
};

export const down = async (db: NodePgDatabase) => {
  await db.execute(sql`DROP INDEX IF EXISTS idx_idempotency_keys_expires;`);
  await db.execute(sql`DROP TABLE IF EXISTS idempotency_keys;`);
  console.log("[Migration] Dropped idempotency_keys table");
};

/**
 * SQL script for manual execution if needed:
 *
 * -- Create table
 * CREATE TABLE IF NOT EXISTS idempotency_keys (
 *   key VARCHAR(255) PRIMARY KEY,
 *   result JSONB NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   expires_at TIMESTAMP WITH TIME ZONE NOT NULL
 * );
 *
 * -- Index for cleanup
 * CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
 * ON idempotency_keys (expires_at);
 *
 * -- Cleanup job (run periodically via cron or pg_cron)
 * DELETE FROM idempotency_keys WHERE expires_at < NOW();
 */

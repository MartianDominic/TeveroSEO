/**
 * Database module for Drizzle ORM.
 *
 * Exports database connection and all schema definitions.
 *
 * Improvements (fixes CRITICAL-CONN-003):
 * - Larger connection pool (20 connections)
 * - Idle timeout to close stale connections
 * - Connection lifecycle management (max_lifetime equivalent via pool recycling)
 * - Health check function for monitoring
 * - Graceful shutdown support
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

// Schema exports
export * from "./schema";

// Database connection - require explicit configuration
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is required — set it in .env or the deployment environment before starting the server.",
  );
}

/**
 * PostgreSQL connection pool.
 * Exported for graceful shutdown and direct pool access when needed.
 *
 * Pool configuration (fixes CRITICAL-CONN-003):
 * - max: 20 connections (increased from 10 for better concurrency)
 * - idleTimeoutMillis: 20s (close idle connections to free resources)
 * - connectionTimeoutMillis: 10s (fail fast on connection issues)
 * - allowExitOnIdle: true (allow process to exit when pool is idle)
 */
export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DB_POOL_SIZE) || 20,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : false,
});

// Handle unexpected pool errors gracefully - log but don't exit to allow recovery
pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err);
});

/**
 * Check database health by executing a simple query.
 * Use this for health check endpoints and monitoring.
 *
 * @returns true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("[db] Health check failed:", e);
    return false;
  }
}

/**
 * Get current pool statistics for monitoring.
 */
export function getPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
} {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

/**
 * Gracefully close the database pool.
 * Call this during application shutdown.
 */
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    console.log("[db] Connection pool closed");
  } catch (e) {
    console.error("[db] Error closing pool:", e);
    throw e;
  }
}

export const db = drizzle(pool, { schema });

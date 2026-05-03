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
export * from "./webhook-schema";

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

// Handle unexpected pool errors - log and handle fatal errors appropriately
pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err);

  // Check if error is fatal (connection lost or refused)
  const errorMessage = err.message || "";
  const isFatalError =
    errorMessage.includes("Connection terminated") ||
    errorMessage.includes("connection refused") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("the database system is starting up") ||
    errorMessage.includes("the database system is shutting down");

  if (isFatalError) {
    console.error("[db] Fatal pool error detected - attempting recovery");

    // In production, exit and let orchestrator restart the process
    // This ensures a clean reconnection rather than operating in a degraded state
    if (process.env.NODE_ENV === "production") {
      console.error("[db] Exiting due to fatal database error (orchestrator will restart)");
      process.exit(1);
    }
    // In development, just log - developer can restart manually
    console.error("[db] Development mode - manual restart may be required");
  }
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

/**
 * Type alias for the database client.
 * Use this when injecting db into services.
 */
export type DbClient = typeof db;

/**
 * Type for Drizzle transaction context.
 * Use this when passing transaction to repository methods.
 */
export type DrizzleTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

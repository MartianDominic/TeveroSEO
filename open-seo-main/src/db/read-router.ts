/**
 * Read routing module for database consolidation.
 * Phase 67-03: Cutover
 *
 * Implements gradual read migration from primary database to tevero:
 *   - DB_READ_PERCENTAGE_TEVERO controls percentage of reads to tevero
 *   - Random selection determines which database handles each read
 *   - Allows gradual migration with instant rollback capability
 *
 * Environment variables:
 *   - DB_READ_PERCENTAGE_TEVERO: 0-100, percentage of reads to route to tevero
 *   - TEVERO_DATABASE_URL: Connection string for consolidated database
 *
 * Migration phases:
 *   1. Set to 0 (default): all reads from primary
 *   2. Set to 10: 10% of reads from tevero (testing)
 *   3. Set to 50: 50/50 split (validation)
 *   4. Set to 90: 90% from tevero (near-complete migration)
 *   5. Set to 100: all reads from tevero (full migration)
 *
 * Rollback: Set DB_READ_PERCENTAGE_TEVERO=0 to instantly route all reads back to primary
 *
 * Requirements:
 *   - HIGH-DB-003: Zero-downtime cutover
 *   - MED-DB-007: Feature flag controlled migration
 */

import { db as primaryDb } from "./index";
import { createTeveroDb } from "./dual-write";

/**
 * Read percentage for tevero database.
 * 0 = all reads from primary
 * 100 = all reads from tevero
 */
const DB_READ_PERCENTAGE_TEVERO = parseInt(
  process.env.DB_READ_PERCENTAGE_TEVERO || "0",
  10
);

/**
 * Tables that are eligible for read routing.
 * Only tables that have been migrated to tevero should be included.
 */
const ROUTABLE_TABLES = new Set([
  "shared_clients",
  "shared_voice_profiles",
]);

/**
 * Determines if a read should be routed to tevero database.
 *
 * Uses random selection based on DB_READ_PERCENTAGE_TEVERO.
 * For example, if percentage is 30, there's a 30% chance this returns true.
 *
 * @param table - The table name being read from
 * @returns true if the read should go to tevero, false for primary
 */
export function shouldReadFromTevero(table: string): boolean {
  // Only route tables that have been migrated
  if (!ROUTABLE_TABLES.has(table)) {
    return false;
  }

  // If percentage is 0, always use primary (fast path)
  if (DB_READ_PERCENTAGE_TEVERO <= 0) {
    return false;
  }

  // If percentage is 100, always use tevero (fast path)
  if (DB_READ_PERCENTAGE_TEVERO >= 100) {
    return true;
  }

  // Random selection based on percentage
  return Math.random() * 100 < DB_READ_PERCENTAGE_TEVERO;
}

/**
 * Get the appropriate database connection for reading.
 *
 * Routes reads between primary and tevero based on:
 * - Table eligibility (must be in ROUTABLE_TABLES)
 * - DB_READ_PERCENTAGE_TEVERO setting
 * - Random selection
 *
 * @param table - The table name being read from
 * @returns Database client (primary or tevero)
 */
export function getReadDb(table: string) {
  if (shouldReadFromTevero(table)) {
    try {
      return createTeveroDb();
    } catch (err) {
      // If tevero connection fails, fall back to primary
      console.error("[read-router] Failed to connect to tevero, using primary:", err);
      return primaryDb;
    }
  }
  return primaryDb;
}

/**
 * Get the current read percentage setting.
 * Useful for monitoring and debugging.
 */
export function getReadPercentage(): number {
  return DB_READ_PERCENTAGE_TEVERO;
}

/**
 * Check if a table is routable to tevero.
 *
 * @param table - The table name to check
 * @returns true if the table can be routed to tevero
 */
export function isRoutableTable(table: string): boolean {
  return ROUTABLE_TABLES.has(table);
}

/**
 * Get list of all routable tables.
 * Useful for monitoring which tables are part of the migration.
 */
export function getRoutableTables(): string[] {
  return Array.from(ROUTABLE_TABLES);
}

/**
 * Read router status for monitoring.
 */
export interface ReadRouterStatus {
  enabled: boolean;
  percentage: number;
  routableTables: string[];
}

/**
 * Get current read router status.
 * Useful for health checks and monitoring dashboards.
 */
export function getReadRouterStatus(): ReadRouterStatus {
  return {
    enabled: DB_READ_PERCENTAGE_TEVERO > 0,
    percentage: DB_READ_PERCENTAGE_TEVERO,
    routableTables: getRoutableTables(),
  };
}

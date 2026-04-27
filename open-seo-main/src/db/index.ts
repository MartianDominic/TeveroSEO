/**
 * Database module for Drizzle ORM.
 *
 * Exports database connection and all schema definitions.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// Schema exports
export * from "./schema";

// Database connection
const connectionString = process.env.DATABASE_URL || "postgresql://localhost:5432/open_seo";

/**
 * PostgreSQL connection pool.
 * Exported for graceful shutdown and direct pool access when needed.
 */
export const pool = new pg.Pool({
  connectionString,
  max: 10,
});

export const db = drizzle(pool);

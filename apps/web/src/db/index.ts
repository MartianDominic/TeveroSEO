/**
 * Database module for apps/web
 *
 * Connects to the same PostgreSQL database as open-seo-main.
 * Imports schema definitions for SEO Chat tables.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as seoChatSchema from "./schema/seo-chat";
import * as documentBuilderSchema from "./schema/document-builder";

// Database connection - require explicit configuration
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is required",
  );
}

/**
 * PostgreSQL connection pool.
 */
export const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
});

/**
 * Drizzle database instance with SEO Chat schema.
 */
export const db = drizzle(pool, {
  schema: {
    ...seoChatSchema,
    ...documentBuilderSchema,
  },
});

/**
 * Re-export schema for convenience
 */
export * from "./schema/seo-chat";
export * from "./schema/document-builder";

/**
 * Graceful shutdown
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

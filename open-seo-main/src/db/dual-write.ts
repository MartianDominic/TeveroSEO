/**
 * Dual-write module for database consolidation.
 * Phase 67-03: Cutover
 *
 * Implements shadow write pattern for zero-downtime migration:
 *   - Primary write (blocking): writes to current database
 *   - Shadow write (fire-and-forget): writes to tevero consolidated database
 *
 * Environment variables:
 *   - SHADOW_WRITE_ENABLED: Set to 'true' to enable shadow writes
 *   - TEVERO_DATABASE_URL: Connection string for consolidated database
 *
 * Requirements:
 *   - HIGH-DB-003: Zero-downtime cutover
 *   - MED-DB-007: Feature flag controlled migration
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import { sharedClients, type SharedClientInsert } from "./schema/shared-clients";

/**
 * Shadow write feature flag.
 * When true, writes to tevero database in addition to primary.
 */
const SHADOW_WRITE_ENABLED = process.env.SHADOW_WRITE_ENABLED === "true";

/**
 * Tevero database URL for consolidated database.
 */
const TEVERO_DATABASE_URL = process.env.TEVERO_DATABASE_URL;

/**
 * Cached pool for tevero database connection.
 * Lazily initialized on first shadow write.
 */
let teveroPool: pg.Pool | null = null;

/**
 * Creates or returns cached tevero database connection.
 * Uses a separate pool from primary to avoid connection interference.
 *
 * @returns Drizzle database client for tevero database
 */
export function createTeveroDb() {
  if (!TEVERO_DATABASE_URL) {
    throw new Error(
      "TEVERO_DATABASE_URL environment variable is required for shadow writes"
    );
  }

  if (!teveroPool) {
    teveroPool = new pg.Pool({
      connectionString: TEVERO_DATABASE_URL,
      max: 5, // Smaller pool for shadow writes
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: true }
          : false,
    });

    teveroPool.on("error", (err) => {
      console.error("[dual-write] Tevero pool error:", err);
    });
  }

  return drizzle(teveroPool, {
    schema: { sharedClients },
  });
}

/**
 * Closes the tevero database pool.
 * Call during application shutdown.
 */
export async function closeTeveroPool(): Promise<void> {
  if (teveroPool) {
    await teveroPool.end();
    teveroPool = null;
    console.log("[dual-write] Tevero pool closed");
  }
}

/**
 * Client data for dual-write operations.
 */
export type ClientData = SharedClientInsert;

/**
 * Performs a shadow write to tevero database.
 * Fire-and-forget pattern: does not block primary operation.
 *
 * @param operation - The operation type ('insert' or 'update')
 * @param data - The client data to write
 * @param clientId - For updates, the client ID to update
 */
async function shadowWrite(
  operation: "insert" | "update",
  data: ClientData,
  clientId?: string
): Promise<void> {
  if (!SHADOW_WRITE_ENABLED) {
    return;
  }

  if (!TEVERO_DATABASE_URL) {
    console.warn("[dual-write] TEVERO_DATABASE_URL not set, skipping shadow write");
    return;
  }

  try {
    const teveroDb = createTeveroDb();

    if (operation === "insert") {
      await teveroDb.insert(sharedClients).values(data);
      console.log("[dual-write] Shadow insert successful");
    } else if (operation === "update" && clientId) {
      await teveroDb
        .update(sharedClients)
        .set(data)
        .where(eq(sharedClients.id, clientId));
      console.log("[dual-write] Shadow update successful");
    }
  } catch (err) {
    // Fire-and-forget: log error but don't throw
    console.error("[dual-write] Shadow write failed:", err);
  }
}

/**
 * Dual-write insert: creates client in primary DB with shadow write to tevero.
 *
 * @param primaryDb - Primary database client
 * @param data - Client data to insert
 * @returns The inserted client from primary database
 */
export async function dualWriteClientInsert<T>(
  primaryDb: { insert: (table: typeof sharedClients) => { values: (data: ClientData) => { returning: () => Promise<T[]> } } },
  data: ClientData
): Promise<T[]> {
  // Primary write (blocking)
  const result = await primaryDb
    .insert(sharedClients)
    .values(data)
    .returning();

  // Shadow write (fire-and-forget)
  shadowWrite("insert", data).catch((err) =>
    console.error("[dual-write] Shadow write failed:", err)
  );

  return result;
}

/**
 * Dual-write update: updates client in primary DB with shadow write to tevero.
 *
 * @param primaryDb - Primary database client
 * @param clientId - The client ID to update
 * @param data - Client data to update
 * @returns The updated client from primary database
 */
export async function dualWriteClientUpdate<T>(
  primaryDb: {
    update: (table: typeof sharedClients) => {
      set: (data: Partial<ClientData>) => {
        where: (condition: ReturnType<typeof eq>) => { returning: () => Promise<T[]> };
      };
    };
  },
  clientId: string,
  data: Partial<ClientData>
): Promise<T[]> {
  // Primary write (blocking)
  const result = await primaryDb
    .update(sharedClients)
    .set(data)
    .where(eq(sharedClients.id, clientId))
    .returning();

  // Shadow write (fire-and-forget)
  shadowWrite("update", data as ClientData, clientId).catch((err) =>
    console.error("[dual-write] Shadow write failed:", err)
  );

  return result;
}

/**
 * Simple dual-write client function for basic operations.
 * For backwards compatibility with plan specification.
 *
 * @param operation - 'insert' or 'update'
 * @param data - Client data
 * @param primaryDb - Primary database client
 * @param clientId - For updates, the client ID
 * @returns Result from primary write
 */
export async function dualWriteClient(
  operation: "insert" | "update",
  data: ClientData,
  primaryDb: ReturnType<typeof drizzle>,
  clientId?: string
) {
  if (operation === "insert") {
    // Primary write (blocking)
    const result = await primaryDb.insert(sharedClients).values(data).returning();

    // Shadow write (fire-and-forget)
    if (SHADOW_WRITE_ENABLED) {
      shadowWrite("insert", data).catch((err) =>
        console.error("[dual-write] Shadow write failed:", err)
      );
    }

    return result;
  } else if (operation === "update" && clientId) {
    // Primary write (blocking)
    const result = await primaryDb
      .update(sharedClients)
      .set(data)
      .where(eq(sharedClients.id, clientId))
      .returning();

    // Shadow write (fire-and-forget)
    if (SHADOW_WRITE_ENABLED) {
      shadowWrite("update", data, clientId).catch((err) =>
        console.error("[dual-write] Shadow write failed:", err)
      );
    }

    return result;
  }

  throw new Error(`Invalid operation: ${operation}`);
}

/**
 * Check if shadow write is enabled.
 */
export function isShadowWriteEnabled(): boolean {
  return SHADOW_WRITE_ENABLED;
}

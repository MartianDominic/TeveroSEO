/**
 * Row Level Security Context Middleware
 *
 * Sets the PostgreSQL session variables that RLS policies use
 * to determine data access. Must be called at the start of each
 * request that accesses the database.
 *
 * Usage:
 *   await setRLSContext({ userId: 'xxx', orgId: 'yyy' });
 *   // ... database operations are now scoped to this user/org
 */

import { db, pool } from "@/db";
import { sql } from "drizzle-orm";
import type { PoolClient } from "pg";

/**
 * RLS context configuration.
 */
export interface RLSContext {
  /** The authenticated user's ID */
  userId: string;
  /** The user's current organization ID */
  orgId?: string;
  /** Whether the user has admin privileges */
  isAdmin?: boolean;
}

/**
 * Set the user context for Row Level Security.
 * Call this at the start of each request before any database operations.
 *
 * @param ctx - The RLS context containing user and org info
 * @throws Error if the context cannot be set
 */
export async function setRLSContext(ctx: RLSContext): Promise<void> {
  const userId = ctx.userId;
  const orgId = ctx.orgId ?? "";
  const isAdmin = ctx.isAdmin ?? false;

  await db.execute(sql`
    SELECT set_user_context(
      ${userId}::text,
      ${orgId}::text,
      ${isAdmin}::boolean
    )
  `);
}

/**
 * Clear the RLS context.
 * Call this when the request completes or the user logs out.
 */
export async function clearRLSContext(): Promise<void> {
  await db.execute(sql`SELECT clear_user_context()`);
}

/**
 * Execute a database operation with RLS context.
 * Automatically sets and clears the context.
 *
 * @param ctx - The RLS context
 * @param operation - The async operation to execute
 * @returns The result of the operation
 *
 * @example
 * const clients = await withRLSContext(
 *   { userId: auth.userId, orgId: auth.orgId },
 *   async () => db.select().from(clients)
 * );
 */
export async function withRLSContext<T>(
  ctx: RLSContext,
  operation: () => Promise<T>
): Promise<T> {
  await setRLSContext(ctx);
  try {
    return await operation();
  } finally {
    // Clear context after operation
    // Note: In a transaction, context is automatically cleared on commit/rollback
    await clearRLSContext();
  }
}

/**
 * Execute a database operation with RLS context in a transaction.
 * The context is set within the transaction and automatically cleared on commit/rollback.
 *
 * IMPORTANT: The operation callback receives the connected client (PoolClient) with
 * RLS context already set. All queries within the operation MUST use this client
 * to ensure RLS policies are enforced.
 *
 * @param ctx - The RLS context
 * @param operation - The async operation to execute within the transaction (receives PoolClient)
 * @returns The result of the operation
 *
 * @example
 * const result = await withRLSTransaction(
 *   { userId: auth.userId, orgId: auth.orgId },
 *   async (client) => {
 *     // Use client.query() for all database operations
 *     await client.query('INSERT INTO clients (name) VALUES ($1)', [data.name]);
 *     await client.query('INSERT INTO audit_logs (action) VALUES ($1)', ['insert']);
 *     return data;
 *   }
 * );
 */
export async function withRLSTransaction<T>(
  ctx: RLSContext,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Set context within the transaction
    await client.query("SELECT set_user_context($1, $2, $3)", [
      ctx.userId,
      ctx.orgId ?? "",
      ctx.isAdmin ?? false,
    ]);

    // CRITICAL: Pass `client` (with RLS context set), NOT `pool`
    const result = await operation(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a request handler wrapper that automatically sets RLS context.
 * Use this to wrap your API handlers.
 *
 * @param handler - The handler function to wrap
 * @returns A wrapped handler that sets RLS context
 *
 * @example
 * const getClients = createRLSHandler(async (input, ctx) => {
 *   return db.select().from(clients);
 * });
 */
export function createRLSHandler<TInput, TOutput>(
  handler: (input: TInput, ctx: RLSContext) => Promise<TOutput>
) {
  return async (input: TInput, ctx: RLSContext): Promise<TOutput> => {
    return withRLSContext(ctx, () => handler(input, ctx));
  };
}

/**
 * Extract RLS context from a request.
 * Override this based on your auth system (Clerk, better-auth, etc.)
 *
 * @param req - The incoming request
 * @returns RLS context or null if not authenticated
 */
export function extractRLSContextFromRequest(req: {
  headers?: Record<string, string | undefined>;
  auth?: {
    userId?: string;
    orgId?: string;
    isAdmin?: boolean;
  };
}): RLSContext | null {
  // Extract from auth object (set by auth middleware)
  if (req.auth?.userId) {
    return {
      userId: req.auth.userId,
      orgId: req.auth.orgId,
      isAdmin: req.auth.isAdmin,
    };
  }

  return null;
}

/**
 * Middleware factory for setting RLS context.
 * Integrates with TanStack Start or Express-style middleware.
 *
 * @example
 * // TanStack Start
 * const middleware = createRLSMiddleware({
 *   getContext: (ctx) => ({
 *     userId: ctx.auth.userId,
 *     orgId: ctx.auth.orgId,
 *   }),
 * });
 */
export function createRLSMiddleware<TContext>(options: {
  getContext: (ctx: TContext) => RLSContext | null;
  onUnauthenticated?: () => void;
}) {
  return async <T>(
    ctx: TContext,
    next: () => Promise<T>
  ): Promise<T> => {
    const rlsContext = options.getContext(ctx);

    if (!rlsContext) {
      if (options.onUnauthenticated) {
        options.onUnauthenticated();
      }
      throw new Error("Unauthorized: RLS context not available");
    }

    return withRLSContext(rlsContext, next);
  };
}

/**
 * Type guard to check if RLS context is set.
 */
export function hasRLSContext(ctx: unknown): ctx is { rls: RLSContext } {
  return (
    typeof ctx === "object" &&
    ctx !== null &&
    "rls" in ctx &&
    typeof (ctx as Record<string, unknown>).rls === "object"
  );
}

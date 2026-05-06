/**
 * Out-of-Scope Repository
 * Phase 89-04: Out-of-Scope Detection
 *
 * CRUD operations for out_of_scope_requests table.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  outOfScopeRequests,
  type OutOfScopeRequestInsert,
  type OutOfScopeRequestSelect,
  type OutOfScopeStatus,
} from "@/db/keyword-lockin-schema";

/**
 * Insert a new out-of-scope request.
 */
export async function insertOutOfScopeRequest(
  request: OutOfScopeRequestInsert
): Promise<OutOfScopeRequestSelect> {
  const [inserted] = await db
    .insert(outOfScopeRequests)
    .values(request)
    .returning();
  return inserted;
}

/**
 * Get out-of-scope requests for a contract.
 */
export async function getRequestsByContract(
  contractId: string,
  options?: {
    status?: OutOfScopeStatus;
    limit?: number;
  }
): Promise<OutOfScopeRequestSelect[]> {
  const conditions = [eq(outOfScopeRequests.contractId, contractId)];

  if (options?.status) {
    conditions.push(eq(outOfScopeRequests.status, options.status));
  }

  return await db
    .select()
    .from(outOfScopeRequests)
    .where(and(...conditions))
    .orderBy(desc(outOfScopeRequests.requestedAt))
    .limit(options?.limit ?? 100);
}

/**
 * Get out-of-scope requests for a client.
 */
export async function getRequestsByClient(
  clientId: string,
  options?: {
    status?: OutOfScopeStatus;
    limit?: number;
  }
): Promise<OutOfScopeRequestSelect[]> {
  const conditions = [eq(outOfScopeRequests.clientId, clientId)];

  if (options?.status) {
    conditions.push(eq(outOfScopeRequests.status, options.status));
  }

  return await db
    .select()
    .from(outOfScopeRequests)
    .where(and(...conditions))
    .orderBy(desc(outOfScopeRequests.requestedAt))
    .limit(options?.limit ?? 100);
}

/**
 * Get pending request count for a contract.
 */
export async function getPendingRequestCount(contractId: string): Promise<number> {
  const pending = await db
    .select()
    .from(outOfScopeRequests)
    .where(
      and(
        eq(outOfScopeRequests.contractId, contractId),
        eq(outOfScopeRequests.status, "pending")
      )
    );
  return pending.length;
}

/**
 * Resolve an out-of-scope request.
 */
export async function resolveRequest(
  requestId: string,
  resolution: {
    status: OutOfScopeStatus;
    resolutionNotes?: string;
    changeOrderId?: string;
  }
): Promise<OutOfScopeRequestSelect | undefined> {
  const [updated] = await db
    .update(outOfScopeRequests)
    .set({
      status: resolution.status,
      resolutionNotes: resolution.resolutionNotes,
      changeOrderId: resolution.changeOrderId,
      resolvedAt: new Date(),
    })
    .where(eq(outOfScopeRequests.id, requestId))
    .returning();
  return updated;
}

/**
 * Get request by ID.
 */
export async function getRequestById(
  requestId: string
): Promise<OutOfScopeRequestSelect | undefined> {
  const [request] = await db
    .select()
    .from(outOfScopeRequests)
    .where(eq(outOfScopeRequests.id, requestId))
    .limit(1);
  return request;
}

export const OutOfScopeRepository = {
  insertOutOfScopeRequest,
  getRequestsByContract,
  getRequestsByClient,
  getPendingRequestCount,
  resolveRequest,
  getRequestById,
};

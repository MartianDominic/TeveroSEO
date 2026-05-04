/**
 * Contract Repository
 * Phase 45: Data Foundation
 *
 * CRUD operations for contracts table with state machine transitions.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  contracts,
  type ContractInsert,
  type ContractSelect,
  type ContractStatus,
} from "@/db/contract-schema";

/**
 * Insert a new contract.
 */
export async function insertContract(
  contract: ContractInsert,
): Promise<ContractSelect> {
  const [inserted] = await db.insert(contracts).values(contract).returning();
  return inserted;
}

/**
 * Get a contract by ID.
 *
 * SECURITY: This method does NOT filter by workspace.
 * Use getContractByIdScoped() for tenant-safe access, or
 * call assertTenantAccess() at service layer after retrieval.
 */
export async function getContractById(
  contractId: string,
): Promise<ContractSelect | undefined> {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  return contract;
}

/**
 * Get a contract by ID with workspace scope.
 * Returns undefined if contract doesn't exist OR belongs to different workspace.
 * Use this for tenant-safe data access.
 */
export async function getContractByIdScoped(
  contractId: string,
  workspaceId: string,
): Promise<ContractSelect | undefined> {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.workspaceId, workspaceId)))
    .limit(1);
  return contract;
}

/**
 * Get contracts for a workspace with optional filters.
 */
export async function getContractsByWorkspace(
  workspaceId: string,
  options?: {
    status?: ContractStatus;
    clientId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<ContractSelect[]> {
  const conditions = [eq(contracts.workspaceId, workspaceId)];

  if (options?.status) {
    conditions.push(eq(contracts.status, options.status));
  }

  if (options?.clientId) {
    conditions.push(eq(contracts.clientId, options.clientId));
  }

  return await db
    .select()
    .from(contracts)
    .where(and(...conditions))
    .orderBy(desc(contracts.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

/**
 * Get contracts for a specific client.
 *
 * SECURITY: Requires workspaceId to prevent cross-tenant access (IDOR).
 */
export async function getContractsByClient(
  clientId: string,
  workspaceId: string,
  options?: {
    status?: ContractStatus;
    limit?: number;
  },
): Promise<ContractSelect[]> {
  const conditions = [
    eq(contracts.clientId, clientId),
    eq(contracts.workspaceId, workspaceId),
  ];

  if (options?.status) {
    conditions.push(eq(contracts.status, options.status));
  }

  return await db
    .select()
    .from(contracts)
    .where(and(...conditions))
    .orderBy(desc(contracts.createdAt))
    .limit(options?.limit ?? 50);
}

/**
 * Transition contract state with optimistic locking.
 * Returns undefined if current state doesn't match fromState (concurrent modification).
 *
 * SECURITY: Requires workspaceId to prevent cross-tenant access (IDOR).
 */
export async function transitionContractState(
  contractId: string,
  workspaceId: string,
  fromState: ContractStatus,
  toState: ContractStatus,
  additionalFields?: Partial<
    Pick<
      ContractSelect,
      | "sentAt"
      | "signedAt"
      | "executedAt"
      | "dokobitSessionId"
      | "signedPdfUrl"
      | "signerName"
    >
  >,
): Promise<ContractSelect | undefined> {
  const [updated] = await db
    .update(contracts)
    .set({
      status: toState,
      updatedAt: new Date(),
      ...additionalFields,
    })
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.workspaceId, workspaceId),
        eq(contracts.status, fromState)
      )
    )
    .returning();
  return updated;
}

/**
 * Update contract content (for draft contracts only).
 *
 * SECURITY: Requires workspaceId to prevent cross-tenant access (IDOR).
 */
export async function updateContract(
  contractId: string,
  workspaceId: string,
  updates: Partial<Pick<ContractSelect, "title" | "content" | "expiresAt">>,
): Promise<ContractSelect | undefined> {
  const [updated] = await db
    .update(contracts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.workspaceId, workspaceId)
      )
    )
    .returning();
  return updated;
}

/**
 * Delete a contract (hard delete).
 *
 * SECURITY: Requires workspaceId to prevent cross-tenant access (IDOR).
 */
export async function deleteContract(contractId: string, workspaceId: string): Promise<void> {
  await db.delete(contracts).where(
    and(
      eq(contracts.id, contractId),
      eq(contracts.workspaceId, workspaceId)
    )
  );
}

export const ContractRepository = {
  insertContract,
  getContractById,
  getContractByIdScoped,
  getContractsByWorkspace,
  getContractsByClient,
  transitionContractState,
  updateContract,
  deleteContract,
};

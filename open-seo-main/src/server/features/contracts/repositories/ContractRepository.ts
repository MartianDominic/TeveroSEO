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
 */
export async function getContractsByClient(
  clientId: string,
  options?: {
    status?: ContractStatus;
    limit?: number;
  },
): Promise<ContractSelect[]> {
  const conditions = [eq(contracts.clientId, clientId)];

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
 */
export async function transitionContractState(
  contractId: string,
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
    .where(and(eq(contracts.id, contractId), eq(contracts.status, fromState)))
    .returning();
  return updated;
}

/**
 * Update contract content (for draft contracts only).
 */
export async function updateContract(
  contractId: string,
  updates: Partial<Pick<ContractSelect, "title" | "content" | "expiresAt">>,
): Promise<ContractSelect | undefined> {
  const [updated] = await db
    .update(contracts)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId))
    .returning();
  return updated;
}

/**
 * Delete a contract (hard delete).
 */
export async function deleteContract(contractId: string): Promise<void> {
  await db.delete(contracts).where(eq(contracts.id, contractId));
}

export const ContractRepository = {
  insertContract,
  getContractById,
  getContractsByWorkspace,
  getContractsByClient,
  transitionContractState,
  updateContract,
  deleteContract,
};

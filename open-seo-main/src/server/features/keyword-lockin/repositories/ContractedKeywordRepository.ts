/**
 * Contracted Keyword Repository
 * Phase 89-03: Lock Event Flow
 *
 * CRUD operations for contracted_keywords table.
 */
import { eq, and, count } from "drizzle-orm";
import { db } from "@/db";
import {
  contractedKeywords,
  type ContractedKeywordInsert,
  type ContractedKeywordSelect,
} from "@/db/keyword-lockin-schema";

/**
 * Bulk insert contracted keywords (atomic).
 * Used during lock event flow.
 */
export async function insertContractedKeywords(
  keywords: ContractedKeywordInsert[]
): Promise<ContractedKeywordSelect[]> {
  if (keywords.length === 0) return [];
  return await db.insert(contractedKeywords).values(keywords).returning();
}

/**
 * Get all contracted keywords for a contract.
 */
export async function getContractedKeywordsByContract(
  contractId: string,
  options?: {
    status?: "active" | "completed" | "replaced";
  }
): Promise<ContractedKeywordSelect[]> {
  const conditions = [eq(contractedKeywords.contractId, contractId)];

  if (options?.status) {
    conditions.push(eq(contractedKeywords.status, options.status));
  }

  return await db
    .select()
    .from(contractedKeywords)
    .where(and(...conditions));
}

/**
 * Get count of active keywords for a contract.
 */
export async function getActiveKeywordCount(contractId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(contractedKeywords)
    .where(
      and(
        eq(contractedKeywords.contractId, contractId),
        eq(contractedKeywords.status, "active")
      )
    );
  return result?.count ?? 0;
}

/**
 * Get contracted keyword by ID.
 */
export async function getContractedKeywordById(
  keywordId: string
): Promise<ContractedKeywordSelect | undefined> {
  const [keyword] = await db
    .select()
    .from(contractedKeywords)
    .where(eq(contractedKeywords.id, keywordId))
    .limit(1);
  return keyword;
}

/**
 * Update contracted keyword status.
 */
export async function updateContractedKeywordStatus(
  keywordId: string,
  status: "active" | "completed" | "replaced",
  replacementData?: {
    replacedBy?: string;
    replacementReason?: string;
  }
): Promise<ContractedKeywordSelect | undefined> {
  const [updated] = await db
    .update(contractedKeywords)
    .set({
      status,
      replacedBy: replacementData?.replacedBy,
      replacedAt: status === "replaced" ? new Date() : undefined,
      replacementReason: replacementData?.replacementReason,
    })
    .where(eq(contractedKeywords.id, keywordId))
    .returning();
  return updated;
}

export const ContractedKeywordRepository = {
  insertContractedKeywords,
  getContractedKeywordsByContract,
  getActiveKeywordCount,
  getContractedKeywordById,
  updateContractedKeywordStatus,
};

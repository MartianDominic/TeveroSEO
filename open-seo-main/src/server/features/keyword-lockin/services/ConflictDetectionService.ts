/**
 * Conflict Detection Service
 * Phase 89-05: Multi-Client Keyword Conflict Detection
 *
 * Detects when keywords are locked to competing clients in same market.
 */
import { eq, and, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { contractedKeywords } from "@/db/keyword-lockin-schema";
import { contracts } from "@/db/contract-schema";
import { clients } from "@/db/client-schema";

/**
 * Conflict detail for a single keyword.
 */
export interface KeywordConflict {
  keywordText: string;
  conflictingClient: {
    id: string;
    name: string;
    domain: string;
    country: string | null;
  };
  contract: {
    id: string;
    expiresAt: Date | null;
    status: string;
  };
}

/**
 * Conflict detection result.
 */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: KeywordConflict[];
  conflictCount: number;
  nonConflictingKeywords: string[];
}

/**
 * Detect keyword conflicts across clients.
 *
 * Finds keywords that are already locked to other clients in the same
 * geographic market (by country).
 *
 * @param keywords - Keywords being proposed for locking
 * @param currentClientId - Client receiving the keywords (excluded from results)
 * @param country - Geographic market to check (optional, if null checks all)
 * @returns Conflict detection result
 */
export async function detectKeywordConflicts(
  keywords: string[],
  currentClientId: string,
  country?: string | null
): Promise<ConflictDetectionResult> {
  if (keywords.length === 0) {
    return {
      hasConflicts: false,
      conflicts: [],
      conflictCount: 0,
      nonConflictingKeywords: [],
    };
  }

  // Normalize keywords for comparison
  const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

  // Build the join query
  // contracted_keywords -> contracts -> clients
  const conditions = [
    inArray(sql`LOWER(${contractedKeywords.keywordText})`, normalizedKeywords),
    eq(contractedKeywords.status, "active"),
    eq(contracts.status, "executed"), // Only active contracts
    ne(clients.id, currentClientId),
  ];

  // Add geographic filter if provided
  if (country) {
    conditions.push(eq(clients.country, country));
  }

  const results = await db
    .select({
      keywordText: contractedKeywords.keywordText,
      clientId: clients.id,
      clientName: clients.name,
      clientDomain: clients.domain,
      clientCountry: clients.country,
      contractId: contracts.id,
      contractExpiresAt: contracts.expiresAt,
      contractStatus: contracts.status,
    })
    .from(contractedKeywords)
    .innerJoin(contracts, eq(contractedKeywords.contractId, contracts.id))
    .innerJoin(clients, eq(contracts.clientId, clients.id))
    .where(and(...conditions));

  // Map results to conflict objects
  const conflicts: KeywordConflict[] = results.map((row) => ({
    keywordText: row.keywordText,
    conflictingClient: {
      id: row.clientId,
      name: row.clientName,
      domain: row.clientDomain,
      country: row.clientCountry,
    },
    contract: {
      id: row.contractId,
      expiresAt: row.contractExpiresAt,
      status: row.contractStatus,
    },
  }));

  // Find keywords without conflicts
  const conflictingKeywords = new Set(
    conflicts.map((c) => c.keywordText.toLowerCase().trim())
  );
  const nonConflictingKeywords = keywords.filter(
    (k) => !conflictingKeywords.has(k.toLowerCase().trim())
  );

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    conflictCount: conflicts.length,
    nonConflictingKeywords,
  };
}

/**
 * Get all clients with conflicting keywords for a proposed set.
 * Returns unique client list with all their conflicting keywords.
 */
export async function getConflictingClients(
  keywords: string[],
  currentClientId: string,
  country?: string | null
): Promise<
  Array<{
    client: {
      id: string;
      name: string;
      domain: string;
    };
    conflictingKeywords: string[];
    contractExpiresAt: Date | null;
  }>
> {
  const result = await detectKeywordConflicts(keywords, currentClientId, country);

  // Group by client
  const clientMap = new Map<
    string,
    {
      client: { id: string; name: string; domain: string };
      conflictingKeywords: string[];
      contractExpiresAt: Date | null;
    }
  >();

  for (const conflict of result.conflicts) {
    const existing = clientMap.get(conflict.conflictingClient.id);
    if (existing) {
      existing.conflictingKeywords.push(conflict.keywordText);
    } else {
      clientMap.set(conflict.conflictingClient.id, {
        client: {
          id: conflict.conflictingClient.id,
          name: conflict.conflictingClient.name,
          domain: conflict.conflictingClient.domain,
        },
        conflictingKeywords: [conflict.keywordText],
        contractExpiresAt: conflict.contract.expiresAt,
      });
    }
  }

  return Array.from(clientMap.values());
}

/**
 * Check if a single keyword has conflicts.
 */
export async function hasKeywordConflict(
  keywordText: string,
  currentClientId: string,
  country?: string | null
): Promise<boolean> {
  const result = await detectKeywordConflicts([keywordText], currentClientId, country);
  return result.hasConflicts;
}

/**
 * Get conflict summary for UI display.
 */
export function formatConflictSummary(result: ConflictDetectionResult): string {
  if (!result.hasConflicts) {
    return "No conflicts detected.";
  }

  const clientNames = [...new Set(result.conflicts.map((c) => c.conflictingClient.name))];
  return `${result.conflictCount} keyword(s) conflict with ${clientNames.length} client(s): ${clientNames.join(", ")}`;
}

export const ConflictDetectionService = {
  detectKeywordConflicts,
  getConflictingClients,
  hasKeywordConflict,
  formatConflictSummary,
};

/**
 * Lock Event Service
 * Phase 89-03: Lock Event Flow
 *
 * Orchestrates keyword locking at contract signing.
 */
import { ContractedKeywordRepository } from "../repositories/ContractedKeywordRepository";
import { ContractGoalRepository } from "../repositories/ContractGoalRepository";
import type {
  ContractedKeywordInsert,
  ContractedKeywordSelect,
  ContractGoalInsert,
  ContractGoalSelect,
  FunnelStage,
} from "@/db/keyword-lockin-schema";

/**
 * Keyword data for locking.
 */
export interface KeywordToLock {
  keywordId?: string;
  keywordText: string;
  searchVolume?: number;
  difficulty?: number;
  funnelStage?: FunnelStage;
  baselinePosition?: number; // Current ranking position (null if not ranking)
}

/**
 * Goal data for creating contract goal.
 */
export interface GoalToCreate {
  metric?: "keywords_in_top_10" | "traffic_increase" | "ranking_improvement";
  targetValue: number;
  targetDeadline: Date;
}

/**
 * Result of lock event.
 */
export interface LockEventResult {
  keywords: ContractedKeywordSelect[];
  goal: ContractGoalSelect;
  lockedCount: number;
}

/**
 * Lock keywords at contract signing.
 *
 * This is the core lock event flow:
 * 1. Validate inputs
 * 2. Insert contracted keywords with baseline positions
 * 3. Create contract goal
 * 4. Return locked keywords and goal
 *
 * @param contractId - The contract ID (must be in "signed" state)
 * @param keywords - Keywords to lock with baseline data
 * @param goal - Goal configuration
 * @returns Lock event result with keywords and goal
 */
export async function lockKeywordsAtSigning(
  contractId: string,
  keywords: KeywordToLock[],
  goal: GoalToCreate
): Promise<LockEventResult> {
  // Validate
  if (!contractId) {
    throw new Error("VALIDATION_ERROR: contractId is required");
  }

  if (!goal.targetValue || goal.targetValue <= 0) {
    throw new Error("VALIDATION_ERROR: goal.targetValue must be positive");
  }

  if (!goal.targetDeadline) {
    throw new Error("VALIDATION_ERROR: goal.targetDeadline is required");
  }

  // Prepare keyword inserts
  const keywordInserts: ContractedKeywordInsert[] = keywords.map((kw) => ({
    contractId,
    keywordId: kw.keywordId,
    keywordText: kw.keywordText,
    searchVolume: kw.searchVolume,
    difficulty: kw.difficulty,
    funnelStage: kw.funnelStage,
    baselinePosition: kw.baselinePosition,
    status: "active" as const,
    lockedAt: new Date(),
  }));

  // Insert keywords atomically
  const lockedKeywords = await ContractedKeywordRepository.insertContractedKeywords(keywordInserts);

  // Create contract goal
  const goalInsert: ContractGoalInsert = {
    contractId,
    metric: goal.metric ?? "keywords_in_top_10",
    targetValue: goal.targetValue,
    targetDeadline: goal.targetDeadline,
    currentValue: 0,
    achievementPercent: "0",
    status: "in_progress",
  };

  const createdGoal = await ContractGoalRepository.insertContractGoal(goalInsert);

  return {
    keywords: lockedKeywords,
    goal: createdGoal,
    lockedCount: lockedKeywords.length,
  };
}

/**
 * Get lock event summary for a contract.
 */
export async function getLockEventSummary(contractId: string): Promise<{
  keywords: ContractedKeywordSelect[];
  goals: ContractGoalSelect[];
  activeCount: number;
} | null> {
  const keywords = await ContractedKeywordRepository.getContractedKeywordsByContract(contractId);
  const goals = await ContractGoalRepository.getGoalsByContract(contractId);
  const activeCount = await ContractedKeywordRepository.getActiveKeywordCount(contractId);

  if (keywords.length === 0 && goals.length === 0) {
    return null;
  }

  return { keywords, goals, activeCount };
}

export const LockEventService = {
  lockKeywordsAtSigning,
  getLockEventSummary,
};

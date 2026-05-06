/**
 * Contract Goal Repository
 * Phase 89-03: Lock Event Flow
 *
 * CRUD operations for contract_goals table.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  contractGoals,
  type ContractGoalInsert,
  type ContractGoalSelect,
  type GoalStatus,
} from "@/db/keyword-lockin-schema";

/**
 * Insert a new contract goal.
 */
export async function insertContractGoal(
  goal: ContractGoalInsert
): Promise<ContractGoalSelect> {
  const [inserted] = await db.insert(contractGoals).values(goal).returning();
  return inserted;
}

/**
 * Get all goals for a contract.
 */
export async function getGoalsByContract(
  contractId: string
): Promise<ContractGoalSelect[]> {
  return await db
    .select()
    .from(contractGoals)
    .where(eq(contractGoals.contractId, contractId));
}

/**
 * Get a specific goal by ID.
 */
export async function getGoalById(
  goalId: string
): Promise<ContractGoalSelect | undefined> {
  const [goal] = await db
    .select()
    .from(contractGoals)
    .where(eq(contractGoals.id, goalId))
    .limit(1);
  return goal;
}

/**
 * Update goal progress.
 * Recalculates achievementPercent as (currentValue / targetValue * 100).
 */
export async function updateGoalProgress(
  goalId: string,
  currentValue: number
): Promise<ContractGoalSelect | undefined> {
  // First get the goal to calculate percentage
  const goal = await getGoalById(goalId);
  if (!goal) return undefined;

  const achievementPercent = (currentValue / goal.targetValue) * 100;
  const status: GoalStatus = achievementPercent >= 100 ? "achieved" : "in_progress";

  const [updated] = await db
    .update(contractGoals)
    .set({
      currentValue,
      achievementPercent: achievementPercent.toFixed(2),
      status,
      achievedAt: status === "achieved" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(contractGoals.id, goalId))
    .returning();
  return updated;
}

/**
 * Mark goal as missed (deadline passed without achieving).
 */
export async function markGoalMissed(
  goalId: string
): Promise<ContractGoalSelect | undefined> {
  const [updated] = await db
    .update(contractGoals)
    .set({
      status: "missed",
      updatedAt: new Date(),
    })
    .where(eq(contractGoals.id, goalId))
    .returning();
  return updated;
}

export const ContractGoalRepository = {
  insertContractGoal,
  getGoalsByContract,
  getGoalById,
  updateGoalProgress,
  markGoalMissed,
};

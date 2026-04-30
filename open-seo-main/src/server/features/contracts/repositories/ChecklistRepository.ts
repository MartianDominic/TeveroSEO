/**
 * Checklist Repository
 * Phase 45: Data Foundation
 *
 * CRUD operations for onboarding_checklists table with JSONB item updates.
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  onboardingChecklists,
  type OnboardingChecklistInsert,
  type OnboardingChecklistSelect,
  type ChecklistItem,
} from "@/db/onboarding-schema";

/**
 * Insert a new checklist.
 */
export async function insertChecklist(
  checklist: OnboardingChecklistInsert,
): Promise<OnboardingChecklistSelect> {
  const [inserted] = await db
    .insert(onboardingChecklists)
    .values(checklist)
    .returning();
  return inserted;
}

/**
 * Get a checklist by ID.
 */
export async function getChecklistById(
  checklistId: string,
): Promise<OnboardingChecklistSelect | undefined> {
  const [checklist] = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.id, checklistId))
    .limit(1);
  return checklist;
}

/**
 * Get checklist for a client.
 */
export async function getChecklistByClient(
  clientId: string,
): Promise<OnboardingChecklistSelect | undefined> {
  const [checklist] = await db
    .select()
    .from(onboardingChecklists)
    .where(eq(onboardingChecklists.clientId, clientId))
    .limit(1);
  return checklist;
}

/**
 * Get checklists for a workspace.
 */
export async function getChecklistsByWorkspace(
  workspaceId: string,
  options?: {
    serviceTier?: string;
    limit?: number;
    offset?: number;
  },
): Promise<OnboardingChecklistSelect[]> {
  const conditions = [eq(onboardingChecklists.workspaceId, workspaceId)];

  if (options?.serviceTier) {
    conditions.push(eq(onboardingChecklists.serviceTier, options.serviceTier));
  }

  return await db
    .select()
    .from(onboardingChecklists)
    .where(and(...conditions))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

/**
 * Update a specific checklist item within the JSONB array.
 * Performs atomic read-modify-write.
 */
export async function updateChecklistItem(
  checklistId: string,
  itemId: string,
  updates: Partial<Pick<ChecklistItem, "completedAt" | "completedBy">>,
): Promise<OnboardingChecklistSelect | undefined> {
  // Fetch current checklist
  const checklist = await getChecklistById(checklistId);
  if (!checklist) return undefined;

  // Update the specific item
  const updatedItems = checklist.items.map((item) =>
    item.id === itemId ? { ...item, ...updates } : item,
  );

  // Recalculate completed count
  const completedCount = updatedItems.filter((i) => i.completedAt).length;

  // Save back atomically
  const [updated] = await db
    .update(onboardingChecklists)
    .set({
      items: updatedItems,
      completedCount,
      updatedAt: new Date(),
    })
    .where(eq(onboardingChecklists.id, checklistId))
    .returning();

  return updated;
}

/**
 * Complete a checklist item.
 */
export async function completeChecklistItem(
  checklistId: string,
  itemId: string,
  completedBy?: string,
): Promise<OnboardingChecklistSelect | undefined> {
  return updateChecklistItem(checklistId, itemId, {
    completedAt: new Date().toISOString(),
    completedBy,
  });
}

/**
 * Uncomplete a checklist item (undo completion).
 */
export async function uncompleteChecklistItem(
  checklistId: string,
  itemId: string,
): Promise<OnboardingChecklistSelect | undefined> {
  // Fetch current checklist
  const checklist = await getChecklistById(checklistId);
  if (!checklist) return undefined;

  // Remove completion from the specific item
  const updatedItems = checklist.items.map((item) =>
    item.id === itemId
      ? { ...item, completedAt: undefined, completedBy: undefined }
      : item,
  );

  // Recalculate completed count
  const completedCount = updatedItems.filter((i) => i.completedAt).length;

  const [updated] = await db
    .update(onboardingChecklists)
    .set({
      items: updatedItems,
      completedCount,
      updatedAt: new Date(),
    })
    .where(eq(onboardingChecklists.id, checklistId))
    .returning();

  return updated;
}

/**
 * Delete a checklist (hard delete).
 */
export async function deleteChecklist(checklistId: string): Promise<void> {
  await db
    .delete(onboardingChecklists)
    .where(eq(onboardingChecklists.id, checklistId));
}

export const ChecklistRepository = {
  insertChecklist,
  getChecklistById,
  getChecklistByClient,
  getChecklistsByWorkspace,
  updateChecklistItem,
  completeChecklistItem,
  uncompleteChecklistItem,
  deleteChecklist,
};

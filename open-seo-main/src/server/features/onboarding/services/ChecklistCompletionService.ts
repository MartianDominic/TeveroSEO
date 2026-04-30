/**
 * ChecklistCompletionService - Event-driven checklist item completion.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Handles automatic checklist item completion when OAuth succeeds or system events fire.
 * Implements SC-03 (auto-complete items via OAuth and system events).
 */
import { nanoid } from "nanoid";
import { ChecklistRepository } from "../../contracts/repositories/ChecklistRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import type { OnboardingChecklistSelect } from "@/db/onboarding-schema";

/**
 * Supported auto-complete event types.
 * These events trigger automatic checklist item completion.
 */
export type AutoCompleteEvent =
  | "gsc_connected"
  | "ga_connected"
  | "cms_connected"
  | "gbp_connected"
  | "kickoff_completed";

/**
 * Handle an auto-complete event by completing matching checklist items.
 *
 * Idempotent: If item is already completed, silently returns without error.
 * Logs activity when completion occurs.
 *
 * @param workspaceId - Workspace ID for activity logging
 * @param clientId - Client ID to find checklist
 * @param event - Event type that triggered completion
 */
export async function handleAutoCompleteEvent(
  workspaceId: string,
  clientId: string,
  event: AutoCompleteEvent
): Promise<void> {
  // Get checklist for client
  const checklist = await ChecklistRepository.getChecklistByClient(clientId);
  if (!checklist) {
    // No checklist exists - early return without error
    return;
  }

  // Find item with matching autoCompleteEvent that is not already completed
  const item = checklist.items.find(
    (i) => i.autoCompleteEvent === event && !i.completedAt
  );

  if (!item) {
    // No matching incomplete item - idempotent return
    return;
  }

  // Complete the item
  await ChecklistRepository.completeChecklistItem(
    checklist.id,
    item.id,
    "system"
  );

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "onboarding",
    entityId: checklist.id,
    activityType: "item_completed",
    activityData: {
      itemId: item.id,
      event,
      automatic: true,
    },
    actorId: null, // System action, no actor
  });
}

/**
 * Manually complete a checklist item.
 *
 * Completes item regardless of autoCompleteEvent field.
 * For items that require manual checkbox completion.
 *
 * @param checklistId - Checklist ID
 * @param itemId - Item ID within checklist
 * @param completedBy - User ID who completed
 * @returns Updated checklist or undefined if not found
 */
export async function completeItemManually(
  checklistId: string,
  itemId: string,
  completedBy: string
): Promise<OnboardingChecklistSelect | undefined> {
  return ChecklistRepository.completeChecklistItem(
    checklistId,
    itemId,
    completedBy
  );
}

export const ChecklistCompletionService = {
  handleAutoCompleteEvent,
  completeItemManually,
};

/**
 * ChecklistCompletionService
 * Phase 51-02: Onboarding Checklist Completion
 *
 * Handles completing checklist items manually or via auto-complete events.
 * Automatically triggers conversion check after each completion.
 */
import { ChecklistRepository } from "../../contracts/repositories/ChecklistRepository";
import { ConversionService, type ConversionSummary } from "./ConversionService";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import type { OnboardingChecklistSelect } from "@/db/onboarding-schema";

const log = createLogger({ module: "ChecklistCompletionService" });

/**
 * Result of completing a checklist item.
 * Includes updated checklist and optional conversion summary if triggered.
 */
export interface CompleteItemResult {
  checklist: OnboardingChecklistSelect;
  conversionSummary: ConversionSummary | null;
}

/**
 * Complete a checklist item manually.
 * Called when user clicks the complete checkbox in UI.
 *
 * @param checklistId - ID of the checklist
 * @param itemId - ID of the item to complete
 * @param completedBy - User ID who completed the item
 * @returns Updated checklist and conversion summary if triggered
 * @throws AppError if checklist or item not found
 */
export async function completeItemManually(
  checklistId: string,
  itemId: string,
  completedBy: string
): Promise<CompleteItemResult> {
  const checklist = await ChecklistRepository.completeChecklistItem(
    checklistId,
    itemId,
    completedBy
  );

  if (!checklist) {
    throw new AppError("NOT_FOUND", "Checklist or item not found");
  }

  log.info("Checklist item completed manually", {
    checklistId,
    itemId,
    completedBy,
    completedCount: checklist.completedCount,
    totalCount: checklist.totalCount,
  });

  // Check if this completion triggers conversion
  const conversionSummary = await ConversionService.checkAndTriggerConversion(
    checklistId,
    checklist.workspaceId
  );

  if (conversionSummary) {
    log.info("Conversion triggered by manual completion", {
      checklistId,
      clientId: conversionSummary.clientId,
    });
  }

  return { checklist, conversionSummary };
}

/**
 * Handle auto-complete event from external trigger (e.g., OAuth callback).
 * Called when a system event should mark a checklist item complete.
 *
 * @param checklistId - ID of the checklist
 * @param eventName - The auto-complete event name (e.g., "gsc_connected")
 * @returns Updated checklist and conversion summary if triggered, null if no matching item
 */
export async function handleAutoCompleteEvent(
  checklistId: string,
  eventName: string
): Promise<CompleteItemResult | null> {
  const checklist = await ChecklistRepository.getChecklistById(checklistId);

  if (!checklist) {
    log.warn("Checklist not found for auto-complete event", {
      checklistId,
      eventName,
    });
    return null;
  }

  // Find item with matching autoCompleteEvent
  const item = checklist.items.find(
    (i) => i.autoCompleteEvent === eventName && !i.completedAt
  );

  if (!item) {
    log.info("No matching incomplete item for auto-complete event", {
      checklistId,
      eventName,
    });
    return null;
  }

  // Complete the item
  const updatedChecklist = await ChecklistRepository.completeChecklistItem(
    checklistId,
    item.id,
    "system"
  );

  if (!updatedChecklist) {
    throw new AppError("INTERNAL_ERROR", "Failed to complete checklist item");
  }

  log.info("Checklist item auto-completed", {
    checklistId,
    itemId: item.id,
    eventName,
    completedCount: updatedChecklist.completedCount,
    totalCount: updatedChecklist.totalCount,
  });

  // Check if this completion triggers conversion
  const conversionSummary = await ConversionService.checkAndTriggerConversion(
    checklistId,
    updatedChecklist.workspaceId
  );

  if (conversionSummary) {
    log.info("Conversion triggered by auto-complete event", {
      checklistId,
      eventName,
      clientId: conversionSummary.clientId,
    });
  }

  return { checklist: updatedChecklist, conversionSummary };
}

/**
 * Get checklist completion progress for a client.
 *
 * @param clientId - Client ID to get checklist for
 * @returns Checklist with completion status, null if not found
 */
export async function getChecklistProgress(
  clientId: string
): Promise<OnboardingChecklistSelect | null> {
  const checklist = await ChecklistRepository.getChecklistByClient(clientId);
  return checklist ?? null;
}

export const ChecklistCompletionService = {
  completeItemManually,
  handleAutoCompleteEvent,
  getChecklistProgress,
};

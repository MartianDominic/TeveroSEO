/**
 * ConversionService
 * Phase 51-02: Prospect Conversion
 *
 * Handles prospect-to-client conversion triggered when onboarding checklist
 * reaches 100% completion. Updates statuses, logs activities, and returns
 * conversion summary for UI display.
 */
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { prospects } from "@/db/prospect-schema";
import { contracts } from "@/db/contract-schema";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import { ChecklistRepository } from "../../contracts/repositories/ChecklistRepository";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ConversionService" });

/**
 * Summary returned after successful conversion.
 * Used by ConversionSummary component for display.
 */
export interface ConversionSummary {
  clientId: string;
  clientName: string;
  serviceTier: string;
  completedAt: Date;
  connectedServices: string[];
  nextSteps: string[];
}

/**
 * Complete onboarding and convert prospect to active client.
 * Called when checklist reaches 100% completion.
 *
 * @param checklistId - ID of the completed checklist
 * @param workspaceId - Workspace for authorization check
 * @returns ConversionSummary with client data and next steps
 * @throws AppError if checklist not found, not complete, or access denied
 */
export async function completeOnboarding(
  checklistId: string,
  workspaceId: string
): Promise<ConversionSummary> {
  // Get checklist
  const checklist = await ChecklistRepository.getChecklistById(checklistId);

  if (!checklist) {
    throw new AppError("NOT_FOUND", "Checklist not found");
  }

  if (checklist.workspaceId !== workspaceId) {
    throw new AppError("FORBIDDEN", "Access denied");
  }

  // Verify 100% complete
  if (checklist.completedCount !== checklist.totalCount) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Checklist not complete: ${checklist.completedCount}/${checklist.totalCount}`
    );
  }

  // Get client
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, checklist.clientId))
    .limit(1);

  if (!client) {
    throw new AppError("NOT_FOUND", "Client not found");
  }

  // Store previous status for activity logging
  const previousStatus = client.status;

  // Update client status to "active"
  await db
    .update(clients)
    .set({
      status: "active",
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(clients.id, client.id));

  // Find and update linked prospect (via contract -> proposal -> prospect)
  // Note: This traces back through the contract that created this onboarding
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.clientId, client.id))
    .limit(1);

  if (contract?.proposalId) {
    // Find prospect that led to this proposal
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(
        and(
          eq(prospects.workspaceId, workspaceId),
          eq(prospects.convertedClientId, client.id)
        )
      )
      .limit(1);

    if (prospect) {
      await db
        .update(prospects)
        .set({
          pipelineStage: "active_client",
          updatedAt: new Date(),
        })
        .where(eq(prospects.id, prospect.id));

      log.info("Prospect stage updated to active_client", {
        prospectId: prospect.id,
        clientId: client.id,
      });
    }
  }

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "client",
    entityId: client.id,
    activityType: "status_changed",
    activityData: {
      previousStatus,
      newStatus: "active",
      trigger: "onboarding_complete",
      checklistId,
    },
  });

  // Determine connected services from completed credential items
  const connectedServices = checklist.items
    .filter((item) => item.category === "credentials" && item.completedAt)
    .map((item) => item.label.replace("Connect ", ""));

  // Generate next steps based on tier
  const nextSteps = getNextStepsForTier(checklist.serviceTier);

  log.info("Onboarding completed, client converted to active", {
    clientId: client.id,
    checklistId,
    serviceTier: checklist.serviceTier,
  });

  return {
    clientId: client.id,
    clientName: client.name,
    serviceTier: checklist.serviceTier,
    completedAt: new Date(),
    connectedServices,
    nextSteps,
  };
}

/**
 * Check if checklist is complete and trigger conversion if so.
 * Called after each item completion to check for automatic conversion.
 *
 * @param checklistId - ID of the checklist to check
 * @param workspaceId - Workspace for authorization
 * @returns ConversionSummary if conversion triggered, null otherwise
 */
export async function checkAndTriggerConversion(
  checklistId: string,
  workspaceId: string
): Promise<ConversionSummary | null> {
  const checklist = await ChecklistRepository.getChecklistById(checklistId);

  if (!checklist) {
    return null;
  }

  // Only trigger if 100% complete
  if (checklist.completedCount !== checklist.totalCount) {
    return null;
  }

  // Already converted? Check client status
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, checklist.clientId))
    .limit(1);

  if (client?.status === "active") {
    // Already converted, return summary without re-triggering
    log.info("Client already active, returning existing summary", {
      clientId: client.id,
      checklistId,
    });

    return {
      clientId: client.id,
      clientName: client.name,
      serviceTier: checklist.serviceTier,
      completedAt: checklist.updatedAt,
      connectedServices: checklist.items
        .filter((item) => item.category === "credentials" && item.completedAt)
        .map((item) => item.label.replace("Connect ", "")),
      nextSteps: getNextStepsForTier(checklist.serviceTier),
    };
  }

  return completeOnboarding(checklistId, workspaceId);
}

/**
 * Get tier-specific next steps for the conversion summary.
 */
function getNextStepsForTier(tier: string): string[] {
  switch (tier) {
    case "enterprise":
      return [
        "Review competitor analysis in the dashboard",
        "Schedule first content strategy review",
        "Set up weekly reporting schedule",
        "Configure SEO automation rules",
      ];
    case "growth":
      return [
        "Review SEO audit results",
        "Submit first content brief",
        "Set up monthly reporting",
      ];
    case "starter":
    default:
      return [
        "Review SEO audit results",
        "Submit your first content request",
      ];
  }
}

export const ConversionService = {
  completeOnboarding,
  checkAndTriggerConversion,
};

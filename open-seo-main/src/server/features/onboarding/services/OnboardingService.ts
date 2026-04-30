/**
 * Onboarding checklist service.
 * Phase 48: Contract & Payment
 *
 * Creates onboarding checklists when contracts are paid.
 * Implements "Payment before onboarding" requirement.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/proposal-schema";
import {
  type ChecklistItem,
  type ServiceTier,
  type OnboardingChecklistSelect,
} from "@/db/onboarding-schema";
import { ChecklistRepository } from "../../contracts/repositories/ChecklistRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import { ContractRepository } from "../../contracts/repositories/ContractRepository";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { nanoid } from "nanoid";

const log = createLogger({ module: "OnboardingService" });

/**
 * Checklist templates by service tier.
 * Items include autoCompleteEvent for automatic completion triggers.
 */
const CHECKLIST_TEMPLATES: Record<ServiceTier, Omit<ChecklistItem, "id">[]> = {
  starter: [
    {
      label: "Connect Google Search Console",
      category: "credentials",
      autoCompleteEvent: "gsc_connected",
    },
    {
      label: "Connect Google Analytics",
      category: "credentials",
      autoCompleteEvent: "ga_connected",
    },
    { label: "Schedule kickoff call", category: "kickoff" },
    {
      label: "Complete kickoff call",
      category: "kickoff",
      autoCompleteEvent: "kickoff_completed",
    },
    { label: "Submit initial content brief", category: "content" },
  ],
  growth: [
    {
      label: "Connect Google Search Console",
      category: "credentials",
      autoCompleteEvent: "gsc_connected",
    },
    {
      label: "Connect Google Analytics",
      category: "credentials",
      autoCompleteEvent: "ga_connected",
    },
    {
      label: "Connect WordPress/CMS",
      category: "credentials",
      autoCompleteEvent: "cms_connected",
    },
    { label: "Schedule kickoff call", category: "kickoff" },
    {
      label: "Complete kickoff call",
      category: "kickoff",
      autoCompleteEvent: "kickoff_completed",
    },
    { label: "Review brand voice profile", category: "setup" },
    { label: "Submit initial content brief", category: "content" },
    { label: "Approve first content draft", category: "content" },
  ],
  enterprise: [
    {
      label: "Connect Google Search Console",
      category: "credentials",
      autoCompleteEvent: "gsc_connected",
    },
    {
      label: "Connect Google Analytics",
      category: "credentials",
      autoCompleteEvent: "ga_connected",
    },
    {
      label: "Connect WordPress/CMS",
      category: "credentials",
      autoCompleteEvent: "cms_connected",
    },
    {
      label: "Connect Google Business Profile",
      category: "credentials",
      autoCompleteEvent: "gbp_connected",
    },
    { label: "Schedule kickoff call", category: "kickoff" },
    {
      label: "Complete kickoff call",
      category: "kickoff",
      autoCompleteEvent: "kickoff_completed",
    },
    { label: "Review competitor analysis", category: "setup" },
    { label: "Approve brand voice profile", category: "setup" },
    { label: "Review content strategy", category: "content" },
    { label: "Submit first content batch", category: "content" },
    { label: "Approve first content batch", category: "content" },
    { label: "Review link building strategy", category: "content" },
  ],
};

/**
 * Determine service tier from proposal pricing.
 * Enterprise: setupFee >= 5000 EUR
 * Growth: setupFee >= 2500 EUR
 * Starter: below 2500 EUR
 */
function determineServiceTier(setupFeeCents: number): ServiceTier {
  if (setupFeeCents >= 500000) return "enterprise"; // >= 5000 EUR
  if (setupFeeCents >= 250000) return "growth"; // >= 2500 EUR
  return "starter";
}

/**
 * Create onboarding checklist from paid contract.
 * CRITICAL: Only called after payment confirmed (Payment before onboarding).
 */
export async function createFromContract(
  contractId: string,
  workspaceId: string
): Promise<OnboardingChecklistSelect> {
  // Get contract
  const contract = await ContractRepository.getContractById(contractId);

  if (!contract || contract.workspaceId !== workspaceId) {
    throw new AppError("NOT_FOUND", "Contract not found");
  }

  if (contract.status !== "executed") {
    throw new AppError(
      "CONFLICT",
      `Cannot create onboarding for contract in ${contract.status} status. Payment required first.`
    );
  }

  if (!contract.clientId) {
    throw new AppError("VALIDATION_ERROR", "Contract missing client ID");
  }

  // Check if checklist already exists
  const existing = await ChecklistRepository.getChecklistByClient(
    contract.clientId
  );
  if (existing) {
    log.info("Checklist already exists for client", {
      clientId: contract.clientId,
    });
    return existing;
  }

  // Determine service tier from proposal
  let setupFeeCents = 250000; // Default growth tier
  if (contract.proposalId) {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, contract.proposalId))
      .limit(1);

    if (proposal) {
      setupFeeCents = proposal.setupFeeCents ?? setupFeeCents;
    }
  }

  const serviceTier = determineServiceTier(setupFeeCents);
  const templateItems = CHECKLIST_TEMPLATES[serviceTier];

  // Generate checklist items with IDs
  const items: ChecklistItem[] = templateItems.map((item) => ({
    ...item,
    id: nanoid(),
  }));

  // Create checklist
  const checklist = await ChecklistRepository.insertChecklist({
    id: nanoid(),
    workspaceId,
    clientId: contract.clientId,
    serviceTier,
    items,
    completedCount: 0,
    totalCount: items.length,
  });

  // Contract remains in "executed" status (already set by payment handler)
  // No state transition needed - executed contracts are active contracts

  // Log checklist creation
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "onboarding",
    entityId: checklist.id,
    activityType: "created",
    activityData: {
      contractId,
      clientId: contract.clientId,
      serviceTier,
      itemCount: items.length,
    },
  });

  log.info("Onboarding checklist created", {
    checklistId: checklist.id,
    contractId,
    serviceTier,
  });

  return checklist;
}

export const OnboardingService = {
  createFromContract,
  determineServiceTier,
  CHECKLIST_TEMPLATES,
};

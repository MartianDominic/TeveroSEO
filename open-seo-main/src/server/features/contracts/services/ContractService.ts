/**
 * Contract management service.
 * Phase 48-01: Contract Generation
 *
 * Provides contract lifecycle management from proposal acceptance through
 * e-signature and payment integration.
 */
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import * as ContractRepository from "../repositories/ContractRepository";
import * as ActivityRepository from "../repositories/ActivityRepository";
import { ProposalService } from "../../proposals/services/ProposalService";
import { DokobitService } from "./DokobitService";
import { generateContractPdf } from "./ContractPdfGenerator";
import type { ContractStatus, ContractContent, ContractSelect } from "@/db/contract-schema";
import type { ProposalContent } from "@/db/proposal-schema";

const log = createLogger({ module: "ContractService" });

/**
 * Valid status transitions for the contract state machine.
 * Per D-09: draft -> sent -> signed -> paid -> active
 */
export const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["sent"],
  sent: ["signed", "expired", "cancelled"],
  signed: ["executed"],
  executed: [],
  expired: [],
  cancelled: [],
};

/**
 * Check if a status transition is valid.
 */
export function canTransition(
  from: ContractStatus,
  to: ContractStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Convert ProposalContent to ContractContent.
 * Maps proposal structure to contract document sections.
 */
function proposalToContractContent(
  content: ProposalContent,
  companyName: string,
): ContractContent {
  const sections = [
    {
      title: "Service Overview",
      body: `${companyName} agrees to provide comprehensive SEO services as outlined in this agreement. ${content.hero.subheadline}`,
    },
    {
      title: "Scope of Work",
      body: content.investment.inclusions.join(". ") + ".",
    },
    {
      title: "Investment",
      body: `Setup Fee: €${content.investment.setupFee}. Monthly Fee: €${content.investment.monthlyFee}.`,
    },
    {
      title: "Next Steps",
      body: content.nextSteps.join(". ") + ".",
    },
  ];

  const terms = `
This agreement is entered into by and between the parties identified below.
The service provider will deliver the services described in the Scope of Work section.
Payment terms: Setup fee due upon signing. Monthly fee billed on the first of each month.
Either party may terminate this agreement with 30 days written notice.
All work product remains the property of the client upon payment.
  `.trim();

  const signatures = [
    { role: "Service Provider", name: companyName },
    { role: "Client" },
  ];

  return { sections, terms, signatures };
}

/**
 * Create a contract from an accepted proposal.
 * Generates contract content from proposal data.
 */
async function createFromProposal(
  proposalId: string,
  workspaceId: string,
): Promise<ContractSelect> {
  // Fetch proposal via ProposalService
  const proposal = await ProposalService.findById(proposalId);

  if (!proposal) {
    throw new AppError("NOT_FOUND", "Proposal not found");
  }

  if (proposal.workspaceId !== workspaceId) {
    throw new AppError("NOT_FOUND", "Proposal not found");
  }

  // Convert proposal content to contract content
  const companyName = "TeveroSEO"; // TODO: Get from workspace settings
  const content = proposalToContractContent(proposal.content, companyName);

  // Generate contract ID
  const contractId = nanoid();
  const now = new Date();

  // Insert contract
  const contract = await ContractRepository.insertContract({
    id: contractId,
    workspaceId,
    proposalId,
    clientId: null, // Set when proposal has client association
    title: `Service Agreement - ${proposal.content.hero.headline}`,
    content,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "contract",
    entityId: contractId,
    activityType: "created",
    activityData: { proposalId },
    actorId: null,
  });

  log.info("Contract created from proposal", { contractId, proposalId });

  return contract;
}

/**
 * Send contract for e-signature via Dokobit.
 * Transitions contract from draft to sent.
 */
async function sendForSigning(
  contractId: string,
  workspaceId: string,
  actorId?: string,
): Promise<{ contract: ContractSelect; signingUrl: string }> {
  // Get contract
  const contract = await ContractRepository.getContractById(contractId);

  if (!contract) {
    throw new AppError("NOT_FOUND", "Contract not found");
  }

  if (contract.workspaceId !== workspaceId) {
    throw new AppError("NOT_FOUND", "Contract not found");
  }

  // Validate status is draft
  if (contract.status !== "draft") {
    throw new AppError(
      "CONTRACT_INVALID_STATE",
      `Invalid state transition from ${contract.status} to sent. Contract must be in draft status.`,
    );
  }

  // Generate PDF
  const pdfBuffer = await generateContractPdf({
    title: contract.title,
    content: contract.content,
    workspaceName: "TeveroSEO", // TODO: Get from workspace
    clientName: "Client", // TODO: Get from contract.clientId
    createdAt: contract.createdAt,
  });

  // Create Dokobit signing session
  const webhookUrl = `${process.env.APP_URL}/api/webhooks/dokobit/signed`;
  const dokobitResponse = await DokobitService.createSigningSession(
    contractId,
    pdfBuffer,
    webhookUrl,
  );

  // Transition contract state to "sent"
  const updatedContract = await ContractRepository.transitionContractState(
    contractId,
    "draft",
    "sent",
    {
      dokobitSessionId: dokobitResponse.sessionId,
      sentAt: new Date(),
    },
  );

  if (!updatedContract) {
    throw new AppError(
      "CONFLICT",
      "Contract state changed during processing. Please retry.",
    );
  }

  // Log activity
  await ActivityRepository.recordStatusChange(
    workspaceId,
    "contract",
    contractId,
    "draft",
    "sent",
    actorId,
  );

  log.info("Contract sent for signing", {
    contractId,
    dokobitSessionId: dokobitResponse.sessionId,
  });

  return {
    contract: updatedContract,
    signingUrl: dokobitResponse.signingUrl,
  };
}

export const ContractService = {
  createFromProposal,
  sendForSigning,
};

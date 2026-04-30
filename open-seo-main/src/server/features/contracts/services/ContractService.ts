/**
 * Contract management service.
 * Phase 48-01: Contract Generation
 * Phase 55-06: Agreement template integration with language support
 *
 * Provides contract lifecycle management from proposal acceptance through
 * e-signature and payment integration.
 */
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { db } from "@/db";
import {
  agreementTemplates,
  generatedAgreements,
  type AgreementLanguage,
  type GeneratedAgreementSelect,
  type GeneratedAgreementInsert,
} from "@/db/agreement-template-schema";
import * as ContractRepository from "../repositories/ContractRepository";
import * as ActivityRepository from "../repositories/ActivityRepository";
import { ProposalService } from "../../proposals/services/ProposalService";
import { DokobitService } from "./DokobitService.js";
import { generateContractPdf } from "./ContractPdfGenerator.js";
import { getTemplateSubstitutionService } from "./TemplateSubstitutionService";
import { getLanguageResolutionService } from "@/server/services/LanguageResolutionService";
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

/**
 * Handle Dokobit signing completion webhook.
 * Per D-03: Webhook callback on completion.
 * Per D-04: Store signed PDF in workspace storage.
 */
async function handleSigningComplete(
  sessionId: string,
  signerName: string,
): Promise<ContractSelect> {
  const { db } = await import("@/db");
  const { contracts } = await import("@/db/contract-schema");
  const { eq } = await import("drizzle-orm");
  const { saveFile } = await import("@/server/lib/storage");

  // Find contract by Dokobit session ID
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.dokobitSessionId, sessionId))
    .limit(1);

  if (!contract) {
    throw new AppError("NOT_FOUND", "Contract not found for session");
  }

  if (contract.status !== "sent") {
    throw new AppError("CONFLICT", `Cannot sign contract in ${contract.status} status`);
  }

  // Download signed PDF from Dokobit
  const signedDoc = await DokobitService.downloadSignedDocument(sessionId);

  // Store signed PDF in workspace storage per D-04
  const pdfPath = `contracts/${contract.workspaceId}/${contract.id}/signed.pdf`;
  await saveFile(pdfPath, Buffer.from(signedDoc.signedPdfBase64, "base64"));

  // Transition to signed
  const updatedContract = await ContractRepository.transitionContractState(
    contract.id,
    "sent",
    "signed",
    {
      signedAt: new Date(),
      signedPdfUrl: pdfPath,
      signerName,
    },
  );

  if (!updatedContract) {
    throw new AppError("CONFLICT", "Contract status changed during processing");
  }

  // Log activity
  await ActivityRepository.recordStatusChange(
    contract.workspaceId,
    "contract",
    contract.id,
    "sent",
    "signed",
  );

  log.info("Contract signed", { contractId: contract.id, signerName });
  return updatedContract;
}

/**
 * Generate a contract number in SEO-YYYY-NNNN format.
 * T-55-13: Versioning for legal compliance tracking.
 */
function generateContractNumber(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `SEO-${year}-${randomPart}`;
}

/**
 * Get an agreement template by ID or by language.
 */
async function getTemplate(
  templateId?: string,
  language: AgreementLanguage = "en"
): Promise<typeof agreementTemplates.$inferSelect | null> {
  if (templateId) {
    const [template] = await db
      .select()
      .from(agreementTemplates)
      .where(eq(agreementTemplates.id, templateId))
      .limit(1);
    return template || null;
  }

  // Get active template for language and type
  const [template] = await db
    .select()
    .from(agreementTemplates)
    .where(
      and(
        eq(agreementTemplates.language, language),
        eq(agreementTemplates.type, "seo-services"),
        eq(agreementTemplates.isActive, true)
      )
    )
    .limit(1);

  return template || null;
}

/**
 * Options for generating an agreement from a template.
 */
interface GenerateAgreementOptions {
  templateId?: string;
  prospectId?: string;
  clientId?: string;
  proposalId?: string;
  workspaceId: string;
  variableValues: Record<string, string | number | string[]>;
  language?: AgreementLanguage;
  formality?: "formal" | "informal";
}

/**
 * Generate an agreement from a template with variable substitution.
 * Phase 55-06: Agreement generation with language support.
 */
async function generateAgreement(
  options: GenerateAgreementOptions
): Promise<{
  id: string;
  content: string;
  language: AgreementLanguage;
  warnings: string[];
}> {
  const langService = getLanguageResolutionService();
  const substitutionService = getTemplateSubstitutionService();

  // Resolve target language
  let targetLanguage = options.language;
  if (!targetLanguage) {
    const resolved = await langService.resolveForCommunication(
      options.workspaceId,
      options.prospectId || options.clientId || null,
      options.prospectId ? "prospect" : "client"
    );
    targetLanguage = resolved.locale as AgreementLanguage;
  }

  // Get template for target language
  const template = await getTemplate(options.templateId, targetLanguage);
  if (!template) {
    throw new AppError("NOT_FOUND", `No active template found for language: ${targetLanguage}`);
  }

  // Perform variable substitution
  const result = await substitutionService.substituteVariables(
    template.sections,
    template.variables,
    options.variableValues,
    targetLanguage,
    options.formality || "formal"
  );

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", `Template substitution failed: ${result.errors.join(", ")}`);
  }

  // Store generated agreement
  const agreementId = nanoid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const agreementData: GeneratedAgreementInsert = {
    id: agreementId,
    templateId: template.id,
    templateVersion: template.version,
    prospectId: options.prospectId || null,
    clientId: options.clientId || null,
    proposalId: options.proposalId || null,
    workspaceId: options.workspaceId,
    language: targetLanguage,
    renderedContent: result.content,
    variableValues: options.variableValues,
    status: "draft",
    createdAt: now,
    expiresAt,
  };

  await db.insert(generatedAgreements).values(agreementData);

  log.info("Agreement generated", {
    agreementId,
    templateId: template.id,
    language: targetLanguage,
    warnings: result.warnings.length,
  });

  return {
    id: agreementId,
    content: result.content,
    language: targetLanguage,
    warnings: result.warnings,
  };
}

/**
 * Create an agreement from a proposal.
 * Builds variable values from proposal, prospect, and workspace data.
 */
async function createAgreementFromProposal(
  proposalId: string,
  prospectId: string,
  workspaceId: string
): Promise<GeneratedAgreementSelect> {
  // Fetch proposal
  const proposal = await ProposalService.findById(proposalId);
  if (!proposal) {
    throw new AppError("NOT_FOUND", "Proposal not found");
  }

  if (proposal.workspaceId !== workspaceId) {
    throw new AppError("NOT_FOUND", "Proposal not found");
  }

  // Build variable values from proposal content
  const content = proposal.content;
  const contractNumber = generateContractNumber();

  const variableValues: Record<string, string | number | string[]> = {
    contractNumber,
    city: "Vilnius", // TODO: Get from workspace settings
    contractDate: new Date().toISOString().split("T")[0],

    // Provider defaults (TODO: Get from workspace settings)
    providerName: "TeveroSEO",
    providerCode: "123456789",
    providerAddress: "Gedimino pr. 1, Vilnius",
    providerRepresentative: "Director",
    providerBasis: "the Articles of Association",
    providerBank: "Swedbank",
    providerAccount: "LT00 0000 0000 0000 0000",
    providerPosition: "Director",

    // Client placeholders (should be filled from prospect/client data)
    clientName: "{{clientName}}", // Will be filled by caller
    clientCode: "{{clientCode}}",
    clientAddress: "{{clientAddress}}",
    clientRepresentative: "{{clientRepresentative}}",
    clientBasis: "the Articles of Association",
    clientBank: "",
    clientAccount: "",
    clientPosition: "Director",

    // Service details from proposal
    websiteUrl: content.hero?.headline || "example.com",
    scopeDescription: content.investment?.inclusions?.join(". ") || "",

    // Financial from proposal
    setupFee: content.investment?.setupFee || 0,
    monthlyFee: content.investment?.monthlyFee || 0,
    currency: "EUR",
    vatStatus: "excluding VAT",

    // Standard terms
    startDate: new Date().toISOString().split("T")[0],
    contractDuration: 12,
    renewalPeriod: 12,
    noticePeriod: 30,
    confidentialityYears: 2,
    liabilityMonths: 3,
    terminationNoticeDays: 30,
  };

  // Generate the agreement
  const result = await generateAgreement({
    proposalId,
    prospectId,
    workspaceId,
    variableValues,
  });

  // Fetch and return the generated agreement
  const [agreement] = await db
    .select()
    .from(generatedAgreements)
    .where(eq(generatedAgreements.id, result.id))
    .limit(1);

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "agreement",
    entityId: result.id,
    activityType: "created",
    activityData: { proposalId, prospectId, language: result.language },
    actorId: null,
  });

  return agreement;
}

export const ContractService = {
  createFromProposal,
  sendForSigning,
  handleSigningComplete,
  // Phase 55-06: Agreement template methods
  generateContractNumber,
  getTemplate,
  generateAgreement,
  createAgreementFromProposal,
};

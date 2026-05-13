/**
 * ProposalGenerationService
 * Phase 101-06: Tiered AI Proposal Generation
 *
 * Implements D-03 tiered AI involvement with 4 modes:
 * - FULL_AI: AI generates complete proposal from domain and package selection
 * - AI_ASSISTED: User provides key details, AI fills gaps
 * - TEMPLATE_MANUAL: Pick template, fill in client specifics (no AI)
 * - BLANK: Start from scratch for custom deals (no AI)
 */
import { nanoid } from "nanoid";
import { db } from "@/db";
import { proposals, type ProposalContent } from "@/db/proposal-schema";
import { proposalTemplates } from "@/db/proposal-template-schema";
import { prospects } from "@/db/prospect-schema";
import { eq, and } from "drizzle-orm";
import { AIProposalGenerator } from "./AIProposalGenerator";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ProposalGenerationService" });

/**
 * Generation modes per D-03 Tiered AI Involvement
 */
export const ProposalGenerationMode = {
  /** AI pulls template + generates all copy + pricing */
  FULL_AI: "full_ai",
  /** Provide key details, AI fills gaps */
  AI_ASSISTED: "ai_assisted",
  /** Pick template, fill in client specifics - no AI, fastest */
  TEMPLATE_MANUAL: "template_manual",
  /** Start from scratch - no AI, no template, for custom deals */
  BLANK: "blank",
} as const;

export type ProposalGenerationMode = (typeof ProposalGenerationMode)[keyof typeof ProposalGenerationMode];

/**
 * Input for FULL_AI mode
 */
export interface FullAIInput {
  prospectId: string;
  packageId: string;
  templateId?: string;
  additionalContext?: string;
}

/**
 * Input for AI_ASSISTED mode
 */
export interface AIAssistedInput {
  prospectId: string;
  packageId: string;
  templateId?: string;
  partialContent: {
    headline?: string;
    painPoints?: string[];
    opportunities?: string[];
    customInclusions?: string[];
  };
}

/**
 * Input for TEMPLATE_MANUAL mode
 */
export interface TemplateManualInput {
  prospectId: string;
  templateId: string;
  packageId: string;
}

/**
 * Input for BLANK mode
 */
export interface BlankInput {
  prospectId: string;
}

/**
 * Discriminated union for generation inputs
 */
export type GenerationInput =
  | { mode: typeof ProposalGenerationMode.FULL_AI; data: FullAIInput }
  | { mode: typeof ProposalGenerationMode.AI_ASSISTED; data: AIAssistedInput }
  | { mode: typeof ProposalGenerationMode.TEMPLATE_MANUAL; data: TemplateManualInput }
  | { mode: typeof ProposalGenerationMode.BLANK; data: BlankInput };

/**
 * Result of proposal generation
 */
export interface GenerationResult {
  proposalId: string;
  content: ProposalContent;
  mode: ProposalGenerationMode;
  aiGenerated: boolean;
}

/**
 * Package definition from templates
 */
export interface ProposalPackage {
  id: string;
  name: string;
  setupFee: number;
  monthlyFee: number;
  inclusions: string[];
  description: string;
}

/**
 * Empty proposal content structure for BLANK mode
 */
const EMPTY_PROPOSAL_CONTENT: ProposalContent = {
  hero: {
    headline: "",
    subheadline: "",
    trafficValue: 0,
  },
  currentState: {
    traffic: 0,
    keywords: 0,
    value: 0,
    chartData: [],
  },
  opportunities: [],
  roi: {
    projectedTrafficGain: 0,
    trafficValue: 0,
    defaultConversionRate: 0.02,
    defaultAov: 100,
  },
  investment: {
    setupFee: 0,
    monthlyFee: 0,
    inclusions: [],
  },
  nextSteps: ["Review Proposal", "Schedule Call", "Begin Partnership"],
};

export const ProposalGenerationService = {
  /**
   * Generate a proposal based on the selected mode.
   * Per D-03: Tiered AI involvement from fully automated to completely manual.
   */
  async generate(
    input: GenerationInput,
    workspaceId: string,
    userId: string
  ): Promise<GenerationResult> {
    let content: ProposalContent;
    let aiGenerated = false;
    let prospectId: string;

    switch (input.mode) {
      case ProposalGenerationMode.FULL_AI:
        content = await this.generateFullAI(input.data, workspaceId);
        prospectId = input.data.prospectId;
        aiGenerated = true;
        break;

      case ProposalGenerationMode.AI_ASSISTED:
        content = await this.generateAIAssisted(input.data, workspaceId);
        prospectId = input.data.prospectId;
        aiGenerated = true;
        break;

      case ProposalGenerationMode.TEMPLATE_MANUAL:
        content = await this.generateFromTemplate(input.data, workspaceId);
        prospectId = input.data.prospectId;
        break;

      case ProposalGenerationMode.BLANK:
        content = { ...EMPTY_PROPOSAL_CONTENT };
        prospectId = input.data.prospectId;
        break;

      default:
        throw new Error(`Unknown generation mode: ${(input as any).mode}`);
    }

    // Create proposal record
    const proposalId = nanoid();
    const token = nanoid(32);

    await db.insert(proposals).values({
      id: proposalId,
      prospectId,
      workspaceId,
      template: input.mode === ProposalGenerationMode.BLANK ? "blank" : "standard",
      content,
      status: "draft",
      token,
    });

    log.info("Proposal generated", { proposalId, mode: input.mode, aiGenerated, workspaceId });

    return {
      proposalId,
      content,
      mode: input.mode,
      aiGenerated,
    };
  },

  /**
   * Full AI Generation: AI pulls template + generates all copy + pricing
   */
  async generateFullAI(input: FullAIInput, workspaceId: string): Promise<ProposalContent> {
    // Get prospect domain
    const [prospect] = await db.select().from(prospects)
      .where(and(eq(prospects.id, input.prospectId), eq(prospects.workspaceId, workspaceId)));

    if (!prospect) {
      throw new Error(`Prospect not found: ${input.prospectId}`);
    }

    // Get template and package
    const { selectedPackage } = await this.getTemplateAndPackage(
      input.templateId,
      input.packageId,
      workspaceId
    );

    // Call AI to generate full content
    const generatedContent = await AIProposalGenerator.generateFull({
      domain: prospect.domain,
      companyName: prospect.companyName ?? prospect.domain,
      packageName: selectedPackage.name,
      packageDescription: selectedPackage.description,
      inclusions: selectedPackage.inclusions,
      setupFee: selectedPackage.setupFee,
      monthlyFee: selectedPackage.monthlyFee,
      additionalContext: input.additionalContext,
    });

    return {
      ...generatedContent,
      investment: {
        setupFee: selectedPackage.setupFee,
        monthlyFee: selectedPackage.monthlyFee,
        inclusions: selectedPackage.inclusions,
      },
    };
  },

  /**
   * AI-Assisted: User provides key details, AI fills gaps
   */
  async generateAIAssisted(input: AIAssistedInput, workspaceId: string): Promise<ProposalContent> {
    const [prospect] = await db.select().from(prospects)
      .where(and(eq(prospects.id, input.prospectId), eq(prospects.workspaceId, workspaceId)));

    if (!prospect) {
      throw new Error(`Prospect not found: ${input.prospectId}`);
    }

    const { selectedPackage } = await this.getTemplateAndPackage(
      input.templateId,
      input.packageId,
      workspaceId
    );

    // Call AI to expand partial content
    const expandedContent = await AIProposalGenerator.expandContent({
      domain: prospect.domain,
      companyName: prospect.companyName ?? prospect.domain,
      partialContent: input.partialContent,
      packageName: selectedPackage.name,
      inclusions: selectedPackage.inclusions,
    });

    return {
      ...expandedContent,
      investment: {
        setupFee: selectedPackage.setupFee,
        monthlyFee: selectedPackage.monthlyFee,
        inclusions: input.partialContent.customInclusions ?? selectedPackage.inclusions,
      },
    };
  },

  /**
   * Template + Manual: Load template content with selected package pricing
   */
  async generateFromTemplate(input: TemplateManualInput, workspaceId: string): Promise<ProposalContent> {
    const [prospect] = await db.select().from(prospects)
      .where(and(eq(prospects.id, input.prospectId), eq(prospects.workspaceId, workspaceId)));

    if (!prospect) {
      throw new Error(`Prospect not found: ${input.prospectId}`);
    }

    const { selectedPackage } = await this.getTemplateAndPackage(
      input.templateId,
      input.packageId,
      workspaceId
    );

    // Return template structure with package pricing and prospect info
    return {
      hero: {
        headline: `SEO Growth Strategy for ${prospect.companyName ?? prospect.domain}`,
        subheadline: `${selectedPackage.name} Package`,
        trafficValue: 0,
      },
      currentState: {
        traffic: 0,
        keywords: 0,
        value: 0,
        chartData: [],
      },
      opportunities: [],
      roi: {
        projectedTrafficGain: 0,
        trafficValue: 0,
        defaultConversionRate: 0.02,
        defaultAov: 100,
      },
      investment: {
        setupFee: selectedPackage.setupFee,
        monthlyFee: selectedPackage.monthlyFee,
        inclusions: selectedPackage.inclusions,
      },
      nextSteps: EMPTY_PROPOSAL_CONTENT.nextSteps,
    };
  },

  /**
   * Helper: Get template and specific package
   */
  async getTemplateAndPackage(
    templateId: string | undefined,
    packageId: string,
    workspaceId: string
  ): Promise<{ template: typeof proposalTemplates.$inferSelect; selectedPackage: ProposalPackage }> {
    // Get template (default if not specified)
    let template;
    if (templateId) {
      [template] = await db.select().from(proposalTemplates)
        .where(and(eq(proposalTemplates.id, templateId), eq(proposalTemplates.workspaceId, workspaceId)));
    } else {
      [template] = await db.select().from(proposalTemplates)
        .where(and(eq(proposalTemplates.workspaceId, workspaceId), eq(proposalTemplates.isDefault, true)));
    }

    if (!template) {
      throw new Error("No template found");
    }

    // Find selected package
    const packages = ((template as any).packages ?? []) as ProposalPackage[];
    const selectedPackage = packages.find(p => p.id === packageId);

    if (!selectedPackage) {
      throw new Error(`Package not found: ${packageId}`);
    }

    return { template, selectedPackage };
  },
};

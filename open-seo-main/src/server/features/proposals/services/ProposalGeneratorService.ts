/**
 * ProposalGeneratorService - Full proposal generation orchestration.
 * Phase 43-06: Proposal Generation
 *
 * Orchestrates the complete proposal generation flow:
 * 1. Fetch prospect and analysis data
 * 2. Classify awareness level (Schwartz framework)
 * 3. Generate sections using appropriate XML prompts
 * 4. Build proposal content structure
 * 5. Save to database with access token
 *
 * Proposal Scenarios:
 * - focused: 3-10 keywords, all page mapping, EUR150 + EUR25/kw
 * - full_audit: 100+ keywords, top 20 mapping, EUR800 flat
 * - competitor_only: Gap list, no mapping, EUR250 + EUR75/comp
 */
import { db } from "@/db";
import {
  proposals,
  type ProposalContent,
  type OpportunityDifficulty,
} from "@/db/proposal-schema";
import { prospects, prospectAnalyses } from "@/db/prospect-schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";
import {
  awarenessClassifier,
  type AwarenessLevel,
} from "./AwarenessClassifier";
import {
  sectionGenerator,
  type SectionType,
  type GeneratedSection,
} from "./SectionGenerator";
import {
  cascadeSelector,
  DEFAULT_CASCADE,
  type SelectionResult,
  type FunnelStage,
  type CascadeConfig,
} from "@/server/features/keywords";

const log = createLogger({ module: "ProposalGeneratorService" });

export type ProposalScenario = "focused" | "full_audit" | "competitor_only";

/**
 * Sections included per scenario (from 43-CONTEXT.md)
 */
const SCENARIO_SECTIONS: Record<ProposalScenario, SectionType[]> = {
  focused: [
    "executive_summary",
    "keyword_analysis",
    "competitor_comparison",
    "page_mapping",
    "roi_projections",
    "investment",
  ],
  full_audit: [
    "executive_summary",
    "current_state",
    "keyword_analysis",
    "competitor_comparison",
    "page_mapping",
    "roi_projections",
    "investment",
  ],
  competitor_only: ["executive_summary", "competitor_comparison", "investment"],
};

export interface GenerateProposalInput {
  prospectId: string;
  scenario: ProposalScenario;
  awarenessLevel?: AwarenessLevel; // Override auto-detection
  pricing: {
    setupFee: number;
    monthlyFee: number;
    contractMonths: number;
  };
  agencyInfo?: {
    name?: string;
    positioning?: string;
    differentiators?: string[];
    caseStudies?: Array<{ client: string; result: string }>;
  };
  language?: "lt" | "en";
}

export interface GenerateProposalResult {
  proposalId: string;
  sections: GeneratedSection[];
  awarenessLevel: AwarenessLevel;
  scenario: ProposalScenario;
}

export class ProposalGeneratorService {
  /**
   * Generate a full proposal for a prospect.
   */
  async generateProposal(
    input: GenerateProposalInput
  ): Promise<GenerateProposalResult> {
    log.info("Starting proposal generation", {
      prospectId: input.prospectId,
      scenario: input.scenario,
    });

    // Fetch prospect
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, input.prospectId))
      .limit(1);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    // Get latest analysis
    const [analysis] = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.prospectId, input.prospectId))
      .orderBy(desc(prospectAnalyses.createdAt))
      .limit(1);

    // Calculate keyword stats from analysis
    const organicKeywords = analysis?.organicKeywords || [];
    const keywordGaps = analysis?.keywordGaps || [];
    const allKeywords = [...organicKeywords, ...keywordGaps];

    const quickWins = keywordGaps.filter(
      (k) => k.difficulty <= 50 && k.searchVolume >= 200
    ).length;
    const totalVolume = allKeywords.reduce(
      (sum, k) => sum + (k.searchVolume || 0),
      0
    );

    // Determine awareness level
    let awarenessLevel = input.awarenessLevel;
    if (!awarenessLevel) {
      try {
        const classification = await awarenessClassifier.classify({
          domain: prospect.domain,
          scrapeSummary:
            analysis?.scrapedContent?.businessInfo?.summary || undefined,
          initialInquiry: prospect.notes || undefined,
          leadSource: prospect.source || undefined,
        });
        awarenessLevel = classification.awarenessLevel;

        log.info("Awareness classified", {
          domain: prospect.domain,
          level: awarenessLevel,
          confidence: classification.confidence,
        });
      } catch (error) {
        // Fallback to quick classification
        log.warn("AI classification failed, using rule-based", { error });
        awarenessLevel = awarenessClassifier.quickClassify({
          domain: prospect.domain,
          initialInquiry: prospect.notes || undefined,
        });
      }
    }

    // Get sections for this scenario
    const sectionTypes = SCENARIO_SECTIONS[input.scenario];

    // Build section input
    const sectionInput = {
      companyName: prospect.companyName || prospect.domain,
      domain: prospect.domain,
      awarenessLevel,
      totalKeywords: allKeywords.length,
      quickWins,
      trafficOpportunity: totalVolume,
      revenueOpportunity: Math.round(totalVolume * 0.02 * 50), // 2% CTR, EUR50 AOV
      topCompetitor: analysis?.competitorDomains?.[0] || undefined,
      competitorTraffic: analysis?.domainMetrics?.organicTraffic || undefined,
      biggestGap: keywordGaps[0]?.keyword || undefined,
      setupFee: input.pricing.setupFee,
      monthlyFee: input.pricing.monthlyFee,
      contractMonths: input.pricing.contractMonths,
      agencyName: input.agencyInfo?.name,
      agencyPositioning: input.agencyInfo?.positioning,
      differentiators: input.agencyInfo?.differentiators,
      caseStudies: input.agencyInfo?.caseStudies,
      language: input.language || "lt",
    };

    // Generate sections
    log.info("Generating proposal sections", {
      sectionCount: sectionTypes.length,
      scenario: input.scenario,
    });

    const sections = await sectionGenerator.generateSections(
      sectionTypes,
      sectionInput
    );

    // Create proposal record
    const proposalId = `prop_${nanoid(12)}`;
    const token = nanoid(24);

    // Build ProposalContent from sections
    const content: ProposalContent = this.buildContent(
      sections,
      sectionInput,
      keywordGaps
    );

    await db.insert(proposals).values({
      id: proposalId,
      prospectId: input.prospectId,
      workspaceId: prospect.workspaceId,
      template: this.getTemplateForScenario(input.scenario),
      content,
      setupFeeCents: input.pricing.setupFee * 100,
      monthlyFeeCents: input.pricing.monthlyFee * 100,
      status: "draft",
      token,
    });

    log.info("Proposal generated", {
      proposalId,
      scenario: input.scenario,
      awarenessLevel,
      sectionCount: sections.length,
    });

    return {
      proposalId,
      sections,
      awarenessLevel,
      scenario: input.scenario,
    };
  }

  /**
   * Regenerate a single section for an existing proposal.
   */
  async regenerateSection(
    proposalId: string,
    sectionType: SectionType
  ): Promise<GeneratedSection> {
    log.info("Regenerating section", { proposalId, sectionType });

    // Fetch proposal and related data
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Get prospect
    const [prospect] = proposal.prospectId
      ? await db
          .select()
          .from(prospects)
          .where(eq(prospects.id, proposal.prospectId))
          .limit(1)
      : [null];

    // Build minimal input from existing proposal
    const sectionInput = {
      companyName: prospect?.companyName || prospect?.domain || "Client",
      domain: prospect?.domain || "",
      awarenessLevel: "solution-aware" as AwarenessLevel, // Default
      setupFee: (proposal.setupFeeCents || 0) / 100,
      monthlyFee: (proposal.monthlyFeeCents || 0) / 100,
      contractMonths: 6,
      language: "lt" as const,
    };

    const section = await sectionGenerator.generateSection(
      sectionType,
      sectionInput
    );

    log.info("Section regenerated", {
      proposalId,
      sectionType,
      contentLength: section.content.length,
    });

    return section;
  }

  /**
   * Map scenario to template type for database storage.
   */
  private getTemplateForScenario(
    scenario: ProposalScenario
  ): "standard" | "premium" | "enterprise" {
    switch (scenario) {
      case "focused":
        return "standard";
      case "full_audit":
        return "premium";
      case "competitor_only":
        return "standard";
      default:
        return "standard";
    }
  }

  /**
   * Build ProposalContent structure from generated sections and analysis data.
   */
  private buildContent(
    sections: GeneratedSection[],
    input: {
      companyName: string;
      trafficOpportunity?: number;
      revenueOpportunity?: number;
      competitorTraffic?: number;
      totalKeywords?: number;
      setupFee?: number;
      monthlyFee?: number;
    },
    keywordGaps: Array<{
      keyword: string;
      searchVolume: number;
      difficulty: number;
      funnelStage?: FunnelStage;
      compositeScore?: number;
    }>,
    cascadeConfig?: CascadeConfig
  ): ProposalContent {
    // Map sections to ProposalContent structure
    const execSummary = sections.find((s) => s.type === "executive_summary");

    // Prepare keywords for cascade selection
    const keywordsForSelection = keywordGaps.map((kw) => ({
      keyword: kw.keyword,
      funnelStage: kw.funnelStage || this.inferFunnelStage(kw),
      compositeScore: kw.compositeScore || 0.5,
      metrics: {
        volume: kw.searchVolume,
        difficulty: kw.difficulty,
      },
    }));

    // Run cascade selection
    const selection = cascadeSelector.select(
      keywordsForSelection,
      cascadeConfig || { ...DEFAULT_CASCADE, targetCount: 10 }
    );

    // Map selected keywords to opportunities
    const opportunities = selection.selected.map((kw) => ({
      keyword: kw.keyword,
      volume: kw.metrics.volume,
      difficulty: this.mapDifficulty(kw.metrics.difficulty),
      potential: Math.round(kw.metrics.volume * 0.15),
    }));

    return {
      hero: {
        headline: `SEO Galimybes: ${input.companyName}`,
        subheadline: execSummary?.content.substring(0, 200) || "",
        trafficValue: input.trafficOpportunity || 0,
      },
      currentState: {
        traffic: input.competitorTraffic || 0,
        keywords: input.totalKeywords || 0,
        value: input.revenueOpportunity || 0,
        chartData: this.generateChartData(),
      },
      opportunities,
      roi: {
        projectedTrafficGain: input.trafficOpportunity || 0,
        trafficValue: input.revenueOpportunity || 0,
        defaultConversionRate: 0.02,
        defaultAov: 50,
      },
      investment: {
        setupFee: input.setupFee || 0,
        monthlyFee: input.monthlyFee || 0,
        inclusions: [
          "Techninis SEO auditas",
          "On-page optimizacija",
          "Turinio strategija",
          "Menesines ataskaitos",
        ],
      },
      nextSteps: [
        "Pasirasyti sutarti",
        "Atlikti pradini audita",
        "Paruosti veiklos plana",
      ],
    };
  }

  /**
   * Map numeric difficulty to category.
   */
  private mapDifficulty(difficulty: number): OpportunityDifficulty {
    if (difficulty <= 30) return "easy";
    if (difficulty <= 60) return "medium";
    return "hard";
  }

  /**
   * Infer funnel stage from keyword characteristics.
   * Heuristic: high-intent signals -> BOFU, question words -> TOFU
   */
  private inferFunnelStage(kw: { keyword: string; difficulty: number }): FunnelStage {
    const keyword = kw.keyword.toLowerCase();

    // BOFU indicators (commercial intent)
    if (
      keyword.includes('buy') ||
      keyword.includes('price') ||
      keyword.includes('kaina') ||
      keyword.includes('pirkti') ||
      keyword.includes('įsigyti') ||
      keyword.includes('užsakyti')
    ) {
      return 'bofu';
    }

    // TOFU indicators (informational)
    if (
      keyword.includes('what') ||
      keyword.includes('how') ||
      keyword.includes('kas') ||
      keyword.includes('kaip') ||
      keyword.includes('kodėl') ||
      keyword.includes('why')
    ) {
      return 'tofu';
    }

    // Default to MOFU (consideration)
    return 'mofu';
  }

  /**
   * Generate placeholder chart data for traffic projections.
   */
  private generateChartData(): Array<{ month: string; traffic: number }> {
    const months = [
      "Sau",
      "Vas",
      "Kov",
      "Bal",
      "Geg",
      "Bir",
      "Lie",
      "Rgp",
      "Rgs",
      "Spa",
      "Lap",
      "Gru",
    ];
    const currentMonth = new Date().getMonth();

    return Array.from({ length: 6 }, (_, i) => {
      const monthIndex = (currentMonth + i) % 12;
      return {
        month: months[monthIndex],
        traffic: Math.round(1000 * (1 + i * 0.2)), // Projected growth
      };
    });
  }
}

// Lazy singleton to avoid instantiation during import (for testing)
let _instance: ProposalGeneratorService | null = null;

export function getProposalGeneratorService(): ProposalGeneratorService {
  if (!_instance) {
    _instance = new ProposalGeneratorService();
  }
  return _instance;
}

// Re-export for convenience (lazy instantiation)
export const proposalGeneratorService = {
  generateProposal: (input: GenerateProposalInput) =>
    getProposalGeneratorService().generateProposal(input),
  regenerateSection: (proposalId: string, sectionType: SectionType) =>
    getProposalGeneratorService().regenerateSection(proposalId, sectionType),
};

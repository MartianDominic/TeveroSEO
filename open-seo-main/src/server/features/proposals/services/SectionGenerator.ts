/**
 * SectionGenerator - AI-powered proposal section generation.
 * Phase 43-06: Proposal Generation
 *
 * Generates proposal sections using XML prompt templates based on
 * Halbert/Kennedy/Ogilvy copywriting frameworks. Each section type
 * has a dedicated prompt template for consistent, high-quality output.
 *
 * Frameworks:
 * - Halbert fascinations for presale hooks
 * - Ogilvy authority for executive summaries
 * - Kennedy direct response for investment sections
 * - Lithuanian Civil Code compliance for agreements
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@/server/lib/logger";
import type { AwarenessLevel } from "./AwarenessClassifier";

const log = createLogger({ module: "SectionGenerator" });

// ES module workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_DIR = join(__dirname, "../prompts");

export type SectionType =
  | "presale_hook"
  | "executive_summary"
  | "current_state"
  | "keyword_analysis"
  | "competitor_comparison"
  | "page_mapping"
  | "roi_projections"
  | "investment"
  | "agreement";

export interface SectionInput {
  // Prospect data
  companyName: string;
  domain: string;
  awarenessLevel: AwarenessLevel;

  // Analysis data
  totalKeywords?: number;
  quickWins?: number;
  trafficOpportunity?: number;
  revenueOpportunity?: number;
  topCompetitor?: string;
  competitorTraffic?: number;
  biggestGap?: string;

  // Pricing
  setupFee?: number;
  monthlyFee?: number;
  contractMonths?: number;

  // Agency info
  agencyName?: string;
  agencyPositioning?: string;
  differentiators?: string[];
  caseStudies?: Array<{ client: string; result: string }>;

  // Lithuanian-specific
  language?: "lt" | "en";
}

export interface GeneratedSection {
  type: SectionType;
  content: string;
  language: string;
  generatedAt: string;
}

/**
 * Prompt file mapping for each section type.
 */
const PROMPT_FILES: Record<SectionType, string> = {
  presale_hook: "presale-hook.xml",
  executive_summary: "executive-summary.xml",
  current_state: "current-state.xml",
  keyword_analysis: "keyword-analysis.xml",
  competitor_comparison: "competitor-comparison.xml",
  page_mapping: "page-mapping.xml",
  roi_projections: "roi-projections.xml",
  investment: "investment-section.xml",
  agreement: "agreement-generator.xml",
};

/**
 * Escape special characters in user input to prevent prompt injection.
 * Part of threat mitigation T-43-17.
 */
function escapeUserInput(input: string): string {
  return input
    .replace(/{{/g, "{ {")
    .replace(/}}/g, "} }")
    .replace(/<script/gi, "&lt;script")
    .replace(/<\/script/gi, "&lt;/script");
}

export class SectionGenerator {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Generate a single section using the appropriate XML prompt.
   */
  async generateSection(
    sectionType: SectionType,
    input: SectionInput
  ): Promise<GeneratedSection> {
    const promptPath = this.getPromptPath(sectionType);
    let promptTemplate: string;

    try {
      promptTemplate = readFileSync(promptPath, "utf-8");
    } catch (error) {
      log.error(
        "Failed to read prompt template",
        error instanceof Error ? error : new Error(String(error)),
        { path: promptPath, sectionType }
      );
      throw new Error(`Failed to load prompt template for ${sectionType}`);
    }

    // Fill template with escaped input (T-43-17)
    const prompt = this.fillTemplate(promptTemplate, input);

    log.info("Generating section", {
      sectionType,
      domain: input.domain,
      awarenessLevel: input.awarenessLevel,
    });

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract the generated content (may be wrapped in XML tags)
    let generatedContent = content.text;

    // Try to extract from <output> tags if present
    const outputMatch = generatedContent.match(/<output>([\s\S]*?)<\/output>/);
    if (outputMatch) {
      generatedContent = outputMatch[1].trim();
    }

    log.info("Section generated", {
      sectionType,
      domain: input.domain,
      contentLength: generatedContent.length,
    });

    return {
      type: sectionType,
      content: generatedContent,
      language: input.language || "lt",
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate multiple sections in parallel.
   */
  async generateSections(
    sectionTypes: SectionType[],
    input: SectionInput
  ): Promise<GeneratedSection[]> {
    log.info("Generating multiple sections", {
      count: sectionTypes.length,
      types: sectionTypes,
      domain: input.domain,
    });

    const promises = sectionTypes.map((type) =>
      this.generateSection(type, input)
    );

    const results = await Promise.all(promises);

    log.info("All sections generated", {
      count: results.length,
      domain: input.domain,
    });

    return results;
  }

  /**
   * Get the prompt file path for a section type.
   */
  private getPromptPath(sectionType: SectionType): string {
    const filename = PROMPT_FILES[sectionType];
    if (!filename) {
      throw new Error(`Unknown section type: ${sectionType}`);
    }
    return join(PROMPTS_DIR, filename);
  }

  /**
   * Fill template placeholders with escaped input values.
   * Applies T-43-17 threat mitigation for user-provided data.
   */
  private fillTemplate(template: string, input: SectionInput): string {
    // Escape user-provided strings (T-43-17)
    const safeInput = {
      companyName: escapeUserInput(input.companyName),
      domain: escapeUserInput(input.domain),
      topCompetitor: input.topCompetitor
        ? escapeUserInput(input.topCompetitor)
        : "N/A",
      biggestGap: input.biggestGap ? escapeUserInput(input.biggestGap) : "N/A",
      agencyName: input.agencyName
        ? escapeUserInput(input.agencyName)
        : "Tevero",
      agencyPositioning: input.agencyPositioning
        ? escapeUserInput(input.agencyPositioning)
        : "",
    };

    const replacements: Record<string, string> = {
      "{{COMPANY_NAME}}": safeInput.companyName,
      "{{DOMAIN}}": safeInput.domain,
      "{{AWARENESS_LEVEL}}": input.awarenessLevel,
      "{{TOTAL_KEYWORDS}}": String(input.totalKeywords || 0),
      "{{QUICK_WINS}}": String(input.quickWins || 0),
      "{{TRAFFIC_OPPORTUNITY}}": String(input.trafficOpportunity || 0),
      "{{REVENUE_OPPORTUNITY}}": String(input.revenueOpportunity || 0),
      "{{TOP_COMPETITOR}}": safeInput.topCompetitor,
      "{{COMPETITOR_TRAFFIC}}": String(input.competitorTraffic || 0),
      "{{BIGGEST_GAP}}": safeInput.biggestGap,
      "{{SETUP_FEE}}": String(input.setupFee || 0),
      "{{MONTHLY_FEE}}": String(input.monthlyFee || 0),
      "{{CONTRACT_MONTHS}}": String(input.contractMonths || 6),
      "{{AGENCY_NAME}}": safeInput.agencyName,
      "{{AGENCY_POSITIONING}}": safeInput.agencyPositioning,
      "{{DIFFERENTIATORS}}": (input.differentiators || []).join(", "),
      "{{CASE_STUDIES}}": JSON.stringify(input.caseStudies || []),
      "{{LANGUAGE}}": input.language || "lt",
    };

    let result = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, "g"), value);
    }

    return result;
  }
}

// Lazy singleton to avoid instantiation during import (for testing)
let _instance: SectionGenerator | null = null;

export function getSectionGenerator(): SectionGenerator {
  if (!_instance) {
    _instance = new SectionGenerator();
  }
  return _instance;
}

// Re-export for convenience (lazy instantiation)
export const sectionGenerator = {
  generateSection: (sectionType: SectionType, input: SectionInput) =>
    getSectionGenerator().generateSection(sectionType, input),
  generateSections: (sectionTypes: SectionType[], input: SectionInput) =>
    getSectionGenerator().generateSections(sectionTypes, input),
};

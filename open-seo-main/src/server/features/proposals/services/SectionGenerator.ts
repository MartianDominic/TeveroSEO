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
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { withRetry } from "@/server/lib/retry";
import type { AwarenessLevel } from "./AwarenessClassifier";

const log = createLogger({ module: "SectionGenerator" });

// ES module workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_DIR = join(__dirname, "../prompts");

/**
 * Template cache - loaded once at module initialization, reused forever.
 * Templates are static XML files that never change at runtime.
 * This eliminates blocking readFileSync calls during request handling.
 */
const TEMPLATE_CACHE = new Map<string, string>();

/**
 * Load a template from disk or return cached version.
 * Safe to call at module initialization or lazily on first use.
 */
function loadTemplate(filename: string): string {
  if (TEMPLATE_CACHE.has(filename)) {
    return TEMPLATE_CACHE.get(filename)!;
  }

  const path = join(PROMPTS_DIR, filename);
  const content = readFileSync(path, "utf-8");
  TEMPLATE_CACHE.set(filename, content);
  log.debug("Template loaded and cached", { filename });
  return content;
}

/**
 * Preload all templates at module initialization.
 * This ensures no blocking I/O during request handling.
 */
function preloadAllTemplates(): void {
  const files = [
    "presale-hook.xml",
    "executive-summary.xml",
    "current-state.xml",
    "keyword-analysis.xml",
    "competitor-comparison.xml",
    "page-mapping.xml",
    "roi-projections.xml",
    "investment-section.xml",
    "agreement-generator.xml",
  ];

  for (const filename of files) {
    try {
      loadTemplate(filename);
    } catch (error) {
      // Log but don't fail initialization - template may not exist yet
      log.warn("Failed to preload template", { filename, error: String(error) });
    }
  }

  log.info("Template preloading complete", { loadedCount: TEMPLATE_CACHE.size });
}

// Preload templates at module initialization (blocking but only once at startup)
preloadAllTemplates();

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
 * Zod schema for validating LLM section generation response.
 * The LLM returns text content, optionally wrapped in <output> tags.
 * We validate that the response is a non-empty string.
 */
const SectionResponseSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1, "Generated content cannot be empty"),
});

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
   * Uses cached templates to avoid blocking I/O during request handling.
   */
  async generateSection(
    sectionType: SectionType,
    input: SectionInput
  ): Promise<GeneratedSection> {
    const filename = PROMPT_FILES[sectionType];
    if (!filename) {
      throw new Error(`Unknown section type: ${sectionType}`);
    }

    let promptTemplate: string;
    try {
      // Use cached template (loaded at module init, no blocking I/O)
      promptTemplate = loadTemplate(filename);
    } catch (error) {
      log.error(
        "Failed to load prompt template",
        error instanceof Error ? error : new Error(String(error)),
        { filename, sectionType }
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

    const response = await withRetry(
      () =>
        this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    // Bounds check: ensure response has content
    if (!response.content || response.content.length === 0) {
      log.error("Empty response from Claude", new Error("Empty content array"), {
        sectionType,
        domain: input.domain,
      });
      throw new Error("Empty response from Claude API");
    }

    const content = response.content[0];

    // Validate response structure with Zod schema
    const validationResult = SectionResponseSchema.safeParse(content);
    if (!validationResult.success) {
      log.error("LLM response validation failed", new Error("Schema validation failed"), {
        sectionType,
        domain: input.domain,
        errors: validationResult.error.issues,
      });
      throw new Error(`Invalid LLM response: ${validationResult.error.message}`);
    }

    // Extract the generated content (may be wrapped in XML tags)
    let generatedContent = validationResult.data.text;

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

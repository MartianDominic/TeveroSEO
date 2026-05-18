/**
 * AI Generation Service for Document Builder
 * Phase 102-03: AI content generation
 *
 * Generates persuasive content using Gemini 3.1 Pro.
 * Cost: $1.25/1M tokens per D-05.
 *
 * Features:
 * - Block-type specific prompt engineering
 * - Prospect context integration
 * - Style reference support
 * - Framework compliance context
 * - Multi-language support (Lithuanian, English)
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { logger } from "@/lib/logger";
import { PERSUASION_BLOCK_TYPES } from "./persuasion-blocks";
import { sanitizeForPrompt, containsInjectionPatterns } from "./input-sanitizer";
import type { ProspectContext, StyleReference, PersuasionBlockType } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Generation request per DOCUMENT-BUILDER-ARCHITECTURE.md.
 */
export interface GenerationRequest {
  /** Block type to generate content for */
  blockType: PersuasionBlockType;
  /** Intent of the generation */
  intent: "create" | "fill_variables" | "regenerate" | "improve";
  /** Prospect context for personalization */
  prospect: ProspectContext;
  /** Style references for tone matching */
  styleReferences?: StyleReference[];
  /** Existing content (for improve intent) */
  existingContent?: string;
  /** User's custom instructions */
  customPrompt?: string;
  /** Maximum word count */
  maxLength?: number;
  /** Desired tone */
  tone?: string;
  /** Target language (default: 'lt' for Lithuanian) */
  language: string;
  /** Framework identifier for compliance */
  framework?: string;
  /** Content of preceding blocks for context */
  precedingBlocks?: string[];
}

/**
 * Generation response.
 */
export interface GenerationResponse {
  /** Generated content */
  content: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Alternative phrasings */
  suggestions?: string[];
  /** Token usage for cost tracking */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Estimated cost in USD */
  cost?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  lt: "Lithuanian",
  en: "English",
};

const FALLBACK_MESSAGE = "Unable to generate content. Please try again or write your content manually.";

/**
 * Gemini 3.1 Pro cost per million tokens.
 * Per CLAUDE.md LLM Architecture spec: $1.25/1M tokens
 */
const GEMINI_COST_PER_1M_TOKENS = 1.25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get block metadata for prompt construction.
 */
function getBlockInfo(blockType: PersuasionBlockType): {
  label: string;
  description: string;
  aiPromptHint: string;
} {
  const metadata = PERSUASION_BLOCK_TYPES.find((b) => b.type === blockType);
  if (!metadata) {
    return {
      label: "Custom Block",
      description: "Freeform content section",
      aiPromptHint: "Generate relevant persuasive content.",
    };
  }
  return {
    label: metadata.label,
    description: metadata.description,
    aiPromptHint: metadata.aiPromptHint,
  };
}

/**
 * Build the AI prompt from generation request.
 */
export function buildPrompt(request: GenerationRequest): string {
  const blockInfo = getBlockInfo(request.blockType);
  const languageName = LANGUAGE_NAMES[request.language] ?? "English";

  const sections: string[] = [];

  // System context
  sections.push(`You are generating content for a "${request.blockType}" (${blockInfo.label}) block in a persuasive proposal document.`);
  sections.push(`Purpose: ${blockInfo.description}`);
  sections.push("");

  // Block-specific guidance
  sections.push("BLOCK-SPECIFIC GUIDANCE:");
  sections.push(blockInfo.aiPromptHint);
  sections.push("");

  // Prospect context - sanitize all user-provided values
  if (request.prospect) {
    sections.push("PROSPECT CONTEXT:");
    if (request.prospect.domain) {
      sections.push(`- Domain: ${sanitizeForPrompt(request.prospect.domain)}`);
    }
    if (request.prospect.niche) {
      sections.push(`- Industry/Niche: ${sanitizeForPrompt(request.prospect.niche)}`);
    }
    if (request.prospect.painPoints && request.prospect.painPoints.length > 0) {
      const sanitizedPainPoints = request.prospect.painPoints.map(sanitizeForPrompt);
      sections.push(`- Pain Points: ${sanitizedPainPoints.join(", ")}`);
    }
    sections.push("");
  }

  // Style references - sanitize user-provided content
  if (request.styleReferences && request.styleReferences.length > 0) {
    sections.push("STYLE REFERENCES:");
    for (const ref of request.styleReferences) {
      if (ref.content) {
        sections.push(`- ${sanitizeForPrompt(ref.content)}`);
      }
    }
    sections.push("");
  }

  // Framework context
  if (request.framework) {
    sections.push(`FRAMEWORK: This block is part of the "${request.framework}" persuasion framework. Ensure content aligns with framework principles.`);
    sections.push("");
  }

  // Preceding blocks for narrative flow - sanitize content
  if (request.precedingBlocks && request.precedingBlocks.length > 0) {
    sections.push("PRECEDING CONTENT (for narrative flow):");
    for (const block of request.precedingBlocks) {
      sections.push(`- "${sanitizeForPrompt(block)}"`);
    }
    sections.push("");
  }

  // Intent-specific instructions
  sections.push("TASK:");
  switch (request.intent) {
    case "create":
      sections.push("Generate fresh, compelling content for this block.");
      break;
    case "improve":
      sections.push("Improve the following existing content while maintaining its core message:");
      if (request.existingContent) {
        sections.push(`"${sanitizeForPrompt(request.existingContent)}"`);
      }
      break;
    case "fill_variables":
      sections.push("Fill in the variable placeholders with appropriate values based on context.");
      break;
    case "regenerate":
      sections.push("Generate a completely new version of this block with a fresh approach.");
      break;
  }
  sections.push("");

  // Constraints
  sections.push("CONSTRAINTS:");
  sections.push(`- Write in ${languageName}`);
  if (request.maxLength) {
    sections.push(`- Maximum length: ${request.maxLength} words`);
  }
  if (request.tone) {
    sections.push(`- Tone: ${request.tone}`);
  }
  sections.push("- Output only the content, no explanations or markdown formatting");
  sections.push("");

  // Custom prompt - sanitize user input
  if (request.customPrompt) {
    sections.push("ADDITIONAL INSTRUCTIONS:");
    sections.push(sanitizeForPrompt(request.customPrompt));
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Main Generation Function
// ---------------------------------------------------------------------------

/**
 * Generate content for a document builder block.
 *
 * Uses Gemini 3.1 Pro for high-quality content generation.
 *
 * @param request - Generation request with block type, context, and constraints
 * @returns Generated content with confidence score
 */
export async function generateBlockContent(
  request: GenerationRequest
): Promise<GenerationResponse> {
  const startTime = Date.now();

  try {
    // Input validation
    if (!request.blockType) {
      logger.warn("[ai-generator] Missing blockType in request");
      return { content: FALLBACK_MESSAGE, confidence: 0 };
    }

    logger.info("[ai-generator] Starting content generation", {
      blockType: request.blockType,
      intent: request.intent,
      language: request.language,
    });

    // Log potential injection attempts for security monitoring
    const fieldsToCheck = [
      request.customPrompt,
      request.existingContent,
      request.prospect?.domain,
      request.prospect?.niche,
      ...(request.prospect?.painPoints ?? []),
      ...(request.precedingBlocks ?? []),
      ...(request.styleReferences?.map((r) => r.content) ?? []),
    ].filter(Boolean) as string[];

    for (const field of fieldsToCheck) {
      if (containsInjectionPatterns(field)) {
        logger.warn("[ai-generator] Potential injection pattern detected", {
          blockType: request.blockType,
          fieldLength: field.length,
        });
        break;
      }
    }

    const prompt = buildPrompt(request);

    const result = await generateText({
      model: google("gemini-3.1-pro"),
      prompt,
    });

    // Calculate confidence based on content length and presence of key elements
    // This is a heuristic - longer, more detailed content suggests higher confidence
    const contentLength = result.text.length;
    const hasStructure = result.text.includes("\n") || result.text.length > 100;
    const confidence = Math.min(0.95, Math.max(0.5, contentLength / 500 + (hasStructure ? 0.2 : 0)));

    // Extract token usage for cost tracking (AI SDK uses inputTokens/outputTokens)
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const totalTokens = result.usage?.totalTokens ?? (promptTokens + completionTokens);

    // Calculate cost: $1.25 per 1M tokens
    const cost = (totalTokens / 1_000_000) * GEMINI_COST_PER_1M_TOKENS;

    const durationMs = Date.now() - startTime;
    logger.info("[ai-generator] Content generation completed", {
      blockType: request.blockType,
      intent: request.intent,
      durationMs,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: Math.round(cost * 1_000_000) / 1_000_000, // Round to 6 decimal places
      contentLength: result.text.length,
      confidence,
    });

    return {
      content: result.text,
      confidence,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
      cost,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Log error but return graceful fallback
    logger.error("[ai-generator] Generation failed", {
      blockType: request.blockType,
      intent: request.intent,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: FALLBACK_MESSAGE,
      confidence: 0,
    };
  }
}

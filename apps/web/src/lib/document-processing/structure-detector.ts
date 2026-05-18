/**
 * AI Structure Detection Service
 * Phase 102-10: Task 2 - AI structure detector
 *
 * Uses Gemini 3.1 Pro to analyze document text and detect
 * persuasion block types with confidence scores.
 *
 * Cost: $1.25/1M tokens per LLM Architecture spec.
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { PersuasionBlockType } from "@/lib/document-builder/types";
import { sanitizeForPrompt } from "@/lib/document-builder/input-sanitizer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Detected variable within a block.
 */
export interface BlockVariable {
  id: string;
  originalText: string;
  suggestedVariable: string;
  variableType: "company_name" | "contact_name" | "price" | "date" | "domain" | "percentage" | "custom";
  confidence: number;
  occurrences: number;
  positions: Array<{ start: number; end: number }>;
}

/**
 * A detected persuasion block from document text.
 */
export interface DetectedBlock {
  id: string;
  type: PersuasionBlockType | "heading" | "paragraph" | "table" | "list" | "image" | "unknown";
  title?: string;
  content: string;
  confidence: number;
  position?: number;
  reasoning?: string;
  variables: BlockVariable[];
}

/**
 * Document metadata from structure detection.
 */
export interface DocumentMetadata {
  language: string;
  totalWords: number;
  structurePattern: string;
  tone: string;
}

/**
 * Result of structure detection.
 */
export interface StructureDetectionResult {
  blocks: DetectedBlock[];
  metadata: DocumentMetadata;
}

// ---------------------------------------------------------------------------
// Zod Schema for AI response validation
// ---------------------------------------------------------------------------

const blockVariableSchema = z.object({
  id: z.string(),
  originalText: z.string(),
  suggestedVariable: z.string(),
  variableType: z.enum(["company_name", "contact_name", "price", "date", "domain", "percentage", "custom"]),
  confidence: z.number().min(0).max(100),
  occurrences: z.number().int().min(1),
  positions: z.array(z.object({
    start: z.number().int().min(0),
    end: z.number().int().min(0),
  })),
});

const detectedBlockSchema = z.object({
  id: z.string(),
  type: z.enum([
    "pain_amplifier",
    "villain_story",
    "credibility",
    "social_proof",
    "process_reveal",
    "offer_stack",
    "risk_reversal",
    "objection_handler",
    "urgency",
    "cta",
    "custom",
    "heading",
    "paragraph",
    "table",
    "list",
    "image",
    "unknown",
  ]),
  title: z.string().optional(),
  content: z.string(),
  confidence: z.number().min(0).max(100),
  position: z.number().int().min(0).optional(),
  reasoning: z.string().optional(),
  variables: z.array(blockVariableSchema),
});

const structureDetectionResponseSchema = z.object({
  blocks: z.array(detectedBlockSchema),
  metadata: z.object({
    language: z.string(),
    totalWords: z.number().int().min(0),
    structurePattern: z.string(),
    tone: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Prompt Template
// ---------------------------------------------------------------------------

const STRUCTURE_DETECTION_PROMPT = `You are an expert at analyzing sales proposals and identifying persuasion techniques.

TASK: Analyze this document text and identify distinct persuasion blocks.

BLOCK TYPES:
1. pain_amplifier - Highlights problems, costs, or pain points the prospect faces
   Example: "Every day without SEO, you're losing potential customers"

2. villain_story - Positions competitors, old methods, or status quo as the enemy
   Example: "Other agencies promise everything but deliver excuses"

3. credibility - Establishes authority, expertise, experience, certifications
   Example: "We've helped 47 e-commerce brands achieve page 1 rankings"

4. social_proof - Testimonials, case studies, client logos, reviews
   Example: "Here's what Karolina from Plaukų Pasaka said..."

5. process_reveal - Explains methodology, steps, how the service works
   Example: "Our 6-phase SEO transformation process"

6. offer_stack - Presents packages, pricing, what's included
   Example: "Starto Package: 2,500 EUR | Augimo Package: 3,500 EUR"

7. risk_reversal - Guarantees, refund policies, risk removal
   Example: "If we don't achieve results, you get a full refund"

8. objection_handler - Addresses concerns, FAQ, common questions
   Example: "You might be wondering if SEO really works..."

9. urgency - Time pressure, scarcity, deadlines
   Example: "We only accept 8 new clients per month"

10. cta - Call to action, next steps
    Example: "Schedule your free strategy call today"

Also detect:
- heading - Section headers
- paragraph - Standard paragraphs that don't fit persuasion types
- table - Structured data or pricing tables
- list - Bullet or numbered lists
- unknown - Content that can't be classified

ALSO DETECT VARIABLES:
Find text that should become dynamic placeholders:
- Company names (UAB, AB, MB for Lithuanian)
- Personal names
- Prices (EUR, €, currency amounts)
- Dates
- Domains/URLs
- Percentages

Suggest variable syntax like: {{prospect.company}}, {{pricing.basic}}, {{seo_data.rank}}

IMPORTANT:
- Detect the language (especially Lithuanian vs English)
- Assign confidence scores (0-100) based on how certain you are
- Order blocks by their position in the document
- Include reasoning for each classification
- Generate unique IDs for each block and variable

DOCUMENT TEXT:
`;

// ---------------------------------------------------------------------------
// Main Detection Function
// ---------------------------------------------------------------------------

/**
 * Detect persuasion block structure from document text.
 *
 * Uses Gemini 3.1 Pro to analyze text and classify sections
 * into persuasion block types with confidence scores.
 *
 * @param text - The document text to analyze
 * @param options - Optional configuration
 * @returns Detected blocks with metadata
 */
export async function detectStructure(
  text: string,
  options?: {
    /** Page images for visual context (base64) */
    pageImages?: string[];
    /** Hint about expected language */
    languageHint?: string;
  }
): Promise<StructureDetectionResult> {
  if (!text || text.trim().length === 0) {
    return {
      blocks: [],
      metadata: {
        language: "unknown",
        totalWords: 0,
        structurePattern: "Empty document",
        tone: "none",
      },
    };
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // For very short text, skip AI and return basic result
  if (wordCount < 5) {
    return {
      blocks: [{
        id: `block-${Date.now()}`,
        type: "paragraph",
        content: text.trim(),
        confidence: 100,
        position: 0,
        variables: [],
      }],
      metadata: {
        language: options?.languageHint ?? "unknown",
        totalWords: wordCount,
        structurePattern: "Single paragraph",
        tone: "neutral",
      },
    };
  }

  try {
    // Sanitize user text to prevent prompt injection attacks
    const sanitizedText = sanitizeForPrompt(text);
    const prompt = `${STRUCTURE_DETECTION_PROMPT}${sanitizedText}`;

    const result = await generateObject({
      model: google("gemini-3.1-pro"),
      schema: structureDetectionResponseSchema,
      prompt,
    });

    // Sort blocks by position
    const sortedBlocks = [...result.object.blocks].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      return posA - posB;
    });

    logger.info("[structure-detector] Structure detection complete", {
      blocksDetected: sortedBlocks.length,
      language: result.object.metadata.language,
      wordCount,
    });

    return {
      blocks: sortedBlocks,
      metadata: result.object.metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("[structure-detector] Structure detection failed", {
      error: errorMessage,
      textLength: text.length,
    });

    throw new Error(`Structure detection failed: ${errorMessage}`);
  }
}

/**
 * Generate structured content using Gemini.
 * Exported for testing/mocking purposes.
 */
export async function generateStructuredContent(
  prompt: string
): Promise<z.infer<typeof structureDetectionResponseSchema>> {
  const result = await generateObject({
    model: google("gemini-3.1-pro"),
    schema: structureDetectionResponseSchema,
    prompt,
  });

  return result.object;
}

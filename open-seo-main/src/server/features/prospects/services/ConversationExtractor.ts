/**
 * AI-powered conversation extraction service.
 * Phase 56: Prospect Input Excellence
 *
 * Uses Claude to extract structured business information from conversation transcripts,
 * email threads, or sales notes. Returns typed data with confidence score.
 *
 * Security: API key loaded from env, never exposed to client.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { detectPlatform } from "@/server/features/connections/services/PlatformDetector";
import type { DetectionResult } from "@/server/features/connections/types";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MIN_CONTENT_LENGTH = 50;
const MAX_CONTENT_LENGTH = 50000;

// Negative associations schema for keyword filtering
const NegativeAssociationsSchema = z.object({
  notServices: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  adjacentVerticals: z.array(z.string()).default([]),
  wrongIntent: z.array(z.string()).default([]),
});

// Zod schema for validating AI response
const ExtractionResultSchema = z.object({
  businessName: z.string().optional(),
  industry: z.string().optional(),
  services: z.array(z.string()).optional().default([]),
  targetAudience: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  location: z.string().optional(),
  confidence: z.number().min(0).max(100).default(0),
  // Phase 63: Negative associations for keyword filtering
  negativeAssociations: NegativeAssociationsSchema.optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export interface ExtractionInput {
  content: string;
  inputMode: "website" | "website_with_context" | "conversation";
  domain?: string;
  contextNotes?: string;
}

export interface ExtractedProspectData extends ExtractionResult {
  platform?: DetectionResult;
}

const EXTRACTION_PROMPT = `You are an expert business analyst. Extract structured information from the following text.

The text may be:
- A sales call transcript
- An email thread
- Meeting notes
- General business context

Extract the following information. If information is not clearly present, omit that field. Be conservative - only include data you're confident about.

Required output format (JSON):
{
  "businessName": "Company name if mentioned",
  "industry": "Business industry/vertical",
  "services": ["List of services they offer"],
  "targetAudience": "Who they serve (B2B, B2C, specific segments)",
  "keywords": ["Relevant SEO keywords based on their business"],
  "location": "City, State/Country if mentioned",
  "confidence": 0-100 (how confident you are in the overall extraction),
  "negativeAssociations": {
    "notServices": ["Services this business does NOT provide"],
    "competitors": ["Known competitor types or brands"],
    "adjacentVerticals": ["Related but wrong business types"],
    "wrongIntent": ["Intent signals indicating wrong audience"]
  }
}

Guidelines:
- For keywords, generate 5-10 relevant SEO keywords based on their business
- Confidence score: 90+ = very clear info, 70-89 = most info present, 50-69 = partial info, <50 = limited info
- If the text is nonsense or unrelated to business, return confidence: 0
- For negativeAssociations: identify what this business does NOT do, even if similar-sounding
  - Example: A company that BUYS embroidery should have "embroidery services" in notServices
  - Example: A hair salon should have "hair transplant" in adjacentVerticals

TEXT TO ANALYZE:
`;

/**
 * Extract structured business information from conversation text using Claude AI.
 */
export async function extractFromConversation(
  input: ExtractionInput,
): Promise<ExtractedProspectData> {
  // Validate input
  if (!input.content?.trim()) {
    throw new AppError("VALIDATION_ERROR", "Content is required for extraction");
  }

  if (input.content.length < MIN_CONTENT_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Content must be at least ${MIN_CONTENT_LENGTH} characters for meaningful extraction`,
    );
  }

  if (input.content.length > MAX_CONTENT_LENGTH) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError("CONFIG_ERROR", "ANTHROPIC_API_KEY not configured");
  }

  // Build prompt with context
  let fullContent = input.content;
  if (input.contextNotes) {
    fullContent = `CONTEXT NOTES:\n${input.contextNotes}\n\nMAIN CONTENT:\n${input.content}`;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}${fullContent}`,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );

    if (!textBlock?.text) {
      logger.warn("No text in Claude response", { inputMode: input.inputMode });
      return { confidence: 0, services: [], keywords: [] };
    }

    // Parse and validate JSON response
    let parsed: unknown;
    try {
      // Handle potential markdown code blocks
      const jsonText = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      logger.warn("Failed to parse Claude JSON response", {
        error: parseError,
        response: textBlock.text.slice(0, 200),
      });
      return { confidence: 0, services: [], keywords: [] };
    }

    // Validate with Zod schema
    const validated = ExtractionResultSchema.safeParse(parsed);
    if (!validated.success) {
      logger.warn("Claude response failed Zod validation", {
        errors: validated.error.issues,
      });
      return { confidence: 0, services: [], keywords: [] };
    }

    const result: ExtractedProspectData = validated.data;

    // Run platform detection for website modes
    if (
      input.domain &&
      (input.inputMode === "website" || input.inputMode === "website_with_context")
    ) {
      try {
        result.platform = await detectPlatform(`https://${input.domain}`);
      } catch (platformError) {
        logger.warn("Platform detection failed", {
          domain: input.domain,
          error: platformError,
        });
        // Non-blocking - continue without platform info
      }
    }

    return result;
  } catch (error) {
    // Don't expose internal errors
    logger.error("Extraction failed", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(
      "EXTRACTION_ERROR",
      "Failed to extract information. Please try again.",
    );
  }
}

export const ConversationExtractor = {
  extract: extractFromConversation,
};

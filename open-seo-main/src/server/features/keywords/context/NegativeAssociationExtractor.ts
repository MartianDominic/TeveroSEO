/**
 * NegativeAssociationExtractor: Extracts negative associations from business context.
 *
 * Purpose: Filter adjacent verticals and semantically similar but contextually
 * wrong keywords. Critical for achieving 100-200 ON-POINT keywords per prospect.
 *
 * Example: An embroidery company that BUYS embroidery should EXCLUDE
 * "embroidery services" because they don't SELL embroidery.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import type { NegativeAssociations } from "../classification/types";
import { CLAUDE_CONFIG } from "../classification/config";

/**
 * Schema for validating Claude's extraction response.
 */
const NegativeAssociationsSchema = z.object({
  notServices: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  adjacentVerticals: z.array(z.string()).default([]),
  wrongIntent: z.array(z.string()).default([]),
});

/**
 * Input for negative association extraction.
 */
export interface BusinessContextInput {
  businessName: string;
  industry: string;
  services: string[];
  description?: string;
  targetAudience?: string;
}

const EXTRACTION_PROMPT = `You are a business analyst. Extract negative associations from the business context.

Negative associations help filter OUT irrelevant keywords during SEO analysis.

<instructions>
1. notServices: What this business explicitly does NOT sell/provide
   - If they SELL shoes, "shoe repair" is a notService (they don't repair)
   - If they BUY embroidery, "embroidery services" is a notService (they don't sell embroidery)

2. competitors: Known competitor types or domains
   - Direct competitors in the same space
   - Brand names to avoid targeting

3. adjacentVerticals: Related but WRONG verticals
   - A hair salon: "hair transplant clinic" is adjacent but wrong
   - A car dealer: "car repair shop" is adjacent but wrong
   - Services that sound similar but serve different needs

4. wrongIntent: Intent signals that indicate wrong audience
   - For B2B: "free", "DIY", "home" often indicate B2C
   - For premium: "cheap", "budget" indicate wrong segment
   - For professional: "tutorial", "how to" indicate learners not buyers
</instructions>

Return ONLY valid JSON:
{
  "notServices": ["..."],
  "competitors": ["..."],
  "adjacentVerticals": ["..."],
  "wrongIntent": ["..."]
}`;

/**
 * Extracts negative associations from business context using Claude.
 */
export class NegativeAssociationExtractor {
  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AppError("CONFIG_ERROR", "ANTHROPIC_API_KEY not configured");
    }
    this.client = new Anthropic({ apiKey: key });
  }

  /**
   * Extract negative associations from business context.
   * Returns empty arrays on error (graceful degradation).
   */
  async extract(context: BusinessContextInput): Promise<NegativeAssociations> {
    // Validate minimum required context
    if (!context.businessName || !context.industry) {
      logger.warn("Insufficient context for negative association extraction", {
        hasName: !!context.businessName,
        hasIndustry: !!context.industry,
      });
      return this.emptyResult();
    }

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_CONFIG.model,
        max_tokens: CLAUDE_CONFIG.maxTokens,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}

<business-context>
Business: ${context.businessName}
Industry: ${context.industry}
Services: ${context.services.join(", ") || "not specified"}
${context.description ? `Description: ${context.description}` : ""}
${context.targetAudience ? `Target: ${context.targetAudience}` : ""}
</business-context>`,
          },
        ],
      });

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      if (!textBlock?.text) {
        logger.warn("No text in Claude response for negative association extraction");
        return this.emptyResult();
      }

      // Handle potential markdown code blocks
      const jsonText = textBlock.text.replace(/```json\n?|\n?```/g, "").trim();

      let parsed: z.infer<typeof NegativeAssociationsSchema> | null = null;
      try {
        const jsonData = JSON.parse(jsonText);
        const parseResult = NegativeAssociationsSchema.safeParse(jsonData);
        if (parseResult.success) {
          parsed = parseResult.data;
        }
      } catch {
        logger.warn("Failed to parse negative associations JSON", {
          text: jsonText.slice(0, 200),
        });
        return this.emptyResult();
      }

      if (!parsed) {
        logger.warn("Failed to validate negative associations schema");
        return this.emptyResult();
      }

      return parsed;
    } catch (error) {
      logger.error("Negative association extraction failed", {
        error: error instanceof Error ? error.message : String(error),
        businessName: context.businessName,
      });
      return this.emptyResult();
    }
  }

  /**
   * Return empty result for graceful degradation.
   */
  private emptyResult(): NegativeAssociations {
    return {
      notServices: [],
      competitors: [],
      adjacentVerticals: [],
      wrongIntent: [],
    };
  }
}

/**
 * Singleton-style extractor for convenience.
 */
export const negativeAssociationExtractor = {
  extract: (context: BusinessContextInput) =>
    new NegativeAssociationExtractor().extract(context),
};

/**
 * AI-powered keyword opportunity generator.
 * Phase 29: AI Opportunity Discovery - Task 29-01
 *
 * Uses Claude to generate keyword ideas from scraped business content.
 * Supports multiple languages (English, Lithuanian, etc.)
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  OPPORTUNITY_KEYWORD_CATEGORIES,
  type OpportunityKeywordCategory,
} from "@/db/prospect-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "keyword-generator" });

// Schema for validating AI-generated keywords
const GeneratedKeywordSchema = z.object({
  keyword: z.string(),
  category: z.enum(OPPORTUNITY_KEYWORD_CATEGORIES),
});

export interface GeneratedKeyword {
  keyword: string;
  category: OpportunityKeywordCategory;
}

export interface KeywordGeneratorInput {
  products: string[];
  brands: string[];
  services: string[];
  location: string | null;
  targetMarket: "residential" | "commercial" | "both" | null;
  language: string;
}

// Language name mapping for prompts
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  lt: "Lithuanian",
  de: "German",
  fr: "French",
  fi: "Finnish",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  nl: "Dutch",
};

/**
 * Build the prompt for Claude to generate keyword opportunities.
 */
export function buildKeywordPrompt(input: KeywordGeneratorInput): string {
  const languageName = LANGUAGE_NAMES[input.language] ?? "English";
  const productsList = input.products.length > 0 ? input.products.join(", ") : "Not specified";
  const brandsList = input.brands.length > 0 ? input.brands.join(", ") : "Not specified";
  const servicesList = input.services.length > 0 ? input.services.join(", ") : "Not specified";
  const locationText = input.location ?? "Not specified";
  const targetMarketText = input.targetMarket ?? "Not specified";

  return `You are an SEO expert generating keyword opportunities for a business.

BUSINESS INFORMATION:
- Products: ${productsList}
- Brands: ${brandsList}
- Services: ${servicesList}
- Location: ${locationText}
- Target Market: ${targetMarketText}

Generate 50-100 keyword ideas in ${languageName} that this business should target for SEO.

CATEGORIES (generate keywords for all five):
1. "product" - Product-focused keywords (e.g., "barrel sauna price", "outdoor sauna for sale")
2. "brand" - Brand-related keywords (e.g., "Harvia heater reviews", "[brand] near me")
3. "service" - Service keywords (e.g., "sauna installation", "[service] + [location]")
4. "commercial" - Commercial/transactional intent (e.g., "buy [product]", "[product] prices", "best [product]")
5. "informational" - Informational/educational (e.g., "how to [task]", "[topic] guide", "[product] vs [product]")

GUIDELINES:
- Include location modifiers where relevant (e.g., "[service] in [location]")
- Generate long-tail variations (3-5 words)
- Include price/cost-related keywords
- Include comparison keywords
- Mix head terms and long-tail keywords
- If brands are specified, include brand + product combinations
- Generate keywords in ${languageName}

Return ONLY a valid JSON array, no additional text or markdown formatting:
[
  {"keyword": "keyword text", "category": "product"},
  {"keyword": "another keyword", "category": "brand"},
  ...
]`;
}

/**
 * Parse and validate the AI response to extract keywords.
 */
export function parseKeywordResponse(response: string): GeneratedKeyword[] {
  try {
    // Remove markdown code blocks if present
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleanedResponse) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    // Validate and filter keywords
    const validKeywords: GeneratedKeyword[] = [];
    const seenKeywords = new Set<string>();

    for (const item of parsed) {
      const result = GeneratedKeywordSchema.safeParse(item);
      if (result.success) {
        const keyword = result.data.keyword.trim();
        const normalizedKeyword = keyword.toLowerCase();

        // Skip empty keywords and duplicates
        if (keyword.length > 0 && !seenKeywords.has(normalizedKeyword)) {
          seenKeywords.add(normalizedKeyword);
          validKeywords.push({
            keyword,
            category: result.data.category,
          });
        }
      }
    }

    return validKeywords;
  } catch (error) {
    log.error(
      "Failed to parse keyword response",
      error instanceof Error ? error : new Error(String(error)),
    );
    return [];
  }
}

/**
 * Generate keyword opportunities from business information using Claude.
 *
 * @param input - Business information from scraped content
 * @returns Array of generated keywords with categories
 */
export async function generateKeywordOpportunities(
  input: KeywordGeneratorInput,
): Promise<GeneratedKeyword[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log.warn("ANTHROPIC_API_KEY not set, returning empty keywords");
    return [];
  }

  const prompt = buildKeywordPrompt(input);

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textContent || textContent.type !== "text") {
      log.error("No text content in Claude response", new Error("Empty response"));
      return [];
    }

    const keywords = parseKeywordResponse(textContent.text);

    log.info("Keywords generated", {
      inputProducts: input.products.length,
      inputBrands: input.brands.length,
      inputServices: input.services.length,
      generatedCount: keywords.length,
      language: input.language,
    });

    return keywords;
  } catch (error) {
    log.error(
      "Failed to generate keyword opportunities",
      error instanceof Error ? error : new Error(String(error)),
    );
    return [];
  }
}

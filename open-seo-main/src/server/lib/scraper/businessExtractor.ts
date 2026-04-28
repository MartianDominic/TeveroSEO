/**
 * AI-powered business information extraction from scraped website content.
 *
 * Uses Claude to analyze PageAnalysis data and extract:
 * - Products/services offered
 * - Brand names
 * - Location
 * - Target market (residential/commercial/both)
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { PageAnalysis } from "@/server/lib/audit/types";
import { createLogger } from "@/server/lib/logger";

/** Claude model to use for business extraction */
const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL_BUSINESS_EXTRACTOR || "claude-3-5-sonnet-20241022";

/** Maximum tokens for Claude response */
const MAX_TOKENS = 2048;

const log = createLogger({ module: "business-extractor" });

// Zod schema for validation
const BusinessInfoSchema = z.object({
  products: z.array(z.string()),
  brands: z.array(z.string()),
  services: z.array(z.string()),
  location: z.string().nullable(),
  targetMarket: z.enum(["residential", "commercial", "both"]).nullable(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

export interface BusinessInfo {
  products: string[];
  brands: string[];
  services: string[];
  location: string | null;
  targetMarket: "residential" | "commercial" | "both" | null;
  summary: string;
  confidence: number; // 0-1
}

export interface ScrapedContent {
  pages: PageAnalysis[];
  businessLinks: {
    products: string | null;
    about: string | null;
    services: string | null;
    contact: string | null;
    categories: string[];
  } | null;
  businessInfo: BusinessInfo | null;
  totalCostCents: number;
  scrapedAt: string; // ISO timestamp
}

/**
 * Extract business information from scraped pages using Claude.
 *
 * @param pages - Array of PageAnalysis from multi-page scraper
 * @param domain - Domain being analyzed
 * @returns BusinessInfo with extracted data and confidence score
 */
export async function extractBusinessInfo(
  pages: PageAnalysis[],
  domain: string,
): Promise<BusinessInfo> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured - cannot extract business info");
  }

  // Build prompt from PageAnalysis data
  const prompt = buildPrompt(pages, domain);

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
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
      throw new Error("No text content in Claude response");
    }

    // Parse JSON response
    const parsed = JSON.parse(textContent.text) as unknown;

    // Validate with Zod
    const validated = BusinessInfoSchema.parse(parsed);

    log.info("Business info extracted", {
      domain,
      productsCount: validated.products.length,
      brandsCount: validated.brands.length,
      servicesCount: validated.services.length,
      confidence: validated.confidence,
    });

    return validated;
  } catch (error) {
    log.error(
      "Failed to extract business info",
      error instanceof Error ? error : new Error(String(error)),
      { domain },
    );

    // Return empty result on error
    return {
      products: [],
      brands: [],
      services: [],
      location: null,
      targetMarket: null,
      summary: "Failed to extract business information",
      confidence: 0,
    };
  }
}

/**
 * Build prompt for Claude from PageAnalysis data.
 */
function buildPrompt(pages: PageAnalysis[], domain: string): string {
  // Aggregate content from all pages
  const pageContents = pages.map((page, idx) => {
    return `
PAGE ${idx + 1}: ${page.url}
Title: ${page.title || "(none)"}
Meta Description: ${page.metaDescription || "(none)"}
OG Title: ${page.ogTitle || "(none)"}
OG Description: ${page.ogDescription || "(none)"}
H1 Headings: ${page.h1s.join(", ") || "(none)"}
Word Count: ${page.wordCount}
`.trim();
  });

  const contentBlock = pageContents.join("\n\n---\n\n");

  return `You are analyzing a business website to extract key information.

Domain: ${domain}

Website Content:
${contentBlock}

Based on this content, extract the following information and return it as JSON:

{
  "products": ["array of product names or product categories sold"],
  "brands": ["array of brand names mentioned - these are manufacturers/brands they work with, not their company name"],
  "services": ["array of services offered"],
  "location": "primary geographic location (city, state/region, country) or null if not found",
  "targetMarket": "residential" | "commercial" | "both" | null,
  "summary": "1-2 sentence summary of what this business does",
  "confidence": 0.0-1.0 (how confident you are in this extraction)
}

Guidelines:
- Products: Specific items or categories they sell (e.g., "AC Units", "Solar Panels", "Furniture")
- Brands: Third-party brands they carry or install (e.g., "Carrier", "Trane", "Tesla")
- Services: What they do (e.g., "Installation", "Repair", "Consulting", "Maintenance")
- Location: Extract city/county/state/country from content (not just from domain)
- Target Market: Look for keywords like "residential", "commercial", "business", "homeowners"
- Confidence: Higher if content is clear and specific, lower if vague or minimal

Return ONLY valid JSON, no additional text.`;
}

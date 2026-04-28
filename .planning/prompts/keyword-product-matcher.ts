/**
 * Keyword-to-Product Matcher Implementation
 *
 * This module implements the runtime logic for the XML prompt template,
 * handling product candidate injection and response parsing.
 */

import { readFileSync } from "fs";
import { join } from "path";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ProductCandidate {
  id: string;
  name: string;
  brand: string;
  product_line: string;
  category: string;
  specs: {
    color_code?: string;
    color_name?: string;
    volume?: string;
    weight?: string;
    type?: string;
  };
  url: string;
  embedding_score: number;
}

export type MatchType =
  | "PRODUCT"
  | "CATEGORY"
  | "BRAND_COLLECTION"
  | "PRODUCT_LINE"
  | "NO_MATCH";

export type IntentType =
  | "PRODUCT_SPECIFIC"
  | "PRODUCT_LINE"
  | "BRAND_EXPLORATION"
  | "GENERIC"
  | "COLOR_SPECIFIC";

export type ActionType =
  | "ASSIGN_TO_PRODUCT"
  | "ASSIGN_TO_CATEGORY"
  | "ASSIGN_TO_BRAND_COLLECTION"
  | "ASSIGN_TO_PRODUCT_LINE"
  | "FLAG_AS_GAP";

export interface MatchedProduct {
  id: string | null;
  url: string | null;
  confidence: number;
}

export interface RecommendedCategory {
  type: "product_type" | "brand_collection" | "product_line" | null;
  name: string | null;
  suggested_url: string | null;
  confidence: number;
}

export interface GapAnalysis {
  searched_product: {
    brand?: string;
    product_line?: string;
    color_code?: string;
    volume?: string;
  } | null;
  closest_alternatives:
    | Array<{
        id: string;
        reason: string;
        distance: "close" | "moderate" | "far";
      }>
    | null;
  recommendation: string | null;
}

export interface ScoringBreakdown {
  brand_match: number;
  color_code_match: number;
  product_line_match: number;
  spec_match: number;
  total: number;
}

export interface MatcherResponse {
  match_type: MatchType;
  intent: IntentType;
  matched_product: MatchedProduct | null;
  recommended_category: RecommendedCategory | null;
  gap_analysis: GapAnalysis | null;
  scoring_breakdown: ScoringBreakdown;
  reasoning: string;
  action: ActionType;
  corrected_keyword?: string; // Present if typo was corrected
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

/**
 * Builds the complete prompt by injecting keyword and products into the XML template
 */
export function buildMatcherPrompt(
  keyword: string,
  products: ProductCandidate[]
): string {
  // Load XML template
  const templatePath = join(__dirname, "keyword-product-matcher.xml");
  let template = readFileSync(templatePath, "utf-8");

  // Inject keyword
  template = template.replace("{{KEYWORD}}", escapeXml(keyword));

  // Inject products as JSON
  const productsJson = JSON.stringify(products, null, 2);
  template = template.replace("{{PRODUCTS_JSON}}", productsJson);

  return template;
}

/**
 * Escape special XML characters in user input
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// RESPONSE PARSER
// ============================================================================

/**
 * Parse and validate the LLM response
 */
export function parseMatcherResponse(response: string): MatcherResponse {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

  try {
    const parsed = JSON.parse(jsonStr) as MatcherResponse;
    return validateResponse(parsed);
  } catch (error) {
    throw new Error(
      `Failed to parse matcher response: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validate response structure and enforce business rules
 */
function validateResponse(response: MatcherResponse): MatcherResponse {
  // Validate match_type
  const validMatchTypes: MatchType[] = [
    "PRODUCT",
    "CATEGORY",
    "BRAND_COLLECTION",
    "PRODUCT_LINE",
    "NO_MATCH",
  ];
  if (!validMatchTypes.includes(response.match_type)) {
    throw new Error(`Invalid match_type: ${response.match_type}`);
  }

  // Validate intent
  const validIntents: IntentType[] = [
    "PRODUCT_SPECIFIC",
    "PRODUCT_LINE",
    "BRAND_EXPLORATION",
    "GENERIC",
    "COLOR_SPECIFIC",
  ];
  if (!validIntents.includes(response.intent)) {
    throw new Error(`Invalid intent: ${response.intent}`);
  }

  // Validate confidence ranges
  if (response.matched_product?.confidence !== undefined) {
    if (
      response.matched_product.confidence < 0 ||
      response.matched_product.confidence > 1
    ) {
      throw new Error(
        `Invalid confidence: ${response.matched_product.confidence}`
      );
    }
  }

  // Business rule: PRODUCT match_type must have matched_product
  if (response.match_type === "PRODUCT" && !response.matched_product?.id) {
    throw new Error("PRODUCT match_type requires matched_product.id");
  }

  // Business rule: Category-type matches must have recommended_category
  const categoryMatchTypes: MatchType[] = [
    "CATEGORY",
    "BRAND_COLLECTION",
    "PRODUCT_LINE",
  ];
  if (
    categoryMatchTypes.includes(response.match_type) &&
    !response.recommended_category?.suggested_url
  ) {
    throw new Error(
      `${response.match_type} requires recommended_category.suggested_url`
    );
  }

  return response;
}

// ============================================================================
// COLOR CODE UTILITIES
// ============================================================================

/**
 * Normalize color code to standard format (X/Y)
 */
export function normalizeColorCode(code: string): string {
  if (!code) return "";

  // Remove spaces
  let normalized = code.replace(/\s/g, "");

  // Convert letter codes to numeric
  const letterMap: Record<string, string> = {
    N: "0",
    A: "1",
    V: "2",
    G: "3",
    C: "4",
    M: "5",
    R: "6",
    B: "7",
  };

  // Check for letter suffix (e.g., "6N" -> "6/0")
  const letterMatch = normalized.match(/^(\d+)([NAVGCMRB])$/i);
  if (letterMatch) {
    const [, level, letter] = letterMatch;
    const tone = letterMap[letter.toUpperCase()] || "0";
    return `${level}/${tone}`;
  }

  // Convert dots and dashes to slashes
  normalized = normalized.replace(/[.\-]/g, "/");

  // Remove leading zeros from level
  normalized = normalized.replace(/^0+(\d)/, "$1");

  return normalized;
}

/**
 * Check if two color codes are equivalent
 */
export function colorCodesMatch(code1: string, code2: string): boolean {
  return normalizeColorCode(code1) === normalizeColorCode(code2);
}

/**
 * Extract color code from text (product name or keyword)
 */
export function extractColorCode(text: string): string | null {
  // Patterns to match various color code formats
  const patterns = [
    /\b(\d{1,2})[\/.\-](\d{1,2}(?:[\/.\-]\d{1,2})?)\b/, // 6/0, 6.0, 6-0, 6/0/1
    /\b(\d{1,2})([NAVGCMRB])\b/i, // 6N, 7A
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\b/, // 6/0/1 (triple)
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// ============================================================================
// BRAND NORMALIZATION
// ============================================================================

const BRAND_ALIASES: Record<string, string[]> = {
  "L'Oréal Professionnel": [
    "L'Oreal",
    "Loreal",
    "LOreal",
    "L'oreal",
    "Loreal Professionnel",
  ],
  Schwarzkopf: ["Schwarckopf", "Shwarzkopf", "Schwarzcopf"],
  Wella: ["Vella", "Wela"],
  Matrix: ["Matix"],
  Redken: ["Redkin"],
  Kérastase: ["Kerastase", "Kerastaze"],
};

// Build reverse lookup
const BRAND_CANONICAL: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
  BRAND_CANONICAL[canonical.toLowerCase()] = canonical;
  for (const alias of aliases) {
    BRAND_CANONICAL[alias.toLowerCase()] = canonical;
  }
}

/**
 * Normalize brand name to canonical form
 */
export function normalizeBrand(brand: string): string {
  const lower = brand.toLowerCase().trim();
  return BRAND_CANONICAL[lower] || brand;
}

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9, // Auto-assign
  MEDIUM: 0.75, // Suggest for review
  LOW: 0.5, // Manual review required
} as const;

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  if (confidence >= CONFIDENCE_THRESHOLDS.LOW) return "low";
  return "none";
}

// ============================================================================
// INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example usage with Claude API (pseudo-code)
 */
export async function matchKeywordToProduct(
  keyword: string,
  candidates: ProductCandidate[]
  // anthropicClient: Anthropic
): Promise<MatcherResponse> {
  // Build the prompt
  const prompt = buildMatcherPrompt(keyword, candidates);

  // Call Claude API (example - actual implementation depends on SDK)
  // const response = await anthropicClient.messages.create({
  //   model: 'claude-sonnet-4-20250514',
  //   max_tokens: 2048,
  //   messages: [
  //     { role: 'user', content: prompt }
  //   ]
  // });

  // Parse and validate response
  // const result = parseMatcherResponse(response.content[0].text);

  // Placeholder for testing
  const result: MatcherResponse = {
    match_type: "PRODUCT",
    intent: "PRODUCT_SPECIFIC",
    matched_product: {
      id: candidates[0]?.id || null,
      url: candidates[0]?.url || null,
      confidence: 0.95,
    },
    recommended_category: null,
    gap_analysis: null,
    scoring_breakdown: {
      brand_match: 40,
      color_code_match: 50,
      product_line_match: 35,
      spec_match: 15,
      total: 140,
    },
    reasoning: "Placeholder response",
    action: "ASSIGN_TO_PRODUCT",
  };

  return result;
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

export const __testing = {
  escapeXml,
  validateResponse,
  BRAND_CANONICAL,
};

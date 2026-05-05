/**
 * POST /api/keywords/generate
 * Phase 84-01: Wire KeywordGenerator into chat flow
 *
 * Accepts business description, extracts constraints via ConstraintExtractor,
 * generates keywords via KeywordGenerator, returns grouped results.
 *
 * Flow:
 * 1. Validate input (DoS protection: max 50k chars)
 * 2. Extract business constraints from description
 * 3. Map constraints to KeywordGenerator input
 * 4. Generate keywords
 * 5. Return grouped by category with counts
 *
 * Security:
 * - T-84-02: Input validation (50k char limit)
 * - T-84-01: Verify user context (delegated to auth middleware)
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createConstraintExtractor } from "@/server/features/keywords/conversation/ConstraintExtractor";
import {
  generateKeywordOpportunities,
  type KeywordGeneratorInput,
  type GeneratedKeyword,
} from "@/server/lib/opportunity/keywordGenerator";
import type {
  AnalysisConstraints,
  ConfidenceScores,
} from "@/server/features/keywords/conversation/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-keywords-generate" });

// Maximum description length (DoS protection)
const MAX_DESCRIPTION_LENGTH = 50_000;

// Confidence threshold for clarification
const CLARIFICATION_THRESHOLD = 0.5;

// Supported languages
const SUPPORTED_LANGUAGES = ["en", "lt", "de", "fr", "fi", "sv", "no", "da", "nl"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Request schema
 */
const GenerateRequestSchema = z.object({
  businessDescription: z
    .string()
    .min(1, "Business description is required")
    .max(MAX_DESCRIPTION_LENGTH, `Description too long (max ${MAX_DESCRIPTION_LENGTH} chars)`),
  language: z.enum(SUPPORTED_LANGUAGES).default("en"),
  enrichedContext: z.string().optional(), // Additional context from clarification answers
});

/**
 * Response types
 */
export interface GenerateKeywordsRequest {
  businessDescription: string;
  language: SupportedLanguage;
  enrichedContext?: string;
}

export interface GeneratedKeywordsByCategory {
  product: string[];
  brand: string[];
  service: string[];
  commercial: string[];
  informational: string[];
}

export interface KeywordCounts {
  total: number;
  product: number;
  brand: number;
  service: number;
  commercial: number;
  informational: number;
}

export interface ClarificationQuestion {
  field: string;
  question: string;
  options?: string[];
}

export interface GenerateKeywordsResponse {
  success: boolean;
  keywords?: GeneratedKeywordsByCategory;
  counts?: KeywordCounts;
  constraints?: AnalysisConstraints;
  confidence?: ConfidenceScores;
  clarificationNeeded?: ClarificationQuestion[];
  error?: string;
}

/**
 * Map field names to human-readable clarifying questions.
 */
function mapFieldToQuestion(field: string): ClarificationQuestion {
  const questionMap: Record<string, ClarificationQuestion> = {
    "business.type": {
      field: "business.type",
      question: "What type of business are you?",
      options: ["E-commerce", "Service", "SaaS", "Local business", "B2B services"],
    },
    "business.coreOffering": {
      field: "business.coreOffering",
      question: "What is your main product or service?",
    },
    "geo.scope": {
      field: "geo.scope",
      question: "What geographic area do you serve?",
      options: ["Single city/neighborhood", "Multiple cities", "Regional", "National"],
    },
    "geo.includeCities": {
      field: "geo.includeCities",
      question: "Which specific cities or areas do you serve?",
    },
    "audience.b2bOnly": {
      field: "audience.b2bOnly",
      question: "Do you serve businesses, consumers, or both?",
      options: ["Only businesses (B2B)", "Only consumers (B2C)", "Both B2B and B2C"],
    },
    "funnel.primary": {
      field: "funnel.primary",
      question: "Are you focused on buyers ready to purchase, or building awareness?",
      options: [
        "Ready-to-buy customers (BOFU)",
        "Considering/comparing options (MOFU)",
        "Building awareness (TOFU)",
      ],
    },
    "priorities": {
      field: "priorities",
      question: "What product or service categories are most important for your business?",
    },
    "negatives": {
      field: "negatives",
      question: "Are there any competitors or terms you want to exclude from targeting?",
    },
  };

  return (
    questionMap[field] || {
      field,
      question: `Please provide more details about: ${field}`,
    }
  );
}

/**
 * Map extracted constraints to KeywordGenerator input format.
 */
function mapConstraintsToGeneratorInput(
  constraints: AnalysisConstraints,
  language: string
): KeywordGeneratorInput {
  const { business, geo, audience } = constraints;

  // Map business type to target market
  let targetMarket: "residential" | "commercial" | "both" | null = null;
  if (audience.b2bOnly) {
    targetMarket = "commercial";
  } else if (audience.b2cAllowed && !audience.b2bOnly) {
    targetMarket = "residential";
  } else {
    targetMarket = "both";
  }

  // Determine if this is product-based or service-based
  const isService = business.type === "service" || business.type === "local";
  const isProduct =
    business.type === "ecommerce" || business.productCategories.length > 0;

  return {
    products: isProduct ? business.productCategories : [],
    brands: [], // Brands would need to be extracted separately
    services: isService ? [business.coreOffering, ...business.productCategories] : [],
    location: geo.includeCities[0] || null,
    targetMarket,
    language,
  };
}

/**
 * Group generated keywords by category.
 */
function groupKeywordsByCategory(
  keywords: GeneratedKeyword[]
): GeneratedKeywordsByCategory {
  const grouped: GeneratedKeywordsByCategory = {
    product: [],
    brand: [],
    service: [],
    commercial: [],
    informational: [],
  };

  for (const kw of keywords) {
    if (kw.category in grouped) {
      grouped[kw.category as keyof GeneratedKeywordsByCategory].push(kw.keyword);
    }
  }

  return grouped;
}

/**
 * Calculate keyword counts by category.
 */
function calculateCounts(grouped: GeneratedKeywordsByCategory): KeywordCounts {
  return {
    total:
      grouped.product.length +
      grouped.brand.length +
      grouped.service.length +
      grouped.commercial.length +
      grouped.informational.length,
    product: grouped.product.length,
    brand: grouped.brand.length,
    service: grouped.service.length,
    commercial: grouped.commercial.length,
    informational: grouped.informational.length,
  };
}

/**
 * Core handler function for keyword generation.
 * Exported for testing.
 */
export async function handleGenerateKeywords(
  request: GenerateKeywordsRequest
): Promise<GenerateKeywordsResponse> {
  // Validate input
  const validation = GenerateRequestSchema.safeParse(request);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return {
      success: false,
      error: firstError?.message || "Invalid request",
    };
  }

  const { businessDescription, language, enrichedContext } = validation.data;

  try {
    // Step 1: Extract constraints from business description
    const extractor = createConstraintExtractor();
    const extractionInput = enrichedContext
      ? `${businessDescription}\n\nAdditional context: ${enrichedContext}`
      : businessDescription;

    const extractionResult = await extractor.extract(extractionInput);

    if (!extractionResult.success || !extractionResult.constraints) {
      return {
        success: false,
        error: `Constraint extraction failed: ${extractionResult.error || "Unknown error"}`,
      };
    }

    // Step 2: Check if clarification is needed (confidence < 0.5)
    const needsClarification =
      extractionResult.confidence &&
      extractionResult.confidence.overall < CLARIFICATION_THRESHOLD;

    if (needsClarification && extractionResult.clarificationNeeded.length > 0) {
      const clarificationQuestions = extractionResult.clarificationNeeded.map(
        mapFieldToQuestion
      );

      return {
        success: true,
        constraints: extractionResult.constraints,
        confidence: extractionResult.confidence ?? undefined,
        clarificationNeeded: clarificationQuestions,
      };
    }

    // Step 3: Map constraints to generator input
    const generatorInput = mapConstraintsToGeneratorInput(
      extractionResult.constraints,
      language
    );

    // Step 4: Generate keywords
    let generatedKeywords: GeneratedKeyword[];
    try {
      generatedKeywords = await generateKeywordOpportunities(generatorInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error("Keyword generation failed", error instanceof Error ? error : new Error(message));
      return {
        success: false,
        error: `Keyword generation failed: ${message}`,
      };
    }

    // Step 5: Group and count keywords
    const grouped = groupKeywordsByCategory(generatedKeywords);
    const counts = calculateCounts(grouped);

    log.info("Keywords generated successfully", {
      total: counts.total,
      language,
      businessType: extractionResult.constraints.business.type,
    });

    return {
      success: true,
      keywords: grouped,
      counts,
      constraints: extractionResult.constraints,
      confidence: extractionResult.confidence ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Keyword generation failed", error instanceof Error ? error : new Error(message));
    return {
      success: false,
      error: `Failed to generate keywords: ${message}`,
    };
  }
}

/**
 * TanStack Start file route handler.
 */
export const Route = createFileRoute("/api/keywords/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();

        const result = await handleGenerateKeywords(body as GenerateKeywordsRequest);

        const status = result.success ? 200 : result.error?.includes("required") ? 400 : 500;

        return new Response(JSON.stringify(result), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

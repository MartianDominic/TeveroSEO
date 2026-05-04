import { z } from "zod";

/**
 * AnalysisConstraints Type System
 *
 * Structured constraints extracted from client conversations that drive
 * geographic filtering, funnel classification, relevance scoring, and cascade selection.
 *
 * This is the core data structure for the keyword intelligence system.
 */

// ============================================================================
// 1. BusinessContext
// ============================================================================

export const BusinessContextSchema = z.object({
  type: z.enum(["ecommerce", "service", "saas", "local", "b2b_services"]),
  coreOffering: z.string(),
  problemsSolved: z.array(z.string()),
  productCategories: z.array(z.string()),
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;

// ============================================================================
// 2. GeoConstraints
// ============================================================================

export const GeoConstraintsSchema = z.object({
  scope: z.enum(["hyperlocal", "city", "regional", "national"]),
  includeCities: z.array(z.string()),
  excludeCities: z.array(z.string()),
  nearMeAllowed: z.boolean(),
  genericAllowed: z.boolean(),
});

export type GeoConstraints = z.infer<typeof GeoConstraintsSchema>;

// ============================================================================
// 3. AudienceConstraints
// ============================================================================

export const AudienceConstraintsSchema = z.object({
  b2bOnly: z.boolean(),
  b2cAllowed: z.boolean(),
  industryFocus: z.array(z.string()),
});

export type AudienceConstraints = z.infer<typeof AudienceConstraintsSchema>;

// ============================================================================
// 4. FunnelConfig
// ============================================================================

export const FunnelConfigSchema = z.object({
  primary: z.enum(["bofu", "mofu", "tofu"]),
  fallbackOrder: z.array(z.enum(["bofu", "mofu", "tofu"])),
  targetCount: z.number().int().positive(),
  minPerStage: z.number().int().positive().optional(),
});

export type FunnelConfig = z.infer<typeof FunnelConfigSchema>;

// ============================================================================
// 5. Priority
// ============================================================================

export const PrioritySchema = z.object({
  category: z.string(),
  weightMultiplier: z.number().min(1.0).max(2.0),
  reason: z.string(),
});

export type Priority = z.infer<typeof PrioritySchema>;

// ============================================================================
// 6. NegativeFilters
// ============================================================================

export const NegativeFiltersSchema = z.object({
  excludeTerms: z.array(z.string()),
  excludeBrands: z.array(z.string()),
  excludeIntents: z.array(z.string()),
});

export type NegativeFilters = z.infer<typeof NegativeFiltersSchema>;

// ============================================================================
// 7. SpecialModes
// ============================================================================

export const SpecialModesSchema = z.object({
  pSEODetection: z.boolean(),
  sideKeywordDiscovery: z.boolean(),
  competitorGaps: z.boolean(),
});

export type SpecialModes = z.infer<typeof SpecialModesSchema>;

// ============================================================================
// ConfidenceScores
// ============================================================================

export const ConfidenceScoresSchema = z.object({
  overall: z.number().min(0).max(1),
  business: z.number().min(0).max(1),
  geo: z.number().min(0).max(1),
  audience: z.number().min(0).max(1),
  funnel: z.number().min(0).max(1),
  priorities: z.number().min(0).max(1),
  negatives: z.number().min(0).max(1),
  specialModes: z.number().min(0).max(1),
});

export type ConfidenceScores = z.infer<typeof ConfidenceScoresSchema>;

// ============================================================================
// AnalysisConstraints (aggregates all 7 categories)
// ============================================================================

export const AnalysisConstraintsSchema = z.object({
  business: BusinessContextSchema,
  geo: GeoConstraintsSchema,
  audience: AudienceConstraintsSchema,
  funnel: FunnelConfigSchema,
  priorities: z.array(PrioritySchema),
  negatives: NegativeFiltersSchema,
  specialModes: SpecialModesSchema,
});

export type AnalysisConstraints = z.infer<typeof AnalysisConstraintsSchema>;

// ============================================================================
// ExtractionResult (wrapper for extraction output)
// ============================================================================

export const ExtractionResultSchema = z.object({
  success: z.boolean(),
  constraints: AnalysisConstraintsSchema.nullable(),
  confidence: ConfidenceScoresSchema.nullable(),
  clarificationNeeded: z.array(z.string()),
  error: z.string().nullable(),
  rawResponse: z.string().optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ============================================================================
// Validation function (type guard)
// ============================================================================

/**
 * Type guard to check if an unknown object is a valid AnalysisConstraints.
 *
 * @param obj - Object to validate
 * @returns True if object matches AnalysisConstraints schema
 */
export function isValidAnalysisConstraints(obj: unknown): obj is AnalysisConstraints {
  const result = AnalysisConstraintsSchema.safeParse(obj);
  return result.success;
}

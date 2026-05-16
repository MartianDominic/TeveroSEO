/**
 * A/B Testing Service
 * Phase 102-05: A/B testing UI and version diff
 *
 * Implements deterministic variant assignment per D-03 (CONTEXT.md)
 * and statistical significance calculation using z-test for proportions.
 */

import { createHash } from "crypto";

import type { BlockVariant, TipTapContent, BlockVariantStatus } from "./types";

// =====================================
// Types
// =====================================

/**
 * Result of A/B test significance calculation.
 */
export interface ABTestResult {
  variantId: string;
  variantName: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  confidenceLevel: number;
  isSignificant: boolean;
  recommendation: "winner" | "loser" | "needs_more_data";
}

/**
 * Variant creation request.
 */
export interface CreateVariantRequest {
  parentBlockId: string;
  variantName: string;
  content: TipTapContent;
  weight?: number;
}

/**
 * Variant weights update request.
 */
export interface UpdateWeightsRequest {
  blockId: string;
  weights: Record<string, number>;
}

// =====================================
// Constants
// =====================================

/**
 * Minimum impressions needed for statistical significance calculation.
 */
const MIN_IMPRESSIONS_FOR_SIGNIFICANCE = 100;

/**
 * Z-score threshold for 95% confidence (one-tailed).
 */
const Z_SCORE_95_CONFIDENCE = 1.645;

// =====================================
// Deterministic Variant Assignment (D-03)
// =====================================

/**
 * Get the variant that should be shown to a specific prospect for a specific block.
 *
 * Uses deterministic hash assignment: sha256(prospectId:blockId) mod 100
 * This ensures the same prospect always sees the same variant across visits.
 *
 * @param prospectId - The prospect identifier
 * @param blockId - The block identifier
 * @param variants - Array of active variants for the block
 * @returns The variant to display
 * @throws Error if variants array is empty
 */
export function getVariantForProspect(
  prospectId: string,
  blockId: string,
  variants: BlockVariant[]
): BlockVariant {
  if (variants.length === 0) {
    throw new Error("At least one variant is required");
  }

  if (variants.length === 1) {
    return variants[0];
  }

  // Normalize weights to ensure they sum to 100
  const normalizedVariants = normalizeWeights(variants);

  // Create deterministic hash from prospectId + blockId
  const hash = createHash("sha256")
    .update(`${prospectId}:${blockId}`)
    .digest();

  // Convert first 4 bytes to unsigned 32-bit integer
  const hashNum = hash.readUInt32BE(0);

  // Get bucket 0-99
  const bucket = hashNum % 100;

  // Assign to variant based on cumulative weights
  let cumulative = 0;
  for (const variant of normalizedVariants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant;
    }
  }

  // Fallback to last variant (shouldn't happen with normalized weights)
  return normalizedVariants[normalizedVariants.length - 1];
}

// =====================================
// Statistical Significance
// =====================================

/**
 * Calculate statistical significance for A/B test variants.
 *
 * Uses z-test for two proportions to determine if the difference
 * in conversion rates is statistically significant.
 *
 * @param variants - Array of variants with impression/conversion data
 * @returns Array of ABTestResult with significance analysis
 */
export function calculateSignificance(variants: BlockVariant[]): ABTestResult[] {
  if (variants.length === 0) {
    return [];
  }

  // Calculate conversion rates for all variants
  const variantStats = variants.map((v) => ({
    variant: v,
    impressions: v.impressions,
    conversions: v.conversions,
    conversionRate: v.impressions > 0 ? v.conversions / v.impressions : 0,
  }));

  // Find control (first variant) for comparison
  const control = variantStats[0];

  return variantStats.map((stats) => {
    const { variant, impressions, conversions, conversionRate } = stats;

    // Check if we have enough data
    if (impressions < MIN_IMPRESSIONS_FOR_SIGNIFICANCE) {
      return {
        variantId: variant.id,
        variantName: variant.variantName,
        impressions,
        conversions,
        conversionRate,
        confidenceLevel: 0,
        isSignificant: false,
        recommendation: "needs_more_data" as const,
      };
    }

    // For control, compare against best performing test variant
    // For test variants, compare against control
    let comparisonStats = control;
    if (stats === control && variantStats.length > 1) {
      // Find best test variant for comparison
      comparisonStats = variantStats
        .slice(1)
        .reduce((best, current) =>
          current.conversionRate > best.conversionRate ? current : best
        );
    }

    // Calculate z-score for difference in proportions
    const { zScore, confidenceLevel } = calculateZTest(stats, comparisonStats);

    // Determine recommendation
    const isSignificant = confidenceLevel >= 95;
    let recommendation: "winner" | "loser" | "needs_more_data";

    if (!isSignificant) {
      recommendation = "needs_more_data";
    } else if (conversionRate > comparisonStats.conversionRate) {
      recommendation = "winner";
    } else {
      recommendation = "loser";
    }

    return {
      variantId: variant.id,
      variantName: variant.variantName,
      impressions,
      conversions,
      conversionRate,
      confidenceLevel,
      isSignificant,
      recommendation,
    };
  });
}

/**
 * Calculate z-test for difference in proportions.
 */
function calculateZTest(
  variant: { impressions: number; conversionRate: number },
  control: { impressions: number; conversionRate: number }
): { zScore: number; confidenceLevel: number } {
  const p1 = variant.conversionRate;
  const p2 = control.conversionRate;
  const n1 = variant.impressions;
  const n2 = control.impressions;

  // Handle edge cases
  if (n1 === 0 || n2 === 0) {
    return { zScore: 0, confidenceLevel: 0 };
  }

  // Pooled proportion
  const pooledP =
    (variant.conversionRate * n1 + control.conversionRate * n2) / (n1 + n2);

  // Standard error
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  // Handle zero standard error (both proportions are 0 or 1)
  if (se === 0) {
    return { zScore: 0, confidenceLevel: p1 === p2 ? 0 : 100 };
  }

  // Z-score
  const zScore = Math.abs((p1 - p2) / se);

  // Convert z-score to confidence level (approximate)
  // Using standard normal distribution CDF approximation
  const confidenceLevel = zScoreToConfidence(zScore);

  return { zScore, confidenceLevel };
}

/**
 * Convert z-score to confidence level percentage.
 * Uses approximation of standard normal CDF.
 */
function zScoreToConfidence(z: number): number {
  // Common z-score to confidence mappings
  if (z >= 2.576) return 99;
  if (z >= 2.326) return 98;
  if (z >= 1.96) return 95;
  if (z >= 1.645) return 90;
  if (z >= 1.282) return 80;
  if (z >= 0.842) return 60;
  if (z >= 0.524) return 40;
  if (z >= 0.253) return 20;

  // Linear interpolation for lower values
  return Math.round(z * 40);
}

// =====================================
// Weight Management
// =====================================

/**
 * Normalize variant weights to sum to 100.
 *
 * @param variants - Array of variants with weights
 * @returns New array with normalized weights
 */
export function normalizeWeights(variants: BlockVariant[]): BlockVariant[] {
  if (variants.length === 0) {
    return [];
  }

  if (variants.length === 1) {
    return [{ ...variants[0], weight: 100 }];
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  if (totalWeight === 0) {
    // Equal distribution if all weights are 0
    const equalWeight = Math.floor(100 / variants.length);
    return variants.map((v, i) => ({
      ...v,
      weight: i === variants.length - 1 ? 100 - equalWeight * (variants.length - 1) : equalWeight,
    }));
  }

  if (totalWeight === 100) {
    return variants;
  }

  // Scale proportionally
  const scale = 100 / totalWeight;
  let remaining = 100;

  return variants.map((v, i) => {
    if (i === variants.length - 1) {
      // Give remaining weight to last variant to ensure sum = 100
      return { ...v, weight: remaining };
    }
    const scaledWeight = Math.round(v.weight * scale);
    remaining -= scaledWeight;
    return { ...v, weight: scaledWeight };
  });
}

/**
 * Validate that weights are within allowed range.
 *
 * @param weights - Map of variant ID to weight
 * @returns true if all weights are valid (0-100)
 */
export function validateWeights(weights: Record<string, number>): boolean {
  const values = Object.values(weights);
  return values.every((w) => w >= 0 && w <= 100);
}

// =====================================
// Variant Status Management
// =====================================

/**
 * Determine if a variant can be declared as winner.
 * Requires statistical significance and being the best performer.
 *
 * @param result - The ABTestResult for the variant
 * @returns true if variant meets winner criteria
 */
export function canDeclareWinner(result: ABTestResult): boolean {
  return result.isSignificant && result.recommendation === "winner";
}

/**
 * Get display label for variant status.
 */
export function getStatusLabel(status: BlockVariantStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "winner":
      return "Winner";
    case "loser":
      return "Stopped";
  }
}

// =====================================
// Exports
// =====================================

export type { BlockVariant, BlockVariantStatus };

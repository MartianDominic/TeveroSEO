/**
 * A/B Testing Service
 * Phase 102-05: A/B testing UI and version diff
 *
 * Implements deterministic variant assignment per D-03 (CONTEXT.md)
 * and statistical significance calculation using z-test for proportions.
 */

import { createHash } from "crypto";

import { logger } from "@/lib/logger";
import type { BlockVariant, TipTapContent, BlockVariantStatus } from "./types";
import { VARIANT_STATUS } from "./types";

// =====================================
// Service Logger
// =====================================

/**
 * Create a child logger scoped to the A/B testing service.
 * Use this for all logging within this module.
 */
function createServiceLogger(operation: string, meta?: Record<string, unknown>) {
  return logger.child({
    service: "ab-testing",
    operation,
    ...meta,
  });
}

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

/**
 * Experiment status for lifecycle management.
 */
export type ExperimentStatus = "draft" | "running" | "paused" | "completed";

/**
 * Experiment definition for A/B testing lifecycle.
 */
export interface Experiment {
  id: string;
  blockId: string;
  name: string;
  status: ExperimentStatus;
  variants: BlockVariant[];
  /** ISO timestamp when experiment was created */
  createdAt: string;
  /** ISO timestamp when experiment started running (null if never started) */
  startedAt: string | null;
  /** ISO timestamp when experiment was paused (null if not paused) */
  pausedAt: string | null;
  /** ISO timestamp when experiment was completed (null if not completed) */
  completedAt: string | null;
  /** ID of the winning variant (null if no winner declared) */
  winnerId: string | null;
}

/**
 * Result of experiment lifecycle operations.
 */
export interface ExperimentLifecycleResult {
  success: boolean;
  experiment?: Experiment;
  error?: string;
}

/**
 * Result of winner eligibility check.
 */
export interface WinnerEligibilityResult {
  canDeclare: boolean;
  reasons: string[];
}

// =====================================
// Constants
// =====================================

/**
 * Minimum impressions needed for statistical significance calculation.
 * Set to 250 to ensure adequate sample size for reliable results.
 */
const MIN_IMPRESSIONS_FOR_SIGNIFICANCE = 250;

/**
 * Minimum experiment duration in hours before significance can be evaluated.
 * Prevents early peeking bias (checking results too early can lead to false positives).
 */
const MIN_EXPERIMENT_DURATION_HOURS = 24;

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
 * @returns The variant to display, or null if no variants available
 */
export function getVariantForProspect(
  prospectId: string,
  blockId: string,
  variants: BlockVariant[]
): BlockVariant | null {
  const log = createServiceLogger("getVariantForProspect", { blockId, prospectId });

  if (variants.length === 0) {
    log.warn("No variants available for block - ensure at least one variant exists", {
      blockId,
    });
    return null;
  }

  if (variants.length === 1) {
    log.debug("Single variant, returning directly", {
      variantId: variants[0].id,
    });
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
      log.debug("Variant assigned via deterministic hash", {
        variantId: variant.id,
        variantName: variant.variantName,
        bucket,
        variantCount: variants.length,
      });
      return variant;
    }
  }

  // Fallback to last variant (shouldn't happen with normalized weights)
  const fallbackVariant = normalizedVariants[normalizedVariants.length - 1];
  log.warn("Fallback to last variant - weights may not sum correctly", {
    variantId: fallbackVariant.id,
    bucket,
  });
  return fallbackVariant;
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
    const { confidenceLevel } = calculateZTest(stats, comparisonStats);

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
 * Stats required for z-test calculation.
 * All fields are required - conversions must be explicitly provided.
 */
interface VariantStats {
  impressions: number;
  conversions: number;
  conversionRate: number;
}

/**
 * Calculate z-test for difference in two proportions.
 *
 * Uses the correct formula for a two-proportion z-test:
 * z = (p1 - p2) / sqrt(p * (1-p) * (1/n1 + 1/n2))
 * where p is the pooled proportion = (x1 + x2) / (n1 + n2)
 *
 * @param variant - Variant stats including conversions and impressions
 * @param control - Control stats including conversions and impressions
 * @returns z-score and confidence level
 */
function calculateZTest(
  variant: VariantStats,
  control: VariantStats
): { zScore: number; confidenceLevel: number; pValue: number } {
  const n1 = variant.impressions;
  const n2 = control.impressions;

  // Handle edge cases - need sufficient data
  if (n1 === 0 || n2 === 0) {
    return { zScore: 0, confidenceLevel: 0, pValue: 1 };
  }

  // Use conversions directly - required by VariantStats interface
  const x1 = variant.conversions;
  const x2 = control.conversions;

  const p1 = x1 / n1;
  const p2 = x2 / n2;

  // Pooled proportion (correct formula using actual conversions)
  const pooledP = (x1 + x2) / (n1 + n2);

  // Standard error
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  // Handle zero standard error (both proportions are 0 or 1)
  if (se === 0) {
    return { zScore: 0, confidenceLevel: p1 === p2 ? 0 : 100, pValue: p1 === p2 ? 1 : 0 };
  }

  // Z-score (absolute value for two-tailed test)
  const zScore = Math.abs((p1 - p2) / se);

  // Two-tailed p-value using error function approximation
  const pValue = 2 * (1 - normalCDF(zScore));

  // Convert to confidence level (100 - p-value as percentage)
  const confidenceLevel = Math.min(99.9, (1 - pValue) * 100);

  return { zScore, confidenceLevel, pValue };
}

/**
 * Standard normal cumulative distribution function (CDF).
 * Uses the approximation: CDF(z) = 0.5 * (1 + erf(z / sqrt(2)))
 */
function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * Error function approximation (Abramowitz and Stegun).
 * Maximum error: 1.5 * 10^-7
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
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
 * Validation result for weights.
 */
export interface WeightValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate that weights meet all requirements:
 * - Each weight is between 0 and 100
 * - No negative weights
 * - Weights sum to exactly 100%
 * - At least one variant has weight > 0
 *
 * @param weights - Map of variant ID to weight
 * @returns Validation result with errors if invalid
 */
export function validateWeights(weights: Record<string, number>): WeightValidationResult {
  const values = Object.values(weights);
  const errors: string[] = [];

  if (values.length === 0) {
    errors.push("At least one variant is required");
    return { isValid: false, errors };
  }

  // Check for negative weights
  const hasNegative = values.some((w) => w < 0);
  if (hasNegative) {
    errors.push("Weights cannot be negative");
  }

  // Check for weights over 100
  const hasOverflow = values.some((w) => w > 100);
  if (hasOverflow) {
    errors.push("Individual weights cannot exceed 100%");
  }

  // Check sum equals 100
  const sum = values.reduce((acc, w) => acc + w, 0);
  if (Math.abs(sum - 100) > 0.01) {
    errors.push(`Weights must sum to 100% (current sum: ${sum.toFixed(1)}%)`);
  }

  // Check at least one variant has traffic
  const hasTraffic = values.some((w) => w > 0);
  if (!hasTraffic) {
    errors.push("At least one variant must have traffic allocation > 0");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Legacy validation function for backward compatibility.
 * @deprecated Use validateWeights which returns detailed errors
 */
export function areWeightsValid(weights: Record<string, number>): boolean {
  return validateWeights(weights).isValid;
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
// Experiment Lifecycle Management
// =====================================

/**
 * Check if an experiment has met the minimum duration requirement.
 * Prevents early peeking bias by ensuring tests run long enough.
 *
 * @param experiment - The experiment to check
 * @returns true if minimum duration has been met
 */
export function hasMetMinimumDuration(experiment: Experiment): boolean {
  if (!experiment.startedAt) {
    return false;
  }

  const startTime = new Date(experiment.startedAt).getTime();
  const now = Date.now();
  const durationMs = now - startTime;
  const minDurationMs = MIN_EXPERIMENT_DURATION_HOURS * 60 * 60 * 1000;

  return durationMs >= minDurationMs;
}

/**
 * Get the remaining time until minimum duration is met.
 *
 * @param experiment - The experiment to check
 * @returns Remaining time in milliseconds, or 0 if already met
 */
export function getRemainingDuration(experiment: Experiment): number {
  if (!experiment.startedAt) {
    return MIN_EXPERIMENT_DURATION_HOURS * 60 * 60 * 1000;
  }

  const startTime = new Date(experiment.startedAt).getTime();
  const now = Date.now();
  const durationMs = now - startTime;
  const minDurationMs = MIN_EXPERIMENT_DURATION_HOURS * 60 * 60 * 1000;

  return Math.max(0, minDurationMs - durationMs);
}

/**
 * Check if an experiment is eligible to declare a winner.
 * Enforces both minimum duration and minimum impressions.
 *
 * @param experiment - The experiment to check
 * @returns Eligibility result with reasons
 */
export function checkWinnerEligibility(experiment: Experiment): WinnerEligibilityResult {
  const reasons: string[] = [];

  // Check experiment status
  if (experiment.status !== "running") {
    reasons.push(`Experiment must be running (current: ${experiment.status})`);
  }

  // Check minimum duration (early peeking protection)
  if (!hasMetMinimumDuration(experiment)) {
    const remainingMs = getRemainingDuration(experiment);
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    reasons.push(`Minimum duration not met (${remainingHours}h remaining of ${MIN_EXPERIMENT_DURATION_HOURS}h)`);
  }

  // Check minimum impressions for all variants
  const lowImpressionVariants = experiment.variants.filter(
    (v) => v.impressions < MIN_IMPRESSIONS_FOR_SIGNIFICANCE
  );
  if (lowImpressionVariants.length > 0) {
    const names = lowImpressionVariants.map((v) => v.variantName).join(", ");
    reasons.push(
      `Insufficient impressions for: ${names} (need ${MIN_IMPRESSIONS_FOR_SIGNIFICANCE}+ each)`
    );
  }

  return {
    canDeclare: reasons.length === 0,
    reasons,
  };
}

/**
 * Calculate significance with early peeking protection.
 * Returns needs_more_data if minimum duration not met.
 *
 * @param experiment - The experiment containing variants
 * @returns Array of ABTestResult with significance analysis
 */
export function calculateSignificanceWithProtection(
  experiment: Experiment
): ABTestResult[] {
  // If minimum duration not met, return needs_more_data for all variants
  if (!hasMetMinimumDuration(experiment)) {
    return experiment.variants.map((v) => ({
      variantId: v.id,
      variantName: v.variantName,
      impressions: v.impressions,
      conversions: v.conversions,
      conversionRate: v.impressions > 0 ? v.conversions / v.impressions : 0,
      confidenceLevel: 0,
      isSignificant: false,
      recommendation: "needs_more_data" as const,
    }));
  }

  // Duration met, proceed with normal significance calculation
  return calculateSignificance(experiment.variants);
}

/**
 * Start an experiment (transition from draft to running).
 *
 * @param experiment - The experiment to start
 * @returns Updated experiment or error
 */
export function startExperiment(experiment: Experiment): ExperimentLifecycleResult {
  const log = createServiceLogger("startExperiment", {
    experimentId: experiment.id,
    blockId: experiment.blockId,
  });

  log.info("Starting experiment", {
    currentStatus: experiment.status,
    variantCount: experiment.variants.length,
  });

  if (experiment.status !== "draft" && experiment.status !== "paused") {
    log.warn("Cannot start experiment - invalid status", {
      currentStatus: experiment.status,
      requiredStatus: ["draft", "paused"],
    });
    return {
      success: false,
      error: `Cannot start experiment: current status is "${experiment.status}" (must be "draft" or "paused")`,
    };
  }

  if (experiment.variants.length < 2) {
    log.warn("Cannot start experiment - insufficient variants", {
      variantCount: experiment.variants.length,
      required: 2,
    });
    return {
      success: false,
      error: "Cannot start experiment: at least 2 variants required",
    };
  }

  // Validate weights
  const weights: Record<string, number> = {};
  for (const v of experiment.variants) {
    weights[v.id] = v.weight;
  }
  const weightValidation = validateWeights(weights);
  if (!weightValidation.isValid) {
    log.warn("Cannot start experiment - invalid weights", {
      errors: weightValidation.errors,
    });
    return {
      success: false,
      error: `Invalid weights: ${weightValidation.errors.join(", ")}`,
    };
  }

  const now = new Date().toISOString();
  const updatedExperiment: Experiment = {
    ...experiment,
    status: "running",
    startedAt: experiment.startedAt ?? now, // Keep original start time if resuming
    pausedAt: null,
    variants: experiment.variants.map((v) => ({
      ...v,
      status: VARIANT_STATUS.ACTIVE,
    })),
  };

  log.info("Experiment started successfully", {
    experimentId: updatedExperiment.id,
    variantCount: updatedExperiment.variants.length,
    variantIds: updatedExperiment.variants.map((v) => v.id),
  });

  return {
    success: true,
    experiment: updatedExperiment,
  };
}

/**
 * Pause a running experiment.
 *
 * @param experiment - The experiment to pause
 * @returns Updated experiment or error
 */
export function pauseExperiment(experiment: Experiment): ExperimentLifecycleResult {
  const log = createServiceLogger("pauseExperiment", {
    experimentId: experiment.id,
    blockId: experiment.blockId,
  });

  log.info("Pausing experiment", { currentStatus: experiment.status });

  if (experiment.status !== "running") {
    log.warn("Cannot pause experiment - not running", {
      currentStatus: experiment.status,
    });
    return {
      success: false,
      error: `Cannot pause experiment: current status is "${experiment.status}" (must be "running")`,
    };
  }

  const now = new Date().toISOString();
  const updatedExperiment: Experiment = {
    ...experiment,
    status: "paused",
    pausedAt: now,
    variants: experiment.variants.map((v) => ({
      ...v,
      status: VARIANT_STATUS.PAUSED,
    })),
  };

  log.info("Experiment paused successfully", {
    experimentId: updatedExperiment.id,
  });

  return {
    success: true,
    experiment: updatedExperiment,
  };
}

/**
 * Stop an experiment and optionally declare a winner.
 *
 * @param experiment - The experiment to stop
 * @param winnerId - Optional ID of the winning variant
 * @returns Updated experiment or error
 */
export function stopExperiment(
  experiment: Experiment,
  winnerId?: string
): ExperimentLifecycleResult {
  const log = createServiceLogger("stopExperiment", {
    experimentId: experiment.id,
    blockId: experiment.blockId,
  });

  log.info("Stopping experiment", {
    currentStatus: experiment.status,
    winnerId: winnerId ?? null,
  });

  if (experiment.status === "completed") {
    log.warn("Cannot stop experiment - already completed");
    return {
      success: false,
      error: "Experiment is already completed",
    };
  }

  // If a winner is specified, validate it exists
  if (winnerId) {
    const winnerVariant = experiment.variants.find((v) => v.id === winnerId);
    if (!winnerVariant) {
      log.error("Winner variant not found", { winnerId });
      return {
        success: false,
        error: `Winner variant "${winnerId}" not found in experiment`,
      };
    }
  }

  const now = new Date().toISOString();
  const updatedExperiment: Experiment = {
    ...experiment,
    status: "completed",
    completedAt: now,
    winnerId: winnerId ?? null,
    variants: experiment.variants.map((v) => ({
      ...v,
      status: winnerId
        ? v.id === winnerId
          ? VARIANT_STATUS.WINNER
          : VARIANT_STATUS.LOSER
        : VARIANT_STATUS.PAUSED,
    })),
  };

  log.info("Experiment stopped successfully", {
    experimentId: updatedExperiment.id,
    winnerId: updatedExperiment.winnerId,
    hasWinner: !!winnerId,
  });

  return {
    success: true,
    experiment: updatedExperiment,
  };
}

/**
 * Roll out the winning variant to 100% traffic.
 * This ends the experiment and makes the winner the only active variant.
 *
 * @param experiment - The experiment to roll out
 * @param variantId - The ID of the variant to roll out
 * @returns Updated experiment or error
 */
export function rolloutWinner(
  experiment: Experiment,
  variantId: string
): ExperimentLifecycleResult {
  const log = createServiceLogger("rolloutWinner", {
    experimentId: experiment.id,
    blockId: experiment.blockId,
    variantId,
  });

  log.info("Rolling out winner variant to 100% traffic", {
    variantId,
    currentStatus: experiment.status,
  });

  const variant = experiment.variants.find((v) => v.id === variantId);
  if (!variant) {
    log.error("Variant not found", { variantId });
    return {
      success: false,
      error: `Variant "${variantId}" not found in experiment`,
    };
  }

  // Check winner eligibility
  const eligibility = checkWinnerEligibility(experiment);
  if (!eligibility.canDeclare) {
    log.warn("Cannot roll out winner - eligibility check failed", {
      reasons: eligibility.reasons,
    });
    return {
      success: false,
      error: `Cannot roll out winner: ${eligibility.reasons.join("; ")}`,
    };
  }

  // Calculate significance to verify this is actually a winner
  const results = calculateSignificance(experiment.variants);
  const variantResult = results.find((r) => r.variantId === variantId);

  if (!variantResult || variantResult.recommendation !== "winner") {
    log.warn("Cannot roll out - variant is not a statistically significant winner", {
      variantId,
      recommendation: variantResult?.recommendation,
      confidenceLevel: variantResult?.confidenceLevel,
    });
    return {
      success: false,
      error: `Variant "${variant.variantName}" is not a statistically significant winner`,
    };
  }

  const now = new Date().toISOString();
  const updatedExperiment: Experiment = {
    ...experiment,
    status: "completed",
    completedAt: now,
    winnerId: variantId,
    variants: experiment.variants.map((v) => ({
      ...v,
      weight: v.id === variantId ? 100 : 0,
      status:
        v.id === variantId
          ? VARIANT_STATUS.WINNER
          : VARIANT_STATUS.LOSER,
    })),
  };

  log.info("Winner rolled out successfully", {
    experimentId: updatedExperiment.id,
    winnerId: variantId,
    winnerName: variant.variantName,
    confidenceLevel: variantResult.confidenceLevel,
    conversionRate: variantResult.conversionRate,
  });

  return {
    success: true,
    experiment: updatedExperiment,
  };
}

/**
 * Automatically detect and return the winning variant if one exists.
 *
 * @param experiment - The experiment to check
 * @returns The winning variant or null if no clear winner
 */
export function detectWinner(experiment: Experiment): BlockVariant | null {
  // Check eligibility first
  const eligibility = checkWinnerEligibility(experiment);
  if (!eligibility.canDeclare) {
    return null;
  }

  // Calculate significance
  const results = calculateSignificance(experiment.variants);

  // Find a significant winner
  const winnerResult = results.find(
    (r) => r.isSignificant && r.recommendation === "winner"
  );

  if (!winnerResult) {
    return null;
  }

  return experiment.variants.find((v) => v.id === winnerResult.variantId) ?? null;
}

/**
 * Get the display label for experiment status.
 */
export function getExperimentStatusLabel(status: ExperimentStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
  }
}

/**
 * Create a new experiment in draft status.
 *
 * @param blockId - The block ID this experiment is for
 * @param name - The experiment name
 * @param variants - Initial variants (at least 2 required)
 * @returns New experiment or error
 */
export function createExperiment(
  blockId: string,
  name: string,
  variants: BlockVariant[]
): ExperimentLifecycleResult {
  const log = createServiceLogger("createExperiment", { blockId });

  log.info("Creating new experiment", {
    name,
    variantCount: variants.length,
  });

  if (variants.length < 2) {
    log.warn("Cannot create experiment - insufficient variants", {
      variantCount: variants.length,
      required: 2,
    });
    return {
      success: false,
      error: "At least 2 variants required to create an experiment",
    };
  }

  const now = new Date().toISOString();
  const experiment: Experiment = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    blockId,
    name,
    status: "draft",
    variants: variants.map((v) => ({
      ...v,
      status: VARIANT_STATUS.PAUSED,
    })),
    createdAt: now,
    startedAt: null,
    pausedAt: null,
    completedAt: null,
    winnerId: null,
  };

  log.info("Experiment created successfully", {
    experimentId: experiment.id,
    name: experiment.name,
    variantCount: experiment.variants.length,
    variantIds: experiment.variants.map((v) => v.id),
  });

  return {
    success: true,
    experiment,
  };
}

// =====================================
// Exports
// =====================================

export type { BlockVariant, BlockVariantStatus };

export {
  MIN_IMPRESSIONS_FOR_SIGNIFICANCE,
  MIN_EXPERIMENT_DURATION_HOURS,
};

/**
 * Shared utilities for SEO Chat tool result cards
 *
 * Consolidates duplicate functions from:
 * - DomainHealthCard.tsx (formatNumber)
 * - KeywordAnalysisCard.tsx (formatVolume, getFeasibilityColor, getFunnelColor)
 * - FeasibilityCard.tsx (getVerdictColor)
 * - TopicalMapView.tsx (formatVolume, getFunnelColor, getFunnelBorderColor)
 * - ProposalSlideOver.tsx (getFeasibilityColor)
 */

/**
 * Format large numbers with K/M suffixes for compact display.
 * Used for traffic, rankings, and keyword volumes.
 *
 * @example formatVolume(1500) => "1.5K"
 * @example formatVolume(2500000) => "2.5M"
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

/**
 * Alias for formatVolume - used in DomainHealthCard for consistency.
 */
export const formatNumber = formatVolume;

/**
 * Format number with locale-specific thousands separators.
 * Use this when exact numbers matter (not compact display).
 *
 * @example formatLocaleNumber(1500) => "1,500"
 */
export function formatLocaleNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format number using compact notation with Intl.NumberFormat.
 * Alternative to formatVolume with more locale-aware formatting.
 *
 * @example formatCompactNumber(1500) => "1.5K"
 */
export function formatCompactNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

/**
 * Feasibility level type for keyword ranking difficulty assessment.
 */
export type FeasibilityLevel = 'feasible' | 'challenging' | 'difficult' | 'unlikely';

/**
 * Type guard to validate a string is a valid FeasibilityLevel.
 * Use this to validate external data before passing to color functions.
 *
 * @example
 * if (isFeasibilityLevel(externalData.level)) {
 *   const color = getFeasibilityColor(externalData.level);
 * }
 */
export function isFeasibilityLevel(value: unknown): value is FeasibilityLevel {
  return (
    typeof value === 'string' &&
    ['feasible', 'challenging', 'difficult', 'unlikely'].includes(value)
  );
}

/**
 * Get border and text color classes for feasibility level badges.
 * Used in KeywordAnalysisCard, FeasibilityCard, ProposalSlideOver.
 *
 * Per design system:
 * - feasible: green
 * - challenging: amber
 * - difficult: orange
 * - unlikely: red
 */
export function getFeasibilityColor(feasibility: FeasibilityLevel): string {
  switch (feasibility) {
    case 'feasible':
      return 'border-green-500 text-green-600';
    case 'challenging':
      return 'border-amber-500 text-amber-600';
    case 'difficult':
      return 'border-orange-500 text-orange-600';
    case 'unlikely':
      return 'border-red-500 text-red-600';
  }
}

/**
 * Alias for getFeasibilityColor - used in FeasibilityCard for verdict display.
 * Same color mapping since verdicts use same feasibility levels.
 */
export const getVerdictColor = getFeasibilityColor;

/**
 * Get background color classes for feasibility level badges.
 * Use when a background fill is needed in addition to border/text.
 */
export function getFeasibilityBgColor(feasibility: FeasibilityLevel): string {
  switch (feasibility) {
    case 'feasible':
      return 'bg-green-50 dark:bg-green-950';
    case 'challenging':
      return 'bg-amber-50 dark:bg-amber-950';
    case 'difficult':
      return 'bg-orange-50 dark:bg-orange-950';
    case 'unlikely':
      return 'bg-red-50 dark:bg-red-950';
  }
}

/**
 * Funnel stage type for marketing funnel classification.
 */
export type FunnelStage = 'bofu' | 'mofu' | 'tofu';

/**
 * Type guard to validate a string is a valid FunnelStage.
 * Use this to validate external data before passing to color functions.
 *
 * @example
 * if (isFunnelStage(externalData.funnel)) {
 *   const color = getFunnelColor(externalData.funnel);
 * }
 */
export function isFunnelStage(value: unknown): value is FunnelStage {
  return (
    typeof value === 'string' &&
    ['bofu', 'mofu', 'tofu'].includes(value)
  );
}

/**
 * Get color classes for funnel stage badges.
 * Per D-04: BOFU=green, MOFU=amber, TOFU=blue.
 *
 * Used in KeywordAnalysisCard clusters preview.
 */
export function getFunnelColor(funnel: FunnelStage): string {
  switch (funnel) {
    case 'bofu':
      return 'border-green-500 text-green-600';
    case 'mofu':
      return 'border-amber-500 text-amber-600';
    case 'tofu':
      return 'border-blue-500 text-blue-600';
  }
}

/**
 * Get full funnel color classes with background.
 * Per D-04: BOFU=green, MOFU=amber, TOFU=blue.
 *
 * Used in TopicalMapView cluster nodes for richer styling.
 */
export function getFunnelColorWithBg(funnel: FunnelStage): string {
  switch (funnel) {
    case 'bofu':
      return 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30';
    case 'mofu':
      return 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30';
    case 'tofu':
      return 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30';
  }
}

/**
 * Get left border accent color for funnel stage.
 * Used in TopicalMapView card styling.
 */
export function getFunnelBorderColor(funnel: FunnelStage): string {
  switch (funnel) {
    case 'bofu':
      return 'border-l-4 border-l-green-500';
    case 'mofu':
      return 'border-l-4 border-l-amber-500';
    case 'tofu':
      return 'border-l-4 border-l-blue-500';
  }
}

// ---------------------------------------------------------------------------
// Health Level Utilities
// ---------------------------------------------------------------------------

/**
 * Health level type for domain health assessment.
 */
export type HealthLevel = 'strong' | 'moderate' | 'weak';

/**
 * Type guard to validate a string is a valid HealthLevel.
 */
export function isHealthLevel(value: unknown): value is HealthLevel {
  return (
    typeof value === 'string' &&
    ['strong', 'moderate', 'weak'].includes(value)
  );
}

/**
 * Determine health level from combined DA/DR score.
 * Used in DomainHealthCard to derive health badge.
 *
 * @param score - Average of DA and DR (0-100)
 * @returns Health level classification
 */
export function getHealthLevel(score: number): HealthLevel {
  if (score >= 40) return 'strong';
  if (score >= 20) return 'moderate';
  return 'weak';
}

/**
 * Get text color class for health level badge.
 * Per design system:
 * - strong: green
 * - moderate: amber
 * - weak: red
 */
export function getHealthColor(level: HealthLevel): string {
  switch (level) {
    case 'strong':
      return 'text-green-600';
    case 'moderate':
      return 'text-amber-600';
    case 'weak':
      return 'text-red-600';
  }
}

/**
 * Get human-readable label for health level.
 * Capitalizes the first letter.
 */
export function getHealthLabel(level: HealthLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/**
 * Heatmap Calculator for Document Builder
 * Phase 102-04: Analytics Pipeline and Heatmap Visualization
 *
 * Calculates engagement scores and heat levels for block visualization.
 * Per UI-SPEC: Color gradient for engagement scoring (0-100).
 */

// =============================================================================
// Types
// =============================================================================

export type HeatLevel = "cold" | "cool" | "warm" | "hot" | "very_hot";

export interface HeatmapData {
  blockId: string;
  score: number; // 0-100
  level: HeatLevel;
  color: string;
  views: number;
  avgDwellMs: number;
  label: string;
}

// =============================================================================
// Heat Level Thresholds (per UI-SPEC)
// =============================================================================

const HEAT_THRESHOLDS = {
  cold: { min: 0, max: 20 },
  cool: { min: 21, max: 40 },
  warm: { min: 41, max: 60 },
  hot: { min: 61, max: 80 },
  very_hot: { min: 81, max: 100 },
} as const;

// =============================================================================
// Heat Colors (per UI-SPEC)
// =============================================================================

const HEAT_COLORS: Record<HeatLevel, string> = {
  cold: "rgba(156, 163, 175, 0.15)", // gray-400
  cool: "rgba(251, 191, 36, 0.15)", // amber-400
  warm: "rgba(251, 146, 60, 0.20)", // orange-400
  hot: "rgba(239, 68, 68, 0.25)", // red-500
  very_hot: "rgba(220, 38, 38, 0.35)", // red-600
};

// =============================================================================
// Heat Labels (per Copywriting Contract)
// =============================================================================

const HEAT_LABELS: Record<HeatLevel, string> = {
  cold: "Skipped by most viewers",
  cool: "Low engagement",
  warm: "Moderate engagement",
  hot: "High engagement",
  very_hot: "Very high engagement",
};

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate engagement score for a block.
 *
 * Scoring formula per architecture doc:
 * - 40% view rate (views / totalViews normalized to 0-100)
 * - 60% dwell time (dwell / maxDwell normalized to 0-100)
 *
 * @param views - Number of views for this block
 * @param dwellMs - Average dwell time in milliseconds
 * @param totalViews - Total views across all blocks
 * @param maxDwellMs - Maximum dwell time across all blocks (for normalization)
 * @returns Engagement score from 0-100
 */
export function calculateEngagementScore(
  views: number,
  dwellMs: number,
  totalViews: number,
  maxDwellMs: number = 30000 // Default max dwell 30 seconds
): number {
  // Avoid division by zero
  if (totalViews === 0) {
    return 0;
  }

  // Calculate view rate component (40%)
  const viewRate = views / totalViews;
  const normalizedViewRate = Math.min(viewRate * 100, 100);
  const viewComponent = normalizedViewRate * 0.4;

  // Calculate dwell component (60%)
  const normalizedDwell = maxDwellMs > 0 ? Math.min(dwellMs / maxDwellMs, 1) : 0;
  const dwellComponent = normalizedDwell * 100 * 0.6;

  // Combined score (0-100)
  const score = viewComponent + dwellComponent;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Get heat level from engagement score.
 *
 * Per UI-SPEC thresholds:
 * - 0-20: cold
 * - 21-40: cool
 * - 41-60: warm
 * - 61-80: hot
 * - 81-100: very_hot
 *
 * @param score - Engagement score (0-100)
 * @returns Heat level
 */
export function getHeatLevel(score: number): HeatLevel {
  if (score <= HEAT_THRESHOLDS.cold.max) {
    return "cold";
  }
  if (score <= HEAT_THRESHOLDS.cool.max) {
    return "cool";
  }
  if (score <= HEAT_THRESHOLDS.warm.max) {
    return "warm";
  }
  if (score <= HEAT_THRESHOLDS.hot.max) {
    return "hot";
  }
  return "very_hot";
}

/**
 * Get heat color for a heat level.
 *
 * Per UI-SPEC color table.
 *
 * @param level - Heat level
 * @returns RGBA color string
 */
export function getHeatColor(level: HeatLevel): string {
  return HEAT_COLORS[level];
}

/**
 * Get label for a heat level.
 *
 * Per Copywriting Contract.
 *
 * @param level - Heat level
 * @returns Human-readable label
 */
export function getHeatLabel(level: HeatLevel): string {
  return HEAT_LABELS[level];
}

// =============================================================================
// Full Heatmap Data Calculation
// =============================================================================

interface BlockData {
  blockId: string;
  views: number;
  avgDwellMs: number;
}

/**
 * Calculate heatmap data for multiple blocks.
 *
 * Normalizes scores across all blocks for fair comparison.
 *
 * @param blocks - Array of block data
 * @returns Array of heatmap data with scores and colors
 */
export function calculateHeatmapData(blocks: BlockData[]): HeatmapData[] {
  if (blocks.length === 0) {
    return [];
  }

  // Calculate totals for normalization
  const totalViews = blocks.reduce((sum, b) => sum + b.views, 0);
  const maxDwellMs = Math.max(...blocks.map((b) => b.avgDwellMs), 1);

  return blocks.map((block) => {
    const score = calculateEngagementScore(
      block.views,
      block.avgDwellMs,
      totalViews,
      maxDwellMs
    );
    const level = getHeatLevel(score);

    return {
      blockId: block.blockId,
      score,
      level,
      color: getHeatColor(level),
      views: block.views,
      avgDwellMs: block.avgDwellMs,
      label: getHeatLabel(level),
    };
  });
}

/**
 * Get CSS gradient for heatmap overlay.
 *
 * Creates a linear gradient from transparent to heat color.
 *
 * @param level - Heat level
 * @returns CSS linear-gradient string
 */
export function getHeatGradient(level: HeatLevel): string {
  const color = getHeatColor(level);
  return `linear-gradient(to bottom, transparent 0%, ${color} 50%, transparent 100%)`;
}

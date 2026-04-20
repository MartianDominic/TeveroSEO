/**
 * Opportunity type definitions for the web app.
 * Phase 25: Team & Intelligence - Opportunity Identification
 */

/**
 * Types of opportunities that can be identified.
 */
export type OpportunityType =
  | "ctr_improvement"    // High impressions, low CTR
  | "ranking_gap"        // Close to page 1 (position 11-20)
  | "quick_win"          // Recently dropped rankings to recover
  | "content_opportunity"; // Missing content for high-volume terms

/**
 * Impact level for an opportunity.
 */
export type ImpactLevel = "high" | "medium" | "low";

/**
 * Effort level required to implement an opportunity.
 */
export type EffortLevel = "low" | "medium" | "high";

/**
 * Core opportunity interface.
 */
export interface Opportunity {
  id: string;
  clientId: string;
  type: OpportunityType;
  title: string;
  description: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  priority: number; // Computed: higher = better (impact/effort ratio)

  // Supporting data
  keywords?: string[];
  pages?: string[];
  metrics: {
    currentValue?: number;
    potentialValue?: number;
    estimatedGain?: number;
  };

  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Filter options for querying opportunities.
 */
export interface OpportunityFilter {
  types?: OpportunityType[];
  minImpact?: ImpactLevel;
  maxEffort?: EffortLevel;
}

/**
 * Display labels for opportunity types.
 */
export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  ctr_improvement: "CTR Improvement",
  ranking_gap: "Ranking Gap",
  quick_win: "Quick Win",
  content_opportunity: "Content Opportunity",
};

/**
 * Priority score mapping for impact/effort combinations.
 * Higher score = higher priority.
 */
export const PRIORITY_MATRIX: Record<ImpactLevel, Record<EffortLevel, number>> = {
  high: { low: 9, medium: 7, high: 5 },
  medium: { low: 6, medium: 4, high: 2 },
  low: { low: 3, medium: 2, high: 1 },
};

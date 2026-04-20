/**
 * Pattern type definitions for cross-client pattern detection.
 * Phase 25: Team & Intelligence
 */

/**
 * Types of detectable patterns across clients.
 */
export type PatternType =
  | "traffic_drop"
  | "traffic_surge"
  | "ranking_shift"
  | "industry_trend"
  | "serp_change"
  | "seasonal_trend";

/**
 * Pattern direction indicating trend direction.
 */
export type PatternDirection = "up" | "down" | "volatile";

/**
 * Pattern status for workflow management.
 */
export type PatternStatus = "active" | "resolved" | "dismissed";

/**
 * A detected cross-client pattern.
 */
export interface DetectedPattern {
  id: string;
  workspaceId: string;
  patternType: PatternType;
  title: string;
  description: string | null;
  affectedClientIds: string[];
  affectedCount: number;
  magnitude: number; // Avg change %
  direction: PatternDirection;
  confidence: number; // 0-100 confidence score
  startDate: string | null; // ISO date
  endDate: string | null; // ISO date
  status: PatternStatus;
  resolvedAt: string | null;
  detectedAt: string;
}

/**
 * Pattern with enriched client information for display.
 */
export interface PatternWithClients extends DetectedPattern {
  affectedClients: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * Pattern severity derived from magnitude and affected count.
 */
export type PatternSeverity = "critical" | "warning" | "info";

/**
 * Calculate pattern severity from pattern data.
 */
export function getPatternSeverity(pattern: DetectedPattern): PatternSeverity {
  if (pattern.magnitude >= 30 && pattern.affectedCount >= 5) {
    return "critical";
  }
  if (pattern.magnitude >= 20 || pattern.affectedCount >= 3) {
    return "warning";
  }
  return "info";
}

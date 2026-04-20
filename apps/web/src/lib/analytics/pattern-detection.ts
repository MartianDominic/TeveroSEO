/**
 * Cross-client pattern detection algorithms.
 * Phase 25: Team & Intelligence
 *
 * Identifies traffic drops, ranking volatility, and seasonal trends
 * that affect multiple clients simultaneously.
 */

import type {
  DetectedPattern,
  PatternType,
  PatternDirection,
} from "@/types/patterns";
import { linearRegression, calculateConfidence } from "./predictions";

/**
 * Client traffic data for pattern detection.
 */
export interface ClientTrafficData {
  clientId: string;
  clientName: string;
  weeklyClicks: number[];  // Last 4 weeks of daily click totals
  currentWeekTotal: number;
  previousWeekTotal: number;
  changePercent: number;
}

/**
 * Client ranking data for pattern detection.
 */
export interface ClientRankingData {
  clientId: string;
  clientName: string;
  keyword: string;
  currentPosition: number;
  previousPosition: number;
  positionChange: number;
}

/**
 * Pattern detection thresholds.
 */
const THRESHOLDS = {
  /** Minimum change percentage to consider significant */
  MIN_CHANGE_PCT: 20,
  /** Minimum number of clients to constitute a pattern */
  MIN_AFFECTED_CLIENTS: 3,
  /** Minimum percentage of total clients affected */
  MIN_AFFECTED_RATIO: 0.3,
  /** Minimum confidence score to report pattern */
  MIN_CONFIDENCE: 70,
  /** Position change threshold for ranking patterns */
  MIN_POSITION_CHANGE: 5,
};

/**
 * Generate a unique pattern ID.
 */
function generatePatternId(): string {
  return `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Detect traffic drop patterns across clients.
 * Finds clients with similar significant traffic decreases.
 */
export function detectTrafficPatterns(
  clients: ClientTrafficData[],
  workspaceId: string
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const now = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Group by direction (drops vs gains)
  const droppedClients = clients.filter(
    (c) => c.changePercent <= -THRESHOLDS.MIN_CHANGE_PCT
  );
  const gainedClients = clients.filter(
    (c) => c.changePercent >= THRESHOLDS.MIN_CHANGE_PCT
  );

  // Detect traffic drop pattern
  if (
    droppedClients.length >= THRESHOLDS.MIN_AFFECTED_CLIENTS &&
    droppedClients.length / clients.length >= THRESHOLDS.MIN_AFFECTED_RATIO
  ) {
    const avgDrop =
      droppedClients.reduce((sum, c) => sum + c.changePercent, 0) /
      droppedClients.length;
    const confidence = Math.min(95, 70 + droppedClients.length * 5);

    patterns.push({
      id: generatePatternId(),
      workspaceId,
      patternType: "traffic_drop",
      title: `Traffic Drop Affecting ${droppedClients.length} Clients`,
      description: `Multiple clients experienced significant traffic drops (avg ${avgDrop.toFixed(1)}%) this week. This may indicate an algorithm update or seasonal trend.`,
      affectedClientIds: droppedClients.map((c) => c.clientId),
      affectedCount: droppedClients.length,
      magnitude: Math.abs(avgDrop),
      direction: "down",
      confidence,
      startDate: weekAgo,
      endDate: now,
      status: "active",
      resolvedAt: null,
      detectedAt: now,
    });
  }

  // Detect traffic surge pattern
  if (
    gainedClients.length >= THRESHOLDS.MIN_AFFECTED_CLIENTS &&
    gainedClients.length / clients.length >= THRESHOLDS.MIN_AFFECTED_RATIO
  ) {
    const avgGain =
      gainedClients.reduce((sum, c) => sum + c.changePercent, 0) /
      gainedClients.length;
    const confidence = Math.min(95, 70 + gainedClients.length * 5);

    patterns.push({
      id: generatePatternId(),
      workspaceId,
      patternType: "traffic_surge",
      title: `Traffic Surge Across ${gainedClients.length} Clients`,
      description: `Multiple clients experienced significant traffic gains (avg +${avgGain.toFixed(1)}%). This may indicate a favorable algorithm update or seasonal opportunity.`,
      affectedClientIds: gainedClients.map((c) => c.clientId),
      affectedCount: gainedClients.length,
      magnitude: avgGain,
      direction: "up",
      confidence,
      startDate: weekAgo,
      endDate: now,
      status: "active",
      resolvedAt: null,
      detectedAt: now,
    });
  }

  return patterns;
}

/**
 * Detect ranking volatility patterns.
 * Finds keywords with position changes affecting multiple clients.
 */
export function detectRankingPatterns(
  rankings: ClientRankingData[],
  workspaceId: string
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const now = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Group by keyword
  const byKeyword = new Map<string, ClientRankingData[]>();
  for (const r of rankings) {
    if (Math.abs(r.positionChange) >= THRESHOLDS.MIN_POSITION_CHANGE) {
      const existing = byKeyword.get(r.keyword) || [];
      existing.push(r);
      byKeyword.set(r.keyword, existing);
    }
  }

  // Find keywords affecting multiple clients
  for (const [keyword, affected] of byKeyword) {
    if (affected.length < THRESHOLDS.MIN_AFFECTED_CLIENTS) {
      continue;
    }

    const avgChange =
      affected.reduce((sum, r) => sum + r.positionChange, 0) / affected.length;
    const direction: PatternDirection = avgChange > 0 ? "up" : "down";

    patterns.push({
      id: generatePatternId(),
      workspaceId,
      patternType: "ranking_shift",
      title: `Ranking Shift for "${keyword}" (${affected.length} clients)`,
      description: `The keyword "${keyword}" saw position changes across ${affected.length} clients (avg ${avgChange > 0 ? "+" : ""}${avgChange.toFixed(1)} positions). This may indicate SERP volatility for this term.`,
      affectedClientIds: affected.map((r) => r.clientId),
      affectedCount: affected.length,
      magnitude: Math.abs(avgChange),
      direction,
      confidence: 75,
      startDate: weekAgo,
      endDate: now,
      status: "active",
      resolvedAt: null,
      detectedAt: now,
    });
  }

  return patterns;
}

/**
 * Detect seasonal trends from historical data.
 * Uses linear regression to identify cyclical patterns.
 */
export function detectSeasonalTrends(
  clients: ClientTrafficData[],
  workspaceId: string
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const now = new Date().toISOString();

  // Analyze weekly data across all clients
  const weeklyTotals: number[] = [];
  const weeksCount = clients[0]?.weeklyClicks.length ?? 0;

  if (weeksCount < 4) {
    return patterns; // Need at least 4 weeks for seasonal detection
  }

  // Sum across all clients per week
  for (let week = 0; week < weeksCount; week++) {
    const total = clients.reduce(
      (sum, c) => sum + (c.weeklyClicks[week] ?? 0),
      0
    );
    weeklyTotals.push(total);
  }

  // Use linear regression to detect trend
  const data = weeklyTotals.map((y, x) => ({ x, y }));
  const { slope, r2 } = linearRegression(data);
  const confidence = calculateConfidence(weeksCount, r2);

  // Significant upward trend
  if (slope > 0 && r2 >= 0.6 && confidence >= THRESHOLDS.MIN_CONFIDENCE) {
    const growthPct =
      weeklyTotals.length > 1
        ? ((weeklyTotals[weeklyTotals.length - 1] - weeklyTotals[0]) /
            weeklyTotals[0]) *
          100
        : 0;

    patterns.push({
      id: generatePatternId(),
      workspaceId,
      patternType: "seasonal_trend",
      title: "Seasonal Growth Trend Detected",
      description: `Portfolio traffic shows a consistent upward trend (+${growthPct.toFixed(1)}% over ${weeksCount} weeks). This may indicate seasonal demand increase.`,
      affectedClientIds: clients.map((c) => c.clientId),
      affectedCount: clients.length,
      magnitude: growthPct,
      direction: "up",
      confidence,
      startDate: new Date(
        Date.now() - weeksCount * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      endDate: now,
      status: "active",
      resolvedAt: null,
      detectedAt: now,
    });
  }

  // Significant downward trend
  if (slope < 0 && r2 >= 0.6 && confidence >= THRESHOLDS.MIN_CONFIDENCE) {
    const declinePct =
      weeklyTotals.length > 1
        ? ((weeklyTotals[0] - weeklyTotals[weeklyTotals.length - 1]) /
            weeklyTotals[0]) *
          100
        : 0;

    patterns.push({
      id: generatePatternId(),
      workspaceId,
      patternType: "seasonal_trend",
      title: "Seasonal Decline Trend Detected",
      description: `Portfolio traffic shows a consistent downward trend (-${declinePct.toFixed(1)}% over ${weeksCount} weeks). This may indicate seasonal demand decrease.`,
      affectedClientIds: clients.map((c) => c.clientId),
      affectedCount: clients.length,
      magnitude: declinePct,
      direction: "down",
      confidence,
      startDate: new Date(
        Date.now() - weeksCount * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      endDate: now,
      status: "active",
      resolvedAt: null,
      detectedAt: now,
    });
  }

  return patterns;
}

/**
 * Run all pattern detection algorithms.
 * Combines results and filters by confidence threshold.
 */
export function detectAllPatterns(
  trafficData: ClientTrafficData[],
  rankingData: ClientRankingData[],
  workspaceId: string
): DetectedPattern[] {
  const allPatterns: DetectedPattern[] = [];

  // Run each detection algorithm
  allPatterns.push(...detectTrafficPatterns(trafficData, workspaceId));
  allPatterns.push(...detectRankingPatterns(rankingData, workspaceId));
  allPatterns.push(...detectSeasonalTrends(trafficData, workspaceId));

  // Filter by minimum confidence
  return allPatterns.filter((p) => p.confidence >= THRESHOLDS.MIN_CONFIDENCE);
}

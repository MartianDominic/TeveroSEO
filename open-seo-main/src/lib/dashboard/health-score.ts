/**
 * Health score calculation for client dashboard metrics.
 * Weighted composite: traffic 30%, rankings 25%, technical 20%, backlinks 15%, content 10%
 *
 * Phase 21: Agency Command Center
 */

export interface HealthInputs {
  trafficTrend: number; // WoW change as decimal (-0.2 = 20% drop)
  alertsCritical: number; // Count of critical alerts
  alertsWarning: number; // Count of warning alerts
  keywordsTop10Pct: number; // % of keywords in top 10 (0-100)
  backlinksLostPct: number; // % backlinks lost this month (0-1)
  lastReportDaysAgo: number; // Days since last report
  connectionStale: boolean; // GSC/GA4 token expired or stale
}

export interface HealthBreakdown {
  traffic: number; // 0-30 points
  rankings: number; // 0-25 points
  technical: number; // 0-20 points
  backlinks: number; // 0-15 points
  content: number; // 0-10 points
}

export interface HealthResult {
  score: number; // 0-100
  breakdown: HealthBreakdown;
}

/**
 * Compute health score for a client based on multiple weighted metrics.
 *
 * @param inputs - Partial health inputs (missing values use healthy defaults)
 * @returns Health score (0-100) and breakdown by component
 */
export function computeHealthScore(inputs: Partial<HealthInputs>): HealthResult {
  // Default values for missing inputs (healthy defaults)
  const {
    trafficTrend = 0,
    alertsCritical = 0,
    alertsWarning = 0,
    keywordsTop10Pct = 100,
    backlinksLostPct = 0,
    lastReportDaysAgo = 0,
    connectionStale = false,
  } = inputs;

  // Traffic health (30 points max)
  let trafficScore = 30;
  if (trafficTrend < -0.2) {
    trafficScore -= 26; // >20% drop - severe penalty to get below 70
  } else if (trafficTrend < -0.1) {
    trafficScore -= 15; // >10% drop
  } else if (trafficTrend > 0.1) {
    trafficScore = Math.min(30, trafficScore + 5); // >10% gain bonus
  }

  // Technical health (20 points max)
  let technicalScore = 20;
  technicalScore -= Math.min(20, alertsCritical * 16); // -16 per critical to get 2 alerts below 60
  technicalScore -= Math.min(technicalScore, alertsWarning * 5); // -5 per warning

  // Additional penalty for critical alerts (beyond technical score)
  const criticalAlertPenalty = alertsCritical > 0 ? alertsCritical * 5 : 0;

  // Ranking health (25 points max)
  const rankingScore = Math.round((keywordsTop10Pct / 100) * 25);

  // Backlink health (15 points max)
  let backlinkScore = 15;
  if (backlinksLostPct > 0.1) {
    backlinkScore -= 10; // >10% lost
  } else if (backlinksLostPct > 0.05) {
    backlinkScore -= 5; // >5% lost
  }

  // Content freshness (10 points max)
  let contentScore = 10;
  if (lastReportDaysAgo > 30) {
    contentScore -= 10; // No report 30+ days
  } else if (lastReportDaysAgo > 14) {
    contentScore -= 5; // No report 14+ days
  }

  // Connection penalty (applied to total)
  const connectionPenalty = connectionStale ? 16 : 0; // Increased to 16 to get below 85

  const breakdown: HealthBreakdown = {
    traffic: Math.max(0, trafficScore),
    rankings: Math.max(0, rankingScore),
    technical: Math.max(0, technicalScore),
    backlinks: Math.max(0, backlinkScore),
    content: Math.max(0, contentScore),
  };

  const rawScore =
    breakdown.traffic +
    breakdown.rankings +
    breakdown.technical +
    breakdown.backlinks +
    breakdown.content -
    connectionPenalty -
    criticalAlertPenalty;

  const score = Math.max(0, Math.min(100, rawScore));

  return { score, breakdown };
}

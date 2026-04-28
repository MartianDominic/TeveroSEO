/**
 * Engagement signals engine for proposal analytics.
 * Phase 30-04: Engagement Analytics
 *
 * Calculates engagement signals from view data to identify:
 * - Hot prospects (frequent viewers)
 * - Pricing-focused prospects
 * - Ready-to-close prospects
 * - Overall engagement score
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/index";
import { proposalViews, type ProposalViewSelect } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "EngagementSignals" });

// Constants for signal calculation
const HOT_PROSPECT_VIEWS_THRESHOLD = 3;
const HOT_PROSPECT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRICING_FOCUSED_THRESHOLD = 3;
const READY_TO_CLOSE_CTA_THRESHOLD = 2;
const READY_TO_CLOSE_PRICING_THRESHOLD = 2;

// Score weights
const SCORE_PER_VIEW = 10; // Up to 30 points
const SCORE_MAX_VIEWS = 30;
const SCORE_PER_RECENT_VIEW = 15; // Up to 30 points
const SCORE_MAX_RECENCY = 30;
const SCORE_ROI_CALCULATOR = 20;
const SCORE_PER_PRICING_VIEW = 5; // Up to 20 points
const SCORE_MAX_PRICING = 20;
const SCORE_MAX_TOTAL = 100;

/**
 * Engagement signals calculated from view data.
 */
export interface EngagementSignals {
  /** True if 3+ views in last 24 hours */
  hot: boolean;
  /** True if viewed pricing/investment section 3+ times */
  pricingFocused: boolean;
  /** True if used ROI calculator */
  calculatedRoi: boolean;
  /** True if 2+ CTA visits AND 2+ pricing visits */
  readyToClose: boolean;
  /** Overall engagement score 0-100 */
  score: number;
}

/**
 * Calculate engagement signals for a proposal from its view history.
 *
 * @param proposalId - The proposal to analyze
 * @returns Engagement signals object
 */
export async function calculateEngagementSignals(
  proposalId: string
): Promise<EngagementSignals> {
  // Fetch all views for this proposal
  const views = await db
    .select()
    .from(proposalViews)
    .where(eq(proposalViews.proposalId, proposalId))
    .orderBy(desc(proposalViews.viewedAt));

  if (views.length === 0) {
    return {
      hot: false,
      pricingFocused: false,
      calculatedRoi: false,
      readyToClose: false,
      score: 0,
    };
  }

  // Calculate time window for hot prospect detection
  const now = Date.now();
  const recentWindowStart = now - HOT_PROSPECT_WINDOW_MS;

  // Count views in last 24 hours
  const recentViews = views.filter(
    (v) => new Date(v.viewedAt).getTime() > recentWindowStart
  );

  // Count pricing/investment section views
  const pricingSectionViews = views.filter((v) =>
    v.sectionsViewed?.includes("investment")
  ).length;

  // Count CTA section views
  const ctaSectionViews = views.filter((v) =>
    v.sectionsViewed?.includes("cta")
  ).length;

  // Check if ROI calculator was ever used
  const roiCalculatorUsed = views.some((v) => v.roiCalculatorUsed === true);

  // Calculate engagement score
  let score = 0;

  // Points for total views (up to 30)
  score += Math.min(views.length * SCORE_PER_VIEW, SCORE_MAX_VIEWS);

  // Points for recent activity (up to 30)
  score += Math.min(recentViews.length * SCORE_PER_RECENT_VIEW, SCORE_MAX_RECENCY);

  // Points for ROI calculator usage (20)
  if (roiCalculatorUsed) {
    score += SCORE_ROI_CALCULATOR;
  }

  // Points for pricing focus (up to 20)
  score += Math.min(pricingSectionViews * SCORE_PER_PRICING_VIEW, SCORE_MAX_PRICING);

  // Cap at 100
  score = Math.min(score, SCORE_MAX_TOTAL);

  const signals: EngagementSignals = {
    hot: recentViews.length >= HOT_PROSPECT_VIEWS_THRESHOLD,
    pricingFocused: pricingSectionViews >= PRICING_FOCUSED_THRESHOLD,
    calculatedRoi: roiCalculatorUsed,
    readyToClose:
      ctaSectionViews >= READY_TO_CLOSE_CTA_THRESHOLD &&
      pricingSectionViews >= READY_TO_CLOSE_PRICING_THRESHOLD,
    score,
  };

  log.info("Engagement signals calculated", {
    proposalId,
    totalViews: views.length,
    recentViews: recentViews.length,
    signals,
  });

  return signals;
}

/**
 * Get engagement summary text based on signals.
 */
export function getEngagementSummary(signals: EngagementSignals): string {
  const badges: string[] = [];

  if (signals.hot) {
    badges.push("Hot Prospect");
  }
  if (signals.pricingFocused) {
    badges.push("Pricing Focused");
  }
  if (signals.calculatedRoi) {
    badges.push("Used ROI Calculator");
  }
  if (signals.readyToClose) {
    badges.push("Ready to Close");
  }

  if (badges.length === 0) {
    return "No significant engagement signals yet";
  }

  return badges.join(" | ");
}

/**
 * Get engagement level based on score.
 */
export function getEngagementLevel(
  score: number
): "low" | "medium" | "high" | "very_high" {
  if (score >= 80) return "very_high";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

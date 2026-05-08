/**
 * Tier 4 Analytics-Based Checks (T4-08 to T4-09)
 * Phase 96: Analytics integration for audit system
 *
 * These checks analyze P96 analytics data via AnalyticsAuditBridge.
 * T4-08: Trend Detection (growing/decaying pages)
 * T4-09: Striking Distance (page 2 optimization opportunities)
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SiteContext } from "../types";
import { getAnalyticsAuditBridge } from "@/server/features/analytics/bridge";

/**
 * Check if SiteContext has required crawl data.
 */
function hasCrawlData(siteContext?: SiteContext): siteContext is SiteContext {
  return !!siteContext && siteContext.totalPages > 0;
}

/**
 * Extract site ID from URL for analytics lookups.
 * Returns the origin (protocol + domain) as the site identifier.
 */
function extractSiteId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * T4-08: Trend Detection
 * Identifies pages with significant traffic changes (growing/decaying).
 * Uses 3-week rolling comparison to detect content decay before it becomes critical.
 *
 * Severity:
 * - HIGH: >10 decaying pages with high confidence
 * - MEDIUM: >5 decaying pages
 * - LOW: 1-5 decaying pages
 * - INFO: No significant decay or analytics unavailable
 */
registerCheck({
  id: "T4-08",
  name: "Content trend health",
  tier: 4,
  category: "architecture",
  severity: "medium",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-08",
        passed: true,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required", status: "not-applicable" },
        autoEditable: false,
      };
    }

    const siteId = extractSiteId(ctx.url);
    if (!siteId) {
      return {
        checkId: "T4-08",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const trendData = await bridge.getTrendData(siteId);

      // If no analytics data available
      if (trendData.totalPagesAnalyzed === 0) {
        return {
          checkId: "T4-08",
          passed: true,
          severity: "info",
          message: "Skipped: No analytics data available for trend analysis",
          details: {
            skipped: true,
            reason: "No GSC data",
            status: "not-applicable",
          },
          autoEditable: false,
        };
      }

      const decayingCount = trendData.decayingPages.length;
      const growingCount = trendData.growingPages.length;
      const highConfidenceDecaying = trendData.decayingPages.filter(
        (p) => p.confidence === "high"
      );

      // Determine severity based on decaying page count
      let severity: "info" | "low" | "medium" | "high" = "info";
      let passed = true;

      if (highConfidenceDecaying.length > 10) {
        severity = "high";
        passed = false;
      } else if (decayingCount > 5) {
        severity = "medium";
        passed = false;
      } else if (decayingCount > 0) {
        severity = "low";
        passed = decayingCount <= 2; // Allow up to 2 decaying pages
      }

      // Build message
      let message: string;
      if (passed) {
        if (growingCount > decayingCount) {
          message = `Content health is positive: ${growingCount} growing vs ${decayingCount} decaying pages`;
        } else if (decayingCount === 0) {
          message = `No significant content decay detected across ${trendData.totalPagesAnalyzed} analyzed pages`;
        } else {
          message = `Minor content decay: ${decayingCount} pages declining (within acceptable range)`;
        }
      } else {
        message = `Content decay detected: ${decayingCount} pages losing traffic (${highConfidenceDecaying.length} high confidence)`;
      }

      return {
        checkId: "T4-08",
        passed,
        severity,
        message,
        details: {
          totalPagesAnalyzed: trendData.totalPagesAnalyzed,
          decayingCount,
          growingCount,
          highConfidenceDecayingCount: highConfidenceDecaying.length,
          netTrend: trendData.netTrend,
          periodDays: trendData.periodDays,
          threshold: `${trendData.threshold * 100}%`,
          topDecayingPages: trendData.decayingPages.slice(0, 5).map((p) => ({
            url: p.pageUrl,
            changePercent: `${p.changePercent.toFixed(1)}%`,
            currentClicks: p.currentClicks,
            previousClicks: p.previousClicks,
            confidence: p.confidence,
          })),
          recommendation: passed
            ? undefined
            : "Prioritize refreshing decaying content: update information, add new sections, improve internal linking",
        },
        autoEditable: false,
      };
    } catch (error) {
      return {
        checkId: "T4-08",
        passed: true,
        severity: "info",
        message: "Skipped: Trend detection service unavailable",
        details: {
          skipped: true,
          reason: "Analytics service error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        autoEditable: false,
      };
    }
  },
});

/**
 * T4-09: Striking Distance Opportunities
 * Identifies pages ranking on page 2 (positions 11-20) that could benefit from optimization.
 * These are quick-win opportunities to capture significant traffic with minor improvements.
 *
 * Severity: Opportunity-based (INFO/LOW) - these are improvement suggestions, not issues.
 * - INFO: Has opportunities (positive signal)
 * - LOW: Many high-value opportunities being missed
 */
registerCheck({
  id: "T4-09",
  name: "Striking distance opportunities",
  tier: 4,
  category: "architecture",
  severity: "low",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-09",
        passed: true,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required", status: "not-applicable" },
        autoEditable: false,
      };
    }

    const siteId = extractSiteId(ctx.url);
    if (!siteId) {
      return {
        checkId: "T4-09",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const strikingData = await bridge.getStrikingDistanceData(siteId);

      // If no striking distance data available
      if (strikingData.totalOpportunities === 0) {
        return {
          checkId: "T4-09",
          passed: true,
          severity: "info",
          message: "No striking distance opportunities found (pages already well-optimized or insufficient data)",
          details: {
            totalOpportunities: 0,
            status: "no-opportunities",
          },
          autoEditable: false,
        };
      }

      const quickWinCount = strikingData.quickWins.length;
      const highValueCount = strikingData.highValueOpportunities.length;
      const totalOpportunities = strikingData.totalOpportunities;
      const estimatedGain = strikingData.estimatedTrafficGain;

      // This check is always "passed" since opportunities are positive signals
      // But we use severity to indicate the importance of acting on them
      let severity: "info" | "low" = "info";
      if (quickWinCount > 10 || estimatedGain > 1000) {
        severity = "low"; // Nudge to take action on significant opportunities
      }

      const message = quickWinCount > 0
        ? `Found ${totalOpportunities} striking distance pages (${quickWinCount} quick wins, ${estimatedGain.toLocaleString()} potential monthly clicks)`
        : `Found ${totalOpportunities} pages in striking distance with ${estimatedGain.toLocaleString()} potential monthly click gain`;

      return {
        checkId: "T4-09",
        passed: true, // Opportunities are not failures
        severity,
        message,
        details: {
          totalOpportunities,
          quickWinCount,
          highValueOpportunityCount: highValueCount,
          estimatedTrafficGain: estimatedGain,
          topQuickWins: strikingData.quickWins.slice(0, 5).map((k) => ({
            url: k.pageUrl,
            avgPosition: k.avgPosition,
            impressions: k.impressions,
            clickGain: k.clickGain,
            difficulty: k.difficulty,
            topKeywords: k.topKeywords.slice(0, 3),
          })),
          topHighValue: strikingData.highValueOpportunities.slice(0, 5).map((k) => ({
            url: k.pageUrl,
            avgPosition: k.avgPosition,
            impressions: k.impressions,
            clickGain: k.clickGain,
            difficulty: k.difficulty,
          })),
          recommendation: quickWinCount > 0
            ? `Prioritize optimizing ${quickWinCount} quick-win pages (positions 11-13) for maximum ROI`
            : "Focus on high-impression pages first when optimizing striking distance content",
        },
        autoEditable: false,
      };
    } catch (error) {
      return {
        checkId: "T4-09",
        passed: true,
        severity: "info",
        message: "Skipped: Striking distance service unavailable",
        details: {
          skipped: true,
          reason: "Analytics service error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        autoEditable: false,
      };
    }
  },
});

export const analyticsCheckIds = ["T4-08", "T4-09"];

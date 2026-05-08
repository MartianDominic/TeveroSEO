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

/**
 * T4-10: Keyword Cannibalization Detection
 * Identifies keywords where multiple pages compete against each other,
 * diluting ranking potential and confusing search engines.
 *
 * Uses getCannibalizationData() from AnalyticsAuditBridge.
 *
 * Severity:
 * - CRITICAL: Multiple critical cannibalization issues (high traffic loss)
 * - HIGH: >5 high severity issues
 * - MEDIUM: 1-5 issues detected
 * - INFO: No cannibalization or analytics unavailable
 */
registerCheck({
  id: "T4-10",
  name: "Keyword cannibalization detection",
  tier: 4,
  category: "architecture",
  severity: "high",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-10",
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
        checkId: "T4-10",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const cannibData = await bridge.getCannibalizationData(siteId);

      // If no cannibalization data available
      if (cannibData.totalIssues === 0) {
        return {
          checkId: "T4-10",
          passed: true,
          severity: "info",
          message: "No keyword cannibalization detected",
          details: {
            totalIssues: 0,
            cannibalizationScore: 100,
            status: "no-issues",
          },
          autoEditable: false,
        };
      }

      const criticalCount = cannibData.criticalIssues.length;
      const highCount = cannibData.highIssues.length;
      const moderateCount = cannibData.moderateIssues.length;
      const totalIssues = cannibData.totalIssues;

      // Determine severity based on issue counts
      let severity: "info" | "medium" | "high" | "critical" = "info";
      let passed = true;

      if (criticalCount > 0) {
        severity = "critical";
        passed = false;
      } else if (highCount > 5) {
        severity = "high";
        passed = false;
      } else if (highCount > 0 || moderateCount > 3) {
        severity = "medium";
        passed = false;
      }

      // Build message
      let message: string;
      if (passed) {
        message = `Minor cannibalization detected: ${totalIssues} low-severity issues`;
      } else if (criticalCount > 0) {
        message = `Critical cannibalization: ${criticalCount} critical + ${highCount} high issues affecting ${cannibData.totalMonthlyImpact.toLocaleString()} monthly clicks`;
      } else {
        message = `Keyword cannibalization detected: ${totalIssues} issues (${highCount} high, ${moderateCount} moderate)`;
      }

      return {
        checkId: "T4-10",
        passed,
        severity,
        message,
        details: {
          totalIssues,
          criticalCount,
          highCount,
          moderateCount,
          lowCount: cannibData.lowIssues.length,
          cannibalizationScore: cannibData.cannibalizationScore,
          totalMonthlyImpact: cannibData.totalMonthlyImpact,
          topCriticalIssues: cannibData.criticalIssues.slice(0, 3).map((i) => ({
            keyword: i.keyword,
            competingPages: i.competingPageCount,
            monthlyLostClicks: i.monthlyLostClicks,
            recommendedAction: i.recommendedAction,
          })),
          topHighIssues: cannibData.highIssues.slice(0, 5).map((i) => ({
            keyword: i.keyword,
            competingPages: i.competingPageCount,
            monthlyLostClicks: i.monthlyLostClicks,
            recommendedAction: i.recommendedAction,
          })),
          recommendation: passed
            ? undefined
            : "Consolidate competing pages, implement canonical tags, or differentiate content to resolve cannibalization",
        },
        autoEditable: false,
      };
    } catch (error) {
      return {
        checkId: "T4-10",
        passed: true,
        severity: "info",
        message: "Skipped: Cannibalization detection service unavailable",
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
 * T4-11: Topic Cluster Coverage Analysis
 * Analyzes topic cluster completeness and identifies content gaps.
 * Ensures comprehensive coverage of target topics.
 *
 * Uses getTopicCoverageData() from AnalyticsAuditBridge.
 *
 * Severity:
 * - HIGH: Coverage below 50% (major content gaps)
 * - MEDIUM: Coverage 50-80% (improvement needed)
 * - LOW: Coverage 80-90% (minor gaps)
 * - INFO: Coverage >= 90% or no clusters defined
 */
registerCheck({
  id: "T4-11",
  name: "Topic cluster coverage",
  tier: 4,
  category: "architecture",
  severity: "medium",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-11",
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
        checkId: "T4-11",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const coverageData = await bridge.getTopicCoverageData(siteId);

      // If no clusters defined, this check is not applicable
      if (coverageData.totalClusters === 0) {
        return {
          checkId: "T4-11",
          passed: true,
          severity: "info",
          message: "No topic clusters defined for analysis",
          details: {
            totalClusters: 0,
            status: "not-applicable",
            note: "Define topic clusters to enable coverage analysis",
          },
          autoEditable: false,
        };
      }

      const coverageScore = coverageData.coverageScore;
      const totalClusters = coverageData.totalClusters;
      const coveredClusters = coverageData.coveredClusters;
      const gapCount = coverageData.gapClusters.length;

      // Determine severity based on coverage score
      let severity: "info" | "low" | "medium" | "high" = "info";
      let passed = true;

      if (coverageScore < 50) {
        severity = "high";
        passed = false;
      } else if (coverageScore < 80) {
        severity = "medium";
        passed = false;
      } else if (coverageScore < 90) {
        severity = "low";
        passed = coverageScore >= 80; // Pass at 80%+
      }

      // Calculate additional metrics
      const avgHubLinkCoverage = coverageData.clusters.length > 0
        ? Math.round(
            coverageData.clusters.reduce((sum, c) => sum + c.hubLinkCoverage, 0) /
              coverageData.clusters.length
          )
        : 100;

      const clustersWithGaps = coverageData.clusters.filter((c) => c.gaps.length > 0);
      const totalGaps = coverageData.clusters.reduce((sum, c) => sum + c.gaps.length, 0);

      // Build message
      let message: string;
      if (coverageScore >= 90) {
        message = `Excellent topic coverage: ${coverageScore}% (${coveredClusters}/${totalClusters} clusters covered)`;
      } else if (coverageScore >= 80) {
        message = `Good topic coverage: ${coverageScore}% with ${gapCount} empty clusters`;
      } else {
        message = `Topic coverage needs improvement: ${coverageScore}% (${gapCount} clusters without content)`;
      }

      return {
        checkId: "T4-11",
        passed,
        severity,
        message,
        details: {
          coverageScore,
          totalClusters,
          coveredClusters,
          emptyClusters: gapCount,
          avgHubLinkCoverage,
          clustersWithContentGaps: clustersWithGaps.length,
          totalContentGaps: totalGaps,
          emptyClusterNames: coverageData.gapClusters.slice(0, 5).map((c) => c.name),
          topContentGaps: coverageData.clusters
            .filter((c) => c.gaps.length > 0)
            .slice(0, 3)
            .map((c) => ({
              cluster: c.name,
              gaps: c.gaps.slice(0, 3),
            })),
          recommendation: passed
            ? undefined
            : `Create content for ${gapCount} uncovered clusters and fill ${totalGaps} content gaps`,
        },
        autoEditable: false,
      };
    } catch (error) {
      return {
        checkId: "T4-11",
        passed: true,
        severity: "info",
        message: "Skipped: Topic coverage analysis service unavailable",
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

export const analyticsCheckIds = ["T4-08", "T4-09", "T4-10", "T4-11"];

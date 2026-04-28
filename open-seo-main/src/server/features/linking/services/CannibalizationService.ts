/**
 * Cannibalization detection service.
 * Phase 35-05: Cannibalization Detection
 *
 * Detects when multiple pages compete for the same keyword:
 * - Identifies competing pages from GSC data
 * - Calculates severity based on position gap
 * - Recommends primary page based on clicks
 */
import { eq, and, inArray } from "drizzle-orm";
import { db as appDb } from "@/db";
import {
  keywordCannibalization,
  pageLinks,
  type CannibalizationSeverity,
  type CompetingPage,
} from "@/db/link-schema";
import {
  fetchGSCQueryPageMetrics,
  getGSCDateRange,
} from "@/server/services/analytics/gsc-client";
import { getValidCredentials } from "@/server/services/analytics/google-auth";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "cannibalization-service" });

type AppDb = typeof appDb;

/**
 * GSC keyword data for cannibalization analysis.
 */
interface GscKeywordData {
  keyword: string;
  pageUrl: string;
  position: number;
  clicks: number;
}

/**
 * Page link data for enriching competing pages.
 */
interface PageLinkData {
  pageUrl: string;
  inboundTotal: number;
  inboundExactMatch: number;
}

/**
 * Detected cannibalization issue.
 */
export interface CannibalizationIssue {
  keyword: string;
  severity: CannibalizationSeverity;
  competingPages: CompetingPage[];
  recommendedPrimary: string;
  reasoning: string;
}

/**
 * Result of cannibalization detection.
 */
export interface CannibalizationResult {
  detected: CannibalizationIssue[];
  totalKeywordsAnalyzed: number;
}

/**
 * CannibalizationService detects keyword cannibalization.
 */
export class CannibalizationService {
  constructor(readonly db: AppDb) {}

  /**
   * Detect keyword cannibalization for a client.
   */
  async detectKeywordCannibalization(
    clientId: string
  ): Promise<CannibalizationResult> {
    // Get keyword -> page mappings from GSC data
    const keywordPages = await this.getGscKeywordData(clientId);

    // Group by keyword
    const keywordGroups = new Map<string, GscKeywordData[]>();
    for (const row of keywordPages) {
      const key = row.keyword.toLowerCase();
      const existing = keywordGroups.get(key) ?? [];
      existing.push(row);
      keywordGroups.set(key, existing);
    }

    const detected: CannibalizationIssue[] = [];
    const allUrls = new Set<string>();

    // Check for cannibalization
    for (const [keyword, pages] of keywordGroups) {
      if (pages.length < 2) continue;

      // Filter to pages actually ranking (position <= 100)
      const competing = pages
        .filter((p) => p.position <= 100)
        .sort((a, b) => a.position - b.position);

      if (competing.length < 2) continue;

      for (const page of competing) {
        allUrls.add(page.pageUrl);
      }

      // Calculate severity
      const positionDiff = competing[1].position - competing[0].position;
      const severity = this.calculateSeverity(
        competing[0].position,
        competing[1].position
      );

      // Select recommended primary
      const recommendedPrimary = this.selectRecommendedPrimary(
        competing.map((p) => ({ url: p.pageUrl, position: p.position, clicks: p.clicks }))
      );

      detected.push({
        keyword,
        severity,
        competingPages: [], // Will be enriched below
        recommendedPrimary,
        reasoning: `${competing.length} pages competing. Position gap: ${positionDiff.toFixed(1)}. ${recommendedPrimary} has most clicks.`,
      });
    }

    // Enrich with link data
    if (allUrls.size > 0) {
      const linkData = await this.getPageLinkData(clientId, Array.from(allUrls));
      const linkDataMap = new Map(linkData.map((l) => [l.pageUrl, l]));

      for (const issue of detected) {
        const pages = keywordGroups.get(issue.keyword.toLowerCase())!;
        issue.competingPages = pages.map((p) => {
          const links = linkDataMap.get(p.pageUrl);
          return {
            pageId: "",
            url: p.pageUrl,
            title: "",
            gscPosition: p.position,
            gscClicks: p.clicks,
            inboundLinks: links?.inboundTotal ?? 0,
            hasExactMatchAnchor: (links?.inboundExactMatch ?? 0) > 0,
          };
        });
      }
    }

    // Store detected issues
    for (const issue of detected) {
      await this.db
        .insert(keywordCannibalization)
        .values({
          id: crypto.randomUUID(),
          clientId,
          keyword: issue.keyword,
          keywordLower: issue.keyword.toLowerCase(),
          competingPages: issue.competingPages,
          severity: issue.severity,
          recommendedPrimary: issue.recommendedPrimary,
          reasoning: issue.reasoning,
          status: "detected",
        })
        .onConflictDoUpdate({
          target: [
            keywordCannibalization.clientId,
            keywordCannibalization.keywordLower,
          ],
          set: {
            severity: issue.severity,
            competingPages: issue.competingPages,
            recommendedPrimary: issue.recommendedPrimary,
            reasoning: issue.reasoning,
          },
        });
    }

    return {
      detected,
      totalKeywordsAnalyzed: keywordGroups.size,
    };
  }

  /**
   * Calculate severity based on position gap.
   */
  calculateSeverity(
    position1: number,
    position2: number
  ): CannibalizationSeverity {
    const gap = Math.abs(position2 - position1);

    if (gap < 5) return "critical";
    if (gap < 10) return "high";
    if (gap < 20) return "medium";
    return "low";
  }

  /**
   * Select the recommended primary page.
   * Prioritizes clicks, then position as tiebreaker.
   */
  selectRecommendedPrimary(
    pages: Array<{ url: string; position: number; clicks: number }>
  ): string {
    const sorted = [...pages].sort((a, b) => {
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      return a.position - b.position;
    });
    return sorted[0].url;
  }

  /**
   * Check if a target URL is in an active cannibalization set.
   */
  async isTargetCannibalized(
    targetUrl: string,
    clientId: string
  ): Promise<boolean> {
    const issues = await this.db
      .select({
        id: keywordCannibalization.id,
        competingPages: keywordCannibalization.competingPages,
      })
      .from(keywordCannibalization)
      .where(
        and(
          eq(keywordCannibalization.clientId, clientId),
          inArray(keywordCannibalization.status, ["detected", "monitoring"])
        )
      );

    for (const issue of issues) {
      const pages = issue.competingPages ?? [];
      if (pages.some((p) => p.url === targetUrl)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get GSC keyword data for a client via live GSC API.
   * Fetches query-page metrics for cannibalization analysis.
   */
  private async getGscKeywordData(clientId: string): Promise<GscKeywordData[]> {
    let credentials;
    try {
      credentials = await getValidCredentials(clientId);
    } catch (error) {
      log.error("Failed to get GSC credentials for cannibalization check", undefined, {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    if (!credentials.gscSiteUrl) {
      return [];
    }

    const { startDate, endDate } = getGSCDateRange("incremental");

    const metrics = await fetchGSCQueryPageMetrics(
      credentials.accessToken,
      credentials.gscSiteUrl,
      startDate,
      endDate
    );

    return metrics.map((m) => ({
      keyword: m.query,
      pageUrl: m.pageUrl,
      position: m.position,
      clicks: m.clicks,
    }));
  }

  /**
   * Get page link metrics for URLs.
   */
  private async getPageLinkData(
    clientId: string,
    urls: string[]
  ): Promise<PageLinkData[]> {
    if (urls.length === 0) return [];

    const result = await this.db
      .select({
        pageUrl: pageLinks.pageUrl,
        inboundTotal: pageLinks.inboundTotal,
        inboundExactMatch: pageLinks.inboundExactMatch,
      })
      .from(pageLinks)
      .where(
        and(
          eq(pageLinks.clientId, clientId),
          inArray(pageLinks.pageUrl, urls)
        )
      );

    return result;
  }
}

/**
 * Convenience function for checking cannibalization.
 */
export async function detectKeywordCannibalization(
  db: AppDb,
  clientId: string
): Promise<CannibalizationResult> {
  const service = new CannibalizationService(db);
  return service.detectKeywordCannibalization(clientId);
}

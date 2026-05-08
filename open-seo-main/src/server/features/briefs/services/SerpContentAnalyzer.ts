/**
 * SERP Content Analyzer
 * Phase 36: Content Brief Generation - T-40-02-03
 * Phase 95-10: Consumer Integration Completion
 *
 * Fetches and analyzes competitor content to extract:
 * - Common H2 headings across top-ranking pages
 * - Word count statistics (min, max, avg)
 *
 * Uses MigrationRouter for gradual rollout from legacy to unified scraping.
 */
import * as cheerio from "cheerio";
import { getOptimizedDataForSEOFetcher } from "@/server/features/scraping/providers/OptimizedDataForSEOFetcher";
import { routeBatchRequest, type ScrapeResult } from "@/server/features/scraping";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "SerpContentAnalyzer" });

export interface H2Frequency {
  heading: string;
  frequency: number;
}

export interface WordCountStats {
  min: number;
  max: number;
  avg: number;
}

export interface SerpContentAnalysis {
  commonH2s: H2Frequency[];
  wordCountStats: WordCountStats;
  wordCounts: number[];
  analyzedUrls: number;
}

/**
 * Legacy result type from OptimizedDataForSEOFetcher.
 */
interface LegacyFetchResult {
  url: string;
  success: boolean;
  statusCode: number;
  html?: string;
}

/**
 * Transformer to convert between legacy and new result formats.
 */
const serpContentTransformer = {
  legacyToNew: (legacy: LegacyFetchResult): ScrapeResult => ({
    url: legacy.url,
    success: legacy.success,
    statusCode: legacy.statusCode,
    html: legacy.html,
    tierUsed: "dfs_basic",
    fromCache: false,
    responseTimeMs: 0,
    responseSizeBytes: legacy.html?.length ?? 0,
    estimatedCostUsd: 0.002, // DFS basic cost estimate
  }),
  newToLegacy: (newResult: ScrapeResult): LegacyFetchResult => ({
    url: newResult.url,
    success: newResult.success,
    statusCode: newResult.statusCode,
    html: newResult.html,
  }),
};

/**
 * Options for SERP content analysis.
 */
export interface AnalyzeSerpContentOptions {
  /** Client ID for cost attribution */
  clientId?: string;
  /** Workspace ID for cost attribution */
  workspaceId?: string;
}

/**
 * Analyze SERP competitor content for H2s and word counts.
 * Fetches HTML for up to 5 URLs via MigrationRouter.
 * Routes through unified ScrapingService when feature flag is active.
 *
 * @param urls - Competitor URLs from SERP results
 * @param options - Options including clientId for cost tracking
 * @returns Analysis with common H2s and word count stats
 */
export async function analyzeSerpContent(
  urls: string[],
  options: AnalyzeSerpContentOptions = {}
): Promise<SerpContentAnalysis> {
  const h2Counts = new Map<string, number>();
  const wordCounts: number[] = [];
  let analyzedUrls = 0;

  if (urls.length === 0) {
    return {
      commonH2s: [],
      wordCountStats: { min: 1500, max: 2500, avg: 2000 },
      wordCounts: [],
      analyzedUrls: 0,
    };
  }

  try {
    // Route through MigrationRouter for gradual rollout
    const urlsToProcess = urls.slice(0, 5);
    const resultsMap = await routeBatchRequest<LegacyFetchResult>({
      feature: "serpContent",
      urls: urlsToProcess,
      legacyBatchFn: async (urlsToFetch) => {
        // Legacy path: use OptimizedDataForSEOFetcher
        const fetcher = getOptimizedDataForSEOFetcher();
        const batchResults = await fetcher.fetchBatch(urlsToFetch, {
          mode: "basic",
          urgency: "bulk", // Uses Standard Queue automatically
          includeRawHtml: true,
        });
        // Map results by URL - results are returned in same order as input
        const resultMap = new Map<string, LegacyFetchResult>();
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const url = urlsToFetch[i];
          resultMap.set(url, {
            url,
            success: result.success,
            statusCode: result.statusCode ?? 0,
            html: result.html,
          });
        }
        return resultMap;
      },
      scrapeOptions: {
        feature: "serpContent",
        includeHtml: true,
        includeParsedData: true,
        clientId: options.clientId,
        workspaceId: options.workspaceId,
      },
      transformer: serpContentTransformer,
      concurrency: 5,
    });

    // Process results (same logic for both paths)
    for (const result of resultsMap.values()) {
      if (!result.success || !result.html || result.statusCode !== 200) {
        continue;
      }

      analyzedUrls++;
      const $ = cheerio.load(result.html);

      // Extract H2s
      $("h2").each((_, el) => {
        const text = $(el).text().trim();
        const normalized = text.toLowerCase();
        if (normalized.length >= 5 && normalized.length <= 100) {
          h2Counts.set(normalized, (h2Counts.get(normalized) || 0) + 1);
        }
      });

      // Extract word count from main content
      $("script, style, nav, footer, header, aside, .sidebar, .comments, .advertisement").remove();
      const content =
        $("article, main, .content, .post-content, [role='main']").first().text() ||
        $("body").text();
      const words = content.split(/\s+/).filter((w) => w.length > 0);

      if (words.length > 100) {
        wordCounts.push(words.length);
      }
    }

    log.info("SERP content analysis complete", {
      analyzedUrls,
      h2Count: h2Counts.size,
      wordCountSamples: wordCounts.length,
    });
  } catch (error) {
    log.error(
      "SERP content analysis failed",
      error instanceof Error ? error : new Error(String(error))
    );
  }

  return {
    commonH2s: Array.from(h2Counts.entries())
      .filter(([, count]) => count >= 2)
      .map(([heading, frequency]) => ({ heading, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10),
    wordCountStats:
      wordCounts.length > 0
        ? {
            min: Math.min(...wordCounts),
            max: Math.max(...wordCounts),
            avg: Math.round(
              wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
            ),
          }
        : { min: 1500, max: 2500, avg: 2000 },
    wordCounts,
    analyzedUrls,
  };
}

/**
 * Extract common H2s from competitor pages.
 * Wrapper for backward compatibility with SerpAnalyzer.
 */
export async function extractCommonH2s(urls: string[]): Promise<H2Frequency[]> {
  const analysis = await analyzeSerpContent(urls);
  return analysis.commonH2s;
}

/**
 * Calculate word count statistics from competitor pages.
 * Wrapper for backward compatibility with SerpAnalyzer.
 */
export async function calculateWordCountStats(
  urls: string[]
): Promise<WordCountStats> {
  const analysis = await analyzeSerpContent(urls);
  return analysis.wordCountStats;
}

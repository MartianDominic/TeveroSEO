/**
 * SERP Content Analyzer
 * Phase 36: Content Brief Generation - T-40-02-03
 *
 * Fetches and analyzes competitor content to extract:
 * - Common H2 headings across top-ranking pages
 * - Word count statistics (min, max, avg)
 *
 * Single API call fetches HTML for all URLs, reducing costs.
 */
import * as cheerio from "cheerio";
import { fetchOnPageInstantPages } from "@/server/lib/dataforseo";
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
 * Analyze SERP competitor content for H2s and word counts.
 * Fetches HTML for up to 5 URLs in a single API call.
 *
 * @param urls - Competitor URLs from SERP results
 * @returns Analysis with common H2s and word count stats
 */
export async function analyzeSerpContent(
  urls: string[]
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
    const results = await fetchOnPageInstantPages(urls.slice(0, 5));

    for (const result of results) {
      if (!result.fetch_html || result.status_code !== 200) {
        continue;
      }

      analyzedUrls++;
      const $ = cheerio.load(result.fetch_html);

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

/**
 * Relevance calculation for keyword-page mapping.
 * Scores title/H1/content/URL overlap to determine best page match.
 *
 * Weights based on Kyle Roof's research (Factor Group A = 60-70%):
 * - Title: 35 points
 * - H1: 25 points
 * - First 100 words: 15 points
 * - URL slug: 15 points
 * - Body content frequency: 10 points (capped)
 */

export interface PageContent {
  url: string;
  title: string | null;
  h1?: string | null; // From headingOrderJson or direct extraction
  content?: string; // Full body text or first 500 words
  wordCount?: number;
}

export interface RelevanceResult {
  score: number; // 0-100
  breakdown: {
    title: number;
    h1: number;
    firstContent: number;
    urlSlug: number;
    bodyFrequency: number;
  };
  matchDetails: string[];
}

/**
 * Calculate relevance score between a keyword and a page.
 * Returns 0-100 score based on keyword presence in key locations.
 */
export function calculateRelevance(
  keyword: string,
  page: PageContent,
): RelevanceResult {
  const keywordLower = keyword.toLowerCase().trim();
  const breakdown = {
    title: 0,
    h1: 0,
    firstContent: 0,
    urlSlug: 0,
    bodyFrequency: 0,
  };
  const matchDetails: string[] = [];

  // 1. Title match (35 points max)
  if (page.title) {
    const titleLower = page.title.toLowerCase();
    if (titleLower.includes(keywordLower)) {
      // Exact match in first 30 chars = full points
      const position = titleLower.indexOf(keywordLower);
      if (position < 30) {
        breakdown.title = 35;
        matchDetails.push(`Keyword in title (position ${position})`);
      } else {
        breakdown.title = 25;
        matchDetails.push(`Keyword in title (late position)`);
      }
    }
  }

  // 2. H1 match (25 points max)
  if (page.h1) {
    const h1Lower = page.h1.toLowerCase();
    if (h1Lower.includes(keywordLower)) {
      breakdown.h1 = 25;
      matchDetails.push("Keyword in H1");
    }
  }

  // 3. First 100 words / first content (15 points)
  if (page.content) {
    const contentLower = page.content.toLowerCase();
    const first100Words = contentLower.split(/\s+/).slice(0, 100).join(" ");
    if (first100Words.includes(keywordLower)) {
      breakdown.firstContent = 15;
      matchDetails.push("Keyword in first 100 words");
    }
  }

  // 4. URL slug match (15 points)
  try {
    const url = new URL(page.url);
    // Replace hyphens and underscores with spaces for matching
    const pathLower = url.pathname.toLowerCase().replace(/[-_]/g, " ");
    // Also convert keyword spaces to spaces for consistent matching
    const keywordForUrl = keywordLower.replace(/ /g, " ");
    if (pathLower.includes(keywordForUrl)) {
      breakdown.urlSlug = 15;
      matchDetails.push("Keyword in URL");
    }
  } catch {
    // Invalid URL, skip
  }

  // 5. Body frequency (10 points max, capped at 3% density)
  if (page.content && page.wordCount && page.wordCount > 0) {
    const contentLower = page.content.toLowerCase();
    const keywordWords = keywordLower.split(/\s+/).length;
    const regex = new RegExp(escapeRegex(keywordLower), "gi");
    const matches = contentLower.match(regex);
    const occurrences = matches?.length ?? 0;

    // Density = (keyword occurrences * keyword word count) / total words
    const density = (occurrences * keywordWords) / page.wordCount;

    // Score: 0-3% density = 0-10 points, capped at 3%
    const densityScore = Math.min(density / 0.03, 1) * 10;
    breakdown.bodyFrequency = Math.round(densityScore);

    if (occurrences > 0) {
      matchDetails.push(
        `${occurrences} occurrences (${(density * 100).toFixed(1)}% density)`,
      );
    }
  }

  const score =
    breakdown.title +
    breakdown.h1 +
    breakdown.firstContent +
    breakdown.urlSlug +
    breakdown.bodyFrequency;

  return {
    score: Math.min(100, score), // Cap at 100
    breakdown,
    matchDetails,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determine if a page is a good match for a keyword.
 * Threshold of 60% based on V1-SEO-IMPLEMENTATION-SPEC.md.
 */
export function isGoodMatch(score: number): boolean {
  return score >= 60;
}

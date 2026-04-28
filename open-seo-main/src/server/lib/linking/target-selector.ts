/**
 * Target selector for internal link recommendations.
 * Phase 35-03: Target Selection
 *
 * Ranks potential link target pages based on multiple scoring factors:
 * - Link deficit (25%): How far below ideal inbound count
 * - Exact-match need (20%): Pages lacking exact-match anchors
 * - Orphan status (30%): Pages with zero inbound links
 * - Depth (15%): Pages far from homepage
 * - Relevance (20%): Keyword overlap between source and target
 */
import type {
  PageCandidate,
  ScoredCandidate,
  RankLinkTargetsParams,
} from "./types";

/**
 * Common English stopwords to exclude from keyword extraction.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "were", "will", "with", "the", "this", "but", "they",
  "have", "had", "what", "when", "where", "who", "which", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "can", "just", "should", "now", "also", "into", "our", "your",
  "about", "above", "after", "again", "against", "any", "because", "been",
  "before", "being", "below", "between", "do", "does", "doing", "down",
  "during", "here", "him", "his", "her", "if", "include", "includes", "including",
  "me", "my", "myself", "once", "out", "over", "she", "them", "then",
  "there", "these", "those", "through", "under", "until", "up", "we",
  "you", "would", "could", "may", "might", "must", "shall", "need",
]);

/**
 * Scoring weights for composite score calculation.
 */
const WEIGHTS = {
  linkDeficit: 0.25,
  exactMatch: 0.20,
  orphan: 0.30,
  depth: 0.15,
  relevance: 0.20,
} as const;

/**
 * Default values for ranking parameters.
 */
const DEFAULTS = {
  maxResults: 10,
  siteAverageInbound: 5,
  maxClickDepth: 5,
} as const;

/**
 * Extract keywords from content text, excluding stopwords.
 *
 * @param content - Text content to extract keywords from
 * @returns Array of unique lowercase keywords
 */
export function extractKeywordsFromContent(content: string): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  // Split on non-word characters
  const words = content
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3) // Filter short words
    .filter((word) => !STOPWORDS.has(word)); // Filter stopwords

  // Remove duplicates
  return [...new Set(words)];
}

/**
 * Compute Jaccard similarity between two keyword sets.
 *
 * @param sourceKeywords - Keywords from source page
 * @param targetKeywords - Keywords from target page
 * @returns Similarity score between 0 and 1
 */
export function computeKeywordOverlap(
  sourceKeywords: string[],
  targetKeywords: string[]
): number {
  if (sourceKeywords.length === 0 || targetKeywords.length === 0) {
    return 0;
  }

  const sourceSet = new Set(sourceKeywords);
  const targetSet = new Set(targetKeywords);

  // Intersection
  const intersection = new Set([...sourceSet].filter((x) => targetSet.has(x)));

  // Union
  const union = new Set([...sourceSet, ...targetSet]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * Compute link deficit score (0-100).
 * Higher score = page needs more inbound links.
 *
 * @param currentInbound - Current inbound link count
 * @param idealInbound - Ideal/target inbound link count
 * @returns Score from 0-100
 */
export function computeLinkDeficitScore(
  currentInbound: number,
  idealInbound: number
): number {
  if (idealInbound <= 0) {
    return 0;
  }

  if (currentInbound >= idealInbound) {
    return 0;
  }

  // Calculate deficit as percentage of ideal
  const deficit = (idealInbound - currentInbound) / idealInbound;
  return Math.round(deficit * 100);
}

/**
 * Compute exact-match need score (0-100).
 * Higher score = page needs exact-match anchor text.
 *
 * @param exactMatchCount - Current count of exact-match anchors
 * @param hasTargetKeyword - Whether page has a target keyword defined
 * @returns Score from 0-100
 */
export function computeExactMatchScore(
  exactMatchCount: number,
  hasTargetKeyword: boolean
): number {
  if (!hasTargetKeyword) {
    return 0;
  }

  if (exactMatchCount === 0) {
    return 100;
  }

  if (exactMatchCount >= 3) {
    return 0;
  }

  // Scale: 1 exact = 66, 2 exact = 33
  return Math.round((1 - exactMatchCount / 3) * 100);
}

/**
 * Compute orphan score (0 or 100).
 * Orphan pages get full bonus.
 *
 * @param isOrphan - Whether page is an orphan (0 inbound links)
 * @returns 100 for orphans, 0 otherwise
 */
export function computeOrphanScore(isOrphan: boolean): number {
  return isOrphan ? 100 : 0;
}

/**
 * Compute depth score (0-100).
 * Higher score = page is deeper in site hierarchy.
 *
 * @param clickDepth - Current click depth from homepage
 * @param maxClickDepth - Maximum depth threshold
 * @returns Score from 0-100
 */
export function computeDepthScore(
  clickDepth: number | null,
  maxClickDepth: number
): number {
  if (clickDepth === null || clickDepth <= 1 || maxClickDepth <= 1) {
    return 0;
  }

  // Linear scale: depth 1 = 0, depth max = 100
  const score = ((clickDepth - 1) / (maxClickDepth - 1)) * 100;
  return Math.min(100, Math.round(score));
}

/**
 * Compute relevance score from keyword overlap (0-100).
 *
 * @param keywordOverlap - Jaccard similarity (0-1)
 * @returns Score from 0-100
 */
export function computeRelevanceScore(keywordOverlap: number): number {
  return Math.round(keywordOverlap * 100);
}

/**
 * Generate human-readable reasons for a link suggestion.
 */
function generateReasons(
  candidate: PageCandidate,
  scores: {
    linkDeficit: number;
    exactMatch: number;
    orphan: number;
    depth: number;
    relevance: number;
  }
): string[] {
  const reasons: string[] = [];

  if (scores.orphan === 100) {
    reasons.push("Orphan page with no inbound links - high priority for rescue");
  }

  if (scores.linkDeficit >= 80) {
    reasons.push(
      `Severe link deficit: ${candidate.inboundCount} inbound vs ${candidate.idealInboundCount} ideal`
    );
  } else if (scores.linkDeficit >= 50) {
    reasons.push(
      `Link deficit: needs ${candidate.idealInboundCount - candidate.inboundCount} more inbound links`
    );
  }

  if (scores.exactMatch >= 80) {
    reasons.push(
      `No exact-match anchor text for keyword "${candidate.targetKeyword}"`
    );
  } else if (scores.exactMatch >= 50) {
    reasons.push("Low exact-match anchor diversity");
  }

  if (scores.depth >= 80) {
    reasons.push(`Deep page at click depth ${candidate.clickDepth} - needs shortcut`);
  } else if (scores.depth >= 50) {
    reasons.push(`Page depth ${candidate.clickDepth} could be reduced`);
  }

  if (scores.relevance >= 70) {
    reasons.push("High topical relevance to source page");
  } else if (scores.relevance >= 40) {
    reasons.push("Moderate topical relevance to source page");
  }

  return reasons;
}

/**
 * Rank potential link target pages based on multiple scoring factors.
 *
 * @param params - Ranking parameters
 * @returns Sorted array of scored candidates (highest score first)
 */
export function rankLinkTargets(params: RankLinkTargetsParams): ScoredCandidate[] {
  const {
    sourcePage,
    candidates,
    maxResults = DEFAULTS.maxResults,
    siteAverageInbound = DEFAULTS.siteAverageInbound,
    maxClickDepth = DEFAULTS.maxClickDepth,
  } = params;

  if (candidates.length === 0) {
    return [];
  }

  // Extract source page keywords
  const sourceKeywords = extractKeywordsFromContent(sourcePage.bodyText);

  // Filter out source page from candidates
  const filteredCandidates = candidates.filter(
    (c) => c.pageUrl !== sourcePage.pageUrl && c.pageId !== sourcePage.pageId
  );

  // Score each candidate
  const scoredCandidates: ScoredCandidate[] = filteredCandidates.map((candidate) => {
    // Use provided ideal or site average
    const idealInbound = candidate.idealInboundCount || siteAverageInbound;

    // Compute individual scores
    const linkDeficitScore = computeLinkDeficitScore(candidate.inboundCount, idealInbound);
    const exactMatchScore = computeExactMatchScore(
      0, // TODO: Get actual exact-match count from pageLinks
      candidate.targetKeyword !== null
    );
    const orphanScore = computeOrphanScore(candidate.isOrphan);
    const depthScore = computeDepthScore(candidate.clickDepth, maxClickDepth);

    // Compute relevance from keyword overlap
    const keywordOverlap = computeKeywordOverlap(sourceKeywords, candidate.contentKeywords);
    const relevanceScore = computeRelevanceScore(keywordOverlap);

    // Compute weighted composite score
    const score =
      WEIGHTS.linkDeficit * linkDeficitScore +
      WEIGHTS.exactMatch * exactMatchScore +
      WEIGHTS.orphan * orphanScore +
      WEIGHTS.depth * depthScore +
      WEIGHTS.relevance * relevanceScore;

    // Generate reasons
    const reasons = generateReasons(candidate, {
      linkDeficit: linkDeficitScore,
      exactMatch: exactMatchScore,
      orphan: orphanScore,
      depth: depthScore,
      relevance: relevanceScore,
    });

    return {
      pageId: candidate.pageId,
      pageUrl: candidate.pageUrl,
      pageTitle: candidate.pageTitle,
      targetKeyword: candidate.targetKeyword,
      score: Math.round(score * 10) / 10, // Round to 1 decimal
      linkDeficitScore,
      exactMatchScore,
      orphanScore,
      depthScore,
      relevanceScore,
      reasons,
    };
  });

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Return top N results
  return scoredCandidates.slice(0, maxResults);
}

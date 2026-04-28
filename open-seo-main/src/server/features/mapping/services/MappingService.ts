/**
 * Keyword-to-page mapping service.
 * Implements the decision logic from V1-SEO-IMPLEMENTATION-SPEC.md Phase 3.
 *
 * Decision tree:
 * 1. Already ranking? -> Keep that page (optimize)
 * 2. Best existing page match (>60% relevance)? -> Use that page (optimize)
 * 3. No good match? -> Flag for new content (create)
 */
import {
  calculateRelevance,
  isGoodMatch,
  type PageContent,
} from "./relevance";
import type { KeywordPageMappingInsert } from "@/db/schema";

// Lazy-load repository to avoid triggering DB connection in pure function tests
async function getRepository() {
  const { MappingRepository } = await import(
    "../repositories/MappingRepository"
  );
  return MappingRepository;
}

export interface KeywordData {
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  currentPosition?: number | null; // From GSC/rankings (1-100, null if not ranking)
  currentUrl?: string | null; // Which page currently ranks
}

export interface MappingResult {
  keyword: string;
  targetUrl: string | null;
  action: "optimize" | "create";
  relevanceScore: number | null;
  reason: string;
  matchDetails?: string[];
}

/**
 * Map a single keyword to the best page.
 */
export function mapKeywordToPage(
  keyword: KeywordData,
  pages: PageContent[],
): MappingResult {
  // Decision 1: Already ranking at position <= 20?
  if (
    keyword.currentPosition &&
    keyword.currentPosition <= 20 &&
    keyword.currentUrl
  ) {
    return {
      keyword: keyword.keyword,
      targetUrl: keyword.currentUrl,
      action: "optimize",
      relevanceScore: null, // Not calculated when already ranking
      reason: `Already position ${keyword.currentPosition}`,
    };
  }

  // Decision 2: Find best existing page match
  if (pages.length === 0) {
    return {
      keyword: keyword.keyword,
      targetUrl: null,
      action: "create",
      relevanceScore: 0,
      reason: "No pages in inventory",
    };
  }

  // Calculate relevance for all pages
  const scored = pages.map((page) => ({
    page,
    result: calculateRelevance(keyword.keyword, page),
  }));

  // Sort by relevance score descending
  scored.sort((a, b) => b.result.score - a.result.score);

  const bestMatch = scored[0];

  // Decision 3: Is best match good enough (>= 60%)?
  if (isGoodMatch(bestMatch.result.score)) {
    return {
      keyword: keyword.keyword,
      targetUrl: bestMatch.page.url,
      action: "optimize",
      relevanceScore: bestMatch.result.score,
      reason: `Best match (${Math.round(bestMatch.result.score)}% relevant)`,
      matchDetails: bestMatch.result.matchDetails,
    };
  }

  // Decision 4: No good match - flag for new content
  return {
    keyword: keyword.keyword,
    targetUrl: null,
    action: "create",
    relevanceScore: bestMatch.result.score, // Show best score even if below threshold
    reason: `No existing page matches (best: ${Math.round(bestMatch.result.score)}%)`,
  };
}

/**
 * Map multiple keywords to pages (batch operation).
 */
export function mapKeywordsToPages(
  keywords: KeywordData[],
  pages: PageContent[],
): MappingResult[] {
  return keywords.map((kw) => mapKeywordToPage(kw, pages));
}

/**
 * Persist mapping results to database.
 */
export async function saveMappings(
  projectId: string,
  mappings: MappingResult[],
  keywordData: Map<string, KeywordData>,
): Promise<void> {
  const inserts: KeywordPageMappingInsert[] = mappings.map((m) => {
    const kw = keywordData.get(m.keyword);
    return {
      id: crypto.randomUUID(),
      projectId,
      keyword: m.keyword,
      targetUrl: m.targetUrl,
      action: m.action,
      relevanceScore: m.relevanceScore,
      reason: m.reason,
      searchVolume: kw?.searchVolume ?? null,
      difficulty: kw?.difficulty ?? null,
      currentPosition: kw?.currentPosition ?? null,
      currentUrl: kw?.currentUrl ?? null,
      isManualOverride: false,
    };
  });

  const repo = await getRepository();
  await repo.bulkUpsertMappings(inserts);
}

/**
 * Get all mappings for a project.
 */
export async function getMappings(
  projectId: string,
  opts?: { action?: "optimize" | "create" },
) {
  const repo = await getRepository();
  return repo.getMappingsByProject(projectId, opts);
}

/**
 * Manual override: reassign keyword to different page.
 */
export async function overrideMapping(
  projectId: string,
  keyword: string,
  newTargetUrl: string | null,
): Promise<void> {
  const action = newTargetUrl ? "optimize" : "create";
  const repo = await getRepository();
  await repo.updateMappingTarget(projectId, keyword, newTargetUrl, action);
}

/**
 * Get mapping statistics for a project.
 */
export async function getMappingStats(projectId: string) {
  const repo = await getRepository();
  return repo.countMappingsByAction(projectId);
}

export const MappingService = {
  mapKeywordToPage,
  mapKeywordsToPages,
  saveMappings,
  getMappings,
  overrideMapping,
  getMappingStats,
} as const;

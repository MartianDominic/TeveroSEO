"use server";

import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";

interface KeywordParams {
  projectId: string;
  clientId: string;
}

interface ResearchKeywordsParams extends KeywordParams {
  keyword: string;
  locationCode?: number;
  resultLimit?: number;
  mode?: string;
  sortField?: string;
  sortDir?: string;
}

interface SaveKeywordsParams extends KeywordParams {
  keywords: unknown[];
}

interface RemoveSavedKeywordParams extends KeywordParams {
  savedKeywordId: string;
}

interface SerpAnalysisParams extends KeywordParams {
  keyword: string;
  locationCode?: number;
}

/**
 * Build query string with client_id and project_id.
 */
function buildQuery(params: KeywordParams): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    project_id: params.projectId,
  });
  return query.toString();
}

/**
 * Research keywords using DataForSEO.
 */
export async function researchKeywords(params: ResearchKeywordsParams): Promise<unknown> {
  const query = buildQuery(params);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "research",
    keyword: params.keyword,
    locationCode: params.locationCode,
    resultLimit: params.resultLimit,
    mode: params.mode,
    sortField: params.sortField,
    sortDir: params.sortDir,
  });
}

/**
 * Save keywords to the project.
 */
export async function saveKeywords(params: SaveKeywordsParams): Promise<unknown> {
  const query = buildQuery(params);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "save",
    keywords: params.keywords,
  });
}

/**
 * Get saved keywords for a project.
 */
export async function getSavedKeywords(params: KeywordParams): Promise<{ rows: unknown[] }> {
  const query = buildQuery(params);
  return getOpenSeo<{ rows: unknown[] }>(`/api/seo/keywords?${query}`);
}

/**
 * Remove a saved keyword.
 */
export async function removeSavedKeyword(params: RemoveSavedKeywordParams): Promise<unknown> {
  const query = buildQuery(params);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "remove",
    savedKeywordId: params.savedKeywordId,
  });
}

/**
 * Get SERP analysis for a keyword.
 */
export async function getSerpAnalysis(params: SerpAnalysisParams): Promise<unknown> {
  const query = buildQuery(params);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "serp",
    keyword: params.keyword,
    locationCode: params.locationCode,
  });
}

// ---------- Ranking History Actions (Phase 17) ----------

interface GetKeywordHistoryParams {
  keywordId: string;
  clientId: string;
  days?: number;
}

interface GetKeywordLatestParams {
  keywordId: string;
  clientId: string;
}

/**
 * Get ranking history for a keyword (30 or 90 days).
 */
export async function getKeywordHistory({
  keywordId,
  clientId,
  days = 30,
}: GetKeywordHistoryParams): Promise<{
  rows: Array<{
    date: string;
    position: number;
    previousPosition: number | null;
    url: string | null;
    serpFeatures: string[] | null;
  }>;
}> {
  const query = new URLSearchParams({
    client_id: clientId,
    keyword_id: keywordId,
    action: "history",
    days: days.toString(),
  });
  return getOpenSeo(`/api/seo/keyword-rankings?${query}`);
}

/**
 * Get latest ranking with change indicator.
 */
export async function getKeywordLatestRanking({
  keywordId,
  clientId,
}: GetKeywordLatestParams): Promise<{
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  url: string | null;
  serpFeatures: string[] | null;
  date: string | null;
}> {
  const query = new URLSearchParams({
    client_id: clientId,
    keyword_id: keywordId,
    action: "latest",
  });
  return getOpenSeo(`/api/seo/keyword-rankings?${query}`);
}

/**
 * Get saved keywords with their recent rankings for sparklines.
 */
export async function getSavedKeywordsWithRankings(
  params: KeywordParams,
): Promise<{
  rows: Array<{
    id: string;
    keyword: string;
    searchVolume: number;
    competition: number;
    savedAt: string;
    trackingEnabled: boolean;
    rankings: Array<{
      date: string;
      position: number;
      previousPosition: number | null;
    }>;
  }>;
}> {
  const query = new URLSearchParams({
    client_id: params.clientId,
    project_id: params.projectId,
    action: "with-rankings",
  });
  return getOpenSeo(`/api/seo/keyword-rankings?${query}`);
}

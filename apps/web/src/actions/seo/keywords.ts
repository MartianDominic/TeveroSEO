"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID format");
const projectIdSchema = z.string().uuid("Invalid project ID format");
const keywordIdSchema = z.string().uuid("Invalid keyword ID format");

const keywordParamsSchema = z.object({
  projectId: projectIdSchema,
  clientId: clientIdSchema,
});

// DataForSEO location codes are integers (e.g., 2840 for US, 2826 for UK)
const locationCodeSchema = z.number().int().min(1000).max(99999).optional();

const researchKeywordsParamsSchema = keywordParamsSchema.extend({
  keyword: z.string().min(1, "Keyword is required").max(200, "Keyword too long"),
  locationCode: locationCodeSchema,
  resultLimit: z.number().int().min(1).max(1000).optional(),
  mode: z.enum(["related", "suggestions", "questions"]).optional(),
  sortField: z.enum(["search_volume", "competition", "cpc"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const saveKeywordsParamsSchema = keywordParamsSchema.extend({
  keywords: z.array(z.object({
    keyword: z.string().min(1).max(200),
    searchVolume: z.number().int().min(0).optional(),
    competition: z.number().min(0).max(1).optional(),
    cpc: z.number().min(0).optional(),
  })).min(1, "At least one keyword is required").max(500, "Maximum 500 keywords"),
});

const removeSavedKeywordParamsSchema = keywordParamsSchema.extend({
  savedKeywordId: keywordIdSchema,
});

const serpAnalysisParamsSchema = keywordParamsSchema.extend({
  keyword: z.string().min(1, "Keyword is required").max(200, "Keyword too long"),
  locationCode: locationCodeSchema,
});

const getKeywordHistoryParamsSchema = z.object({
  keywordId: keywordIdSchema,
  clientId: clientIdSchema,
  days: z.number().int().min(1).max(365).optional(),
});

const getKeywordLatestParamsSchema = z.object({
  keywordId: keywordIdSchema,
  clientId: clientIdSchema,
});

// Type inference from Zod schemas
type KeywordParams = z.infer<typeof keywordParamsSchema>;
type ResearchKeywordsParams = z.infer<typeof researchKeywordsParamsSchema>;
type SaveKeywordsParams = z.infer<typeof saveKeywordsParamsSchema>;
type RemoveSavedKeywordParams = z.infer<typeof removeSavedKeywordParamsSchema>;
type SerpAnalysisParams = z.infer<typeof serpAnalysisParamsSchema>;
type GetKeywordHistoryParams = z.infer<typeof getKeywordHistoryParamsSchema>;
type GetKeywordLatestParams = z.infer<typeof getKeywordLatestParamsSchema>;

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
 * Rate limited: 20 requests per hour (external API cost).
 */
export async function researchKeywords(params: ResearchKeywordsParams): Promise<unknown> {
  const validated = researchKeywordsParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  // Rate limit: DataForSEO calls have direct cost
  await checkActionRateLimit("keywords", auth.userId);

  const query = buildQuery(validated);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "research",
    keyword: validated.keyword,
    locationCode: validated.locationCode,
    resultLimit: validated.resultLimit,
    mode: validated.mode,
    sortField: validated.sortField,
    sortDir: validated.sortDir,
  });
}

/**
 * Save keywords to the project.
 */
export async function saveKeywords(params: SaveKeywordsParams): Promise<unknown> {
  const validated = saveKeywordsParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "save",
    keywords: validated.keywords,
  });
}

/**
 * Get saved keywords for a project.
 */
export async function getSavedKeywords(params: KeywordParams): Promise<{ rows: unknown[] }> {
  const validated = keywordParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return getOpenSeo<{ rows: unknown[] }>(`/api/seo/keywords?${query}`);
}

/**
 * Remove a saved keyword.
 */
export async function removeSavedKeyword(params: RemoveSavedKeywordParams): Promise<unknown> {
  const validated = removeSavedKeywordParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "remove",
    savedKeywordId: validated.savedKeywordId,
  });
}

/**
 * Get SERP analysis for a keyword.
 * Rate limited: 20 requests per hour (external API cost).
 */
export async function getSerpAnalysis(params: SerpAnalysisParams): Promise<unknown> {
  const validated = serpAnalysisParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  // Rate limit: DataForSEO SERP analysis has direct cost
  await checkActionRateLimit("keywords", auth.userId);

  const query = buildQuery(validated);
  return postOpenSeo(`/api/seo/keywords?${query}`, {
    action: "serp",
    keyword: validated.keyword,
    locationCode: validated.locationCode,
  });
}

// ---------- Ranking History Actions (Phase 17) ----------

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
  const validated = getKeywordHistoryParamsSchema.parse({ keywordId, clientId, days });
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = new URLSearchParams({
    client_id: validated.clientId,
    keyword_id: validated.keywordId,
    action: "history",
    days: (validated.days ?? 30).toString(),
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
  const validated = getKeywordLatestParamsSchema.parse({ keywordId, clientId });
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = new URLSearchParams({
    client_id: validated.clientId,
    keyword_id: validated.keywordId,
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
  const validated = keywordParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = new URLSearchParams({
    client_id: validated.clientId,
    project_id: validated.projectId,
    action: "with-rankings",
  });
  return getOpenSeo(`/api/seo/keyword-rankings?${query}`);
}

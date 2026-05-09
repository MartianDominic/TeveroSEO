"use server";

import { z } from "zod";

import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";

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
export async function researchKeywords(params: ResearchKeywordsParams): Promise<ActionResult<unknown>> {
  try {
    const validated = researchKeywordsParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: DataForSEO calls have direct cost
    await checkActionRateLimit("keywords", auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo(`/api/seo/keywords?${query}`, {
      action: "research",
      keyword: validated.keyword,
      locationCode: validated.locationCode,
      resultLimit: validated.resultLimit,
      mode: validated.mode,
      sortField: validated.sortField,
      sortDir: validated.sortDir,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[researchKeywords] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid keyword research parameters",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to research keywords",
    };
  }
}

/**
 * Save keywords to the project.
 */
export async function saveKeywords(params: SaveKeywordsParams): Promise<ActionResult<unknown>> {
  try {
    const validated = saveKeywordsParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated);
    const data = await postOpenSeo(`/api/seo/keywords?${query}`, {
      action: "save",
      keywords: validated.keywords,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[saveKeywords] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid keyword data provided",
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save keywords",
    };
  }
}

/**
 * Get saved keywords for a project.
 */
export async function getSavedKeywords(params: KeywordParams): Promise<ActionResult<{ rows: unknown[] }>> {
  try {
    const validated = keywordParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated);
    const data = await getOpenSeo<{ rows: unknown[] }>(`/api/seo/keywords?${query}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[getSavedKeywords] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get saved keywords",
    };
  }
}

/**
 * Remove a saved keyword.
 */
export async function removeSavedKeyword(params: RemoveSavedKeywordParams): Promise<ActionResult<unknown>> {
  try {
    const validated = removeSavedKeywordParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = buildQuery(validated);
    const data = await postOpenSeo(`/api/seo/keywords?${query}`, {
      action: "remove",
      savedKeywordId: validated.savedKeywordId,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[removeSavedKeyword] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove keyword",
    };
  }
}

/**
 * Get SERP analysis for a keyword.
 * Rate limited: 20 requests per hour (external API cost).
 */
export async function getSerpAnalysis(params: SerpAnalysisParams): Promise<ActionResult<unknown>> {
  try {
    const validated = serpAnalysisParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: DataForSEO SERP analysis has direct cost
    await checkActionRateLimit("keywords", auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo(`/api/seo/keywords?${query}`, {
      action: "serp",
      keyword: validated.keyword,
      locationCode: validated.locationCode,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[getSerpAnalysis] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get SERP analysis",
    };
  }
}

// ---------- Ranking History Actions (Phase 17) ----------

/**
 * Get ranking history for a keyword (30 or 90 days).
 */
export async function getKeywordHistory({
  keywordId,
  clientId,
  days = 30,
}: GetKeywordHistoryParams): Promise<ActionResult<{
  rows: Array<{
    date: string;
    position: number;
    previousPosition: number | null;
    url: string | null;
    serpFeatures: string[] | null;
  }>;
}>> {
  try {
    const validated = getKeywordHistoryParamsSchema.parse({ keywordId, clientId, days });
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = new URLSearchParams({
      client_id: validated.clientId,
      keyword_id: validated.keywordId,
      action: "history",
      days: (validated.days ?? 30).toString(),
    });
    const data = await getOpenSeo<{
      rows: Array<{
        date: string;
        position: number;
        previousPosition: number | null;
        url: string | null;
        serpFeatures: string[] | null;
      }>;
    }>(`/api/seo/keyword-rankings?${query}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[getKeywordHistory] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get keyword history",
    };
  }
}

/**
 * Get latest ranking with change indicator.
 */
export async function getKeywordLatestRanking({
  keywordId,
  clientId,
}: GetKeywordLatestParams): Promise<ActionResult<{
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  url: string | null;
  serpFeatures: string[] | null;
  date: string | null;
}>> {
  try {
    const validated = getKeywordLatestParamsSchema.parse({ keywordId, clientId });
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = new URLSearchParams({
      client_id: validated.clientId,
      keyword_id: validated.keywordId,
      action: "latest",
    });
    const data = await getOpenSeo<{
      position: number | null;
      previousPosition: number | null;
      change: number | null;
      url: string | null;
      serpFeatures: string[] | null;
      date: string | null;
    }>(`/api/seo/keyword-rankings?${query}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[getKeywordLatestRanking] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get latest ranking",
    };
  }
}

/**
 * Get saved keywords with their recent rankings for sparklines.
 */
export async function getSavedKeywordsWithRankings(
  params: KeywordParams,
): Promise<ActionResult<{
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
}>> {
  try {
    const validated = keywordParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = new URLSearchParams({
      client_id: validated.clientId,
      project_id: validated.projectId,
      action: "with-rankings",
    });
    const data = await getOpenSeo<{
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
    }>(`/api/seo/keyword-rankings?${query}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[getSavedKeywordsWithRankings] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get keywords with rankings",
    };
  }
}

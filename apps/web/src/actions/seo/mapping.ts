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
const mappingParamsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  clientId: z.string().uuid("Invalid client ID format"),
});

const getMappingsParamsSchema = mappingParamsSchema.extend({
  action: z.enum(["optimize", "create"]).optional(),
});

const suggestMappingsParamsSchema = mappingParamsSchema.extend({
  includeGsc: z.boolean().optional(),
  includeSaved: z.boolean().optional(),
  includeProspect: z.boolean().optional(),
});

const overrideMappingParamsSchema = mappingParamsSchema.extend({
  keyword: z.string().min(1, "Keyword is required").max(500, "Keyword too long"),
  newTargetUrl: z.string().url("Invalid URL format").max(2048, "URL too long").nullable(),
});

interface MappingParams {
  projectId: string;
  clientId: string;
}

interface MappingItem {
  id: string;
  keyword: string;
  targetUrl: string | null;
  action: "optimize" | "create";
  relevanceScore: number | null;
  reason: string | null;
  searchVolume: number | null;
  difficulty: number | null;
  currentPosition: number | null;
  currentUrl: string | null;
  isManualOverride: boolean;
  updatedAt: string;
}

interface MappingStats {
  optimize: number;
  create: number;
  total: number;
}

interface GetMappingsResponse {
  mappings: MappingItem[];
  stats: MappingStats;
}

interface SuggestMappingsParams extends MappingParams {
  includeGsc?: boolean;
  includeSaved?: boolean;
  includeProspect?: boolean;
}

interface SuggestMappingsResponse {
  mapped: number;
  stats: MappingStats;
  aggregationStats: {
    totalKeywords: number;
    bySource: Record<string, number>;
    withSearchVolume: number;
    withPosition: number;
  };
  message: string;
}

interface OverrideMappingParams extends MappingParams {
  keyword: string;
  newTargetUrl: string | null;
}

interface OverrideMappingResponse {
  success: boolean;
  message: string;
}

/**
 * Build query string with project_id and client_id.
 */
function buildQuery(params: MappingParams, extra?: Record<string, string>): string {
  const query = new URLSearchParams({
    project_id: params.projectId,
    client_id: params.clientId,
    ...extra,
  });
  return query.toString();
}

/**
 * Get all mappings for a project.
 */
export async function getMappings(
  params: MappingParams & { action?: "optimize" | "create" }
): Promise<ActionResult<GetMappingsResponse>> {
  const parseResult = getMappingsParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const extra = validated.action ? { action: validated.action } : undefined;
    const query = buildQuery(validated, extra);
    const data = await getOpenSeo<GetMappingsResponse>(`/api/seo/keyword-mapping?${query}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[getMappings] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to fetch mappings" };
  }
}

/**
 * Suggest mappings for all unmapped keywords.
 * Rate limited: 50 operations per minute.
 */
export async function suggestMappings(
  params: SuggestMappingsParams
): Promise<ActionResult<SuggestMappingsResponse>> {
  const parseResult = suggestMappingsParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: suggestion can be CPU-intensive
    await checkActionRateLimit("mapping", auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo<SuggestMappingsResponse>(`/api/seo/keyword-mapping?${query}`, {
      action: "suggest",
      includeGsc: validated.includeGsc ?? true,
      includeSaved: validated.includeSaved ?? true,
      includeProspect: validated.includeProspect ?? true,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[suggestMappings] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to suggest mappings" };
  }
}

/**
 * Override a mapping to point to a different URL.
 * Rate limited: 50 operations per minute.
 */
export async function overrideMapping(
  params: OverrideMappingParams
): Promise<ActionResult<OverrideMappingResponse>> {
  const parseResult = overrideMappingParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: prevent bulk override abuse
    await checkActionRateLimit("mapping", auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo<OverrideMappingResponse>(`/api/seo/keyword-mapping?${query}`, {
      action: "override",
      keyword: validated.keyword,
      newTargetUrl: validated.newTargetUrl,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[overrideMapping] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to override mapping" };
  }
}

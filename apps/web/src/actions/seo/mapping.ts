"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";

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
): Promise<GetMappingsResponse> {
  const validated = getMappingsParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const extra = validated.action ? { action: validated.action } : undefined;
  const query = buildQuery(validated, extra);
  return getOpenSeo<GetMappingsResponse>(`/api/seo/keyword-mapping?${query}`);
}

/**
 * Suggest mappings for all unmapped keywords.
 * Rate limited: 50 operations per minute.
 */
export async function suggestMappings(
  params: SuggestMappingsParams
): Promise<SuggestMappingsResponse> {
  const validated = suggestMappingsParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  // Rate limit: suggestion can be CPU-intensive
  await checkActionRateLimit("mapping", auth.userId);

  const query = buildQuery(validated);
  return postOpenSeo<SuggestMappingsResponse>(`/api/seo/keyword-mapping?${query}`, {
    action: "suggest",
    includeGsc: validated.includeGsc ?? true,
    includeSaved: validated.includeSaved ?? true,
    includeProspect: validated.includeProspect ?? true,
  });
}

/**
 * Override a mapping to point to a different URL.
 * Rate limited: 50 operations per minute.
 */
export async function overrideMapping(
  params: OverrideMappingParams
): Promise<OverrideMappingResponse> {
  const validated = overrideMappingParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  // Rate limit: prevent bulk override abuse
  await checkActionRateLimit("mapping", auth.userId);

  const query = buildQuery(validated);
  return postOpenSeo<OverrideMappingResponse>(`/api/seo/keyword-mapping?${query}`, {
    action: "override",
    keyword: validated.keyword,
    newTargetUrl: validated.newTargetUrl,
  });
}

"use server";

import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";

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
  const extra = params.action ? { action: params.action } : undefined;
  const query = buildQuery(params, extra);
  return getOpenSeo<GetMappingsResponse>(`/api/seo/keyword-mapping?${query}`);
}

/**
 * Suggest mappings for all unmapped keywords.
 */
export async function suggestMappings(
  params: SuggestMappingsParams
): Promise<SuggestMappingsResponse> {
  const query = buildQuery(params);
  return postOpenSeo<SuggestMappingsResponse>(`/api/seo/keyword-mapping?${query}`, {
    action: "suggest",
    includeGsc: params.includeGsc ?? true,
    includeSaved: params.includeSaved ?? true,
    includeProspect: params.includeProspect ?? true,
  });
}

/**
 * Override a mapping to point to a different URL.
 */
export async function overrideMapping(
  params: OverrideMappingParams
): Promise<OverrideMappingResponse> {
  const query = buildQuery(params);
  return postOpenSeo<OverrideMappingResponse>(`/api/seo/keyword-mapping?${query}`, {
    action: "override",
    keyword: params.keyword,
    newTargetUrl: params.newTargetUrl,
  });
}

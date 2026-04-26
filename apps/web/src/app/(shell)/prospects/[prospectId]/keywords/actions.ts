"use server";

/**
 * Keyword List Server Actions
 * Phase 43-04: Prioritization Engine + UI
 */

export interface ProspectKeyword {
  id: string;
  keyword: string;
  source: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  currentPosition: number | null;
  tier: string | null;
  quickWinType: string | null;
  compositeScore: number | null;
  relevanceScore: number | null;
  mappedUrl: string | null;
}

export interface ScoreWeights {
  volume: number;
  competition: number;
  relevance: number;
  focus: number;
  position: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  volume: 0.15,
  competition: 0.1,
  relevance: 0.25,
  focus: 0.35,
  position: 0.15,
};

export interface KeywordListResponse {
  keywords: ProspectKeyword[];
  total: number;
  filtered: number;
  tierCounts: Record<string, number>;
}

export interface PrioritizationResult {
  keywordsProcessed: number;
  tierCounts: Record<string, number>;
  quickWinCounts: {
    strikingDistance: number;
    lowHanging: number;
    freshOpportunity: number;
  };
}

/**
 * Fetch keywords for a prospect with optional filtering.
 */
export async function getKeywords(
  prospectId: string,
  options?: {
    tier?: string;
    quickWin?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }
): Promise<KeywordListResponse> {
  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";
  const params = new URLSearchParams();

  if (options?.tier) params.set("tier", options.tier);
  if (options?.quickWin) params.set("quickWin", "true");
  if (options?.sortBy) params.set("sortBy", options.sortBy);
  if (options?.sortOrder) params.set("sortOrder", options.sortOrder);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const response = await fetch(
    `${openSeoUrl}/api/prospects/${prospectId}/keywords?${params}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to fetch keywords" }));
    throw new Error(error.error || "Failed to fetch keywords");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Run prioritization algorithm on all keywords for a prospect.
 */
export async function prioritizeKeywords(
  prospectId: string,
  weights?: ScoreWeights
): Promise<PrioritizationResult> {
  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  const response = await fetch(
    `${openSeoUrl}/api/prospects/${prospectId}/keywords/prioritize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Prioritization failed" }));
    throw new Error(error.error || "Prioritization failed");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Bulk update tier for selected keywords.
 */
export async function bulkUpdateTier(
  prospectId: string,
  keywordIds: string[],
  tier: string
): Promise<{ updated: number }> {
  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  const response = await fetch(
    `${openSeoUrl}/api/prospects/${prospectId}/keywords`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywordIds, tier }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Update failed" }));
    throw new Error(error.error || "Update failed");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Export keywords to CSV format.
 */
export async function exportKeywordsCsv(keywords: ProspectKeyword[]): Promise<string> {
  const headers = [
    "Keyword",
    "Volume",
    "KD",
    "CPC",
    "Position",
    "Tier",
    "Quick Win",
    "Score",
    "Mapped URL",
  ];

  const rows = keywords.map((k) => [
    `"${k.keyword.replace(/"/g, '""')}"`,
    k.searchVolume ?? "",
    k.keywordDifficulty ?? "",
    k.cpc ?? "",
    k.currentPosition ?? "",
    k.tier ?? "",
    k.quickWinType ?? "",
    k.compositeScore?.toFixed(2) ?? "",
    k.mappedUrl ?? "",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

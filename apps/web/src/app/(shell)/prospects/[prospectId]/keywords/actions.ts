"use server";

/**
 * Keyword List Server Actions
 * Phase 43-04: Prioritization Engine + UI
 */

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { requireActionAuth, validateProspectOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";

import { logger } from '@/lib/logger';
/** Default timeout for API requests (30 seconds) */
const API_TIMEOUT_MS = 30000;

// Validation schemas
const prospectIdSchema = z.string().uuid("Invalid prospect ID format");
const keywordIdSchema = z.string().uuid("Invalid keyword ID format");

// Array limits
const MAX_KEYWORD_IDS = 1000;

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

// Options schema for getKeywords
const getKeywordsOptionsSchema = z.object({
  tier: z.string().max(50, "Tier too long").optional(),
  quickWin: z.boolean().optional(),
  sortBy: z.string().max(50, "Sort field too long").optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

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
): Promise<ActionResult<KeywordListResponse>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  // Validate options
  const validatedOptions = getKeywordsOptionsSchema.safeParse(options || {});
  if (!validatedOptions.success) {
    return { success: false, error: validatedOptions.error.issues[0]?.message || "Invalid options" };
  }

  try {
    // Validate ownership before fetching
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const params = new URLSearchParams();

    if (validatedOptions.data.tier) params.set("tier", validatedOptions.data.tier);
    if (validatedOptions.data.quickWin) params.set("quickWin", "true");
    if (validatedOptions.data.sortBy) params.set("sortBy", validatedOptions.data.sortBy);
    if (validatedOptions.data.sortOrder) params.set("sortOrder", validatedOptions.data.sortOrder);
    if (validatedOptions.data.limit) params.set("limit", String(validatedOptions.data.limit));
    if (validatedOptions.data.offset) params.set("offset", String(validatedOptions.data.offset));

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/keywords?${params}`,
      {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
      } catch {
        // Response wasn't JSON (e.g., 502 HTML from nginx)
      }
      logger.error("[getKeywords] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[getKeywords] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Weights schema for prioritization
const weightsSchema = z.object({
  volume: z.number().min(0).max(1).optional(),
  competition: z.number().min(0).max(1).optional(),
  relevance: z.number().min(0).max(1).optional(),
  focus: z.number().min(0).max(1).optional(),
  position: z.number().min(0).max(1).optional(),
});

/**
 * Run prioritization algorithm on all keywords for a prospect.
 */
export async function prioritizeKeywords(
  prospectId: string,
  weights?: ScoreWeights
): Promise<ActionResult<PrioritizationResult>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  // Validate weights if provided
  if (weights) {
    const validatedWeights = weightsSchema.safeParse(weights);
    if (!validatedWeights.success) {
      return { success: false, error: validatedWeights.error.issues[0]?.message || "Invalid weights" };
    }
  }

  try {
    // Validate ownership before prioritizing
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/keywords/prioritize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ weights }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
      } catch {
        // Response wasn't JSON (e.g., 502 HTML from nginx)
      }
      logger.error("[prioritizeKeywords] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[prioritizeKeywords] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Bulk update schema with array limits
const bulkUpdateTierSchema = z.object({
  keywordIds: z.array(keywordIdSchema).min(1, "At least one keyword required").max(MAX_KEYWORD_IDS, `Maximum ${MAX_KEYWORD_IDS} keywords allowed`),
  tier: z.string().min(1, "Tier is required").max(50, "Tier name too long"),
});

/**
 * Bulk update tier for selected keywords.
 */
export async function bulkUpdateTier(
  prospectId: string,
  keywordIds: string[],
  tier: string
): Promise<ActionResult<{ updated: number }>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedProspectId = prospectIdSchema.safeParse(prospectId);
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  // Validate bulk update input with array limits
  const validatedInput = bulkUpdateTierSchema.safeParse({ keywordIds, tier });
  if (!validatedInput.success) {
    return { success: false, error: validatedInput.error.issues[0]?.message || "Invalid input" };
  }

  try {
    // Validate ownership before updating
    await validateProspectOwnership(validatedProspectId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedProspectId.data}/keywords`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ keywordIds: validatedInput.data.keywordIds, tier: validatedInput.data.tier }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
      } catch {
        // Response wasn't JSON (e.g., 502 HTML from nginx)
      }
      logger.error("[bulkUpdateTier] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[bulkUpdateTier] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Export keywords to CSV format.
 */
export async function exportKeywordsCsv(keywords: ProspectKeyword[]): Promise<string> {
  await requireActionAuth();
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

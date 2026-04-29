"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { requireActionAuth } from "@/lib/auth/action-auth";

/** Default timeout for API requests (30 seconds) */
const API_TIMEOUT_MS = 30000;

/**
 * Quick Check Server Actions
 *
 * Calls open-seo-main Quick Check API to validate keywords
 * without creating a workspace.
 */

const QuickCheckSchema = z.object({
  keywords: z.array(z.string()).min(1).max(20),
  generateShareLink: z.boolean().default(false),
});

export interface QuickCheckKeyword {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
  competitionLevel: "low" | "medium" | "high";
}

export interface QuickCheckResponse {
  keywords: QuickCheckKeyword[];
  totalVolume: number;
  costCents: number;
  cached: number;
  enriched: number;
  shareLink?: {
    token: string;
    shareUrl: string;
    expiresAt: string;
  };
}

/**
 * Check 1-20 keywords instantly without creating a workspace.
 */
export async function quickCheckKeywords(
  keywords: string[],
  generateShareLink: boolean = false
): Promise<QuickCheckResponse> {
  await requireActionAuth();
  const input = QuickCheckSchema.parse({ keywords, generateShareLink });

  const { getToken } = await auth();
  const token = await getToken();

  const response = await fetch(`${env.OPEN_SEO_URL}/api/keywords/quick-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      keywords: input.keywords,
      generateShareLink: input.generateShareLink,
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
    } catch {
      // Response wasn't JSON (e.g., 502 HTML from nginx)
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Quick check failed");
  }

  return result.data;
}

/**
 * Export keywords to CSV format.
 */
export async function exportToCsv(
  keywords: QuickCheckKeyword[]
): Promise<string> {
  await requireActionAuth();
  const headers = [
    "Keyword",
    "Search Volume",
    "Keyword Difficulty",
    "CPC",
    "Competition",
    "Competition Level",
  ];

  const rows = keywords.map((k) => [
    `"${k.keyword.replace(/"/g, '""')}"`, // Escape quotes
    k.searchVolume.toString(),
    k.keywordDifficulty.toFixed(1),
    k.cpc.toFixed(2),
    k.competition.toFixed(3),
    k.competitionLevel,
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n"
  );

  return csv;
}

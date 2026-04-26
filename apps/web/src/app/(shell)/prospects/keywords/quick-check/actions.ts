"use server";

import { z } from "zod";

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
  const input = QuickCheckSchema.parse({ keywords, generateShareLink });

  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  const response = await fetch(`${openSeoUrl}/api/keywords/quick-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keywords: input.keywords,
      generateShareLink: input.generateShareLink,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Quick check failed");
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

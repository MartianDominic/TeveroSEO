"use server";

import { z } from "zod";

/**
 * Competitor Spy Server Actions
 *
 * Calls open-seo-main Competitor Spy API to extract
 * keywords from competitor domains.
 */

const CompetitorSpySchema = z.object({
  domain: z.string().min(1),
  limit: z.number().int().min(1).max(500).default(100),
});

export interface CompetitorKeyword {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc: number;
  url: string;
  trafficShare: number;
}

export interface CompetitorSpyResponse {
  domain: string;
  keywords: CompetitorKeyword[];
  totalKeywords: number;
  estimatedTraffic: number;
  costCents: number;
  cached: boolean;
}

/**
 * Spy on a competitor domain to extract their top keywords.
 */
export async function spyOnCompetitor(
  domain: string,
  limit: number = 100
): Promise<CompetitorSpyResponse> {
  const input = CompetitorSpySchema.parse({ domain, limit });

  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  const response = await fetch(`${openSeoUrl}/api/keywords/competitor-spy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: input.domain,
      limit: input.limit,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Competitor spy failed");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Competitor spy failed");
  }

  return result.data;
}

/**
 * Export competitor keywords to CSV format.
 */
export async function exportCompetitorCsv(
  domain: string,
  keywords: CompetitorKeyword[]
): Promise<string> {
  const headers = [
    "Keyword",
    "Position",
    "Search Volume",
    "CPC",
    "Est. Traffic",
    "URL",
  ];

  const rows = keywords.map((k) => [
    `"${k.keyword.replace(/"/g, '""')}"`, // Escape quotes
    k.position.toString(),
    k.searchVolume.toString(),
    k.cpc.toFixed(2),
    Math.round(k.trafficShare).toString(),
    `"${(k.url || "").replace(/"/g, '""')}"`,
  ]);

  const csv = [
    `# Competitor: ${domain}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csv;
}

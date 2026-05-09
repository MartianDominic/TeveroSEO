"use server";

import { z } from "zod";

import { requireActionAuth } from "@/lib/auth/action-auth";
import { postOpenSeo } from "@/lib/server-fetch";

/**
 * Competitor Spy Server Actions
 *
 * Calls open-seo-main Competitor Spy API to extract
 * keywords from competitor domains.
 */

/**
 * Domain validation schema with SSRF protection.
 * Blocks localhost, internal IPs (10.x, 172.16-31.x, 192.168.x), and requires valid TLD.
 */
const INTERNAL_IP_PATTERN = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i;
const VALID_DOMAIN_PATTERN = /^[\w][\w.-]*\.[a-z]{2,}$/i;

const domainSchema = z
  .string()
  .min(1, "Domain is required")
  .max(253, "Domain too long")
  .refine((val) => !INTERNAL_IP_PATTERN.test(val), {
    message: "Internal IP addresses and localhost are not allowed",
  })
  .refine((val) => VALID_DOMAIN_PATTERN.test(val), {
    message: "Invalid domain format - must be a valid domain with TLD",
  });

const CompetitorSpySchema = z.object({
  domain: domainSchema,
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
  await requireActionAuth();
  const input = CompetitorSpySchema.parse({ domain, limit });

  const result = await postOpenSeo<{ success: boolean; data: CompetitorSpyResponse; error?: string }>(
    "/api/keywords/competitor-spy",
    {
      domain: input.domain,
      limit: input.limit,
    }
  );

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
  await requireActionAuth();
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

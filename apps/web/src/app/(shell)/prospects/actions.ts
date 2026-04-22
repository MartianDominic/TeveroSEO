"use server";

import { revalidatePath } from "next/cache";
import {
  getOpenSeo,
  postOpenSeo,
  patchOpenSeo,
  deleteOpenSeo,
} from "@/lib/server-fetch";

export interface Prospect {
  id: string;
  workspaceId: string;
  domain: string;
  companyName: string | null;
  contactEmail: string | null;
  contactName: string | null;
  industry: string | null;
  notes: string | null;
  status: "new" | "analyzing" | "analyzed" | "converted" | "archived";
  source: string | null;
  assignedTo: string | null;
  convertedClientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainMetrics {
  domainRank?: number;
  organicTraffic?: number;
  organicKeywords?: number;
  backlinks?: number;
  referringDomains?: number;
}

export interface OrganicKeywordItem {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc?: number;
  url?: string;
}

export interface BusinessInfo {
  products: string[];
  brands: string[];
  services: string[];
  location: string | null;
  targetMarket: "residential" | "commercial" | "both" | null;
  summary: string;
  confidence: number;
}

export interface ScrapedContent {
  pages: Array<{
    url: string;
    title: string;
    metaDescription: string;
    h1s: string[];
    wordCount: number;
  }>;
  businessLinks: {
    products: string | null;
    about: string | null;
    services: string | null;
    contact: string | null;
    categories: string[];
  } | null;
  businessInfo: BusinessInfo | null;
  totalCostCents: number;
  scrapedAt: string;
}

export interface OpportunityKeyword {
  keyword: string;
  category: "product" | "brand" | "service" | "commercial" | "informational";
  searchVolume: number;
  cpc: number;
  difficulty: number;
  opportunityScore: number;
  achievability?: number;
  classification?: "quick_win" | "strategic" | "long_tail";
  source: "ai_generated";
}

export interface ProspectAnalysis {
  id: string;
  prospectId: string;
  analysisType: string;
  status: string;
  targetRegion: string | null;
  targetLanguage: string | null;
  competitorDomains: string[] | null;
  domainMetrics: DomainMetrics | null;
  organicKeywords: OrganicKeywordItem[] | null;
  opportunityKeywords: OpportunityKeyword[] | null;
  scrapedContent: ScrapedContent | null;
  costCents: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ProspectWithAnalyses extends Prospect {
  analyses: ProspectAnalysis[];
}

export interface PaginatedProspects {
  data: Prospect[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Get paginated list of prospects for current workspace.
 */
export async function getProspects(options?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<PaginatedProspects> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", options.page.toString());
  if (options?.pageSize) params.set("pageSize", options.pageSize.toString());
  if (options?.status) params.set("status", options.status);

  const queryString = params.toString();
  const path = queryString ? `/api/prospects?${queryString}` : "/api/prospects";

  try {
    return await getOpenSeo<PaginatedProspects>(path);
  } catch {
    return { data: [], total: 0, page: 1, pageSize: 50 };
  }
}

/**
 * Get single prospect with analyses.
 */
export async function getProspect(id: string): Promise<ProspectWithAnalyses> {
  return getOpenSeo<ProspectWithAnalyses>(`/api/prospects/${id}`);
}

/**
 * Create a new prospect.
 */
export async function createProspectAction(data: {
  domain: string;
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  notes?: string;
  source?: string;
}): Promise<Prospect> {
  const result = await postOpenSeo<Prospect>("/api/prospects", data);
  revalidatePath("/prospects");
  return result;
}

/**
 * Update a prospect.
 */
export async function updateProspectAction(
  id: string,
  data: Partial<Prospect>,
): Promise<Prospect> {
  const result = await patchOpenSeo<Prospect>(`/api/prospects/${id}`, data);
  revalidatePath("/prospects");
  revalidatePath(`/prospects/${id}`);
  return result;
}

/**
 * Delete a prospect.
 */
export async function deleteProspectAction(id: string): Promise<void> {
  await deleteOpenSeo(`/api/prospects/${id}`);
  revalidatePath("/prospects");
}

/**
 * Trigger analysis for a prospect.
 */
export async function triggerAnalysisAction(
  prospectId: string,
  options?: {
    analysisType?: "quick_scan" | "deep_dive" | "opportunity_discovery";
    targetRegion?: string;
    targetLanguage?: string;
  },
): Promise<{ analysisId: string; jobId: string }> {
  const result = await postOpenSeo<{ analysisId: string; jobId: string }>(
    `/api/prospects/${prospectId}/analyze`,
    {
      analysisType: options?.analysisType ?? "quick_scan",
      targetRegion: options?.targetRegion ?? "US",
      targetLanguage: options?.targetLanguage ?? "en",
    },
  );

  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath("/prospects");
  return result;
}

/**
 * Get remaining analyses for today.
 */
export async function getRemainingAnalyses(): Promise<number> {
  try {
    const result = await getOpenSeo<{ remaining: number }>(
      "/api/prospects/rate-limit",
    );
    return result.remaining;
  } catch {
    return 10;
  }
}

/**
 * Bulk queue analysis for multiple prospects.
 * Respects daily quota - queues up to remaining limit.
 */
export async function bulkAnalyzeAction(
  prospectIds: string[],
  options?: {
    analysisType?: "quick_scan" | "deep_dive" | "opportunity_discovery";
    targetRegion?: string;
    targetLanguage?: string;
  },
): Promise<{
  queuedCount: number;
  skippedCount: number;
  queuedIds: string[];
  skippedIds: string[];
  remainingQuota: number;
}> {
  const result = await postOpenSeo<{
    queuedCount: number;
    skippedCount: number;
    queuedIds: string[];
    skippedIds: string[];
    remainingQuota: number;
  }>("/api/prospects/bulk-analyze", {
    prospectIds,
    analysisType: options?.analysisType ?? "quick_scan",
    targetRegion: options?.targetRegion ?? "US",
    targetLanguage: options?.targetLanguage ?? "en",
  });

  revalidatePath("/prospects");
  return result;
}

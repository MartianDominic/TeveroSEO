"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getOpenSeo,
  postOpenSeo,
  patchOpenSeo,
  deleteOpenSeo,
} from "@/lib/server-fetch";
import { requireActionAuth, validateProspectOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";
import { logError } from "@/lib/errors/handler";

// Validation schemas
const prospectIdSchema = z.string().uuid("Invalid prospect ID format");

// Domain validation - prevent SSRF by only allowing valid domain patterns
const domainSchema = z
  .string()
  .min(1, "Domain is required")
  .max(253, "Domain too long")
  .regex(
    /^(?!:\/\/)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "Invalid domain format. Use format: example.com"
  );

const emailSchema = z.string().email("Invalid email format").max(254, "Email too long").optional();

// Array limits to prevent abuse
const MAX_PROSPECT_IDS = 100;

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
  await requireActionAuth();
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
export async function getProspect(id: string): Promise<ActionResult<ProspectWithAnalyses>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(id);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership before fetching
    await validateProspectOwnership(validatedId.data, auth);

    const data = await getOpenSeo<ProspectWithAnalyses>(`/api/prospects/${validatedId.data}`);
    return { success: true, data };
  } catch (error) {
    logError("getProspect", error, { prospectId: id });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Input validation schema for creating prospects
const createProspectSchema = z.object({
  domain: domainSchema,
  companyName: z.string().max(255, "Company name too long").optional(),
  contactEmail: emailSchema,
  contactName: z.string().max(255, "Contact name too long").optional(),
  industry: z.string().max(100, "Industry too long").optional(),
  notes: z.string().max(5000, "Notes too long").optional(),
  source: z.string().max(100, "Source too long").optional(),
});

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
}): Promise<ActionResult<Prospect>> {
  await requireActionAuth();

  // Validate input
  const validated = createProspectSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const result = await postOpenSeo<Prospect>("/api/prospects", validated.data);
    revalidatePath("/prospects");
    return { success: true, data: result };
  } catch (error) {
    logError("createProspectAction", error, { domain: data.domain });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Update prospect schema - only allow safe fields to be updated
const updateProspectSchema = z.object({
  companyName: z.string().max(255, "Company name too long").optional(),
  contactEmail: emailSchema,
  contactName: z.string().max(255, "Contact name too long").optional(),
  industry: z.string().max(100, "Industry too long").optional(),
  notes: z.string().max(5000, "Notes too long").optional(),
  status: z.enum(["new", "analyzing", "analyzed", "converted", "archived"]).optional(),
  source: z.string().max(100, "Source too long").optional(),
});

/**
 * Update a prospect.
 */
export async function updateProspectAction(
  id: string,
  data: Partial<Prospect>,
): Promise<ActionResult<Prospect>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(id);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  // Validate update data
  const validatedData = updateProspectSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, error: validatedData.error.issues[0]?.message || "Invalid input" };
  }

  try {
    // Validate ownership before updating
    await validateProspectOwnership(validatedId.data, auth);

    const result = await patchOpenSeo<Prospect>(`/api/prospects/${validatedId.data}`, validatedData.data);
    revalidatePath("/prospects");
    revalidatePath(`/prospects/${validatedId.data}`);
    return { success: true, data: result };
  } catch (error) {
    logError("updateProspectAction", error, { prospectId: id });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Delete a prospect.
 */
export async function deleteProspectAction(id: string): Promise<ActionResult<void>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(id);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership before deleting
    await validateProspectOwnership(validatedId.data, auth);

    await deleteOpenSeo(`/api/prospects/${validatedId.data}`);
    revalidatePath("/prospects");
    return { success: true, data: undefined };
  } catch (error) {
    logError("deleteProspectAction", error, { prospectId: id });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Analysis options schema
const analysisOptionsSchema = z.object({
  analysisType: z.enum(["quick_scan", "deep_dive", "opportunity_discovery"]).optional(),
  targetRegion: z.string().max(10, "Region code too long").optional(),
  targetLanguage: z.string().max(10, "Language code too long").optional(),
});

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
): Promise<ActionResult<{ analysisId: string; jobId: string }>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  // Validate options
  const validatedOptions = analysisOptionsSchema.safeParse(options || {});
  if (!validatedOptions.success) {
    return { success: false, error: validatedOptions.error.issues[0]?.message || "Invalid options" };
  }

  try {
    // Validate ownership before triggering analysis
    await validateProspectOwnership(validatedId.data, auth);

    const result = await postOpenSeo<{ analysisId: string; jobId: string }>(
      `/api/prospects/${validatedId.data}/analyze`,
      {
        analysisType: validatedOptions.data.analysisType ?? "quick_scan",
        targetRegion: validatedOptions.data.targetRegion ?? "US",
        targetLanguage: validatedOptions.data.targetLanguage ?? "en",
      },
    );

    revalidatePath(`/prospects/${validatedId.data}`);
    revalidatePath("/prospects");
    return { success: true, data: result };
  } catch (error) {
    logError("triggerAnalysisAction", error, { prospectId, analysisType: options?.analysisType });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Get remaining analyses for today.
 */
export async function getRemainingAnalyses(): Promise<number> {
  await requireActionAuth();
  try {
    const result = await getOpenSeo<{ remaining: number }>(
      "/api/prospects/rate-limit",
    );
    return result.remaining;
  } catch {
    return 10;
  }
}

// Bulk analyze schema with array limits
const bulkAnalyzeSchema = z.object({
  prospectIds: z.array(prospectIdSchema).min(1, "At least one prospect required").max(MAX_PROSPECT_IDS, `Maximum ${MAX_PROSPECT_IDS} prospects allowed`),
  analysisType: z.enum(["quick_scan", "deep_dive", "opportunity_discovery"]).optional(),
  targetRegion: z.string().max(10, "Region code too long").optional(),
  targetLanguage: z.string().max(10, "Language code too long").optional(),
});

// Extraction schemas (Phase 56-02)
const extractFromConversationSchema = z.object({
  content: z
    .string()
    .min(50, "Content must be at least 50 characters")
    .max(50000, "Content exceeds maximum length"),
  inputMode: z.enum(["website", "website_with_context", "conversation"]),
  domain: z.string().optional(),
  contextNotes: z.string().max(50000, "Context notes too long").optional(),
});

export interface ExtractionResult {
  businessName?: string;
  industry?: string;
  services?: string[];
  targetAudience?: string;
  keywords?: string[];
  location?: string;
  confidence: number;
  platform?: {
    platform: string;
    confidence: string;
    signals: Array<{
      type: string;
      platform: string;
      weight: number;
      found: string;
    }>;
  };
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
): Promise<ActionResult<{
  queuedCount: number;
  skippedCount: number;
  queuedIds: string[];
  skippedIds: string[];
  remainingQuota: number;
}>> {
  const auth = await requireActionAuth();

  // Validate input with array limits
  const validated = bulkAnalyzeSchema.safeParse({
    prospectIds,
    ...options,
  });
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  try {
    // Validate ownership for each prospect
    // Note: This validates each prospect - for large batches, consider a bulk validation endpoint
    await Promise.all(
      validated.data.prospectIds.map(id => validateProspectOwnership(id, auth))
    );

    const result = await postOpenSeo<{
      queuedCount: number;
      skippedCount: number;
      queuedIds: string[];
      skippedIds: string[];
      remainingQuota: number;
    }>("/api/prospects/bulk-analyze", {
      prospectIds: validated.data.prospectIds,
      analysisType: validated.data.analysisType ?? "quick_scan",
      targetRegion: validated.data.targetRegion ?? "US",
      targetLanguage: validated.data.targetLanguage ?? "en",
    });

    revalidatePath("/prospects");
    return { success: true, data: result };
  } catch (error) {
    logError("bulkAnalyzeAction", error, { prospectCount: prospectIds.length, analysisType: options?.analysisType });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Extract business information from conversation text using AI.
 * Phase 56: Prospect Input Excellence
 */
export async function extractFromConversationAction(
  data: z.infer<typeof extractFromConversationSchema>,
): Promise<ActionResult<ExtractionResult>> {
  await requireActionAuth();

  // Validate input
  const validated = extractFromConversationSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const result = await postOpenSeo<{
      success: boolean;
      data: ExtractionResult;
      error?: string;
    }>("/api/prospects/extract", validated.data);

    if (!result.success) {
      return { success: false, error: result.error || "Extraction failed" };
    }

    return { success: true, data: result.data };
  } catch (error) {
    logError("extractFromConversationAction", error, {
      inputMode: data.inputMode,
    });
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

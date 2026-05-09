"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { requireActionAuth, validateProspectOwnership, validateProposalOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { env } from "@/lib/env";
import { sanitizeErrorForClient } from "@/lib/error-utils";
import { logger } from '@/lib/logger';
/** Default timeout for API requests (30 seconds) */
const API_TIMEOUT_MS = 30000;

/** Longer timeout for generation requests (60 seconds) */
const GENERATION_TIMEOUT_MS = 60000;

// Validation schemas
const prospectIdSchema = z.string().uuid("Invalid prospect ID format");
const proposalIdSchema = z.string().uuid("Invalid proposal ID format");

// Content size limits
const MAX_CONTENT_LENGTH = 100000;

export type ProposalScenario = "focused" | "full_audit" | "competitor_only";
export type AwarenessLevel =
  | "unaware"
  | "problem-aware"
  | "solution-aware"
  | "product-aware"
  | "most-aware";

export interface GeneratedSection {
  type: string;
  title: string;
  content: string;
  language: string;
}

export interface GenerateProposalInput {
  prospectId: string;
  scenario: ProposalScenario;
  awarenessLevel?: AwarenessLevel;
  pricing: {
    setupFee: number;
    monthlyFee: number;
    contractMonths: number;
  };
  agencyInfo?: {
    name?: string;
    positioning?: string;
    differentiators?: string[];
  };
}

export interface ProposalResult {
  proposalId: string;
  sections: GeneratedSection[];
  awarenessLevel: AwarenessLevel;
}

// Generate proposal input schema
const generateProposalInputSchema = z.object({
  prospectId: prospectIdSchema,
  scenario: z.enum(["focused", "full_audit", "competitor_only"]),
  awarenessLevel: z.enum(["unaware", "problem-aware", "solution-aware", "product-aware", "most-aware"]).optional(),
  pricing: z.object({
    setupFee: z.number().min(0).max(1000000, "Setup fee too high"),
    monthlyFee: z.number().min(0).max(100000, "Monthly fee too high"),
    contractMonths: z.number().int().min(1).max(60, "Contract duration too long"),
  }),
  agencyInfo: z.object({
    name: z.string().max(200, "Agency name too long").optional(),
    positioning: z.string().max(1000, "Positioning too long").optional(),
    differentiators: z.array(z.string().max(500, "Differentiator too long")).max(20, "Maximum 20 differentiators").optional(),
  }).optional(),
});

export async function generateProposal(
  input: GenerateProposalInput
): Promise<ActionResult<ProposalResult>> {
  const authContext = await requireActionAuth();

  // Validate input
  const validated = generateProposalInputSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  try {
    // Validate ownership before generating proposal
    await validateProspectOwnership(validated.data.prospectId, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(`${env.OPEN_SEO_URL}/api/proposals/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(validated.data),
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
      } catch {
        // Response wasn't JSON (e.g., 502 HTML from nginx)
      }
      logger.error("[generateProposal] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: "Failed to generate proposal. Please try again.",
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[generateProposal] Error", error instanceof Error ? error : { error: String(error) });
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

// Section type schema
const sectionTypeSchema = z.string().min(1, "Section type required").max(100, "Section type too long");

export async function regenerateSection(
  proposalId: string,
  sectionType: string
): Promise<ActionResult<GeneratedSection>> {
  const authContext = await requireActionAuth();

  // Validate proposal ID format
  const validatedProposalId = proposalIdSchema.safeParse(proposalId);
  if (!validatedProposalId.success) {
    return { success: false, error: validatedProposalId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  // Validate section type
  const validatedSectionType = sectionTypeSchema.safeParse(sectionType);
  if (!validatedSectionType.success) {
    return { success: false, error: validatedSectionType.error.issues[0]?.message || "Invalid section type" };
  }

  try {
    // Validate ownership before regenerating
    await validateProposalOwnership(validatedProposalId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/proposals/${validatedProposalId.data}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ sectionType: validatedSectionType.data }),
        signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
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
      logger.error("[regenerateSection] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: "Failed to regenerate section. Please try again.",
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[regenerateSection] Error", error instanceof Error ? error : { error: String(error) });
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

// Update section schema with content size limit
const updateSectionSchema = z.object({
  sectionType: sectionTypeSchema,
  content: z.string().max(MAX_CONTENT_LENGTH, `Content too long (max ${MAX_CONTENT_LENGTH} characters)`),
});

export async function updateSection(
  proposalId: string,
  sectionType: string,
  content: string
): Promise<ActionResult<void>> {
  const authContext = await requireActionAuth();

  // Validate proposal ID format
  const validatedProposalId = proposalIdSchema.safeParse(proposalId);
  if (!validatedProposalId.success) {
    return { success: false, error: validatedProposalId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  // Validate section update input
  const validatedInput = updateSectionSchema.safeParse({ sectionType, content });
  if (!validatedInput.success) {
    return { success: false, error: validatedInput.error.issues[0]?.message || "Invalid input" };
  }

  try {
    // Validate ownership before updating
    await validateProposalOwnership(validatedProposalId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/proposals/${validatedProposalId.data}/sections`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ sectionType: validatedInput.data.sectionType, content: validatedInput.data.content }),
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
      logger.error("[updateSection] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: "Failed to update section. Please try again.",
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    logger.error("[updateSection] Error", error instanceof Error ? error : { error: String(error) });
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

export interface ProposalPreviewData {
  id: string;
  prospectId: string;
  sections: GeneratedSection[];
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Recommendations data structure from keyword analysis
 * Phase 47-01: Deferred from 43-06
 */
export interface AIRecommendations {
  awarenessLevel: AwarenessLevel;
  confidence: number;
  hookStrategy: string;
  recommendedApproach: {
    openingAngle: string;
    primaryCialdini: string;
    objectionsToAddress: string[];
  };
  keywordHighlights: {
    totalKeywords: number;
    quickWins: number;
    highValueKeywords: Array<{
      keyword: string;
      volume: number;
      potential: number;
    }>;
    topCompetitor: string | null;
    estimatedTrafficGain: number;
  };
}

/**
 * Fetch AI recommendations based on prospect keyword analysis.
 * Returns awareness level, hook strategy, and keyword highlights.
 */
export async function getAIRecommendations(
  prospectId: string
): Promise<ActionResult<AIRecommendations>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership before fetching recommendations
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/recommendations`,
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
      // Fallback with default recommendations if endpoint doesn't exist yet
      // This allows the UI to function while backend is being developed
      return {
        success: true,
        data: {
          awarenessLevel: "solution-aware",
          confidence: 0.7,
          hookStrategy: "Show immediate value through quick wins",
          recommendedApproach: {
            openingAngle: "Your competitors are ranking for keywords you're missing",
            primaryCialdini: "Social proof + scarcity",
            objectionsToAddress: ["Cost", "Timeline", "Results guarantee"],
          },
          keywordHighlights: {
            totalKeywords: 0,
            quickWins: 0,
            highValueKeywords: [],
            topCompetitor: null,
            estimatedTrafficGain: 0,
          },
        },
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[getAIRecommendations] Error", error instanceof Error ? error : { error: String(error) });
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

export async function getProposalForPreview(
  proposalId: string
): Promise<ActionResult<ProposalPreviewData>> {
  const authContext = await requireActionAuth();

  // Validate proposal ID format
  const validatedProposalId = proposalIdSchema.safeParse(proposalId);
  if (!validatedProposalId.success) {
    return { success: false, error: validatedProposalId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  try {
    // Validate ownership before fetching
    await validateProposalOwnership(validatedProposalId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/proposals/${validatedProposalId.data}`,
      {
        method: "GET",
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
      logger.error("[getProposalForPreview] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: "Failed to load proposal. Please try again.",
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[getProposalForPreview] Error", error instanceof Error ? error : { error: String(error) });
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

// ---------------------------------------------------------------------------
// Service Catalog Actions (Phase 58-03)
// ---------------------------------------------------------------------------

/**
 * Service template data from API.
 */
export interface ServiceTemplate {
  id: string;
  name: string;
  nameEn?: string | null;
  nameLt?: string | null;
  category: "seo_package" | "addon" | "one_time";
  pricingType: "monthly" | "one_time" | "per_unit";
  basePriceCents: number | null;
  setupFeeCents?: number | null;
  inclusions?: string[] | null;
  icon?: string | null;
  isSystemTemplate?: boolean;
}

/**
 * Proposal service selection input.
 */
export interface ProposalServiceInput {
  serviceTemplateId: string;
  customPriceCents?: number | null;
  customSetupCents?: number | null;
  quantity?: number;
  isIncluded: boolean;
}

/**
 * Fetch all available service templates for the workspace.
 */
export async function getServicesForWorkspace(): Promise<
  ActionResult<{ services: ServiceTemplate[] }>
> {
  try {
    await requireActionAuth();

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(`${env.OPEN_SEO_URL}/api/services`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Response wasn't JSON
      }
      logger.error("[getServicesForWorkspace] API error", { status: response.status, detail: errorMessage });
      return { success: false, error: "Failed to fetch services" };
    }

    const result = await response.json();
    return { success: true, data: { services: result.services || [] } };
  } catch (error) {
    logger.error("[getServicesForWorkspace] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return { success: false, error: "Request timed out" };
    }
    return { success: false, error: sanitizeErrorForClient(error) };
  }
}

/**
 * Fetch services selected for a specific proposal.
 */
export async function getProposalServices(
  proposalId: string
): Promise<ActionResult<{ services: ProposalServiceInput[] }>> {
  const authContext = await requireActionAuth();

  // Validate proposal ID
  const validatedId = proposalIdSchema.safeParse(proposalId);
  if (!validatedId.success) {
    return { success: false, error: "Invalid proposal ID" };
  }

  try {
    await validateProposalOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/proposals/${validatedId.data}/services`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      logger.error("[getProposalServices] API error", { status: response.status });
      return { success: false, error: "Failed to fetch proposal services" };
    }

    const result = await response.json();
    return { success: true, data: { services: result.services || [] } };
  } catch (error) {
    logger.error("[getProposalServices] Error", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: sanitizeErrorForClient(error) };
  }
}

// Validation schema for service updates
const updateServicesSchema = z.object({
  services: z.array(
    z.object({
      serviceTemplateId: z.string().uuid(),
      customPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
      customSetupCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
      quantity: z.number().int().min(1).max(100).default(1),
      isIncluded: z.boolean(),
    })
  ),
});

/**
 * Update service selections for a proposal.
 */
export async function updateProposalServices(
  proposalId: string,
  selections: ProposalServiceInput[]
): Promise<ActionResult<{ services: ProposalServiceInput[] }>> {
  const authContext = await requireActionAuth();

  // Validate proposal ID
  const validatedProposalId = proposalIdSchema.safeParse(proposalId);
  if (!validatedProposalId.success) {
    return { success: false, error: "Invalid proposal ID" };
  }

  // Validate selections
  const validatedInput = updateServicesSchema.safeParse({ services: selections });
  if (!validatedInput.success) {
    return {
      success: false,
      error: validatedInput.error.issues[0]?.message || "Invalid service selection",
    };
  }

  try {
    await validateProposalOwnership(validatedProposalId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/proposals/${validatedProposalId.data}/services`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ services: validatedInput.data.services }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Response wasn't JSON
      }
      logger.error("[updateProposalServices] API error", { status: response.status, detail: errorMessage });
      return { success: false, error: "Failed to update services" };
    }

    const result = await response.json();

    return { success: true, data: { services: result.services || [] } };
  } catch (error) {
    logger.error("[updateProposalServices] Error", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: sanitizeErrorForClient(error) };
  }
}

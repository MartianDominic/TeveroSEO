"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { requireActionAuth, validateProspectOwnership, validateProposalOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";

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
      console.error("[generateProposal] API error:", response.status, errorMessage);
      return {
        success: false,
        error: "Failed to generate proposal. Please try again.",
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("[generateProposal] Error:", error);
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
      console.error("[regenerateSection] API error:", response.status, errorMessage);
      return {
        success: false,
        error: "Failed to regenerate section. Please try again.",
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("[regenerateSection] Error:", error);
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
      console.error("[updateSection] API error:", response.status, errorMessage);
      return {
        success: false,
        error: "Failed to update section. Please try again.",
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error("[updateSection] Error:", error);
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
      console.error("[getProposalForPreview] API error:", response.status, errorMessage);
      return {
        success: false,
        error: "Failed to load proposal. Please try again.",
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error("[getProposalForPreview] Error:", error);
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

"use server";

/**
 * Server actions for public proposal page.
 * Phase 46-47: Proposal System
 *
 * These actions fetch and modify proposal data via the open-seo-main API.
 * No authentication required - token provides access.
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 * HIGH-NX-04 FIX: Added Zod validation for all action inputs
 */

import { z } from "zod";

import { getOpenSeoUrl } from "@/lib/env";

// ---------------------------------------------------------------------------
// Validation Schemas (HIGH-NX-04 FIX)
// ---------------------------------------------------------------------------

/**
 * Proposal ID schema - validates UUID format to prevent injection
 */
const proposalIdSchema = z
  .string()
  .uuid("Invalid proposal ID format")
  .max(36, "Proposal ID too long");

/**
 * Public token schema - validates token format for public access
 * Tokens are typically URL-safe base64 or UUID format
 */
const publicTokenSchema = z
  .string()
  .min(1, "Token is required")
  .max(255, "Token too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid token format");

/**
 * Rejection reason schema - validates optional rejection reason
 */
const rejectionReasonSchema = z
  .string()
  .max(2000, "Rejection reason too long")
  .optional();

export interface ProposalContent {
  hero: {
    headline: string;
    subheadline: string;
    trafficValue: number;
  };
  currentState: {
    traffic: number;
    keywords: number;
    value: number;
    chartData?: Array<{ month: string; traffic: number }>;
  };
  opportunities: Array<{
    keyword: string;
    volume: number;
    difficulty: string;
    potential: number;
  }>;
  roi: {
    projectedTrafficGain: number;
    trafficValue: number;
    defaultConversionRate: number;
    defaultAov: number;
  };
  investment: {
    setupFee: number;
    monthlyFee: number;
    inclusions: string[];
  };
  nextSteps: string[];
}

export interface BrandConfig {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

export interface PublicProposal {
  id: string;
  content: ProposalContent;
  brandConfig: BrandConfig | null;
  setupFeeCents: number | null;
  monthlyFeeCents: number | null;
  currency: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

// Service with selection data (merged from template + proposal selection)
export interface ServiceWithSelection {
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
  customPriceCents?: number | null;
  customSetupCents?: number | null;
  quantity: number;
}

/**
 * Fetch proposal by public token.
 * Returns proposal data for rendering or error state.
 * HIGH-NX-04 FIX: Added token validation
 */
export async function getPublicProposal(
  token: string
): Promise<{ success: boolean; data?: PublicProposal; error?: string }> {
  // Validate token format
  const validatedToken = publicTokenSchema.safeParse(token);
  if (!validatedToken.success) {
    return { success: false, error: validatedToken.error.issues[0]?.message || "Invalid token" };
  }

  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/public/${encodeURIComponent(validatedToken.data)}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 410) {
        return { success: false, error: "expired" };
      }
      if (response.status === 404) {
        return { success: false, error: "not_found" };
      }
      return { success: false, error: data.error || "Failed to fetch proposal" };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Accept proposal.
 * Transitions status from viewed to accepted.
 * HIGH-NX-04 FIX: Added proposalId validation
 */
export async function acceptProposal(
  proposalId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate proposal ID format
  const validatedId = proposalIdSchema.safeParse(proposalId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/${encodeURIComponent(validatedId.data)}/accept`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || "Failed to accept proposal" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Reject proposal with optional reason.
 * Transitions status to declined.
 * HIGH-NX-04 FIX: Added proposalId and reason validation
 */
export async function rejectProposal(
  proposalId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Validate proposal ID format
  const validatedId = proposalIdSchema.safeParse(proposalId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  // Validate optional reason
  const validatedReason = rejectionReasonSchema.safeParse(reason);
  if (!validatedReason.success) {
    return { success: false, error: validatedReason.error.issues[0]?.message || "Invalid reason" };
  }

  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/${encodeURIComponent(validatedId.data)}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: validatedReason.data }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || "Failed to reject proposal" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Fetch resolved services for a proposal.
 * Phase 58-04: Service Catalog Integration
 *
 * Returns services with template data merged with proposal selection data.
 * Called by public proposal page to display service line items.
 * HIGH-NX-04 FIX: Added proposalId validation
 */
export async function getProposalServices(
  proposalId: string
): Promise<{ success: boolean; data?: ServiceWithSelection[]; error?: string }> {
  // Validate proposal ID format
  const validatedId = proposalIdSchema.safeParse(proposalId);
  if (!validatedId.success) {
    return { success: false, error: validatedId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/${encodeURIComponent(validatedId.data)}/services/resolved`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      // Services are optional - return empty array if not found
      if (response.status === 404) {
        return { success: true, data: [] };
      }
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || "Failed to fetch services" };
    }

    const result = await response.json();
    return { success: true, data: result.services || [] };
  } catch {
    // Services are optional - return empty array on network error
    return { success: true, data: [] };
  }
}

"use server";

import { z } from "zod";
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
import { revalidatePath } from "next/cache";
import { requireActionAuth, validateProspectOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";

// Validation schemas
const proposalIdSchema = z.string().min(1, "Invalid proposal ID");
const prospectIdSchema = z.string().min(1, "Invalid prospect ID");

/**
 * Proposal summary for list view.
 */
export interface ProposalSummary {
  id: string;
  template: string | null;
  status: string;
  setupFeeCents: number | null;
  monthlyFeeCents: number | null;
  currency: string | null;
  sentAt: string | null;
  firstViewedAt: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response structure from open-seo proposals API.
 */
interface ProposalsApiResponse {
  success: boolean;
  data?: {
    data: ProposalSummary[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

/**
 * Get all proposals for a prospect.
 */
export async function getProposalsForProspect(
  prospectId: string,
  options?: { status?: string; page?: number }
): Promise<ActionResult<{ proposals: ProposalSummary[]; total: number }>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedProspectId = prospectIdSchema.safeParse(prospectId);
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership
    await validateProspectOwnership(validatedProspectId.data, auth);

    // Build query params
    const params = new URLSearchParams();
    params.set("prospectId", validatedProspectId.data);
    if (options?.status) params.set("status", options.status);
    if (options?.page) params.set("page", String(options.page));

    const response = await getOpenSeo<ProposalsApiResponse>(
      `/api/proposals?${params.toString()}`
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to fetch proposals" };
    }

    return {
      success: true,
      data: {
        proposals: response.data.data,
        total: response.data.total,
      },
    };
  } catch (error) {
    console.error("[getProposalsForProspect] Error:", error);
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Response structure from send proposal API.
 */
interface SendProposalResponse {
  success: boolean;
  data?: {
    proposalId: string;
    status: string;
    sentAt: string;
    expiresAt: string | null;
    messageId: string | null;
  };
  error?: string;
}

/**
 * Send a proposal email.
 */
export async function sendProposal(
  proposalId: string,
  prospectId: string,
  options?: { recipientEmail?: string; expirationDays?: number }
): Promise<ActionResult<{ status: string; sentAt: string }>> {
  const auth = await requireActionAuth();

  // Validate IDs
  const validatedProposalId = proposalIdSchema.safeParse(proposalId);
  if (!validatedProposalId.success) {
    return { success: false, error: validatedProposalId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  const validatedProspectId = prospectIdSchema.safeParse(prospectId);
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership
    await validateProspectOwnership(validatedProspectId.data, auth);

    const response = await postOpenSeo<SendProposalResponse>(
      `/api/proposals/${validatedProposalId.data}/send`,
      options || {}
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to send proposal" };
    }

    // Revalidate the proposals list
    revalidatePath(`/prospects/${validatedProspectId.data}/proposals`);

    return {
      success: true,
      data: {
        status: response.data.status,
        sentAt: response.data.sentAt,
      },
    };
  } catch (error) {
    console.error("[sendProposal] Error:", error);
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Resend a proposal email.
 * Creates a new email but keeps the same token.
 */
export async function resendProposal(
  proposalId: string,
  prospectId: string
): Promise<ActionResult<{ status: string }>> {
  const auth = await requireActionAuth();

  // Validate IDs
  const validatedProposalId = proposalIdSchema.safeParse(proposalId);
  if (!validatedProposalId.success) {
    return { success: false, error: validatedProposalId.error.issues[0]?.message || "Invalid proposal ID" };
  }

  const validatedProspectId = prospectIdSchema.safeParse(prospectId);
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership
    await validateProspectOwnership(validatedProspectId.data, auth);

    // For resend, we call the same endpoint - it will handle the status check
    // Note: The backend should allow resending from 'sent' status
    const response = await postOpenSeo<SendProposalResponse>(
      `/api/proposals/${validatedProposalId.data}/resend`,
      {}
    );

    if (!response.success) {
      return { success: false, error: response.error || "Failed to resend proposal" };
    }

    // Revalidate the proposals list
    revalidatePath(`/prospects/${validatedProspectId.data}/proposals`);

    return {
      success: true,
      data: {
        status: "sent",
      },
    };
  } catch (error) {
    console.error("[resendProposal] Error:", error);
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

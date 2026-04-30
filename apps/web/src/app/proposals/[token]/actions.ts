"use server";

/**
 * Server actions for public proposal page.
 * Phase 46-47: Proposal System
 *
 * These actions fetch and modify proposal data via the open-seo-main API.
 * No authentication required - token provides access.
 */

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

const getOpenSeoUrl = () =>
  process.env.OPEN_SEO_API_URL || "http://localhost:3001";

/**
 * Fetch proposal by public token.
 * Returns proposal data for rendering or error state.
 */
export async function getPublicProposal(
  token: string
): Promise<{ success: boolean; data?: PublicProposal; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/public/${token}`,
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
 */
export async function acceptProposal(
  proposalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/${proposalId}/accept`,
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
 */
export async function rejectProposal(
  proposalId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/${proposalId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
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

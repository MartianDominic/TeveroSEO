/**
 * Public Proposal View Page
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * Route: /p/[token]
 *
 * Features:
 * - Validate token and expiry
 * - Read-only proposal view
 * - Track view event
 * - Branded experience using proposal brandConfig
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Metadata } from "next";


import { getOpenSeoUrl } from "@/lib/env";
import { logger } from '@/lib/logger';

import { PublicProposalView } from "./PublicProposalView";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalData {
  id: string;
  content: {
    hero: {
      headline: string;
      subheadline: string;
      trafficValue: number;
    };
    currentState: {
      traffic: number;
      keywords: number;
      value: number;
      chartData: Array<{ month: string; traffic: number }>;
    };
    opportunities: Array<{
      keyword: string;
      volume: number;
      difficulty: "easy" | "medium" | "hard";
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
  };
  brandConfig?: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  } | null;
  setupFeeCents: number | null;
  monthlyFeeCents: number | null;
  currency: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getProposal(token: string): Promise<ProposalData | null> {
  // CFG-CRIT-01 FIX: Use centralized env validation
  const apiUrl = getOpenSeoUrl();

  try {
    const response = await fetch(`${apiUrl}/api/proposals/public/${token}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Don't cache - need fresh data for view tracking
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      return null;
    }

    return result.data;
  } catch (error) {
    logger.error("Failed to fetch proposal", error instanceof Error ? error : { error: String(error) });
    return null;
  }
}

async function trackView(
  proposalId: string,
  token: string,
  userAgent: string,
  ipAddress: string
): Promise<void> {
  // CFG-CRIT-01 FIX: Use centralized env validation
  const apiUrl = getOpenSeoUrl();

  try {
    // Fire and forget - don't block page render
    fetch(`${apiUrl}/api/proposals/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        proposalId,
        token,
        userAgent,
        ipAddress,
        type: "page_view",
      }),
    }).catch(() => {
      // Silently fail - tracking is non-critical
    });
  } catch {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const proposal = await getProposal(token);

  if (!proposal) {
    return {
      title: "Proposal Not Found",
      robots: "noindex, nofollow",
    };
  }

  const headline = proposal.content?.hero?.headline ?? "SEO Proposal";

  return {
    title: headline,
    description: proposal.content?.hero?.subheadline ?? "View your personalized SEO proposal",
    robots: "noindex, nofollow", // Proposals should not be indexed
    openGraph: {
      title: headline,
      description: proposal.content?.hero?.subheadline,
      type: "website",
    },
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function PublicProposalPage({ params }: PageProps) {
  const { token } = await params;

  // Validate token format (32 char nanoid)
  if (!token || token.length !== 32) {
    notFound();
  }

  // Fetch proposal data
  const proposal = await getProposal(token);

  if (!proposal) {
    notFound();
  }

  // Check expiry
  if (proposal.expiresAt) {
    const expiryDate = new Date(proposal.expiresAt);
    if (expiryDate < new Date()) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-1">
          <div className="text-center max-w-md px-4">
            <h1 className="text-2xl font-semibold text-text-1 mb-2">
              Proposal Expired
            </h1>
            <p className="text-text-3">
              This proposal link has expired. Please contact us for an updated proposal.
            </p>
          </div>
        </div>
      );
    }
  }

  // Track view (server-side)
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";

  // SECURITY: Validate X-Forwarded-For against trusted proxy
  // Only trust forwarded headers if request came through our verified proxy
  const proxySecret = headersList.get("x-proxy-secret");
  const expectedSecret = process.env.PROXY_SECRET;
  const forwardedFor = headersList.get("x-forwarded-for");

  let ipAddress: string;
  if (expectedSecret && proxySecret === expectedSecret && forwardedFor) {
    // Trust the forwarded IP from verified proxy
    ipAddress = forwardedFor.split(",")[0].trim();
  } else if (process.env.TRUST_CLOUDFLARE === "true") {
    // Cloudflare provides CF-Connecting-IP
    ipAddress = headersList.get("cf-connecting-ip") ?? "127.0.0.1";
  } else if (process.env.VERCEL) {
    // Vercel provides x-vercel-forwarded-for
    ipAddress =
      headersList.get("x-vercel-forwarded-for")?.split(",")[0].trim() ??
      "127.0.0.1";
  } else {
    // Fall back to x-real-ip only if no forwarded header (less spoofable)
    const realIp = headersList.get("x-real-ip");
    ipAddress = realIp && !forwardedFor ? realIp.trim() : "127.0.0.1";
  }

  // Fire and forget view tracking
  trackView(proposal.id, token, userAgent, ipAddress);

  return (
    <PublicProposalView
      proposal={proposal}
      token={token}
    />
  );
}

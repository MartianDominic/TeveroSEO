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
 */
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
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
  const apiUrl = process.env.OPEN_SEO_API_URL ?? "http://localhost:3001";

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
    console.error("Failed to fetch proposal:", error);
    return null;
  }
}

async function trackView(
  proposalId: string,
  token: string,
  userAgent: string,
  ipAddress: string
): Promise<void> {
  const apiUrl = process.env.OPEN_SEO_API_URL ?? "http://localhost:3001";

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
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0] ??
    headersList.get("x-real-ip") ??
    "127.0.0.1";

  // Fire and forget view tracking
  trackView(proposal.id, token, userAgent, ipAddress);

  return (
    <PublicProposalView
      proposal={proposal}
      token={token}
    />
  );
}

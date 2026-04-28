/**
 * Public Proposal Page Route
 * Phase 30: Interactive Proposals
 *
 * Token-based public access to proposal view (no auth required).
 * Route: /p/{token}
 */

import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ProposalPageView } from "@/client/components/proposals/ProposalPageView";
import { getProposalByToken, recordProposalView, acceptProposal } from "@/serverFunctions/proposals";
import type { ProposalSelect } from "@/db/proposal-schema";

type LoaderData = {
  proposal: Awaited<ReturnType<typeof getProposalByToken>> | null;
  error: string | null;
};

export const Route = createFileRoute("/p/$token")({
  component: ProposalPage,
  head: ({ params }) => ({
    meta: [
      {
        title: "SEO Pasiulymas | Tevero",
      },
      {
        name: "description",
        content: "Perziurekite savo personalizuota SEO pasiulyma",
      },
      {
        name: "robots",
        content: "noindex, nofollow",
      },
    ],
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    try {
      const proposal = await getProposalByToken({ data: { token: params.token } });
      return { proposal, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { proposal: null, error: message };
    }
  },
  errorComponent: ProposalError,
  pendingComponent: ProposalLoading,
});

function ProposalPage() {
  const { proposal, error } = useLoaderData({ from: "/p/$token" }) as LoaderData;
  const { token } = Route.useParams();
  const viewRecorded = useRef(false);
  const [roiCalculatorUsed, setRoiCalculatorUsed] = useState(false);

  // Record initial view on mount
  useEffect(() => {
    if (!proposal || viewRecorded.current) return;

    viewRecorded.current = true;

    // Fire and forget - don't block rendering
    recordProposalView({
      data: {
        token,
        deviceType: getDeviceType(),
        ipHash: undefined, // Server will handle this
      },
    }).catch(() => {
      // Ignore errors - view tracking is non-critical
    });
  }, [proposal, token]);

  // Handle error state
  if (error || !proposal) {
    return <ProposalNotFound error={error} />;
  }

  // Handle expiration
  if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
    return <ProposalExpired />;
  }

  const handleAccept = async () => {
    await acceptProposal({ data: { token } });
    // TODO: Redirect to signing flow (Plan 30-05)
    // For now, show a success message
    window.alert("Pasiulymas priimtas! Netrukus susisieksime su jumis.");
  };

  const handleCalculatorUsed = () => {
    setRoiCalculatorUsed(true);
  };

  const handleViewRecorded = (data: {
    sectionsViewed: string[];
    durationSeconds: number;
    roiCalculatorUsed: boolean;
  }) => {
    // Record engagement data on page leave
    recordProposalView({
      data: {
        token,
        deviceType: getDeviceType(),
        sectionsViewed: data.sectionsViewed,
        durationSeconds: data.durationSeconds,
        roiCalculatorUsed: data.roiCalculatorUsed || roiCalculatorUsed,
      },
    }).catch(() => {
      // Ignore errors
    });
  };

  // Extract company name from prospect if available
  const companyName = extractCompanyName(proposal);

  return (
    <ProposalPageView
      proposal={proposal}
      companyName={companyName}
      onAccept={handleAccept}
      onCalculatorUsed={handleCalculatorUsed}
      onViewRecorded={handleViewRecorded}
    />
  );
}

/**
 * Determines device type from user agent.
 */
function getDeviceType(): string {
  if (typeof window === "undefined") return "unknown";

  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    return /tablet|ipad/.test(ua) ? "tablet" : "mobile";
  }
  return "desktop";
}

/**
 * Extracts company name from proposal data.
 */
function extractCompanyName(proposal: ProposalSelect): string | undefined {
  // Try to get from content hero headline
  const content = proposal.content as { hero?: { headline?: string } };
  if (content?.hero?.headline) {
    // Extract domain or company name from headline if it follows a pattern
    const match = content.hero.headline.match(/([a-z0-9-]+\.[a-z]{2,})/i);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Loading state component.
 */
function ProposalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Kraunama...</p>
      </div>
    </div>
  );
}

/**
 * Error state component.
 */
function ProposalError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-destructive mb-4">
          Ivyko klaida
        </h1>
        <p className="text-muted-foreground mb-6">
          {error.message || "Nepavyko ikrauti pasiulymo. Bandykite dar karta."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Bandyti dar karta
        </button>
      </div>
    </div>
  );
}

/**
 * Not found state component.
 */
function ProposalNotFound({ error }: { error: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-4">Pasiulymas nerastas</h2>
        <p className="text-muted-foreground mb-6">
          {error === "Proposal not found"
            ? "Sis pasiulymas neegzistuoja arba buvo pasalintas."
            : error || "Patikrinkite nuoroda ir bandykite dar karta."}
        </p>
      </div>
    </div>
  );
}

/**
 * Expired state component.
 */
function ProposalExpired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-4">Pasiulymas nebegalioja</h2>
        <p className="text-muted-foreground mb-6">
          Sis pasiulymas nebegalioja. Susisiekite su mumis del naujo pasiulymo.
        </p>
        <a
          href="mailto:info@tevero.io"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-block"
        >
          Susisiekti
        </a>
      </div>
    </div>
  );
}

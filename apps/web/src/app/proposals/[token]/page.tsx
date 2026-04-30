/**
 * Public proposal page.
 * Phase 46-47: Proposal System
 *
 * Server component that fetches proposal by token and renders the view.
 * No authentication required - token provides access.
 */
import { notFound } from "next/navigation";
import { getPublicProposal } from "./actions";
import { ProposalView } from "./components/ProposalView";
import { AcceptRejectButtons } from "./components/AcceptRejectButtons";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;
  const result = await getPublicProposal(token);

  // Handle error states
  if (!result.success) {
    if (result.error === "expired") {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-amber-600"
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
            <h1
              className="text-2xl font-bold text-gray-800 mb-4"
              style={{ fontFamily: "Newsreader, serif" }}
            >
              Pasiulymas nebegalioja
            </h1>
            <p className="text-gray-600">
              Sis pasiulymas nebegalioja. Susisiekite su mumis del naujo
              pasiulymo.
            </p>
          </div>
        </div>
      );
    }

    if (result.error === "not_found") {
      notFound();
    }

    // Network or other error
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold text-gray-800 mb-4"
            style={{ fontFamily: "Newsreader, serif" }}
          >
            Ivyko klaida
          </h1>
          <p className="text-gray-600">
            Nepavyko uzkrauti pasiulymo. Bandykite veliau arba susisiekite su
            mumis.
          </p>
        </div>
      </div>
    );
  }

  const proposal = result.data!;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        <ProposalView proposal={proposal} token={token} />

        {/* Accept/Reject Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <AcceptRejectButtons proposalId={proposal.id} status={proposal.status} />
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-gray-400">
          <p>
            Galioja iki:{" "}
            {proposal.expiresAt
              ? new Date(proposal.expiresAt).toLocaleDateString("lt-LT", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "30 dienu"}
          </p>
        </footer>
      </div>
    </div>
  );
}

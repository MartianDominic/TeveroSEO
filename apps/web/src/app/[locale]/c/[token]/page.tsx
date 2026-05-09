/**
 * Public contract page.
 * Phase 59: Agreement & Signing Excellence
 *
 * Server component that fetches contract by token and renders the view.
 * No authentication required - token provides access per D-06.
 *
 * Mobile-first responsive design per D-17.
 */
import { ContractViewer } from "@/components/contract/ContractViewer";
import { LanguageToggle } from "@/components/contract/LanguageToggle";
import { ProgressIndicator } from "@/components/contract/ProgressIndicator";
import { SignatureSection } from "@/components/contract/SignatureSection";

import { getContractByToken, markContractViewed } from "./actions";

interface Props {
  params: Promise<{ token: string; locale: string }>;
}

export default async function ContractPage({ params }: Props) {
  const { token, locale } = await params;

  const result = await getContractByToken(token);

  // Handle error states
  if ("error" in result) {
    return <ContractError error={result.error} />;
  }

  // Mark as viewed (fire and forget)
  markContractViewed(token);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header with logo and language toggle */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          {result.client.logoUrl && (
            <img
              src={result.client.logoUrl}
              alt={result.client.name}
              className="h-12 w-auto object-contain"
            />
          )}
          <span className="text-lg font-medium text-gray-700">
            {result.client.name}
          </span>
        </div>
        <LanguageToggle currentLocale={locale} token={token} />
      </header>

      {/* Progress indicator for multi-signer flow */}
      <ProgressIndicator
        mode={result.agreement.signingMode}
        totalSigners={result.agreement.totalSigners}
        signedCount={result.agreement.signedCount}
        currentOrder={result.signer.signingOrder}
      />

      {/* Contract content */}
      <ContractViewer
        title={result.agreement.title}
        sections={result.content.sections}
      />

      {/* Signature section */}
      <SignatureSection
        token={token}
        canSign={result.canSign}
        signingMessage={result.signingMessage}
        signerName={result.signer.name}
        signerStatus={result.signer.status}
      />
    </div>
  );
}

/**
 * Error component for invalid/expired tokens.
 * Shows user-friendly message instead of technical error.
 */
function ContractError({ error }: { error: string }) {
  const getErrorContent = () => {
    switch (error) {
      case "expired":
        return {
          title: "Contract Link Expired",
          message:
            "This contract link has expired. Please contact the sender for a new link.",
          icon: (
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
          ),
          bgColor: "bg-amber-100",
        };
      case "not_found":
        return {
          title: "Contract Not Found",
          message:
            "This contract could not be found. Please check the link and try again.",
          icon: (
            <svg
              className="w-8 h-8 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ),
          bgColor: "bg-gray-100",
        };
      default:
        return {
          title: "Contract Unavailable",
          message:
            "Unable to load this contract. Please try again later or contact support.",
          icon: (
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
          ),
          bgColor: "bg-red-100",
        };
    }
  };

  const content = getErrorContent();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div
          className={`w-16 h-16 ${content.bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}
        >
          {content.icon}
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          {content.title}
        </h1>
        <p className="text-gray-600">{content.message}</p>
      </div>
    </div>
  );
}

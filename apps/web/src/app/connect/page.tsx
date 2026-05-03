/**
 * Connection Wizard Page
 * Phase 66-04: Connection Wizard UI
 *
 * Multi-step wizard for connecting websites to TeveroSEO.
 * Entry point at /connect.
 */
"use client";

import * as React from "react";
import { useConnectionWizard } from "@/hooks/use-connection-wizard";
import { UrlInput } from "@/components/connect/url-input";
import { PlatformDetected } from "@/components/connect/platform-detected";
import { ConnectionChoice } from "@/components/connect/connection-choice";
import { ConnectionStepIndicator } from "@/components/connect/step-indicator";
import { PlatformGuide } from "@/components/connect/platform-guide";
import { Card, CardContent, Button } from "@tevero/ui";
import { AlertCircle, RefreshCw } from "lucide-react";

// ============================================================================
// Platform names for display
// ============================================================================

const PLATFORM_NAMES: Record<string, string> = {
  wordpress_self_hosted: "WordPress",
  wordpress_com: "WordPress.com",
  shopify: "Shopify",
  wix: "Wix",
  squarespace: "Squarespace",
  webflow: "Webflow",
  weebly: "Weebly",
  godaddy: "GoDaddy",
  hubspot: "HubSpot CMS",
  ghost: "Ghost",
  bigcommerce: "BigCommerce",
  woocommerce: "WooCommerce",
  magento: "Magento",
  custom_html: "Custom Website",
  gtm_enabled: "Google Tag Manager",
  unknown: "Custom Website",
};

// ============================================================================
// Page Component
// ============================================================================

export default function ConnectPage() {
  const {
    state,
    submitUrl,
    selectPath,
    nextGuideStep,
    prevGuideStep,
    retry,
    startVerification,
    progress,
  } = useConnectionWizard({
    workspaceId: undefined, // TODO: Get from context
    onSuccess: (siteId) => {
      // TODO: Navigate to success page or dashboard
    },
  });

  const platformName = state.detection?.platform
    ? PLATFORM_NAMES[state.detection.platform]
    : undefined;

  // Render based on current step
  const renderStep = () => {
    switch (state.step) {
      case "url":
        return (
          <UrlInput
            onSubmit={submitUrl}
            initialUrl={state.url}
          />
        );

      case "detecting":
        return <PlatformDetected isLoading />;

      case "choice":
        return (
          <div className="space-y-8">
            <PlatformDetected
              detection={state.detection}
              platformName={platformName}
            />
            <ConnectionChoice
              onSelect={selectPath}
              platformName={platformName}
              showOAuth={state.detection?.platform !== "unknown"}
            />
          </div>
        );

      case "diy":
        return (
          <PlatformGuide
            guide={state.guide?.guide}
            snippet={state.guide?.snippet}
            currentStep={state.currentGuideStep}
            onNext={nextGuideStep}
            onBack={prevGuideStep}
          />
        );

      case "developer":
        // TODO: Developer handoff UI (Plan 66-05)
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Send to Developer</h2>
            <p className="text-[var(--text-3)]">Coming soon...</p>
          </div>
        );

      case "oauth":
        // TODO: OAuth flow (redirect to auth provider)
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">OAuth Connection</h2>
            <p className="text-[var(--text-3)]">Redirecting to {platformName}...</p>
          </div>
        );

      case "verifying":
        // Start verification polling
        React.useEffect(() => {
          startVerification();
        }, []);

        return (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              Waiting for your website to say hello...
            </h2>
            <p className="text-[var(--text-3)] mb-6">
              When you've added the helper, visit your website in a new tab.
              We'll detect it automatically.
            </p>
            <Button
              variant="secondary"
              onClick={() => window.open(`https://${state.url}`, "_blank")}
            >
              Open my website in new tab
            </Button>
          </div>
        );

      case "success":
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-[var(--success-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--text-1)] mb-2">
              You're connected!
            </h2>
            <p className="text-[var(--text-3)] mb-6">
              Your first SEO insights will be ready in 24 hours.
              Nothing else to do - go grab a coffee!
            </p>
            <Button>
              Go to Dashboard
            </Button>
          </div>
        );

      case "error":
        return (
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-[var(--error-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-[var(--error)]" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-1)] mb-2">
                Something went wrong
              </h2>
              <p className="text-[var(--text-3)] mb-4">
                {state.error || "We couldn't complete the connection. Please try again."}
              </p>
              <Button onClick={retry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-1)] py-12">
      <div className="max-w-2xl mx-auto">
        {/* Step indicator (hide on error/success) */}
        {state.step !== "error" && state.step !== "success" && (
          <div className="mb-8">
            <ConnectionStepIndicator currentStep={state.step} />
          </div>
        )}

        {/* Main content */}
        <div className="bg-[var(--surface)] rounded-[var(--radius-card)] shadow-card p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

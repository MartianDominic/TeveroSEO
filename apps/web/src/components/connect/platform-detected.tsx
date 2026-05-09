/**
 * Platform Detected Component
 * Phase 66-04: Connection Wizard UI
 *
 * Screen 2: Shows detection progress and result.
 * Per DESIGN.md Section 5.2 Screen 2.
 */
"use client";

import * as React from "react";

import { Check, AlertCircle, Globe } from "lucide-react";

import type { DetectionResult } from "@/lib/api/connect";

import { ProgressBar, Badge, cn } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface PlatformDetectedProps {
  isLoading?: boolean;
  detection?: DetectionResult | null;
  platformName?: string;
  className?: string;
}

// ============================================================================
// Platform Name Mapping
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
// Feature Labels
// ============================================================================

const FEATURE_LABELS: Record<string, string> = {
  ecommerce: "E-commerce platform detected",
  blog: "Blog platform detected",
  custom_code: "Custom code supported",
  gtm_enabled: "Google Tag Manager detected",
};

// ============================================================================
// Component
// ============================================================================

export function PlatformDetected({
  isLoading = false,
  detection,
  platformName,
  className,
}: PlatformDetectedProps) {
  const [progress, setProgress] = React.useState(0);

  // Animate progress bar during loading
  React.useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      return;
    }

    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach 90%
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading]);

  const displayName =
    platformName ||
    (detection?.platform ? PLATFORM_NAMES[detection.platform] : null) ||
    "Custom Website";

  const isUnknown = detection?.platform === "unknown";

  return (
    <div className={cn("flex flex-col items-center px-4", className)}>
      {/* Loading State */}
      {isLoading && (
        <>
          <Globe className="w-12 h-12 text-[var(--accent)] mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold text-[var(--text-1)] mb-4">
            Checking your website...
          </h2>
          <div className="w-full max-w-xs mb-4">
            <ProgressBar value={progress} variant="default" />
          </div>
          <p className="text-[var(--text-3)] text-sm">
            This usually takes 2-3 seconds
          </p>
        </>
      )}

      {/* Detected State */}
      {!isLoading && detection && (
        <>
          {/* Success icon */}
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-4",
              isUnknown
                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                : "bg-[var(--success-soft)] text-[var(--success)]"
            )}
            data-testid="platform-detected-icon"
          >
            {isUnknown ? (
              <AlertCircle className="w-8 h-8" />
            ) : (
              <Check className="w-8 h-8" />
            )}
          </div>

          {/* Platform name */}
          <p className="text-[var(--text-3)] text-sm mb-1">Found:</p>
          <h2 className="text-2xl font-semibold text-[var(--text-1)] mb-4">
            {displayName}
          </h2>

          {/* Features */}
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {detection.features.map((feature) => (
              <Badge key={feature} variant="secondary">
                <Check className="w-3 h-3 mr-1" />
                {FEATURE_LABELS[feature] || feature}
              </Badge>
            ))}
          </div>

          {/* Paid plan warning */}
          {detection.paidPlanRequired && (
            <div className="bg-[var(--warning-soft)] text-[var(--warning)] px-4 py-2 rounded-[var(--radius)] text-sm mt-2">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              This platform may require a paid plan for custom tracking.
            </div>
          )}

          {/* Confidence (only show for unknown) */}
          {isUnknown && (
            <p className="text-[var(--text-3)] text-sm mt-4">
              We couldn&apos;t identify your platform, but don&apos;t worry - you can
              still add the helper to any website.
            </p>
          )}
        </>
      )}
    </div>
  );
}

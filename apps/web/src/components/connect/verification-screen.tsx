"use client";

/**
 * VerificationScreen Component
 * Phase 66-06: Verification UI
 *
 * Real-time verification polling UI that shows:
 * - Waiting state with pulsing animation
 * - Troubleshooting tips after delay
 * - Success celebration with location
 * - OAuth enhancement prompts
 *
 * Copy follows DESIGN.md Section 9 (5th-8th grade level).
 */

import { useEffect } from "react";
import confetti from "canvas-confetti";
import {
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button, Card, CardContent, Separator } from "@tevero/ui";
import { useVerificationPoll, type GeoLocation } from "@/hooks/use-verification-poll";

// ============================================================================
// Types
// ============================================================================

export interface VerificationScreenProps {
  /** Site ID for verification polling */
  siteId: string;
  /** Site URL for "open website" button */
  siteUrl: string;
  /** Called when verification succeeds and user clicks dashboard */
  onSuccess: () => void;
  /** Called when user clicks manual check */
  onManualCheck?: () => void;
  /** Called when user clicks need help */
  onNeedHelp: () => void;
  /** Optional: called when OAuth prompt clicked */
  onConnectOAuth?: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Pulsing dots animation for waiting state.
 */
function PulsingDots() {
  return (
    <div
      data-testid="pulsing-dots"
      className="flex items-center justify-center gap-2 my-8"
      aria-label="Checking for connection"
    >
      <span
        className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

/**
 * Troubleshooting tips shown after delay.
 */
function TroubleshootingTips() {
  return (
    <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
        Taking longer than expected?
      </p>
      <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1.5 list-disc list-inside">
        <li>Make sure you saved the file</li>
        <li>Try refreshing your website</li>
        <li>Clear your browser cache</li>
      </ul>
    </div>
  );
}

/**
 * Success checkmark with animation.
 */
function SuccessCheckmark() {
  return (
    <div className="flex items-center justify-center my-6">
      <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in-50 duration-300">
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
    </div>
  );
}

/**
 * OAuth enhancement prompt card.
 */
function OAuthPrompt({ onConnect }: { onConnect?: () => void }) {
  return (
    <Card className="mt-6 border-dashed">
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-foreground mb-1">
          Want more features?
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          Connect your Google Search Console for ranking data
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onConnect}
          className="group"
        >
          Connect Google Search Console
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VerificationScreen({
  siteId,
  siteUrl,
  onSuccess,
  onManualCheck,
  onNeedHelp,
  onConnectOAuth,
}: VerificationScreenProps) {
  const {
    status,
    isPolling,
    attempts,
    location,
    startPolling,
    checkNow,
  } = useVerificationPoll(siteId);

  // Start polling on mount
  useEffect(() => {
    startPolling();
  }, [startPolling]);

  // Fire confetti on success
  useEffect(() => {
    if (status === "detected" || status === "verified") {
      // Center burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Side bursts
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
      }, 250);

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 400);
    }
  }, [status]);

  const handleManualCheck = () => {
    checkNow();
    onManualCheck?.();
  };

  // Determine if we should show troubleshooting tips
  const showTroubleshooting = attempts >= 1;

  // Success state
  if (status === "detected" || status === "verified") {
    return (
      <div className="max-w-md mx-auto text-center py-8 px-4">
        <SuccessCheckmark />

        <h2 className="text-2xl font-semibold text-foreground mb-2">
          You&apos;re connected!
        </h2>

        {location?.city && location?.country ? (
          <p className="text-muted-foreground">
            We just detected a visitor from {location.city}, {location.country}
          </p>
        ) : (
          <p className="text-muted-foreground">
            We just detected your first visitor!
          </p>
        )}

        <p className="text-sm text-muted-foreground mt-4">
          Your first SEO insights will be ready in 24 hours.
          <br />
          Nothing else to do - go grab a coffee!
        </p>

        <Separator className="my-6" />

        <OAuthPrompt onConnect={onConnectOAuth} />

        <div className="mt-8">
          <Button onClick={onSuccess} size="lg">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Waiting state
  return (
    <div className="max-w-md mx-auto text-center py-8 px-4">
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        Waiting for your website to say hello...
      </h2>

      <PulsingDots />

      <p className="text-muted-foreground mb-6">
        When you&apos;ve added the code, visit your website in a new tab.
        <br />
        We&apos;ll detect it automatically.
      </p>

      <Button variant="outline" asChild className="gap-2">
        <a href={siteUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Open my website in new tab
        </a>
      </Button>

      {showTroubleshooting && <TroubleshootingTips />}

      <Separator className="my-6" />

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualCheck}
          disabled={isPolling}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-4 w-4 ${isPolling ? "animate-spin" : ""}`}
          />
          Check Manually
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNeedHelp}
          className="gap-1.5"
        >
          <HelpCircle className="h-4 w-4" />
          I need help
        </Button>
      </div>
    </div>
  );
}

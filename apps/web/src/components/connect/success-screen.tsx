"use client";

/**
 * SuccessScreen Component
 * Phase 66-06: Verification UI
 *
 * Standalone success celebration screen for pixel verification.
 * Can be used independently or embedded in VerificationScreen.
 *
 * Features:
 * - Confetti celebration animation
 * - Visitor location display
 * - OAuth enhancement prompts
 * - Dashboard navigation
 */

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button, Card, CardContent, Separator } from "@tevero/ui";
import type { GeoLocation } from "@/hooks/use-verification-poll";

// ============================================================================
// Types
// ============================================================================

export interface SuccessScreenProps {
  /** Detected visitor location (optional) */
  location?: GeoLocation;
  /** Called when user clicks go to dashboard */
  onDashboard: () => void;
  /** Called when user clicks connect OAuth */
  onConnectOAuth?: () => void;
  /** Site name for display (optional) */
  siteName?: string;
  /** Whether to show confetti (default: true) */
  showConfetti?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Success checkmark with animation.
 */
function SuccessCheckmark() {
  return (
    <div className="flex items-center justify-center my-6">
      <div
        className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in-50 duration-300"
        data-testid="success-checkmark"
      >
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

export function SuccessScreen({
  location,
  onDashboard,
  onConnectOAuth,
  showConfetti = true,
}: SuccessScreenProps) {
  // Fire confetti on mount
  useEffect(() => {
    if (!showConfetti) return;

    // Center burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Side bursts with cleanup
    const timer1 = setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
    }, 250);

    const timer2 = setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 400);

    // Cleanup: clear timeouts on unmount to prevent memory leaks
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [showConfetti]);

  return (
    <div className="max-w-md mx-auto text-center py-8 px-4">
      <SuccessCheckmark />

      <h2 className="text-2xl font-semibold text-foreground mb-2">
        You're connected!
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
        <Button onClick={onDashboard} size="lg">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

"use client";

/**
 * ConversionSummary Component
 * Phase 51-02: Prospect Conversion
 *
 * Displays a celebration page after successful onboarding completion.
 * Shows confetti animation, connected services, and tier-specific next steps.
 */

import { useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { CheckCircle, ArrowRight, Zap } from "lucide-react";
import { Card, CardContent, Button } from "@tevero/ui";

export interface ConversionSummaryProps {
  clientId: string;
  clientName: string;
  serviceTier: string;
  completedAt: Date;
  connectedServices: string[];
  nextSteps: string[];
}

export function ConversionSummary({
  clientId,
  clientName,
  serviceTier,
  connectedServices,
  nextSteps,
}: ConversionSummaryProps) {
  // Trigger confetti animation on mount
  useEffect(() => {
    // Fire confetti from the center-bottom
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Fire additional bursts for more celebration
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
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome to the team, {clientName}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Onboarding complete. {clientName} is now an active {serviceTier} client.
        </p>
      </div>

      {/* Connected Services */}
      {connectedServices.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Connected Services
            </h3>
            <div className="flex flex-wrap gap-2">
              {connectedServices.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {service}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Next Steps
          </h3>
          <ol className="space-y-3">
            {nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/pipeline">View Pipeline</Link>
        </Button>
        <Button asChild>
          <Link href={`/clients/${clientId}`}>
            Go to Client Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

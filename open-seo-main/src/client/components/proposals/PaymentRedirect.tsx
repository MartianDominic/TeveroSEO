/**
 * Payment Redirect Component
 * Phase 30-06: Payment (Stripe)
 *
 * Initiates Stripe checkout redirect after proposal signing.
 * Shows loading state while creating checkout session.
 */
"use client";

import { useEffect, useState } from "react";
import { createProposalPayment } from "@/serverFunctions/proposals";

interface PaymentRedirectProps {
  token: string;
  onError?: (error: string) => void;
}

/**
 * Automatically redirects to Stripe Checkout after signing.
 *
 * Usage:
 * ```tsx
 * // After signing is complete
 * <PaymentRedirect
 *   token={proposalToken}
 *   onError={(error) => setError(error)}
 * />
 * ```
 */
export function PaymentRedirect({ token, onError }: PaymentRedirectProps) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    const initiatePayment = async () => {
      try {
        const result = await createProposalPayment({ data: { token } });

        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Nepavyko inicijuoti mokejimo";
        setError(message);
        setRedirecting(false);
        onError?.(message);
      }
    };

    initiatePayment();
  }, [token, onError]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Mokejimo klaida</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
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

  if (redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full w-12 h-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">
            Nukreipiame i mokejima...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Palaukite, kol perkeliame jus i saugia mokejimo sistema
          </p>
        </div>
      </div>
    );
  }

  return null;
}

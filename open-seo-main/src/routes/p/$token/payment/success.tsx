/**
 * Payment Success Page
 * Phase 30-06: Payment (Stripe)
 *
 * Displayed after successful Stripe checkout completion.
 * Route: /p/{token}/payment/success
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getProposalPaymentStatus } from "@/serverFunctions/proposals";

export const Route = createFileRoute("/p/$token/payment/success")({
  component: PaymentSuccessPage,
  head: () => ({
    meta: [
      {
        title: "Mokejimas sekmmingas | Tevero",
      },
      {
        name: "robots",
        content: "noindex, nofollow",
      },
    ],
  }),
});

function PaymentSuccessPage() {
  const { token } = Route.useParams();
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [checking, setChecking] = useState(true);

  // Poll for payment confirmation (webhook may be delayed)
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    const interval = 2000; // 2 seconds

    const checkPayment = async () => {
      try {
        const result = await getProposalPaymentStatus({ data: { token } });
        if (result.isPaid) {
          setPaymentConfirmed(true);
          setChecking(false);
          return true;
        }
      } catch {
        // Ignore errors during polling
      }
      return false;
    };

    const poll = async () => {
      const confirmed = await checkPayment();
      if (!confirmed && attempts < maxAttempts) {
        attempts++;
        setTimeout(poll, interval);
      } else {
        setChecking(false);
      }
    };

    poll();

    return () => {
      attempts = maxAttempts; // Stop polling on unmount
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        {checking ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">Tikrinama...</h1>
            <p className="text-muted-foreground">
              Palaukite, kol patvirtinsime jusu mokejima.
            </p>
          </>
        ) : paymentConfirmed ? (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4">Mokejimas sekmingas!</h1>
            <p className="text-muted-foreground mb-6">
              Dekojame! Jusu mokejimas gautas. Netrukus gausite patvirtinimo el.
              laiska.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
              <h2 className="font-semibold mb-2">Kas toliau?</h2>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">1.</span>
                  <span>Musu komanda susisieks su jumis per 24 valandas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">2.</span>
                  <span>Suplanuosime pradini susitikima</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">3.</span>
                  <span>Pradësime SEO optimizavimo darbus</span>
                </li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Turite klausimu?{" "}
              <a
                href="mailto:info@tevero.io"
                className="text-primary hover:underline"
              >
                Susisiekite su mumis
              </a>
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-yellow-600 dark:text-yellow-400"
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
            <h1 className="text-2xl font-bold mb-4">Mokejimas apdorojamas</h1>
            <p className="text-muted-foreground mb-6">
              Jusu mokejimas vis dar apdorojamas. Tai gali uztrukti keletai
              minuciu. Jei mokejimas pavyko, netrukus gausite patvirtinima el.
              pastu.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Bandyti dar karta
            </button>
          </>
        )}
      </div>
    </div>
  );
}

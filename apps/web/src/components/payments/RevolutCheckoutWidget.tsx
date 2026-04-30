"use client";

/**
 * RevolutCheckoutWidget Component
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Wraps @revolut/checkout for popup payment flow.
 * Handles initialization, callbacks, and error states.
 *
 * @see https://developer.revolut.com/docs/revolut-checkout-js
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface RevolutCheckoutWidgetProps {
  orderToken: string;
  onSuccess: () => void;
  onError: (error: Error) => void;
  onCancel: () => void;
  mode?: "popup" | "embedded";
  sandbox?: boolean;
}

type CheckoutState = "loading" | "ready" | "processing" | "error";

export function RevolutCheckoutWidget({
  orderToken,
  onSuccess,
  onError,
  onCancel,
  mode = "popup",
  sandbox = false,
}: RevolutCheckoutWidgetProps) {
  const [state, setState] = useState<CheckoutState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initCheckout = useCallback(async () => {
    if (!orderToken) {
      setErrorMessage("Missing order token");
      setState("error");
      return;
    }

    try {
      setState("loading");
      const RevolutCheckout = (await import("@revolut/checkout")).default;

      const instance = await RevolutCheckout(orderToken, sandbox ? "sandbox" : "prod");

      setState("ready");

      if (mode === "popup") {
        setState("processing");
        instance.payWithPopup({
          onSuccess: () => {
            setState("ready");
            onSuccess();
          },
          onError: (e) => {
            setState("error");
            const msg = e?.message || "Payment failed";
            setErrorMessage(msg);
            onError(new Error(msg));
          },
          onCancel: () => {
            setState("ready");
            onCancel();
          },
        });
      } else {
        const target = document.getElementById("revolut-checkout-container");
        if (target) {
          instance.createCardField({ target });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load checkout";
      setErrorMessage(message);
      setState("error");
      onError(new Error(message));
    }
  }, [orderToken, sandbox, mode, onSuccess, onError, onCancel]);

  useEffect(() => {
    initCheckout();
  }, [initCheckout]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading payment...</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-10 h-10 text-destructive mb-3" />
        <p className="text-destructive font-medium">Payment Error</p>
        <p className="text-sm text-muted-foreground mt-1">
          {errorMessage || "Something went wrong"}
        </p>
        <button
          type="button"
          onClick={initCheckout}
          className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Processing payment...</span>
      </div>
    );
  }

  return (
    <div id="revolut-checkout-container" className="min-h-[200px]">
      {mode === "embedded" && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Card form will appear here
        </p>
      )}
    </div>
  );
}

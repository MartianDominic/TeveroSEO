"use client";

/**
 * RevolutPaymentRequestButton Component
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Apple Pay / Google Pay button via Revolut Payment Request API.
 * Falls back gracefully when digital wallets unavailable.
 *
 * @see https://developer.revolut.com/docs/revolut-checkout-js/#payment-request
 */
import { useEffect, useState, useRef } from "react";

import { Loader2 } from "lucide-react";

interface RevolutPaymentRequestButtonProps {
  publicKey: string;
  amount: number;
  currency: string;
  createOrder: () => Promise<{ token: string }>;
  onSuccess: () => void;
  onError: (error: Error) => void;
  sandbox?: boolean;
}

type ButtonState = "loading" | "available" | "unavailable" | "processing";

interface PaymentRequestInstance {
  canMakePayment: () => Promise<string | false>;
  render: () => void;
  destroy?: () => void;
}

export function RevolutPaymentRequestButton({
  publicKey,
  amount,
  currency,
  createOrder,
  onSuccess,
  onError,
  sandbox = false,
}: RevolutPaymentRequestButtonProps) {
  const [state, setState] = useState<ButtonState>("loading");
  const [availableMethod, setAvailableMethod] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PaymentRequestInstance | null>(null);

  useEffect(() => {
    if (!publicKey || !containerRef.current) return;

    const initPaymentRequest = async () => {
      try {
        const RevolutCheckout = (await import("@revolut/checkout")).default;

        const paymentsModule = await RevolutCheckout.payments({
          publicToken: publicKey,
          locale: "auto",
          mode: sandbox ? "sandbox" : "prod",
        });

        const target = containerRef.current;
        if (!target) return;

        const instance = paymentsModule.paymentRequest(target, {
          currency,
          amount,
          requestShipping: false,
          createOrder: async () => {
            setState("processing");
            const order = await createOrder();
            return { publicId: order.token };
          },
          onSuccess: () => {
            setState("available");
            onSuccess();
          },
          onError: (error) => {
            setState("available");
            onError(new Error(error?.message || "Payment failed"));
          },
          onCancel: () => {
            setState("available");
          },
          buttonStyle: {
            radius: "small",
            variant: "dark",
            size: "large",
          },
        }) as PaymentRequestInstance;

        instanceRef.current = instance;

        const method = await instance.canMakePayment();
        if (method) {
          setAvailableMethod(method);
          setState("available");
          instance.render();
        } else {
          setState("unavailable");
        }
      } catch {
        setState("unavailable");
      }
    };

    initPaymentRequest();

    return () => {
      if (instanceRef.current?.destroy) {
        instanceRef.current.destroy();
      }
    };
  }, [publicKey, amount, currency, createOrder, onSuccess, onError, sandbox]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Checking digital wallet availability...
        </span>
      </div>
    );
  }

  if (state === "unavailable") {
    return null;
  }

  if (state === "processing") {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">
          Processing {availableMethod}...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[48px]" />
      {availableMethod && (
        <p className="text-xs text-center text-muted-foreground">
          Pay with {availableMethod}
        </p>
      )}
    </div>
  );
}

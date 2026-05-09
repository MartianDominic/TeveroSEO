"use client";

/**
 * Invoice Payment Client Component
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Handles provider selection and checkout widget rendering.
 */
import { useState, useCallback } from "react";

import { useRouter } from "next/navigation";
import { redirect } from "next/navigation";

import { CreditCard, Loader2, ExternalLink } from "lucide-react";

type AnyRoute = Parameters<typeof redirect>[0];
import {
  PaymentMethodSelector,
  type PaymentProviderType,
} from "@/components/payments/PaymentMethodSelector";
import { RevolutCheckoutWidget } from "@/components/payments/RevolutCheckoutWidget";
import { RevolutPaymentRequestButton } from "@/components/payments/RevolutPaymentRequestButton";

interface InvoicePaymentClientProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    totalCents: number;
    currency: string;
    dueAt: string | null;
    lineItems: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
    }>;
  };
  payment: {
    availableProviders: string[];
    primaryProvider: string;
    allowClientChoice: boolean;
    revolutPublicKey?: string;
    existingCheckoutUrl?: string;
    existingProvider?: string;
  };
}

type CheckoutState = "idle" | "creating" | "ready" | "error";

export function InvoicePaymentClient({
  invoice,
  payment,
}: InvoicePaymentClientProps) {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>(
    payment.primaryProvider as PaymentProviderType
  );
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(
    payment.existingCheckoutUrl || null
  );
  const [orderToken, setOrderToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatAmount = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const createSession = useCallback(async () => {
    setCheckoutState("creating");
    setError(null);

    try {
      const res = await fetch(`/api/proxy/invoices/${invoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create payment session");
      }

      setCheckoutUrl(data.data.checkoutUrl);
      setOrderToken(data.data.token || null);
      setCheckoutState("ready");

      if (selectedProvider === "stripe" && data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setCheckoutState("error");
    }
  }, [invoice.id, selectedProvider]);

  const handleSuccess = useCallback(() => {
    router.push(`/invoices/${invoice.id}/success` as AnyRoute);
  }, [router, invoice.id]);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
    setCheckoutState("error");
  }, []);

  const handleCancel = useCallback(() => {
    setCheckoutState("idle");
    setOrderToken(null);
  }, []);

  const createRevolutOrder = useCallback(async () => {
    const res = await fetch(`/api/proxy/invoices/${invoice.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "revolut" }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }

    return { token: data.data.token };
  }, [invoice.id]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Invoice Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-8">
        <p className="text-sm text-gray-300 mb-1">Invoice</p>
        <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
        {invoice.dueAt && (
          <p className="text-sm text-gray-400 mt-2">
            Due by{" "}
            {new Date(invoice.dueAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Line Items */}
      <div className="px-6 py-6 border-b">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Items</h2>
        <div className="space-y-3">
          {invoice.lineItems.map((item) => (
            <div key={item.id} className="flex justify-between">
              <div>
                <p className="font-medium text-gray-900">{item.description}</p>
                <p className="text-sm text-gray-500">
                  {item.quantity} × {formatAmount(item.unitPriceCents, invoice.currency)}
                </p>
              </div>
              <p className="font-medium text-gray-900">
                {formatAmount(item.totalCents, invoice.currency)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t flex justify-between items-center">
          <p className="text-lg font-semibold text-gray-900">Total</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatAmount(invoice.totalCents, invoice.currency)}
          </p>
        </div>
      </div>

      {/* Payment Selection */}
      <div className="px-6 py-6">
        {payment.allowClientChoice && payment.availableProviders.length > 1 && (
          <div className="mb-6">
            <PaymentMethodSelector
              providers={payment.availableProviders as PaymentProviderType[]}
              selected={selectedProvider}
              onSelect={setSelectedProvider}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Revolut Quick Pay (Apple/Google Pay) */}
        {selectedProvider === "revolut" && payment.revolutPublicKey && checkoutState === "idle" && (
          <div className="mb-4">
            <RevolutPaymentRequestButton
              publicKey={payment.revolutPublicKey}
              amount={invoice.totalCents}
              currency={invoice.currency}
              createOrder={createRevolutOrder}
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">or</span>
              </div>
            </div>
          </div>
        )}

        {/* Revolut Checkout Widget */}
        {selectedProvider === "revolut" &&
          checkoutState === "ready" &&
          orderToken && (
            <RevolutCheckoutWidget
              orderToken={orderToken}
              onSuccess={handleSuccess}
              onError={handleError}
              onCancel={handleCancel}
            />
          )}

        {/* Pay Button */}
        {checkoutState !== "ready" && (
          <button
            type="button"
            onClick={createSession}
            disabled={checkoutState === "creating"}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {checkoutState === "creating" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Preparing checkout...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                <span>
                  Pay {formatAmount(invoice.totalCents, invoice.currency)}
                </span>
              </>
            )}
          </button>
        )}

        {/* Stripe redirect notice */}
        {selectedProvider === "stripe" && checkoutState === "ready" && checkoutUrl && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              Redirecting to Stripe checkout...
            </p>
            <a
              href={checkoutUrl}
              className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
            >
              <span>Click here if not redirected</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Security Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>Secured payment powered by {selectedProvider === "stripe" ? "Stripe" : "Revolut"}</span>
        </div>
      </div>
    </div>
  );
}

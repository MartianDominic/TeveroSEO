/**
 * Public invoice payment page.
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Server component that fetches invoice and renders payment checkout.
 * No authentication required - clients access via shared link.
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 */
import { notFound } from "next/navigation";

import { getOpenSeoUrl } from "@/lib/env";

import { InvoicePaymentClient } from "./InvoicePaymentClient";

interface Props {
  params: Promise<{ id: string }>;
}

interface InvoicePaymentData {
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

async function getInvoicePaymentDetails(
  id: string
): Promise<{ success: boolean; data?: InvoicePaymentData; error?: string }> {
  // CFG-CRIT-01 FIX: Use centralized env validation
  const apiUrl = getOpenSeoUrl();

  try {
    const res = await fetch(`${apiUrl}/api/invoices/${id}/pay`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || "not_found" };
    }

    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: "network" };
  }
}

export default async function InvoicePayPage({ params }: Props) {
  const { id } = await params;
  const result = await getInvoicePaymentDetails(id);

  if (!result.success || !result.data) {
    if (result.error === "not_found") {
      notFound();
    }

    if (result.error === "Invoice is not available for payment") {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Invoice Already Paid
            </h1>
            <p className="text-gray-600">
              This invoice has already been paid or is no longer available for payment.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-600"
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
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Failed to Load Invoice
          </h1>
          <p className="text-gray-600">
            Unable to load the invoice. Please try again later or contact support.
          </p>
        </div>
      </div>
    );
  }

  const { invoice, payment } = result.data;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-lg mx-auto px-4">
        <InvoicePaymentClient
          invoice={invoice}
          payment={payment}
        />
      </div>
    </div>
  );
}

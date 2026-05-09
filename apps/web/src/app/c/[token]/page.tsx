/**
 * Public Agreement Signing Page
 * Phase 65: User Journey Fix - CRIT-J1
 *
 * Route: /c/[token]
 *
 * Features:
 * - Validate token and expiry
 * - Display agreement/contract for signing
 * - Electronic signature capture
 * - Redirect to invoice/payment after signing
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Metadata } from "next";


import { getOpenSeoUrl } from "@/lib/env";
import { logger } from '@/lib/logger';

import { PublicAgreementView } from "./PublicAgreementView";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgreementData {
  id: string;
  contractId: string;
  proposalId?: string;
  status: string;
  content: {
    title: string;
    parties: {
      provider: {
        name: string;
        address?: string;
        registrationNumber?: string;
      };
      client: {
        name: string;
        email: string;
        address?: string;
      };
    };
    terms: string[];
    scope: string[];
    pricing: {
      setupFeeCents: number;
      monthlyFeeCents: number;
      currency: string;
    };
  };
  expiresAt: string | null;
  createdAt: string;
}

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getAgreement(token: string): Promise<AgreementData | null> {
  // CFG-CRIT-01 FIX: Use centralized env validation
  const apiUrl = getOpenSeoUrl();

  try {
    const response = await fetch(`${apiUrl}/api/agreements/public/${token}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      return null;
    }

    return result.data;
  } catch (error) {
    logger.error("Failed to fetch agreement", error instanceof Error ? error : { error: String(error) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const agreement = await getAgreement(token);

  if (!agreement) {
    return {
      title: "Agreement Not Found",
      robots: "noindex, nofollow",
    };
  }

  return {
    title: agreement.content?.title ?? "Service Agreement",
    description: "Review and sign your service agreement",
    robots: "noindex, nofollow",
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function PublicAgreementPage({ params }: PageProps) {
  const { token } = await params;

  // Validate token format (32 char nanoid)
  if (!token || token.length !== 32) {
    notFound();
  }

  // Fetch agreement data
  const agreement = await getAgreement(token);

  if (!agreement) {
    notFound();
  }

  // Check expiry
  if (agreement.expiresAt) {
    const expiryDate = new Date(agreement.expiresAt);
    if (expiryDate < new Date()) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-1">
          <div className="text-center max-w-md px-4">
            <h1 className="text-2xl font-semibold text-text-1 mb-2">
              Agreement Expired
            </h1>
            <p className="text-text-3">
              This agreement link has expired. Please contact us for an updated agreement.
            </p>
          </div>
        </div>
      );
    }
  }

  // Check if already signed - show comprehensive next steps (CRIT-16 fix)
  if (agreement.status === "signed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1 py-12 px-4">
        <div className="max-w-lg w-full">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-success"
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
            <h1 className="text-2xl font-semibold text-text-1 mb-2">
              Agreement Signed Successfully
            </h1>
            <p className="text-text-3">
              Thank you! Your signed agreement has been received and is now being processed.
            </p>
          </div>

          {/* What happens next */}
          <div className="bg-surface-2 rounded-lg p-6 mb-6">
            <h2 className="font-semibold text-text-1 mb-4">What happens next?</h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-text-1">Confirmation email sent</p>
                  <p className="text-sm text-text-3">Check your inbox for a copy of the signed agreement</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-accent">2</span>
                </div>
                <div>
                  <p className="font-medium text-text-1">Invoice within 24 hours</p>
                  <p className="text-sm text-text-3">You will receive an invoice via email with payment instructions</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-accent">3</span>
                </div>
                <div>
                  <p className="font-medium text-text-1">Onboarding begins</p>
                  <p className="text-sm text-text-3">Your dedicated team member will reach out to get started</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/api/agreements/${agreement.id}/download?token=${token}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-border bg-surface-2 text-text-1 hover:bg-surface-3 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Agreement
            </a>
            <a
              href="mailto:support@tevero.io"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-border bg-surface-2 text-text-1 hover:bg-surface-3 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Us
            </a>
          </div>

          {/* Footer info */}
          <p className="text-center text-text-4 text-xs mt-8">
            Questions? Email us at{" "}
            <a href="mailto:support@tevero.io" className="text-accent hover:underline">
              support@tevero.io
            </a>{" "}
            or call{" "}
            <a href="tel:+37060000000" className="text-accent hover:underline">
              +370 600 00000
            </a>
          </p>
        </div>
      </div>
    );
  }

  return <PublicAgreementView agreement={agreement} token={token} />;
}

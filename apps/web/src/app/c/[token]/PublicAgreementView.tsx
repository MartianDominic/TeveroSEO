"use client";

/**
 * PublicAgreementView - Agreement signing interface for public links.
 * Phase 65: User Journey Fix - CRIT-J1
 *
 * Features:
 * - Display agreement terms and conditions
 * - Electronic signature input
 * - Sign and accept functionality
 * - Redirect to payment after signing
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgreementContent {
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
}

interface AgreementData {
  id: string;
  contractId: string;
  proposalId?: string;
  status: string;
  content: AgreementContent;
  expiresAt: string | null;
  createdAt: string;
}

export interface PublicAgreementViewProps {
  agreement: AgreementData;
  token: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicAgreementView({ agreement, token }: PublicAgreementViewProps) {
  const router = useRouter();
  const { content } = agreement;

  const [signature, setSignature] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSign = signature.trim().length >= 2 && agreedToTerms;

  const handleSign = useCallback(async () => {
    if (!canSign) return;

    setIsSigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/agreements/${agreement.id}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          signature: signature.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to sign agreement");
      }

      const result = await response.json();

      // Redirect to payment page if available, otherwise show success
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else if (result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        // Refresh to show signed state
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign agreement");
    } finally {
      setIsSigning(false);
    }
  }, [agreement.id, token, signature, canSign, router]);

  return (
    <div className="min-h-screen bg-surface-1 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <FileText className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-text-1 mb-2">
            {content.title}
          </h1>
          <p className="text-text-3">
            Please review the terms below and sign to proceed
          </p>
        </div>

        {/* Parties */}
        <div className="bg-surface-2 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-1 mb-4">Parties</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-text-3 mb-1">Service Provider</p>
              <p className="font-medium text-text-1">{content.parties.provider.name}</p>
              {content.parties.provider.address && (
                <p className="text-sm text-text-2">{content.parties.provider.address}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-text-3 mb-1">Client</p>
              <p className="font-medium text-text-1">{content.parties.client.name}</p>
              <p className="text-sm text-text-2">{content.parties.client.email}</p>
            </div>
          </div>
        </div>

        {/* Scope of Services */}
        <div className="bg-surface-2 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-1 mb-4">Scope of Services</h2>
          <ul className="space-y-2">
            {content.scope.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <span className="text-text-2">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing */}
        <div className="bg-surface-2 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-1 mb-4">Investment</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-surface-1 rounded-lg p-4 text-center">
              <p className="text-sm text-text-3 mb-1">Setup Fee</p>
              <p className="text-2xl font-bold text-text-1">
                {formatCurrency(content.pricing.setupFeeCents, content.pricing.currency)}
              </p>
              <p className="text-xs text-text-3">one-time</p>
            </div>
            <div className="bg-surface-1 rounded-lg p-4 text-center">
              <p className="text-sm text-text-3 mb-1">Monthly Fee</p>
              <p className="text-2xl font-bold text-text-1">
                {formatCurrency(content.pricing.monthlyFeeCents, content.pricing.currency)}
              </p>
              <p className="text-xs text-text-3">per month</p>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="bg-surface-2 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-1 mb-4">Terms & Conditions</h2>
          <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-4 bg-surface-1">
            <ol className="list-decimal list-inside space-y-2 text-sm text-text-2">
              {content.terms.map((term, index) => (
                <li key={index}>{term}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-surface-2 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-1 mb-4 flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Electronic Signature
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="signature" className="block text-sm font-medium text-text-2 mb-2">
                Type your full name to sign
              </label>
              <Input
                id="signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={content.parties.client.name}
                className="font-cursive text-lg"
                disabled={isSigning}
              />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                disabled={isSigning}
              />
              <label htmlFor="terms" className="text-sm text-text-2 leading-tight">
                I have read and agree to the terms and conditions outlined above.
                I understand that this electronic signature is legally binding.
              </label>
            </div>
          </div>
        </div>

        {/* Sign Button */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={handleSign}
            disabled={!canSign || isSigning}
            className={cn(
              "px-12 py-6 text-lg font-semibold",
              canSign && !isSigning ? "bg-accent hover:bg-accent-dark" : ""
            )}
          >
            {isSigning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Signing...
              </>
            ) : (
              <>
                <PenLine className="h-5 w-5 mr-2" />
                Sign Agreement
              </>
            )}
          </Button>

          {error && (
            <p className="mt-4 text-error text-sm">{error}</p>
          )}

          <p className="mt-4 text-text-3 text-sm">
            After signing, you will be redirected to complete payment.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-text-4 text-xs">
            This agreement was generated on {new Date(agreement.createdAt).toLocaleDateString()}.
            {agreement.expiresAt && (
              <> Valid until {new Date(agreement.expiresAt).toLocaleDateString()}.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PublicAgreementView;

"use client";

/**
 * Signature section combining consent and signing buttons.
 * Phase 59: Agreement & Signing Excellence
 *
 * Shows appropriate UI based on signer status:
 * - "signed" -> Already signed message
 * - canSign=false -> Waiting message
 * - canSign=true -> Consent checkbox + signing buttons
 */
import { useState } from "react";

import { CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ConsentCheckbox } from "./ConsentCheckbox";
import { SigningButtons } from "./SigningButtons";

interface SignatureSectionProps {
  token: string;
  canSign: boolean;
  signingMessage?: string;
  signerName: string;
  signerStatus: string;
}

export function SignatureSection({
  token,
  canSign,
  signingMessage,
  signerName,
  signerStatus,
}: SignatureSectionProps) {
  const t = useTranslations("agreement.viewer");
  const [hasConsented, setHasConsented] = useState(false);

  // Already signed state
  if (signerStatus === "signed") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-green-800 font-medium text-lg">
            {t("alreadySigned")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Cannot sign yet (waiting for others in sequential mode)
  if (!canSign) {
    return (
      <Card className="border-gray-200">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">
            {signingMessage || t("waitingForPreviousSigner", { name: "" })}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Can sign - show consent and buttons
  return (
    <Card className="border-blue-200 bg-white">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Signer info */}
        <p className="text-sm text-gray-600">
          Signing as: <span className="font-medium">{signerName}</span>
        </p>

        {/* Consent checkbox - required before signing */}
        <ConsentCheckbox
          checked={hasConsented}
          onCheckedChange={setHasConsented}
        />

        {/* Signing buttons - disabled until consent given */}
        <SigningButtons token={token} disabled={!hasConsented} />

        {/* Help text */}
        <p className="text-xs text-gray-500 text-center">
          {t("needHelp", { email: "support@tevero.lt" })}
        </p>
      </CardContent>
    </Card>
  );
}

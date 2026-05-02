"use client";

/**
 * Signing buttons for Smart-ID, Mobile-ID, and ID Card.
 * Phase 59: Agreement & Signing Excellence
 *
 * Initiates Dokobit signing session per D-21.
 * Redirects to Dokobit for actual signing flow.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, CreditCard } from "lucide-react";
import { initiateSigning } from "@/app/[locale]/c/[token]/actions";

interface SigningButtonsProps {
  token: string;
  disabled: boolean;
}

type SigningMethod = "smart-id" | "mobile-id" | "id-card";

export function SigningButtons({ token, disabled }: SigningButtonsProps) {
  const t = useTranslations("agreement.viewer");
  const [isLoading, setIsLoading] = useState<SigningMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSign = async (method: SigningMethod) => {
    setIsLoading(method);
    setError(null);

    try {
      const result = await initiateSigning(token, method);

      if ("error" in result) {
        setError(getErrorMessage(result.error, t));
        setIsLoading(null);
        return;
      }

      // Redirect to Dokobit signing page
      window.location.href = result.redirectUrl;
    } catch {
      setError(t("signWithSmartId") + " failed"); // Fallback error
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Smart-ID - Primary option */}
      <Button
        className="w-full h-12"
        onClick={() => handleSign("smart-id")}
        disabled={disabled || isLoading !== null}
      >
        {isLoading === "smart-id" ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Smartphone className="w-5 h-5 mr-2" />
        )}
        {t("signWithSmartId")}
      </Button>

      {/* Mobile-ID - Secondary option */}
      <Button
        variant="outline"
        className="w-full h-12"
        onClick={() => handleSign("mobile-id")}
        disabled={disabled || isLoading !== null}
      >
        {isLoading === "mobile-id" ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Smartphone className="w-5 h-5 mr-2" />
        )}
        {t("signWithMobileId")}
      </Button>

      {/* ID Card - Tertiary option */}
      <Button
        variant="ghost"
        className="w-full h-12 text-gray-600"
        onClick={() => handleSign("id-card")}
        disabled={disabled || isLoading !== null}
      >
        {isLoading === "id-card" ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <CreditCard className="w-5 h-5 mr-2" />
        )}
        {t("signWithIdCard")}
      </Button>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 text-center mt-2">{error}</p>
      )}
    </div>
  );
}

/**
 * Map error codes to user-friendly messages.
 */
function getErrorMessage(
  errorCode: string,
  t: ReturnType<typeof useTranslations>
): string {
  switch (errorCode) {
    case "cannot_sign_yet":
      return t("waitingForPreviousSigner", { name: "" });
    case "token_expired":
      return "Link has expired";
    case "network_error":
      return "Network error. Please try again.";
    default:
      return "Failed to initiate signing. Please try again.";
  }
}

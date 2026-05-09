/**
 * Post-signing success page.
 * Phase 59-08: Success Page & Status Tracking
 *
 * Displayed after a signer completes their signature.
 * Shows confirmation, progress, and download option when complete.
 */
import { redirect } from "next/navigation";

type AnyRoute = Parameters<typeof redirect>[0];
import { CheckCircle, Download, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@tevero/ui";
import { Button } from "@tevero/ui";

import Link from "next/link";

import { getContractByToken } from "../actions";

interface Props {
  params: Promise<{ token: string; locale: string }>;
}

export default async function SigningSuccessPage({ params }: Props) {
  const { token, locale } = await params;
  const t = await getTranslations("agreement");

  const result = await getContractByToken(token);

  // Handle expired or invalid token
  if ("error" in result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-gray-600">{t("success.linkExpired")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { signer, agreement } = result;

  // Format signed date for display - use signer.signedAt from database to avoid hydration mismatch
  // FIX-06 C12: Using database timestamp instead of new Date() prevents server/client time differences
  const formattedSignedAt = signer.status === "signed" && signer.signedAt
    ? new Date(signer.signedAt).toLocaleDateString(
        locale === "lt" ? "lt-LT" : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    : null;

  // Calculate progress percentage
  const progressPercent = agreement.totalSigners > 0 ? (agreement.signedCount / agreement.totalSigners) * 100 : 0;
  const progress = {
    signed: agreement.signedCount,
    total: agreement.totalSigners,
    isComplete: agreement.signedCount === agreement.totalSigners,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="py-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {t("success.title")}
          </h1>

          {/* Personalized message */}
          <p className="text-center text-gray-600 mb-6">
            {t("success.message", { name: signer.name })}
          </p>

          {/* Agreement info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">{t("success.document")}</p>
            <p className="font-medium text-gray-900">{agreement.title}</p>

            {formattedSignedAt && (
              <>
                <p className="text-sm text-gray-500 mt-3 mb-1">
                  {t("success.signedAt")}
                </p>
                <p className="font-medium text-gray-900">{formattedSignedAt}</p>
              </>
            )}
          </div>

          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">{t("success.signingProgress")}</span>
              <span className="font-medium">
                {progress.signed} / {progress.total}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progress.isComplete && (
              <p className="text-sm text-green-600 mt-2 text-center">
                {t("success.allSigned")}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {progress.isComplete && (
              <Button asChild className="w-full">
                <Link
                  href={`/api/agreements/${agreement.id}/pdf?locale=${locale}` as AnyRoute}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("success.downloadPdf")}
                </Link>
              </Button>
            )}

            <p className="text-sm text-gray-500 text-center flex items-center justify-center gap-1">
              <Mail className="w-4 h-4" />
              {t("success.emailConfirmation")}
            </p>
          </div>

          {/* Close/Done message */}
          <p className="text-sm text-gray-400 text-center mt-6">
            {t("success.closeTab")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

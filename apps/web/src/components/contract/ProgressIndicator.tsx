"use client";

/**
 * Progress indicator for multi-signer contracts.
 * Phase 59: Agreement & Signing Excellence
 *
 * Shows signing progress per D-07 (sequential) and D-08 (parallel).
 * Per D-18: Progress indicator shows section completion.
 */
import { CheckCircle, Circle, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface ProgressIndicatorProps {
  mode: "sequential" | "parallel";
  totalSigners: number;
  signedCount: number;
  currentOrder: number;
}

export function ProgressIndicator({
  mode,
  totalSigners,
  signedCount,
  currentOrder,
}: ProgressIndicatorProps) {
  const t = useTranslations("agreement.viewer");

  // Only show progress for multi-signer contracts
  if (totalSigners <= 1) {
    return null;
  }

  if (mode === "parallel") {
    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-sm text-blue-800">
          {t("progress", { current: signedCount, total: totalSigners })}
        </p>
      </div>
    );
  }

  // Sequential mode - show step indicators
  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSigners }, (_, i) => {
          const order = i + 1;
          const isSigned = order <= signedCount;
          const isCurrent = order === currentOrder;

          return (
            <div key={order} className="flex items-center">
              {/* Step indicator */}
              <div className="relative">
                {isSigned ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : isCurrent ? (
                  <Clock className="w-8 h-8 text-blue-500" />
                ) : (
                  <Circle className="w-8 h-8 text-gray-300" />
                )}
                {/* Step number */}
                <span
                  className={`absolute inset-0 flex items-center justify-center text-xs-safe font-medium ${
                    isSigned
                      ? "text-green-700"
                      : isCurrent
                        ? "text-blue-700"
                        : "text-gray-400"
                  }`}
                >
                  {isSigned ? "" : order}
                </span>
              </div>

              {/* Connector line */}
              {order < totalSigners && (
                <div
                  className={`w-12 h-0.5 mx-1 ${
                    isSigned ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-gray-600 text-center mt-3">
        {t("progress", { current: signedCount, total: totalSigners })}
      </p>
    </div>
  );
}

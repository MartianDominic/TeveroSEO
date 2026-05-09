"use client";

/**
 * AgreementStatusTracker Component
 * Phase 59-08: Success Page & Status Tracking
 *
 * Displays overall agreement status with a progress tracker.
 * Shows visual timeline of the agreement lifecycle.
 */

import { CheckCircle, FileText, Send, Eye, PenTool, Download } from "lucide-react";

import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, ProgressBar } from "@tevero/ui";

export type AgreementStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_signed"
  | "completed"
  | "cancelled";

interface AgreementStatusTrackerProps {
  status: AgreementStatus;
  totalSigners: number;
  signedCount: number;
  createdAt: string;
  sentAt?: string | null;
  completedAt?: string | null;
  locale?: string;
}

interface StatusStep {
  key: string;
  label: string;
  labelLt: string;
  icon: React.ElementType;
}

const STEPS: StatusStep[] = [
  { key: "created", label: "Created", labelLt: "Sukurta", icon: FileText },
  { key: "sent", label: "Sent", labelLt: "Issiusta", icon: Send },
  { key: "viewed", label: "Viewed", labelLt: "Perziureta", icon: Eye },
  { key: "signing", label: "Signing", labelLt: "Pasirasymas", icon: PenTool },
  { key: "completed", label: "Completed", labelLt: "Baigta", icon: CheckCircle },
];

const STATUS_TO_STEP: Record<AgreementStatus, number> = {
  draft: 0,
  sent: 1,
  viewed: 2,
  partially_signed: 3,
  completed: 4,
  cancelled: -1,
};

export function AgreementStatusTracker({
  status,
  totalSigners,
  signedCount,
  createdAt,
  sentAt,
  completedAt,
  locale = "en",
}: AgreementStatusTrackerProps) {
  const currentStep = STATUS_TO_STEP[status];
  const progressPercent = totalSigners > 0 ? (signedCount / totalSigners) * 100 : 0;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(locale === "lt" ? "lt-LT" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusLabel = () => {
    if (status === "cancelled") {
      return locale === "lt" ? "Atsaukta" : "Cancelled";
    }
    if (status === "completed") {
      return locale === "lt" ? "Visi pasirasymai gauti" : "All signatures collected";
    }
    if (status === "partially_signed") {
      return locale === "lt"
        ? `${signedCount} is ${totalSigners} pasirasymu`
        : `${signedCount} of ${totalSigners} signatures`;
    }
    return locale === "lt" ? "Laukiama parasu" : "Awaiting signatures";
  };

  if (status === "cancelled") {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-600">
            {locale === "lt" ? "Sutartis atsaukta" : "Agreement Cancelled"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {locale === "lt"
              ? "Si sutartis buvo atsaukta ir nebegali buti pasirasytas."
              : "This agreement has been cancelled and can no longer be signed."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {locale === "lt" ? "Sutarties busena" : "Agreement Status"}
          </CardTitle>
          <span
            className={cn(
              "text-sm font-medium px-2 py-1 rounded-full",
              status === "completed"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            )}
          >
            {getStatusLabel()}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step Indicators */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index <= currentStep;
            const isCurrent = index === currentStep;

            return (
              <div
                key={step.key}
                className={cn(
                  "flex flex-col items-center gap-2",
                  index < STEPS.length - 1 && "flex-1"
                )}
              >
                <div className="relative flex items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : isCurrent
                        ? "border-blue-500 bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                        : "border-muted bg-muted text-muted-foreground"
                    )}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>

                  {/* Connector line */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "absolute left-10 h-0.5 w-full -translate-x-0",
                        "min-w-[40px] max-w-[100px]",
                        isCompleted ? "bg-green-500" : "bg-muted"
                      )}
                      style={{ width: "calc(100% - 40px)" }}
                    />
                  )}
                </div>

                <span
                  className={cn(
                    "text-xs text-center",
                    isCompleted || isCurrent
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {locale === "lt" ? step.labelLt : step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Signature Progress */}
        {totalSigners > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {locale === "lt" ? "Pasirasymo eiga" : "Signature Progress"}
              </span>
              <span className="font-medium">
                {signedCount} / {totalSigners}
              </span>
            </div>
            <ProgressBar value={progressPercent} size="md" />
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {locale === "lt" ? "Sukurta" : "Created"}
            </span>
            <span>{formatDate(createdAt)}</span>
          </div>

          {sentAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {locale === "lt" ? "Issiusta" : "Sent"}
              </span>
              <span>{formatDate(sentAt)}</span>
            </div>
          )}

          {completedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {locale === "lt" ? "Baigta" : "Completed"}
              </span>
              <span className="text-green-600 font-medium">
                {formatDate(completedAt)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AgreementStatusTracker;

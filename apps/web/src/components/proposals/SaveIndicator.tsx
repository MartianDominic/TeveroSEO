/**
 * SaveIndicator Component - Status display for auto-save
 * Phase 57-06: Auto-Save + Version History
 */
"use client";

import { Loader2, Check, AlertCircle, Cloud, CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SaveStatus } from "@/hooks/useAutoSave";
import { cn } from "@/lib/utils";

// Relative time formatting
function formatRelativeTime(date: Date | null, locale: string): string {
  if (!date) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSec < 60) {
    return rtf.format(-diffSec, "second");
  } else if (diffMin < 60) {
    return rtf.format(-diffMin, "minute");
  } else if (diffHour < 24) {
    return rtf.format(-diffHour, "hour");
  } else {
    return rtf.format(-Math.floor(diffHour / 24), "day");
  }
}

export interface SaveIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Last successful save timestamp */
  lastSavedAt: Date | null;
  /** Number of items in offline queue */
  offlineQueueCount?: number;
  /** Called when retry button clicked */
  onRetry?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Save status indicator with spinner, checkmark, warning, and relative time
 */
export function SaveIndicator({
  status,
  lastSavedAt,
  offlineQueueCount = 0,
  onRetry,
  className,
}: SaveIndicatorProps) {
  const t = useTranslations("proposals.saveIndicator");

  // Get locale for relative time formatting
  const locale =
    typeof window !== "undefined" ? navigator.language : "en";

  const relativeTime = formatRelativeTime(lastSavedAt, locale);

  // Status-specific rendering
  const renderStatus = () => {
    switch (status) {
      case "saving":
        return (
          <div className="flex items-center gap-1.5 text-text-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-sm">{t("saving")}</span>
          </div>
        );

      case "saved":
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-success">
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-sm">{t("saved")}</span>
                  {relativeTime && (
                    <span className="text-text-3 text-xs">
                      ({relativeTime})
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {lastSavedAt?.toLocaleString(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );

      case "error":
        return (
          <div className="flex items-center gap-1.5 text-error">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-sm">{t("error")}</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-6 px-2 text-xs"
              >
                {t("retry")}
              </Button>
            )}
          </div>
        );

      case "idle":
      default:
        return (
          <div className="flex items-center gap-1.5 text-text-3">
            <Cloud className="h-3.5 w-3.5" />
            <span className="text-sm">{t("idle")}</span>
          </div>
        );
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderStatus()}

      {/* Offline queue indicator */}
      {offlineQueueCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-warning">
                <CloudOff className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {t("offline", { count: offlineQueueCount })}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("offlineTooltip", { count: offlineQueueCount })}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

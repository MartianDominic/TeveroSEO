"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import type { ArticleStatus } from "./types";

// ---------------------------------------------------------------------------
// Status Configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ArticleStatus,
  {
    label: string;
    dotClass: string;
    bgClass: string;
    textClass: string;
  }
> = {
  published: {
    label: "Published",
    dotClass: "bg-success",
    bgClass: "bg-success-soft",
    textClass: "text-success",
  },
  scheduled: {
    label: "Scheduled",
    dotClass: "bg-info",
    bgClass: "bg-info-soft",
    textClass: "text-info",
  },
  draft: {
    label: "Draft",
    dotClass: "bg-warning",
    bgClass: "bg-warning-soft",
    textClass: "text-warning",
  },
  in_progress: {
    label: "In Progress",
    dotClass: "bg-accent",
    bgClass: "bg-accent-soft",
    textClass: "text-accent",
  },
  publishing: {
    label: "Publishing",
    dotClass: "bg-info",
    bgClass: "bg-info-soft",
    textClass: "text-info",
  },
  overdue: {
    label: "Overdue",
    dotClass: "bg-error",
    bgClass: "bg-error-soft",
    textClass: "text-error",
  },
};

// ---------------------------------------------------------------------------
// ArticleStatusBadge
// ---------------------------------------------------------------------------

export interface ArticleStatusBadgeProps {
  /** Article status */
  status: ArticleStatus;
  /** Optional countdown text (e.g., "in 4h 23m") */
  countdown?: string;
  /** Is the countdown urgent? (< 1 hour) */
  isUrgent?: boolean;
  /** Show as dot only (for compact displays) */
  dotOnly?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * ArticleStatusBadge displays the publication status of an article.
 *
 * Visual patterns:
 * - Published: solid green dot
 * - Scheduled: hollow blue ring with countdown
 * - Draft: half-filled yellow dot
 * - In Progress: accent dot with soft halo
 * - Overdue: red dot with warning styling
 *
 * @example
 * <ArticleStatusBadge status="scheduled" countdown="in 4h 23m" />
 * <ArticleStatusBadge status="published" />
 * <ArticleStatusBadge status="draft" dotOnly />
 */
export function ArticleStatusBadge({
  status,
  countdown,
  isUrgent,
  dotOnly = false,
  className,
}: ArticleStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Dot-only mode (for compact calendar cells)
  if (dotOnly) {
    return (
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full shrink-0",
          config.dotClass,
          // Soft halo for in_progress
          status === "in_progress" && "ring-2 ring-accent-soft",
          // Hollow ring for scheduled
          status === "scheduled" && "bg-transparent ring-2 ring-info",
          className
        )}
        title={config.label}
        aria-label={config.label}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2 py-0.5",
        "rounded-full",
        "text-[12px] font-medium",
        "tracking-[0.02em]",
        config.bgClass,
        config.textClass,
        // Urgent countdown styling
        isUrgent && status === "scheduled" && "animate-pulse",
        className
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          config.dotClass,
          // Hollow ring for scheduled
          status === "scheduled" && "bg-transparent ring-[1.5px] ring-current"
        )}
      />

      {/* Label */}
      <span className="[font-variant-caps:all-small-caps]">
        {config.label}
      </span>

      {/* Countdown (for scheduled articles) */}
      {countdown && (
        <span className="font-mono text-[11px] opacity-80">{countdown}</span>
      )}
    </span>
  );
}

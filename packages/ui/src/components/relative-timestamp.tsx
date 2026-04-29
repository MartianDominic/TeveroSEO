"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { formatRelativeTime, formatDateTime } from "../lib/format-time";

/**
 * Props for RelativeTimestamp component
 */
export interface RelativeTimestampProps {
  timestamp: string | Date;
  prefix?: string;
  className?: string;
  mono?: boolean;
}

/**
 * A timestamp component that displays relative time (e.g., "5 minutes ago")
 * with a tooltip showing the full date-time.
 * Uses v6 design tokens.
 */
export function RelativeTimestamp({
  timestamp,
  prefix,
  className,
  mono = false,
}: RelativeTimestampProps) {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const relativeTime = formatRelativeTime(date);
  const fullDateTime = formatDateTime(date);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        "text-[length:var(--type-tiny)] text-text-3",
        className
      )}
      title={fullDateTime}
    >
      {prefix && (
        <span className="text-text-4">{prefix}</span>
      )}
      <time
        dateTime={date.toISOString()}
        className={cn(
          mono && "font-mono [font-variant-numeric:tabular-nums_lining-nums]"
        )}
      >
        {relativeTime}
      </time>
    </span>
  );
}

RelativeTimestamp.displayName = "RelativeTimestamp";

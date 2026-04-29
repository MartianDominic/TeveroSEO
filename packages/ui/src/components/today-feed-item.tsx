"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { formatShortTime } from "../lib/format-time";

// ---------------------------------------------------------------------------
// TodayFeedItemProps
// ---------------------------------------------------------------------------

export interface TodayFeedItemProps {
  /** Event timestamp */
  timestamp: string | Date;
  /** Event title */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional semantic tag */
  tag?: {
    label: string;
    variant: "ranking" | "audit" | "alert" | "report" | "connection";
  };
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Tag variant colors
// ---------------------------------------------------------------------------

const TAG_VARIANTS = {
  ranking: {
    dot: "bg-accent",
    text: "text-accent",
  },
  audit: {
    dot: "bg-info",
    text: "text-info",
  },
  alert: {
    dot: "bg-error",
    text: "text-error",
  },
  report: {
    dot: "bg-success",
    text: "text-success",
  },
  connection: {
    dot: "bg-warning",
    text: "text-warning",
  },
} as const;

// ---------------------------------------------------------------------------
// TodayFeedItem
// ---------------------------------------------------------------------------

/**
 * TodayFeedItem displays an activity feed item with:
 * - Two-column layout: mono timestamp (44px fixed width) + body content
 * - Title in text-type-small, text-text-1
 * - Description in text-type-small, text-text-2
 * - Tag with semantic dot + small-caps label
 *
 * @example
 * <TodayFeedItem
 *   timestamp={new Date()}
 *   title="Ranking improved for 'best seo tools'"
 *   description="Position moved from #8 to #5"
 *   tag={{ label: "Ranking", variant: "ranking" }}
 * />
 */
export function TodayFeedItem({
  timestamp,
  title,
  description,
  tag,
  onClick,
  className,
}: TodayFeedItemProps) {
  const formattedTime = formatShortTime(timestamp);
  const tagColors = tag ? TAG_VARIANTS[tag.variant] : null;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        // Two-column grid layout
        "grid grid-cols-[44px_1fr] gap-3",
        // Padding and rounded
        "px-3 py-2.5",
        "rounded-lg",
        // Hover state
        "transition-colors duration-[160ms]",
        onClick && [
          "cursor-pointer",
          "hover:bg-surface-2",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
        ],
        className
      )}
    >
      {/* Timestamp column (44px fixed width) */}
      <span
        className={cn(
          "font-mono",
          "text-[12px] leading-snug",
          "text-text-3",
          "tabular-nums"
        )}
      >
        {formattedTime}
      </span>

      {/* Body column */}
      <div className="min-w-0 space-y-1">
        {/* Title */}
        <p
          className={cn(
            "text-[13px] leading-snug",
            "text-text-1",
            "truncate"
          )}
        >
          {title}
        </p>

        {/* Description (if provided) */}
        {description && (
          <p
            className={cn(
              "text-[13px] leading-snug",
              "text-text-2",
              "line-clamp-2"
            )}
          >
            {description}
          </p>
        )}

        {/* Tag (if provided) */}
        {tag && tagColors && (
          <div className="flex items-center gap-1.5 mt-1">
            {/* Semantic dot (6px) */}
            <span
              className={cn("h-1.5 w-1.5 rounded-full shrink-0", tagColors.dot)}
            />
            {/* Small-caps label */}
            <span
              className={cn(
                "text-[11px] font-medium",
                "tracking-[0.06em]",
                "[font-variant-caps:all-small-caps]",
                tagColors.text
              )}
            >
              {tag.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

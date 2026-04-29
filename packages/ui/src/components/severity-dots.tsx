"use client";

import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// SeverityDotsProps
// ---------------------------------------------------------------------------

export interface SeverityDotsProps {
  /** Number of filled dots */
  count: number;
  /** Maximum number of dots to display (default 5) */
  maxDots?: number;
  /** Tier for color coding: 1=error, 2=warning, 3=info, 4=text-4 */
  tier?: 1 | 2 | 3 | 4;
  /** Dot size: sm=4px, md=6px */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Tier color mapping
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: "bg-error",
  2: "bg-warning",
  3: "bg-info",
  4: "bg-text-4",
};

// ---------------------------------------------------------------------------
// Size configuration
// ---------------------------------------------------------------------------

const SIZE_CONFIG = {
  sm: "h-1 w-1", // 4px
  md: "h-1.5 w-1.5", // 6px
} as const;

// ---------------------------------------------------------------------------
// SeverityDots
// ---------------------------------------------------------------------------

/**
 * SeverityDots displays a row of dots to indicate severity or count.
 *
 * Features:
 * - Configurable max dots (default 5)
 * - Tier-based colors (1=error, 2=warning, 3=info, 4=muted)
 * - Shows numeral when count exceeds maxDots
 * - Two sizes: sm (4px) and md (6px)
 *
 * @example
 * <SeverityDots count={3} tier={2} />
 * <SeverityDots count={12} maxDots={5} tier={1} />
 */
export function SeverityDots({
  count,
  maxDots = 5,
  tier = 1,
  size = "md",
  className,
}: SeverityDotsProps) {
  const tierColor = TIER_COLORS[tier];
  const sizeClass = SIZE_CONFIG[size];

  // If count exceeds maxDots, show numeral instead
  if (count > maxDots) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1",
          "font-mono text-[11px]",
          "[font-variant-numeric:tabular-nums]",
          className
        )}
      >
        {/* First dot to indicate tier color */}
        <span className={cn("rounded-full shrink-0", sizeClass, tierColor)} />
        <span className={cn(tierColor.replace("bg-", "text-"))}>{count}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: maxDots }).map((_, index) => {
        const isFilled = index < count;
        return (
          <span
            key={index}
            className={cn(
              "rounded-full shrink-0",
              sizeClass,
              isFilled ? tierColor : "bg-hairline"
            )}
          />
        );
      })}
    </span>
  );
}

SeverityDots.displayName = "SeverityDots";

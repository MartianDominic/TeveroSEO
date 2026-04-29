"use client";

import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// CountBadgeProps
// ---------------------------------------------------------------------------

export interface CountBadgeProps {
  /** Count to display */
  count: number;
  /** Maximum count before showing overflow (default 99) */
  max?: number;
  /** Visual variant */
  variant?: "default" | "active";
  /** Badge size */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// CountBadge
// ---------------------------------------------------------------------------

/**
 * CountBadge displays a numeric count with overflow handling.
 *
 * Features:
 * - Pill shape (radius-pill)
 * - Shows "99+" when count exceeds max (default 99)
 * - Two variants: default (muted) and active (accent)
 * - Tabular nums for consistent width
 *
 * @example
 * <CountBadge count={5} />
 * <CountBadge count={150} max={99} variant="active" />
 */
export function CountBadge({
  count,
  max = 99,
  variant = "default",
  size = "md",
  className,
}: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        // Shape
        "inline-flex items-center justify-center",
        "rounded-[var(--radius-pill)]",
        // Sizing
        size === "sm" && "px-1.5 py-0.5 min-w-[18px]",
        size === "md" && "px-2 py-0.5 min-w-[22px]",
        // Typography
        "text-[length:var(--type-tiny)]",
        "font-medium",
        "[font-variant-numeric:tabular-nums_lining-nums]",
        // Variant styles
        variant === "default" && "bg-surface-2 text-text-3",
        variant === "active" && "bg-accent-soft text-accent",
        className
      )}
    >
      {displayCount}
    </span>
  );
}

CountBadge.displayName = "CountBadge";

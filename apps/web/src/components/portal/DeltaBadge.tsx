"use client";

/**
 * DeltaBadge Component
 *
 * Colored change indicator showing positive/negative/neutral changes.
 * V6 design: success-soft for positive, error-soft for negative, gray for zero.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export interface DeltaBadgeProps {
  /** The change value (positive = green, negative = red, zero = gray) */
  value: number;
  /** Suffix to display after value (e.g., "%" or " pos") */
  suffix?: string;
  /** Invert colors (for metrics where lower is better, e.g., position) */
  inverted?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

export function DeltaBadge({
  value,
  suffix = "",
  inverted = false,
  size = "md",
  className,
}: DeltaBadgeProps) {
  // Determine direction (accounting for inverted metrics like position)
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  const isNeutral = value === 0;

  // Pick icon
  const Icon = isPositive ? ArrowUp : isNegative ? ArrowDown : Minus;

  // Format the display value
  const displayValue = Math.abs(value);
  const formattedValue =
    displayValue % 1 === 0
      ? displayValue.toString()
      : displayValue.toFixed(1);

  return (
    <span
      className={cn(
        // Base styles
        "inline-flex items-center gap-1 rounded-[--radius-pill] font-sans font-medium",
        // V6 type scale
        size === "sm"
          ? "px-1.5 py-0.5 text-xs-safe"
          : "px-2 py-1 text-xs-safe tracking-[0.02em]",
        // Color variants (V6 semantic colors)
        isPositive && [
          "bg-success-soft text-success",
          "shadow-[0_0_0_1px_rgba(27,110,69,0.12)]",
        ],
        isNegative && [
          "bg-error-soft text-error",
          "shadow-[0_0_0_1px_rgba(155,44,44,0.12)]",
        ],
        isNeutral && [
          "bg-surface-2 text-text-3",
          "shadow-[0_0_0_1px_rgba(20,20,26,0.06)]",
        ],
        className
      )}
    >
      <Icon
        className={cn(
          size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3",
          "flex-shrink-0"
        )}
      />
      <span className="tabular-nums">
        {isPositive && "+"}
        {isNegative && "-"}
        {formattedValue}
        {suffix}
      </span>
    </span>
  );
}

"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// VelocityStripProps
// ---------------------------------------------------------------------------

export interface VelocityStripProps {
  /** 7-day velocity value */
  velocity7d: number;
  /** 30-day velocity value */
  velocity30d: number;
  /** Unit label (e.g., "clicks", "impressions") */
  unit?: string;
  /** Whether to show trend arrows */
  showTrend?: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// VelocityStrip
// ---------------------------------------------------------------------------

/**
 * VelocityStrip displays 7-day and 30-day velocity metrics side by side.
 *
 * Features:
 * - Two-column grid with hairline divider
 * - 2px left border: accent for 7d, text-4 for 30d
 * - Positive values in success tint, negative in error tint
 * - Tabular nums for alignment
 * - Optional trend arrows
 *
 * @example
 * <VelocityStrip
 *   velocity7d={12.5}
 *   velocity30d={-3.2}
 *   unit="clicks"
 *   showTrend
 * />
 */
export function VelocityStrip({
  velocity7d,
  velocity30d,
  unit,
  showTrend = false,
  className,
}: VelocityStripProps) {
  const renderVelocityCell = (
    value: number,
    label: string,
    borderColor: string
  ) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    const valueColor = isPositive
      ? "text-success"
      : isNegative
      ? "text-error"
      : "text-text-3";

    const TrendIcon = isPositive
      ? TrendingUp
      : isNegative
      ? TrendingDown
      : Minus;

    return (
      <div
        className={cn(
          "px-3 py-2",
          "border-l-2",
          borderColor
        )}
      >
        {/* Label */}
        <span
          className={cn(
            "block text-[11px] font-medium",
            "uppercase tracking-[0.06em]",
            "text-text-3 mb-0.5"
          )}
        >
          {label}
        </span>

        {/* Value row */}
        <div className="flex items-baseline gap-1.5">
          {showTrend && (
            <TrendIcon className={cn("h-3.5 w-3.5 shrink-0", valueColor)} />
          )}
          <span
            className={cn(
              "font-display text-[length:var(--num-row)]",
              "[font-variant-numeric:tabular-nums_lining-nums]",
              valueColor
            )}
          >
            {isPositive ? "+" : ""}
            {value.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
          {unit && (
            <span className="text-[12px] text-text-3 italic">{unit}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "grid grid-cols-2",
        "divide-x divide-hairline",
        "rounded-[var(--radius-card)] bg-surface",
        "shadow-[var(--shadow-card)]",
        "overflow-hidden",
        className
      )}
    >
      {renderVelocityCell(velocity7d, "7-Day", "border-l-accent")}
      {renderVelocityCell(velocity30d, "30-Day", "border-l-text-4")}
    </div>
  );
}

VelocityStrip.displayName = "VelocityStrip";

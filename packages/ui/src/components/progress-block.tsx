"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface ProgressBlockProps {
  /** Current value (the big number) */
  current: number;
  /** Target value (the goal) */
  target: number;
  /** Unit label (e.g., "keywords", "articles") */
  unit?: string;
  /** Size variant */
  size?: "mega" | "card" | "row";
  /** Show progress bar below */
  showBar?: boolean;
  /** Additional metric to show on the right */
  secondaryMetric?: {
    value: number | string;
    label: string;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * ProgressBlock - The v6 "editorial moment" numerals pattern
 *
 * Displays current/target as: `12 / 20` with Newsreader serif numerals.
 * The current value carries 100% visual weight; / and target are supportive.
 */
export function ProgressBlock({
  current,
  target,
  unit,
  size = "card",
  showBar = false,
  secondaryMetric,
  className,
}: ProgressBlockProps) {
  const percent = target > 0 ? Math.round((current / target) * 100) : 0;
  const clampedPercent = Math.min(percent, 100);

  // Size-specific classes
  const sizeClasses = {
    mega: {
      current: "num-mega", // 58-80px
      divider: "text-[clamp(38px,3.2vw,52px)] font-light text-text-4",
      target: "text-[clamp(38px,3.2vw,52px)] text-text-3",
      gap: "gap-2",
    },
    card: {
      current: "num-card", // 36-44px
      divider: "text-[clamp(24px,2vw,30px)] font-light text-text-4",
      target: "text-[clamp(24px,2vw,30px)] text-text-3",
      gap: "gap-1.5",
    },
    row: {
      current: "num-row", // 20-26px
      divider: "text-[clamp(14px,1.2vw,18px)] font-light text-text-4",
      target: "text-[clamp(14px,1.2vw,18px)] text-text-3",
      gap: "gap-1",
    },
  };

  const styles = sizeClasses[size];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Main numerals row */}
      <div className="flex items-baseline justify-between">
        {/* Current / Target */}
        <div className={cn("flex items-baseline", styles.gap)}>
          {/* Current value - the editorial moment */}
          <span className={cn(styles.current, "font-display tabular-nums")}>
            {current.toLocaleString()}
          </span>

          {/* Divider */}
          <span className={cn(styles.divider, "font-display")}>
            /
          </span>

          {/* Target value */}
          <span className={cn(styles.target, "font-display tabular-nums")}>
            {target.toLocaleString()}
          </span>

          {/* Unit label */}
          {unit && (
            <span className="ml-2 text-[14px] text-text-3 font-sans">
              {unit}
            </span>
          )}
        </div>

        {/* Secondary metric (right side) */}
        {secondaryMetric && (
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              size === "mega" ? "text-[clamp(22px,1.8vw,28px)]" : "text-[clamp(18px,1.5vw,22px)]",
              "font-display text-text-1 tabular-nums"
            )}>
              {typeof secondaryMetric.value === "number"
                ? secondaryMetric.value.toLocaleString()
                : secondaryMetric.value}
            </span>
            <span className="text-[12px] text-text-3 font-sans tracking-[0.04em] [font-variant-caps:all-small-caps]">
              {secondaryMetric.label}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showBar && (
        <div className="mt-3">
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full bg-accent rounded-full",
                "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              )}
              style={{ width: `${clampedPercent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
    </div>
  );
}

ProgressBlock.displayName = "ProgressBlock";

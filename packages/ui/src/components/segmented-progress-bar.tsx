"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Individual segment in the progress bar
 */
export interface ProgressSegment {
  id: string;
  label: string;
  value: number;
  color?: string;
  percentage?: number;
}

/**
 * Props for SegmentedProgressBar component
 */
export interface SegmentedProgressBarProps {
  segments: ProgressSegment[];
  showLabels?: boolean;
  showValues?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Size variant heights
const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
} as const;

// Default colors for segments when not specified
const defaultColors = [
  "bg-accent",
  "bg-success",
  "bg-warning",
  "bg-info",
  "bg-error",
];

/**
 * A progress bar showing multiple colored segments proportionally.
 * Automatically calculates percentages from values if not provided.
 */
export function SegmentedProgressBar({
  segments,
  showLabels = false,
  showValues = false,
  size = "md",
  className,
}: SegmentedProgressBarProps) {
  // Calculate total and percentages
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const computedSegments = segments.map((segment, index) => ({
    ...segment,
    percentage: segment.percentage ?? (total > 0 ? (segment.value / total) * 100 : 0),
    color: segment.color ?? defaultColors[index % defaultColors.length],
  }));

  return (
    <div className={cn("w-full", className)}>
      {/* Labels row */}
      {showLabels && (
        <div className="flex justify-between mb-1.5">
          {computedSegments.map((segment) => (
            <div
              key={segment.id}
              className="flex items-center gap-1.5"
              style={{ width: `${segment.percentage}%` }}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  segment.color
                )}
              />
              <span
                className={cn(
                  "text-[length:var(--type-tiny)] text-text-2 truncate",
                  "tracking-[0.06em] [font-variant-caps:all-small-caps]"
                )}
              >
                {segment.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar track */}
      <div
        className={cn(
          "w-full rounded-[var(--radius-pill)] bg-surface-3 overflow-hidden flex",
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={computedSegments[0]?.percentage ?? 0}
      >
        {computedSegments.map((segment, index) => (
          <div
            key={segment.id}
            className={cn(
              "h-full transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              segment.color,
              // Round left edge of first segment
              index === 0 && "rounded-l-[var(--radius-pill)]",
              // Round right edge of last segment
              index === computedSegments.length - 1 && "rounded-r-[var(--radius-pill)]"
            )}
            style={{ width: `${segment.percentage}%` }}
          />
        ))}
      </div>

      {/* Values row */}
      {showValues && (
        <div className="flex justify-between mt-1.5">
          {computedSegments.map((segment) => (
            <div
              key={segment.id}
              className="text-center"
              style={{ width: `${segment.percentage}%` }}
            >
              <span
                className={cn(
                  "font-display text-[length:var(--num-tiny)]",
                  "font-[tabular-nums] text-text-1"
                )}
              >
                {segment.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

SegmentedProgressBar.displayName = "SegmentedProgressBar";

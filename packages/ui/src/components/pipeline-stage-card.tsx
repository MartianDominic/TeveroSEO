"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { PIPELINE_STAGE, type StatusConfig } from "../lib/status-config";

// ---------------------------------------------------------------------------
// PipelineStageCardProps
// ---------------------------------------------------------------------------

export interface PipelineStageCardProps {
  /** Stage key (used to look up status config) */
  stage: string;
  /** Display label for the stage */
  label: string;
  /** Count of items in this stage */
  count: number;
  /** Percentage (0-100) for the volume bar */
  percentage: number;
  /** Optional monetary value */
  value?: number;
  /** Whether this stage is currently active/selected */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// PipelineStageCard
// ---------------------------------------------------------------------------

/**
 * PipelineStageCard displays a pipeline funnel stage with:
 * - Small-caps label at top
 * - Newsreader serif count numeral
 * - 3px relative-volume bar showing percentage
 *
 * Active stage gets accent gradient fill and accent bar color.
 * Inactive stages have surface-3 bar and hairline-2 left border.
 *
 * @example
 * <PipelineStageCard
 *   stage="qualified"
 *   label="Qualified"
 *   count={12}
 *   percentage={35}
 *   isActive={true}
 * />
 */
export function PipelineStageCard({
  stage,
  label,
  count,
  percentage,
  value,
  isActive = false,
  onClick,
  className,
}: PipelineStageCardProps) {
  // Get status config for color
  const config: StatusConfig = PIPELINE_STAGE[stage] ?? {
    label,
    color: "bg-text-3",
    bgColor: "bg-surface-2",
    textColor: "text-text-2",
  };

  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        // Base layout
        "flex flex-col items-start",
        "px-4 py-3",
        "min-w-[80px]",
        // Left border (2px stage color)
        "border-l-2",
        isActive ? "border-l-accent" : "border-l-hairline-2",
        // Background
        isActive ? "bg-accent-soft/50" : "bg-transparent",
        // Hover state
        onClick && [
          "cursor-pointer",
          "transition-all duration-[160ms]",
          "hover:bg-surface-2",
        ],
        !onClick && "cursor-default",
        className
      )}
    >
      {/* Small-caps label */}
      <span
        className={cn(
          "text-[12px] font-medium tracking-[0.06em]",
          "[font-variant-caps:all-small-caps]",
          isActive ? "text-accent" : "text-text-3"
        )}
      >
        {label}
      </span>

      {/* Newsreader serif count */}
      <span
        className={cn(
          "font-display",
          "text-num-row",
          "leading-none",
          "mt-1",
          "[font-variant-numeric:tabular-nums_lining-nums]",
          isActive ? "text-accent" : "text-text-1"
        )}
      >
        {count.toLocaleString()}
      </span>

      {/* Optional value */}
      {typeof value === "number" && (
        <span
          className={cn(
            "text-[12px] text-text-3 mt-0.5",
            "[font-variant-numeric:tabular-nums]"
          )}
        >
          ${value.toLocaleString()}
        </span>
      )}

      {/* Volume bar (3px height) */}
      <div className="w-full h-[3px] bg-surface-3 rounded-full mt-2 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isActive
              ? "bg-gradient-to-r from-accent-2 to-accent"
              : config.color
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </button>
  );
}

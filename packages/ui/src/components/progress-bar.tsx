"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const progressBarVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-1",
        md: "h-2",
        lg: "h-3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const progressBarFillVariants = cva(
  "h-full transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)]",
        success: "bg-[var(--success)]",
        warning: "bg-[var(--warning)]",
        error: "bg-[var(--error)]",
        auto: "", // Determined by value thresholds
      },
    },
    defaultVariants: {
      variant: "auto",
    },
  }
);

export interface ProgressBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressBarVariants>,
    VariantProps<typeof progressBarFillVariants> {
  /**
   * Progress value (0-100). Values outside this range are clamped.
   */
  value: number;
  /**
   * Whether to show the percentage label
   */
  showLabel?: boolean;
  /**
   * Label position (only applies when showLabel is true)
   */
  labelPosition?: "inside" | "outside";
}

/**
 * ProgressBar component with v6 design tokens.
 *
 * When variant="auto" (default), the fill color changes based on value:
 * - >= 100: success (green)
 * - >= 80: warning (yellow)
 * - < 80: accent (emerald)
 */
const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      size,
      variant = "auto",
      showLabel = false,
      labelPosition = "outside",
      ...props
    },
    ref
  ) => {
    // Clamp value to 0-100 range
    const clampedValue = Math.min(100, Math.max(0, value));

    // Determine fill color for auto variant
    const autoFillClass = React.useMemo(() => {
      if (variant !== "auto") return "";
      if (clampedValue >= 100) return "bg-[var(--success)]";
      if (clampedValue >= 80) return "bg-[var(--warning)]";
      return "bg-[var(--accent)]";
    }, [variant, clampedValue]);

    const fillClassName = cn(
      progressBarFillVariants({ variant }),
      variant === "auto" && autoFillClass
    );

    return (
      <div
        className={cn(
          "flex items-center gap-2",
          showLabel && labelPosition === "outside" && "gap-3"
        )}
      >
        <div
          ref={ref}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn(
            progressBarVariants({ size }),
            "bg-[var(--surface-3)]",
            className
          )}
          {...props}
        >
          <div
            className={fillClassName}
            style={{ width: `${clampedValue}%` }}
          >
            {showLabel && labelPosition === "inside" && clampedValue > 15 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                {Math.round(clampedValue)}%
              </span>
            )}
          </div>
        </div>
        {showLabel && labelPosition === "outside" && (
          <span className="text-xs font-medium text-[var(--text-2)] tabular-nums">
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";

export { ProgressBar, progressBarVariants, progressBarFillVariants };

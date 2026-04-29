"use client";

import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// StepIndicatorProps
// ---------------------------------------------------------------------------

export interface StepIndicatorProps {
  /** Step number (1-based) or 'done' for completed state */
  step: number | "done";
  /** Whether this step is the current active step */
  current?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// StepIndicator
// ---------------------------------------------------------------------------

/**
 * StepIndicator displays a numbered step or a checkmark for completed steps.
 * Uses v6 design tokens for consistent styling.
 *
 * @example
 * // Numbered step (pending)
 * <StepIndicator step={2} />
 *
 * // Current active step
 * <StepIndicator step={2} current />
 *
 * // Completed step
 * <StepIndicator step="done" />
 */
export function StepIndicator({
  step,
  current = false,
  size = "md",
  className,
}: StepIndicatorProps) {
  const isDone = step === "done";

  const sizeClasses = {
    sm: "h-4 w-4 text-[10px]",
    md: "h-5 w-5 text-xs",
  };

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        "transition-colors duration-[160ms]",
        sizeClasses[size],
        isDone
          ? "bg-success-soft text-success"
          : current
            ? "bg-accent-soft text-accent"
            : "border border-hairline text-text-3",
        className
      )}
      aria-label={
        isDone
          ? "Step completed"
          : typeof step === "number"
            ? `Step ${step}${current ? " (current)" : ""}`
            : undefined
      }
    >
      {isDone ? (
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : typeof step === "number" ? (
        step
      ) : null}
    </span>
  );
}

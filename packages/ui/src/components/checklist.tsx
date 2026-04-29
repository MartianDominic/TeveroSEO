"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { StepIndicator } from "./step-indicator";

// ---------------------------------------------------------------------------
// ChecklistProps
// ---------------------------------------------------------------------------

export interface ChecklistProps {
  /** Title displayed in the card header */
  title?: string;
  /** Optional description below the title */
  description?: string;
  /** Number of completed items (for badge display) */
  completedCount?: number;
  /** Total number of items (for badge display) */
  totalCount?: number;
  /** ChecklistItem children */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// ChecklistItemProps
// ---------------------------------------------------------------------------

export interface ChecklistItemProps {
  /** Whether the item is completed */
  done: boolean;
  /** Item title */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action link */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional children for custom content */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/**
 * Checklist displays a list of ChecklistItem components with a header
 * showing completion progress. Used for onboarding flows and task lists.
 *
 * Uses v6 design tokens: shadow-card, bg-surface, rounded-card.
 *
 * @example
 * <Checklist title="Getting Started" completedCount={1} totalCount={3}>
 *   <ChecklistItem done title="Account created" />
 *   <ChecklistItem
 *     done={false}
 *     title="Configure APIs"
 *     action={{ label: "Go to Settings", onClick: () => router.push("/settings") }}
 *   />
 * </Checklist>
 */
export function Checklist({
  title,
  description,
  completedCount,
  totalCount,
  children,
  className,
}: ChecklistProps) {
  const showBadge =
    typeof completedCount === "number" && typeof totalCount === "number";

  return (
    <div
      className={cn(
        // Card styling with v6 tokens
        "rounded-card bg-surface shadow-card",
        // Spacing
        "p-6",
        // Hover lift effect
        "transition-shadow duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:shadow-lift",
        className
      )}
    >
      {/* Header */}
      {(title || showBadge) && (
        <div className="mb-4 flex items-center gap-2">
          {title && (
            <span className="text-sm font-semibold text-text-1">{title}</span>
          )}
          {showBadge && (
            <span className="text-xs text-text-3">
              {completedCount}/{totalCount} complete
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="mb-4 text-sm text-text-2">{description}</p>
      )}

      {/* Items */}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistItem
// ---------------------------------------------------------------------------

/**
 * ChecklistItem displays a single item within a Checklist.
 * Shows a StepIndicator for completion state and optional action link.
 *
 * @example
 * <ChecklistItem
 *   done={false}
 *   title="Configure API integrations"
 *   description="Connect to DataForSEO, Gemini, and BrightData"
 *   action={{ label: "Go to Settings", onClick: () => {} }}
 * />
 */
export function ChecklistItem({
  done,
  title,
  description,
  action,
  children,
  className,
}: ChecklistItemProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {/* Completion indicator */}
      <StepIndicator step={done ? "done" : 1} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {/* Title */}
          <p
            className={cn(
              "text-sm font-medium",
              done ? "text-text-2 line-through opacity-60" : "text-text-1"
            )}
          >
            {title}
          </p>

          {/* Action link (only shown when not done) */}
          {!done && action && (
            <button
              onClick={action.onClick}
              className={cn(
                "shrink-0 text-xs text-accent",
                "hover:underline",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                "transition-colors duration-[160ms]"
              )}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Description */}
        {description && !done && (
          <p className="mt-0.5 text-xs text-text-3">{description}</p>
        )}

        {/* Custom children */}
        {children}
      </div>
    </div>
  );
}

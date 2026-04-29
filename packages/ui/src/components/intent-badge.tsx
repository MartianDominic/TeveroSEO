"use client";

import * as React from "react";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// IntentBadgeProps
// ---------------------------------------------------------------------------

export type SearchIntent =
  | "commercial"
  | "informational"
  | "transactional"
  | "navigational";

export interface IntentBadgeProps {
  /** Search intent type */
  intent: SearchIntent;
  /** Badge size */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Intent styling
// ---------------------------------------------------------------------------

interface IntentStyle {
  label: string;
  bgColor: string;
  textColor: string;
}

const INTENT_STYLES: Record<SearchIntent, IntentStyle> = {
  commercial: {
    label: "Commercial",
    bgColor: "bg-accent-soft",
    textColor: "text-accent",
  },
  informational: {
    label: "Informational",
    bgColor: "bg-info-soft",
    textColor: "text-info",
  },
  transactional: {
    label: "Transactional",
    bgColor: "bg-warning-soft",
    textColor: "text-warning",
  },
  navigational: {
    label: "Navigational",
    bgColor: "bg-surface-2",
    textColor: "text-text-2",
  },
};

// ---------------------------------------------------------------------------
// IntentBadge
// ---------------------------------------------------------------------------

/**
 * IntentBadge displays the search intent type for a keyword.
 *
 * Features:
 * - Pill shape (radius-pill)
 * - Semantic colors per intent type
 * - Small-caps text styling
 * - Two sizes: sm and md
 *
 * @example
 * <IntentBadge intent="commercial" />
 * <IntentBadge intent="informational" size="sm" />
 */
export function IntentBadge({
  intent,
  size = "md",
  className,
}: IntentBadgeProps) {
  const style = INTENT_STYLES[intent];

  return (
    <span
      className={cn(
        // Shape
        "inline-flex items-center",
        "rounded-[var(--radius-pill)]",
        // Sizing
        size === "sm" && "px-2 py-0.5",
        size === "md" && "px-2.5 py-1",
        // Typography
        "text-[length:var(--type-tiny)]",
        "font-medium",
        "[font-variant-caps:all-small-caps]",
        "tracking-[0.04em]",
        // Colors
        style.bgColor,
        style.textColor,
        className
      )}
    >
      {style.label}
    </span>
  );
}

IntentBadge.displayName = "IntentBadge";

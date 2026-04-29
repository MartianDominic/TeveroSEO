"use client";

import * as React from "react";

/**
 * AriaLive — Screen reader announcements for dynamic content
 *
 * Creates an ARIA live region that announces content changes to screen readers.
 * Content is visually hidden but accessible to assistive technologies.
 *
 * Usage contexts:
 * - Form validation errors (assertive)
 * - Toast notifications (polite)
 * - Loading state changes (polite)
 * - Real-time data updates (polite)
 */

export interface AriaLiveProps {
  /** Content to announce to screen readers */
  children: React.ReactNode;
  /** Politeness level: 'polite' waits for user idle, 'assertive' interrupts */
  mode?: "polite" | "assertive";
  /** Whether to announce the entire region or just changes */
  atomic?: boolean;
  /** What types of changes to announce */
  relevant?: "additions" | "removals" | "text" | "all" | "additions text";
  /** Additional className for customization */
  className?: string;
}

/**
 * AriaLive component
 *
 * Renders a visually hidden live region that announces changes to screen readers.
 * Uses role="status" with aria-live for accessibility.
 */
export function AriaLive({
  children,
  mode = "polite",
  atomic = true,
  relevant = "additions text",
  className,
}: AriaLiveProps) {
  return (
    <div
      role="status"
      aria-live={mode}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={className ?? "sr-only"}
    >
      {children}
    </div>
  );
}

AriaLive.displayName = "AriaLive";

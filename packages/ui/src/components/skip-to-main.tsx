"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * SkipToMain — Skip navigation link for keyboard accessibility
 *
 * Provides a way for keyboard users to skip repetitive navigation
 * and jump directly to main content.
 *
 * Usage:
 * 1. Place <SkipToMain /> at the very beginning of your layout
 * 2. Add id="main-content" and tabIndex={-1} to your main content container
 *
 * Design tokens used:
 * - bg-accent for focused background
 * - text-white for focused text
 * - rounded-button (8px)
 * - shadow-pop for visibility
 * - z-[9999] to appear above all content
 */

export interface SkipToMainProps {
  /** ID of the target element to skip to */
  targetId?: string;
  /** Label text for the skip link */
  label?: string;
  /** Additional className for customization */
  className?: string;
}

/**
 * SkipToMain component
 *
 * Visually hidden by default, becomes visible and positioned on focus.
 * Provides keyboard users a way to skip navigation and go to main content.
 */
export function SkipToMain({
  targetId = "main-content",
  label = "Skip to main content",
  className,
}: SkipToMainProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        // Visually hidden by default (sr-only)
        "sr-only",
        // Visible and positioned on focus
        "focus:not-sr-only",
        "focus:fixed focus:top-4 focus:left-4",
        "focus:z-[9999]",
        // Styling using v6 design tokens
        "focus:bg-accent focus:text-white",
        "focus:px-4 focus:py-2",
        "focus:rounded-button",
        "focus:shadow-pop",
        // Focus ring
        "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
        // Transition
        "transition-all duration-[160ms]",
        className
      )}
    >
      {label}
    </a>
  );
}

SkipToMain.displayName = "SkipToMain";

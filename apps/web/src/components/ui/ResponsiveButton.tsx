/**
 * ResponsiveButton Component
 *
 * A button that shows icon-only on small screens with a tooltip showing the full label.
 * Uses title attribute for native tooltip since we don't have @radix-ui/react-tooltip.
 */

"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@tevero/ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type Breakpoint = "sm" | "md" | "lg";

const breakpointQueries: Record<Breakpoint, string> = {
  sm: "(max-width: 639px)",
  md: "(max-width: 767px)",
  lg: "(max-width: 1023px)",
};

export interface ResponsiveButtonProps extends ButtonProps {
  /**
   * Icon element to display
   */
  icon: React.ReactNode;
  /**
   * Text label to display (hidden at breakpoint)
   */
  label: string;
  /**
   * Breakpoint at which to hide text and show icon-only
   * @default "sm"
   */
  hideTextBreakpoint?: Breakpoint;
  /**
   * Whether to always show icon (even when text is visible)
   * @default true
   */
  showIconWithText?: boolean;
}

/**
 * Button that adapts to viewport size
 *
 * @example
 * ```tsx
 * <ResponsiveButton
 *   icon={<PlusIcon />}
 *   label="Add Prospect"
 *   hideTextBreakpoint="md"
 *   onClick={handleAdd}
 * />
 * ```
 */
export function ResponsiveButton({
  icon,
  label,
  hideTextBreakpoint = "sm",
  showIconWithText = true,
  className,
  ...props
}: ResponsiveButtonProps) {
  const shouldHideText = useMediaQuery(breakpointQueries[hideTextBreakpoint]);

  if (shouldHideText) {
    // Icon-only mode with title tooltip
    return (
      <Button
        {...props}
        size="icon"
        title={label}
        aria-label={label}
        className={className}
      >
        {icon}
      </Button>
    );
  }

  // Full mode with icon + label
  return (
    <Button {...props} className={className}>
      {showIconWithText && icon}
      <span className="btn-text">{label}</span>
    </Button>
  );
}

export default ResponsiveButton;

"use client";

import * as React from "react";

/**
 * FocusTrap — Keyboard focus trap for modals and dialogs
 *
 * Uses @radix-ui/react-focus-scope under the hood.
 * Requires: pnpm add @radix-ui/react-focus-scope
 *
 * Behavior:
 * - When active=true, Tab cycles within trapped area only
 * - Shift+Tab cycles in reverse
 * - Escape calls onEscape (typically closes modal)
 * - Focus moves to first focusable element when activated
 * - Focus returns to trigger when deactivated (if returnFocus=true)
 */

// Note: Import FocusScope from @radix-ui/react-focus-scope after installation
// import * as FocusScope from '@radix-ui/react-focus-scope';

export interface FocusTrapProps {
  /** Whether the focus trap is active */
  active: boolean;
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Ref to element that should receive initial focus */
  initialFocus?: React.RefObject<HTMLElement>;
  /** Whether to return focus to trigger element when deactivated */
  returnFocus?: boolean;
  /** Children to render inside the focus trap */
  children: React.ReactNode;
}

/**
 * FocusTrap component
 *
 * Traps keyboard focus within its children when active.
 * Uses native focus management until @radix-ui/react-focus-scope is installed.
 */
export function FocusTrap({
  active,
  onEscape,
  initialFocus,
  returnFocus = true,
  children,
}: FocusTrapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<Element | null>(null);

  // Store the previously focused element when trap activates
  React.useEffect(() => {
    if (active) {
      previousActiveElement.current = document.activeElement;

      // Focus initial element or first focusable
      if (initialFocus?.current) {
        initialFocus.current.focus();
      } else if (containerRef.current) {
        const focusable = containerRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    } else if (returnFocus && previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus();
    }
  }, [active, initialFocus, returnFocus]);

  // Handle Escape key
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
      }

      // Tab trap logic
      if (event.key === "Tab" && active && containerRef.current) {
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [active, onEscape]
  );

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

FocusTrap.displayName = "FocusTrap";

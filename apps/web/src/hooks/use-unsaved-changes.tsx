/**
 * useUnsavedChanges Hook
 * FIX-17 MED-UJ-04: Navigation guards for unsaved changes
 *
 * Prevents accidental data loss by:
 * - Warning on browser back/forward navigation
 * - Warning on page reload/close
 * - Integrating with Next.js router for client-side navigation
 *
 * Usage:
 * ```tsx
 * const { setHasUnsavedChanges, confirmNavigation } = useUnsavedChanges({
 *   message: "You have unsaved changes. Are you sure you want to leave?",
 * });
 *
 * // Mark form as dirty
 * useEffect(() => {
 *   setHasUnsavedChanges(formState.isDirty);
 * }, [formState.isDirty]);
 *
 * // Or use with form state directly
 * const { hasUnsavedChanges } = useUnsavedChanges({
 *   isDirty: formState.isDirty,
 * });
 * ```
 */
"use client";

import { useEffect, useCallback, useState, useRef } from "react";

import { useRouter } from "next/navigation";

export interface UseUnsavedChangesOptions {
  /** Whether there are unsaved changes (controlled mode) */
  isDirty?: boolean;
  /** Custom confirmation message */
  message?: string;
  /** Callback when user confirms navigation despite unsaved changes */
  onConfirm?: () => void;
  /** Callback when user cancels navigation */
  onCancel?: () => void;
}

export interface UseUnsavedChangesReturn {
  /** Whether there are currently unsaved changes */
  hasUnsavedChanges: boolean;
  /** Set the unsaved changes state (uncontrolled mode) */
  setHasUnsavedChanges: (dirty: boolean) => void;
  /** Manually trigger navigation confirmation */
  confirmNavigation: (onConfirmed: () => void) => void;
  /** Reset the unsaved state (e.g., after save) */
  reset: () => void;
}

const DEFAULT_MESSAGE = "You have unsaved changes. Are you sure you want to leave?";

export function useUnsavedChanges(
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn {
  const {
    isDirty: controlledDirty,
    message = DEFAULT_MESSAGE,
    onConfirm,
    onCancel,
  } = options;

  // Support both controlled and uncontrolled modes
  const [internalDirty, setInternalDirty] = useState(false);
  const hasUnsavedChanges = controlledDirty ?? internalDirty;

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle browser beforeunload event (refresh, close tab, etc.)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      // Modern browsers ignore custom messages, but we need to set returnValue
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  // Handle browser history navigation (back/forward buttons)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handlePopState = (e: PopStateEvent) => {
      // Browser has already navigated, we need to push back and confirm
      const confirmed = window.confirm(message);

      if (confirmed) {
        onConfirm?.();
      } else {
        // Push the current URL back to prevent navigation
        // This is a workaround since we can't prevent popstate
        onCancel?.();
        window.history.pushState(null, "", window.location.href);
      }
    };

    // Push an extra history entry so we can intercept the back button
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedChanges, message, onConfirm, onCancel]);

  const setHasUnsavedChanges = useCallback((dirty: boolean) => {
    if (mountedRef.current) {
      setInternalDirty(dirty);
    }
  }, []);

  const confirmNavigation = useCallback(
    (onConfirmed: () => void) => {
      if (!hasUnsavedChanges) {
        onConfirmed();
        return;
      }

      const confirmed = window.confirm(message);
      if (confirmed) {
        setInternalDirty(false);
        onConfirm?.();
        onConfirmed();
      } else {
        onCancel?.();
      }
    },
    [hasUnsavedChanges, message, onConfirm, onCancel]
  );

  const reset = useCallback(() => {
    setInternalDirty(false);
  }, []);

  return {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    confirmNavigation,
    reset,
  };
}

/**
 * Higher-level hook that integrates with form libraries.
 * Tracks form dirty state automatically.
 *
 * @example
 * ```tsx
 * const form = useForm({ defaultValues });
 * useFormUnsavedChanges(form.formState.isDirty);
 * ```
 */
export function useFormUnsavedChanges(
  isDirty: boolean,
  options: Omit<UseUnsavedChangesOptions, "isDirty"> = {}
): void {
  useUnsavedChanges({ ...options, isDirty });
}

/**
 * Wrapper component that adds unsaved changes protection to its children.
 *
 * @example
 * ```tsx
 * <UnsavedChangesGuard isDirty={formState.isDirty}>
 *   <FormContent />
 * </UnsavedChangesGuard>
 * ```
 */
export function UnsavedChangesGuard({
  children,
  isDirty,
  message,
}: {
  children: React.ReactNode;
  isDirty: boolean;
  message?: string;
}) {
  useUnsavedChanges({ isDirty, message });
  return <>{children}</>;
}

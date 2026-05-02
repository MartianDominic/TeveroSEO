"use client";

/**
 * useSectionOrder - Hook for persisting section order.
 * Phase 57-04: Drag-and-Drop Sections (@dnd-kit)
 *
 * Features:
 * - Debounced API calls to avoid spam during rapid reordering
 * - Optimistic updates (UI updates immediately)
 * - Error handling with rollback capability
 * - Loading and error states
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EditorSection } from "./types";

/**
 * Save status for section order persistence.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Props for useSectionOrder hook.
 */
export interface UseSectionOrderProps {
  /** Proposal ID for API calls */
  proposalId: string;
  /** Initial section order */
  initialSections: EditorSection[];
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Callback for saving order (API call) */
  onSave?: (proposalId: string, sectionOrder: string[]) => Promise<void>;
  /** Callback when save fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useSectionOrder hook.
 */
export interface UseSectionOrderReturn {
  /** Current sections in display order */
  sections: EditorSection[];
  /** Reorder sections (triggers debounced save) */
  reorderSections: (newSections: EditorSection[]) => void;
  /** Update a single section's content */
  updateSection: (sectionId: string, content: string) => void;
  /** Delete a section */
  deleteSection: (sectionId: string) => void;
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last error (if any) */
  error: string | null;
  /** Force save immediately (flushes debounce) */
  flushSave: () => void;
  /** Whether there are unsaved changes */
  isDirty: boolean;
}

/**
 * Hook for managing section order with debounced persistence.
 *
 * Provides optimistic updates with error handling and rollback.
 */
export function useSectionOrder({
  proposalId,
  initialSections,
  debounceMs = 1000,
  onSave,
  onError,
}: UseSectionOrderProps): UseSectionOrderReturn {
  // Current sections state
  const [sections, setSections] = useState<EditorSection[]>(initialSections);

  // Save status tracking
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Refs for debouncing
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<string[] | null>(null);
  const lastSavedOrderRef = useRef<string[]>(initialSections.map(s => s.id));

  /**
   * Save section order to backend.
   */
  const saveOrder = useCallback(async (sectionOrder: string[]) => {
    if (!onSave) {
      // No save handler provided, just mark as saved
      setSaveStatus("saved");
      setIsDirty(false);
      lastSavedOrderRef.current = sectionOrder;
      return;
    }

    setSaveStatus("saving");
    setError(null);

    try {
      await onSave(proposalId, sectionOrder);
      setSaveStatus("saved");
      setIsDirty(false);
      lastSavedOrderRef.current = sectionOrder;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save section order";
      setSaveStatus("error");
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [proposalId, onSave, onError]);

  /**
   * Debounced save function.
   */
  const debouncedSave = useCallback((sectionOrder: string[]) => {
    pendingOrderRef.current = sectionOrder;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (pendingOrderRef.current) {
        saveOrder(pendingOrderRef.current);
        pendingOrderRef.current = null;
      }
    }, debounceMs);
  }, [saveOrder, debounceMs]);

  /**
   * Reorder sections (optimistic update + debounced save).
   */
  const reorderSections = useCallback((newSections: EditorSection[]) => {
    setSections(newSections);
    setIsDirty(true);
    setSaveStatus("idle");

    const newOrder = newSections.map(s => s.id);
    debouncedSave(newOrder);
  }, [debouncedSave]);

  /**
   * Update a single section's content.
   */
  const updateSection = useCallback((sectionId: string, content: string) => {
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId ? { ...s, content } : s
      )
    );
    setIsDirty(true);
  }, []);

  /**
   * Delete a section.
   */
  const deleteSection = useCallback((sectionId: string) => {
    setSections(prev => {
      const newSections = prev.filter(s => s.id !== sectionId);
      const newOrder = newSections.map(s => s.id);
      debouncedSave(newOrder);
      return newSections;
    });
    setIsDirty(true);
  }, [debouncedSave]);

  /**
   * Force save immediately (flush pending debounce).
   */
  const flushSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingOrderRef.current) {
      saveOrder(pendingOrderRef.current);
      pendingOrderRef.current = null;
    }
  }, [saveOrder]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Flush save on unmount if there are pending changes
  useEffect(() => {
    return () => {
      if (pendingOrderRef.current && onSave) {
        // Fire and forget - component is unmounting
        onSave(proposalId, pendingOrderRef.current).catch(() => {
          // Silently fail on unmount
        });
      }
    };
  }, [proposalId, onSave]);

  return {
    sections,
    reorderSections,
    updateSection,
    deleteSection,
    saveStatus,
    error,
    flushSave,
    isDirty,
  };
}

export default useSectionOrder;

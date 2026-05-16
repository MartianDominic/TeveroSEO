/**
 * Undo/Redo Hook
 * Phase 102-11: Task 3 - Generic undo/redo state management
 *
 * Provides undo/redo functionality with keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 * for use in verification UI and document editing.
 */

import { useState, useCallback, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UndoRedoResult<T> {
  /** Current state value */
  state: T;
  /** Update state (adds to undo stack) */
  set: (newState: T | ((prev: T) => T)) => void;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Reset to initial state (clears history) */
  reset: (newState: T) => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of states in undo history */
  historyLength: number;
}

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

/**
 * Generic undo/redo hook with keyboard shortcuts.
 *
 * @param initialState - Initial state value
 * @returns Undo/redo controls and current state
 *
 * @example
 * const { state, set, undo, redo, canUndo, canRedo } = useUndoRedo(initialBlocks);
 *
 * // Update state (automatically adds to undo stack)
 * set(newBlocks);
 *
 * // Or use functional update
 * set(prev => [...prev, newBlock]);
 *
 * // Keyboard shortcuts work automatically:
 * // Ctrl+Z / Cmd+Z = undo
 * // Ctrl+Shift+Z / Cmd+Shift+Z = redo
 * // Ctrl+Y / Cmd+Y = redo
 */
export function useUndoRedo<T>(initialState: T): UndoRedoResult<T> {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  /**
   * Set new state, pushing current to past.
   */
  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setState((prev) => {
      const nextState =
        typeof newState === "function"
          ? (newState as (prev: T) => T)(prev.present)
          : newState;

      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: [], // Clear redo stack on new action
      };
    });
  }, []);

  /**
   * Undo last change.
   */
  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  /**
   * Redo last undone change.
   */
  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  /**
   * Reset to new state, clearing all history.
   */
  const reset = useCallback((newState: T) => {
    setState({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  /**
   * Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z/Ctrl+Y (redo)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl (Windows/Linux) or Cmd (Mac)
      const isModifier = e.metaKey || e.ctrlKey;

      if (!isModifier) return;

      // Ctrl/Cmd + Z
      if (e.key === "z" || e.key === "Z") {
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          e.preventDefault();
          redo();
        } else {
          // Ctrl+Z = Undo
          e.preventDefault();
          undo();
        }
      }

      // Ctrl/Cmd + Y = Redo (alternative)
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    state: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    historyLength: state.past.length,
  };
}

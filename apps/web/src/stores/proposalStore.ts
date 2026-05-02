"use client";

/**
 * Zustand store for proposal editor state with undo/redo support.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * Uses zundo temporal middleware for:
 * - Undo (Cmd+Z / Ctrl+Z)
 * - Redo (Cmd+Shift+Z / Ctrl+Shift+Z)
 * - History limited to 50 states
 */

import { create } from "zustand";
import { temporal } from "zundo";
import type { EditorSection } from "@/components/proposals/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Proposal editor state tracked for undo/redo.
 * Only includes data that should be undoable.
 */
export interface ProposalEditorState {
  /** Ordered list of sections */
  sections: EditorSection[];
  /** Section order (IDs in display order) */
  sectionOrder: string[];
  /** Content map (sectionId -> HTML content) */
  contentMap: Record<string, string>;
}

/**
 * Actions for proposal editor.
 */
export interface ProposalEditorActions {
  /** Initialize store with proposal data */
  initialize: (sections: EditorSection[]) => void;
  /** Update a section's content */
  updateSection: (sectionId: string, content: string) => void;
  /** Update section metadata (title, etc) */
  updateSectionMetadata: (sectionId: string, updates: Partial<EditorSection>) => void;
  /** Reorder sections */
  reorderSections: (newOrder: string[]) => void;
  /** Add a new section */
  addSection: (section: EditorSection, atIndex?: number) => void;
  /** Remove a section */
  removeSection: (sectionId: string) => void;
  /** Reset store to initial state */
  reset: () => void;
}

/**
 * Combined store type.
 */
export type ProposalStore = ProposalEditorState & ProposalEditorActions;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState: ProposalEditorState = {
  sections: [],
  sectionOrder: [],
  contentMap: {},
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Proposal editor store with temporal (undo/redo) support.
 *
 * The temporal middleware wraps the store to track state history.
 * Use useProposalStore.temporal.getState() for undo/redo/canUndo/canRedo.
 */
export const useProposalStore = create<ProposalStore>()(
  temporal(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      initialize: (sections) => {
        const sectionOrder = sections.map((s) => s.id);
        const contentMap: Record<string, string> = {};
        sections.forEach((s) => {
          contentMap[s.id] = s.content;
        });

        set({
          sections,
          sectionOrder,
          contentMap,
        });
      },

      updateSection: (sectionId, content) => {
        set((state) => ({
          contentMap: {
            ...state.contentMap,
            [sectionId]: content,
          },
          sections: state.sections.map((s) =>
            s.id === sectionId ? { ...s, content } : s
          ),
        }));
      },

      updateSectionMetadata: (sectionId, updates) => {
        set((state) => ({
          sections: state.sections.map((s) =>
            s.id === sectionId ? { ...s, ...updates } : s
          ),
        }));
      },

      reorderSections: (newOrder) => {
        set((state) => {
          // Create a map for quick lookup
          const sectionMap = new Map(state.sections.map((s) => [s.id, s]));

          // Reorder sections based on new order
          const reorderedSections = newOrder
            .map((id) => sectionMap.get(id))
            .filter((s): s is EditorSection => s !== undefined);

          return {
            sectionOrder: newOrder,
            sections: reorderedSections,
          };
        });
      },

      addSection: (section, atIndex) => {
        set((state) => {
          const newSections = [...state.sections];
          const newOrder = [...state.sectionOrder];

          if (atIndex !== undefined && atIndex >= 0 && atIndex <= newSections.length) {
            newSections.splice(atIndex, 0, section);
            newOrder.splice(atIndex, 0, section.id);
          } else {
            newSections.push(section);
            newOrder.push(section.id);
          }

          return {
            sections: newSections,
            sectionOrder: newOrder,
            contentMap: {
              ...state.contentMap,
              [section.id]: section.content,
            },
          };
        });
      },

      removeSection: (sectionId) => {
        set((state) => {
          const { [sectionId]: _removed, ...remainingContent } = state.contentMap;

          return {
            sections: state.sections.filter((s) => s.id !== sectionId),
            sectionOrder: state.sectionOrder.filter((id) => id !== sectionId),
            contentMap: remainingContent,
          };
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      // Limit history to 50 states to prevent memory issues
      limit: 50,
      // Only track specific state changes (not actions)
      partialize: (state) => ({
        sections: state.sections,
        sectionOrder: state.sectionOrder,
        contentMap: state.contentMap,
      }),
      // Equality check to prevent duplicate history entries
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    }
  )
);

// ---------------------------------------------------------------------------
// Hooks for undo/redo
// ---------------------------------------------------------------------------

/**
 * Hook to get undo/redo capabilities.
 *
 * Usage:
 * ```tsx
 * const { undo, redo, canUndo, canRedo, pastStates, futureStates } = useProposalHistory();
 * ```
 */
export function useProposalHistory() {
  const store = useProposalStore;

  return {
    /** Undo last action */
    undo: () => store.temporal.getState().undo(),
    /** Redo last undone action */
    redo: () => store.temporal.getState().redo(),
    /** Check if undo is available */
    canUndo: () => store.temporal.getState().pastStates.length > 0,
    /** Check if redo is available */
    canRedo: () => store.temporal.getState().futureStates.length > 0,
    /** Get number of past states */
    pastStatesCount: () => store.temporal.getState().pastStates.length,
    /** Get number of future states */
    futureStatesCount: () => store.temporal.getState().futureStates.length,
    /** Clear history */
    clear: () => store.temporal.getState().clear(),
  };
}

export default useProposalStore;

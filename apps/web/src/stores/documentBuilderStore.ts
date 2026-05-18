"use client";

/**
 * Document Builder Store
 * Phase 102-02: Block Palette and Canvas
 *
 * Zustand store for document builder state management.
 * Handles block CRUD, ordering, and framework selection.
 * Persists drafts to localStorage for recovery.
 *
 * Performance optimizations:
 * - useShallow for object/array selector comparisons
 * - Typed selector hooks to prevent unnecessary re-renders
 * - devtools middleware for debugging
 * - Versioned persist config for safe migrations
 */

import { nanoid } from "nanoid";
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { z } from "zod";

import {
  getBlockMetadata,
  getBlockTemplate,
} from "@/lib/document-builder/persuasion-blocks";
import type {
  BlockStyling,
  PersuasionBlock,
  PersuasionBlockType,
  TipTapContent,
} from "@/lib/document-builder/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Maximum number of history entries to keep for undo/redo.
 * Prevents unbounded memory growth while providing reasonable undo depth.
 */
const MAX_HISTORY_SIZE = 50;

/**
 * History entry for undo/redo operations.
 */
export interface HistoryEntry {
  /** Snapshot of blocks at this point in time */
  blocks: PersuasionBlock[];
  /** Timestamp when this entry was created */
  timestamp: number;
  /** Description of the action that created this entry (for debugging) */
  actionType: string;
}

/**
 * Document builder state.
 */
export interface DocumentBuilderState {
  /** Blocks on the canvas */
  blocks: PersuasionBlock[];
  /** Currently selected block ID */
  selectedBlockId: string | null;
  /** Active framework ID */
  frameworkId: string | null;
  /** Framework display name */
  frameworkName: string | null;
  /** Current proposal ID (if editing existing) */
  proposalId: string | null;
  /** History stack for undo (past states) */
  history: HistoryEntry[];
  /** Index in history for current state (-1 means current state is not from history) */
  historyIndex: number;
  /** Future stack for redo (states undone) */
  future: HistoryEntry[];
}

/**
 * Document builder actions.
 */
export interface DocumentBuilderActions {
  /** Add a new block to the canvas */
  addBlock: (type: PersuasionBlockType, position?: number) => string;
  /** Remove a block from the canvas */
  removeBlock: (id: string) => void;
  /** Move a block from one position to another */
  moveBlock: (fromIndex: number, toIndex: number) => void;
  /** Update a block's content */
  updateBlockContent: (id: string, content: TipTapContent | null) => void;
  /** Update a block's title */
  updateBlockTitle: (id: string, title: string) => void;
  /** Update a block's styling */
  updateBlockStyling: (id: string, styling: Partial<BlockStyling>) => void;
  /** Select a block */
  selectBlock: (id: string | null) => void;
  /** Set the active framework */
  setFramework: (frameworkId: string | null, frameworkName?: string | null) => void;
  /** Set the proposal ID */
  setProposalId: (proposalId: string | null) => void;
  /** Initialize store with existing blocks */
  initialize: (blocks: PersuasionBlock[], frameworkId?: string | null, frameworkName?: string | null) => void;
  /** Get a block at a specific position */
  getBlockAtPosition: (position: number) => PersuasionBlock | undefined;
  /** Get all block types currently on canvas */
  getBlockTypes: () => PersuasionBlockType[];
  /** Reset store to initial state */
  reset: () => void;
  /** Undo the last action */
  undo: () => void;
  /** Redo a previously undone action */
  redo: () => void;
  /** Check if undo is available */
  canUndo: () => boolean;
  /** Check if redo is available */
  canRedo: () => boolean;
  /** Push current state to history (internal use) */
  _pushHistory: (actionType: string) => void;
}

/**
 * Combined store type.
 */
export type DocumentBuilderStore = DocumentBuilderState & DocumentBuilderActions;

// ---------------------------------------------------------------------------
// Persist state type (subset that gets persisted)
// ---------------------------------------------------------------------------

interface PersistedState {
  blocks: PersuasionBlock[];
  frameworkId: string | null;
  frameworkName: string | null;
  proposalId: string | null;
  // Note: history and future are NOT persisted to avoid localStorage bloat
}

// ---------------------------------------------------------------------------
// Zod Schema for Persisted State Validation
// ---------------------------------------------------------------------------

/**
 * TipTap content schema for validation.
 * Uses permissive validation for recursive structure - validates shape but allows nested content.
 * The main goal is to catch corrupted localStorage data, not strict type checking.
 * Note: z.record in Zod v4 requires (keySchema, valueSchema) syntax.
 */
const TipTapContentSchema = z.object({
  type: z.string(),
  content: z.array(z.any()).optional(),
  text: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z.array(z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
});

/**
 * Block styling schema.
 */
const BlockStylingSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  borderColor: z.string().optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
}).passthrough();

/**
 * Persuasion meta schema.
 */
const PersuasionMetaSchema = z.object({
  aiHints: z.string().optional(),
  frameworkId: z.string().optional(),
  isRequired: z.boolean().optional(),
}).passthrough();

/**
 * Persuasion block schema for validation.
 */
const PersuasionBlockSchema = z.object({
  id: z.string(),
  type: z.enum([
    "pain_amplifier",
    "villain_story",
    "credibility",
    "social_proof",
    "process_reveal",
    "offer_stack",
    "risk_reversal",
    "objection_handler",
    "urgency",
    "cta",
    "custom",
  ]),
  position: z.number(),
  content: TipTapContentSchema.nullable(),
  title: z.string().optional(),
  styling: BlockStylingSchema.optional(),
  persuasionMeta: PersuasionMetaSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Zod schema for validating persisted state from localStorage.
 * Ensures type safety during hydration from untrusted storage.
 */
const PersistedStateSchema = z.object({
  blocks: z.array(PersuasionBlockSchema),
  frameworkId: z.string().nullable(),
  frameworkName: z.string().nullable(),
  proposalId: z.string().nullable(),
});

/**
 * Type guard to validate persisted state.
 * Returns validated state or default empty state on failure.
 */
function validatePersistedState(data: unknown): PersistedState {
  const result = PersistedStateSchema.safeParse(data);
  if (result.success) {
    return result.data as PersistedState;
  }
  // Return default state on validation failure
  console.warn("[DocumentBuilderStore] Invalid persisted state, using defaults:", result.error.message);
  return {
    blocks: [],
    frameworkId: null,
    frameworkName: null,
    proposalId: null,
  };
}

// ---------------------------------------------------------------------------
// M-MEM-03: Size-Limited Storage Adapter
// ---------------------------------------------------------------------------

/**
 * Maximum storage size in bytes (500KB).
 * Prevents localStorage from growing unbounded with large block content.
 */
const MAX_STORAGE_SIZE_BYTES = 500 * 1024;

/**
 * Maximum number of blocks to persist.
 * If exceeded, oldest blocks are pruned to fit.
 */
const MAX_BLOCKS_TO_PERSIST = 40;

/**
 * Create a size-limited storage adapter for Zustand persist.
 * Prevents localStorage from growing unbounded by:
 * 1. Limiting maximum storage size
 * 2. Pruning oldest blocks when limit exceeded
 * 3. Gracefully handling storage errors
 */
function createSizeLimitedStorage() {
  return {
    getItem: (name: string): string | null => {
      try {
        return localStorage.getItem(name);
      } catch (error) {
        console.warn("[DocumentBuilderStore] Failed to read from localStorage:", error);
        return null;
      }
    },

    setItem: (name: string, value: string): void => {
      try {
        // Check size before persisting
        const sizeBytes = new Blob([value]).size;

        if (sizeBytes > MAX_STORAGE_SIZE_BYTES) {
          // Parse and prune blocks if too large
          const parsed = JSON.parse(value);
          if (parsed?.state?.blocks && Array.isArray(parsed.state.blocks)) {
            // Keep only the most recent blocks (by position, which reflects order)
            const sortedBlocks = [...parsed.state.blocks].sort(
              (a, b) => (b.position ?? 0) - (a.position ?? 0)
            );
            parsed.state.blocks = sortedBlocks.slice(0, MAX_BLOCKS_TO_PERSIST);

            const prunedValue = JSON.stringify(parsed);
            const prunedSize = new Blob([prunedValue]).size;

            if (prunedSize <= MAX_STORAGE_SIZE_BYTES) {
              localStorage.setItem(name, prunedValue);
              console.warn(
                `[DocumentBuilderStore] Pruned blocks to fit storage limit. ` +
                `Original: ${sizeBytes} bytes, Pruned: ${prunedSize} bytes`
              );
              return;
            }
          }

          // Still too large after pruning - clear storage to prevent memory issues
          console.warn(
            `[DocumentBuilderStore] Storage size (${sizeBytes} bytes) exceeds limit ` +
            `(${MAX_STORAGE_SIZE_BYTES} bytes). Clearing persisted state.`
          );
          localStorage.removeItem(name);
          return;
        }

        localStorage.setItem(name, value);
      } catch (error) {
        // Handle QuotaExceededError and other storage errors
        console.warn("[DocumentBuilderStore] Failed to write to localStorage:", error);
        try {
          // Attempt to clear old data on error
          localStorage.removeItem(name);
        } catch {
          // Ignore cleanup errors
        }
      }
    },

    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.warn("[DocumentBuilderStore] Failed to remove from localStorage:", error);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// H-CON-02: Move Operation Queue for Sequential Processing
// ---------------------------------------------------------------------------

/**
 * Queue for moveBlock operations to prevent race conditions.
 * Rapid consecutive calls are processed sequentially.
 */
interface MoveOperation {
  fromIndex: number;
  toIndex: number;
  timestamp: number;
}

let moveQueue: MoveOperation[] = [];
let isProcessingMoves = false;
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce delay for batching rapid move operations (ms) */
const MOVE_DEBOUNCE_MS = 50;

/**
 * Process queued move operations sequentially.
 * Collapses rapid moves into a single effective move.
 */
function processMoveQueue(executeMove: (from: number, to: number) => void): void {
  if (isProcessingMoves || moveQueue.length === 0) {
    return;
  }

  isProcessingMoves = true;

  try {
    // For rapid successive moves, only the final position matters
    // Collapse queue into effective single move by tracking block position
    if (moveQueue.length > 1) {
      // Get first and last moves
      const firstMove = moveQueue[0];
      const lastMove = moveQueue[moveQueue.length - 1];

      // Execute as single move from original position to final position
      executeMove(firstMove.fromIndex, lastMove.toIndex);
    } else {
      // Single move - execute directly
      const move = moveQueue[0];
      executeMove(move.fromIndex, move.toIndex);
    }
  } finally {
    moveQueue = [];
    isProcessingMoves = false;
  }
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState: DocumentBuilderState = {
  blocks: [],
  selectedBlockId: null,
  frameworkId: null,
  frameworkName: null,
  proposalId: null,
  history: [],
  historyIndex: -1,
  future: [],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Document builder store with persistence and devtools.
 *
 * Features:
 * - Block CRUD operations
 * - Drag-drop reordering via moveBlock
 * - Framework selection
 * - localStorage persistence for draft recovery
 * - DevTools integration for debugging
 * - Versioned storage for safe migrations
 */
export const useDocumentBuilderStore = create<DocumentBuilderStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        ...initialState,

        // Actions
        addBlock: (type, position) => {
          // H-UX-01: Push current state to history before modifying
          get()._pushHistory("addBlock");

          const id = nanoid();
          const metadata = getBlockMetadata(type);
          const template = getBlockTemplate(type);

          const newBlock: PersuasionBlock = {
            id,
            type,
            position: position ?? get().blocks.length,
            content: template,
            title: metadata?.label ?? "Custom Block",
            persuasionMeta: {
              frameworkId: get().frameworkId ?? undefined,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set(
            (state) => {
              const blocks = [...state.blocks];

              if (position !== undefined && position >= 0 && position <= blocks.length) {
                // Insert at position and update positions of subsequent blocks
                blocks.splice(position, 0, newBlock);
                return {
                  blocks: blocks.map((block, index) => ({
                    ...block,
                    position: index,
                  })),
                };
              }

              // Append to end
              return {
                blocks: [...blocks, newBlock],
              };
            },
            false,
            "addBlock"
          );

          return id;
        },

        removeBlock: (id) => {
          // H-UX-01: Push current state to history before modifying
          get()._pushHistory("removeBlock");

          set(
            (state) => ({
              blocks: state.blocks
                .filter((block) => block.id !== id)
                .map((block, index) => ({
                  ...block,
                  position: index,
                })),
              // Deselect if the removed block was selected
              selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
            }),
            false,
            "removeBlock"
          );
        },

        moveBlock: (fromIndex, toIndex) => {
          // H-CON-02: Queue move operations and debounce rapid calls
          moveQueue.push({
            fromIndex,
            toIndex,
            timestamp: Date.now(),
          });

          // Clear existing debounce timer
          if (moveDebounceTimer) {
            clearTimeout(moveDebounceTimer);
          }

          // Process queue after debounce delay
          moveDebounceTimer = setTimeout(() => {
            moveDebounceTimer = null;
            processMoveQueue((from, to) => {
              // H-UX-01: Push current state to history before modifying
              get()._pushHistory("moveBlock");

              set(
                (state) => {
                  if (
                    from < 0 ||
                    from >= state.blocks.length ||
                    to < 0 ||
                    to >= state.blocks.length ||
                    from === to
                  ) {
                    return state;
                  }

                  const blocks = [...state.blocks];
                  const [movedBlock] = blocks.splice(from, 1);
                  blocks.splice(to, 0, movedBlock);

                  // Update all positions
                  return {
                    blocks: blocks.map((block, index) => ({
                      ...block,
                      position: index,
                      updatedAt: block.id === movedBlock.id ? new Date().toISOString() : block.updatedAt,
                    })),
                  };
                },
                false,
                "moveBlock"
              );
            });
          }, MOVE_DEBOUNCE_MS);
        },

        updateBlockContent: (id, content) => {
          // H-UX-01: Push current state to history before modifying
          get()._pushHistory("updateBlockContent");

          set(
            (state) => ({
              blocks: state.blocks.map((block) =>
                block.id === id ? { ...block, content, updatedAt: new Date().toISOString() } : block
              ),
            }),
            false,
            "updateBlockContent"
          );
        },

        updateBlockTitle: (id, title) => {
          set(
            (state) => ({
              blocks: state.blocks.map((block) =>
                block.id === id ? { ...block, title, updatedAt: new Date().toISOString() } : block
              ),
            }),
            false,
            "updateBlockTitle"
          );
        },

        updateBlockStyling: (id, styling) => {
          set(
            (state) => ({
              blocks: state.blocks.map((block) =>
                block.id === id
                  ? {
                      ...block,
                      styling: { ...block.styling, ...styling },
                      updatedAt: new Date().toISOString(),
                    }
                  : block
              ),
            }),
            false,
            "updateBlockStyling"
          );
        },

        selectBlock: (id) => {
          set({ selectedBlockId: id }, false, "selectBlock");
        },

        setFramework: (frameworkId, frameworkName) => {
          set(
            {
              frameworkId,
              frameworkName: frameworkName ?? null,
            },
            false,
            "setFramework"
          );
        },

        setProposalId: (proposalId) => {
          set({ proposalId }, false, "setProposalId");
        },

        initialize: (blocks, frameworkId, frameworkName) => {
          set(
            {
              blocks: blocks.map((block, index) => ({
                ...block,
                position: index,
              })),
              frameworkId: frameworkId ?? null,
              frameworkName: frameworkName ?? null,
              selectedBlockId: null,
            },
            false,
            "initialize"
          );
        },

        getBlockAtPosition: (position) => {
          return get().blocks.find((block) => block.position === position);
        },

        getBlockTypes: () => {
          return get().blocks.map((block) => block.type);
        },

        reset: () => {
          set(initialState, false, "reset");
        },

        // Undo/Redo actions
        undo: () => {
          const { history, blocks, future } = get();
          if (history.length === 0) return;

          const previousEntry = history[history.length - 1];
          const currentEntry: HistoryEntry = {
            blocks: [...blocks],
            timestamp: Date.now(),
            actionType: "undo",
          };

          set(
            {
              blocks: previousEntry.blocks,
              history: history.slice(0, -1),
              future: [...future, currentEntry].slice(-MAX_HISTORY_SIZE),
            },
            false,
            "undo"
          );
        },

        redo: () => {
          const { history, blocks, future } = get();
          if (future.length === 0) return;

          const nextEntry = future[future.length - 1];
          const currentEntry: HistoryEntry = {
            blocks: [...blocks],
            timestamp: Date.now(),
            actionType: "redo",
          };

          set(
            {
              blocks: nextEntry.blocks,
              history: [...history, currentEntry].slice(-MAX_HISTORY_SIZE),
              future: future.slice(0, -1),
            },
            false,
            "redo"
          );
        },

        canUndo: () => get().history.length > 0,

        canRedo: () => get().future.length > 0,

        _pushHistory: (actionType: string) => {
          const { blocks, history } = get();
          const entry: HistoryEntry = {
            blocks: [...blocks],
            timestamp: Date.now(),
            actionType,
          };

          set(
            {
              history: [...history, entry].slice(-MAX_HISTORY_SIZE),
              future: [], // Clear redo stack on new action
            },
            false,
            "_pushHistory"
          );
        },
      }),
      {
        name: "document-builder-store-v1",
        version: 1,
        storage: createJSONStorage(() => createSizeLimitedStorage()),
        // Only persist blocks and framework, not selection state
        partialize: (state): PersistedState => ({
          blocks: state.blocks,
          frameworkId: state.frameworkId,
          frameworkName: state.frameworkName,
          proposalId: state.proposalId,
        }),
        // Handle version migrations with runtime validation
        migrate: (persistedState: unknown, version: number): PersistedState => {
          // Validate persisted state before migration
          const state = validatePersistedState(persistedState);
          if (version === 0) {
            // Migration from version 0 to 1: no changes needed
            return state;
          }
          return state;
        },
      }
    ),
    { name: "DocumentBuilder" }
  )
);

// ---------------------------------------------------------------------------
// Shallow Selector Hooks
// ---------------------------------------------------------------------------
// These hooks use shallow comparison to prevent re-renders when
// the selected values haven't actually changed.

/**
 * Get all blocks with shallow comparison.
 * Only re-renders when blocks array reference changes.
 */
export const useBlocks = () =>
  useDocumentBuilderStore(useShallow((state) => state.blocks));

/**
 * Get only block IDs with shallow comparison.
 * Use this for list rendering when you only need to iterate over blocks.
 * Re-renders only when block IDs change (add/remove), not on content updates.
 */
export const useBlockIds = () =>
  useDocumentBuilderStore(
    useShallow((state) => state.blocks.map((b) => b.id))
  );

/**
 * Get a specific block by ID.
 * Uses useShallow to only re-render when the specific block reference changes.
 * This is more efficient than the previous implementation that recomputed
 * find() on every state change without memoization.
 */
export const useBlockById = (id: string) =>
  useDocumentBuilderStore(
    useShallow((state) => state.blocks.find((b) => b.id === id))
  );

/**
 * Get the currently selected block ID.
 */
export const useSelectedBlockId = () =>
  useDocumentBuilderStore((state) => state.selectedBlockId);

/**
 * Get the currently selected block (full object).
 * Uses useShallow to avoid re-renders when block reference hasn't changed.
 * Single find operation - no double lookup.
 */
export const useSelectedBlock = () =>
  useDocumentBuilderStore(
    useShallow((state) =>
      state.selectedBlockId
        ? state.blocks.find((b) => b.id === state.selectedBlockId)
        : null
    )
  );

/**
 * Get framework info with shallow comparison.
 */
export const useFramework = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      frameworkId: state.frameworkId,
      frameworkName: state.frameworkName,
    }))
  );

/**
 * Get all block actions with shallow comparison.
 * Actions are stable references, so this prevents unnecessary re-renders
 * when only state changes but you only need actions.
 */
export const useBlockActions = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      addBlock: state.addBlock,
      removeBlock: state.removeBlock,
      moveBlock: state.moveBlock,
      updateBlockContent: state.updateBlockContent,
      updateBlockTitle: state.updateBlockTitle,
      updateBlockStyling: state.updateBlockStyling,
    }))
  );

/**
 * Get selection actions with shallow comparison.
 */
export const useSelectionActions = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      selectBlock: state.selectBlock,
    }))
  );

/**
 * Get framework actions with shallow comparison.
 */
export const useFrameworkActions = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      setFramework: state.setFramework,
      initialize: state.initialize,
      reset: state.reset,
    }))
  );

/**
 * Get canvas state (blocks + selection) with shallow comparison.
 * Use this in DocumentCanvas for optimal re-renders.
 */
export const useCanvasState = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      blocks: state.blocks,
      selectedBlockId: state.selectedBlockId,
    }))
  );

/**
 * Get canvas actions with shallow comparison.
 * Use this in DocumentCanvas for optimal re-renders.
 */
export const useCanvasActions = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      selectBlock: state.selectBlock,
      moveBlock: state.moveBlock,
      removeBlock: state.removeBlock,
      updateBlockTitle: state.updateBlockTitle,
      addBlock: state.addBlock,
    }))
  );

// ---------------------------------------------------------------------------
// H-UX-01: Undo/Redo Hooks
// ---------------------------------------------------------------------------

/**
 * Get undo/redo state with shallow comparison.
 * Returns whether undo and redo are available.
 */
export const useUndoRedoState = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      canUndo: state.history.length > 0,
      canRedo: state.future.length > 0,
      historyLength: state.history.length,
      futureLength: state.future.length,
    }))
  );

/**
 * Get undo/redo actions with shallow comparison.
 */
export const useUndoRedoActions = () =>
  useDocumentBuilderStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
    }))
  );

// ---------------------------------------------------------------------------
// M-CON-04: Debounced Selection Hook
// ---------------------------------------------------------------------------

/** Selection debounce delay (ms) */
const SELECTION_DEBOUNCE_MS = 16; // ~1 frame at 60fps

let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSelectionId: string | null = null;

/**
 * Create a debounced selectBlock function.
 * Prevents rapid selection changes from triggering many state updates.
 *
 * Usage:
 * const debouncedSelect = useDebouncedSelectBlock();
 * debouncedSelect(blockId);
 */
export function createDebouncedSelectBlock(
  selectBlock: (id: string | null) => void
): (id: string | null) => void {
  return (id: string | null) => {
    pendingSelectionId = id;

    if (selectionDebounceTimer) {
      clearTimeout(selectionDebounceTimer);
    }

    selectionDebounceTimer = setTimeout(() => {
      selectionDebounceTimer = null;
      selectBlock(pendingSelectionId);
      pendingSelectionId = null;
    }, SELECTION_DEBOUNCE_MS);
  };
}

/**
 * Hook that returns a debounced selectBlock function.
 * M-CON-04: Prevents rapid selection changes from triggering many state updates.
 */
export const useDebouncedSelectBlock = () => {
  const selectBlock = useDocumentBuilderStore((state) => state.selectBlock);
  return createDebouncedSelectBlock(selectBlock);
};

export default useDocumentBuilderStore;

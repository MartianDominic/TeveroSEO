"use client";

/**
 * Document Builder Store
 * Phase 102-02: Block Palette and Canvas
 *
 * Zustand store for document builder state management.
 * Handles block CRUD, ordering, and framework selection.
 * Persists drafts to localStorage for recovery.
 */

import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  getBlockMetadata,
  getBlockTemplate,
} from "@/lib/document-builder/persuasion-blocks";
import type {
  PersuasionBlock,
  PersuasionBlockType,
} from "@/lib/document-builder/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  updateBlockContent: (id: string, content: unknown) => void;
  /** Update a block's title */
  updateBlockTitle: (id: string, title: string) => void;
  /** Update a block's styling */
  updateBlockStyling: (id: string, styling: Record<string, unknown>) => void;
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
}

/**
 * Combined store type.
 */
export type DocumentBuilderStore = DocumentBuilderState & DocumentBuilderActions;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState: DocumentBuilderState = {
  blocks: [],
  selectedBlockId: null,
  frameworkId: null,
  frameworkName: null,
  proposalId: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Document builder store with persistence.
 *
 * Features:
 * - Block CRUD operations
 * - Drag-drop reordering via moveBlock
 * - Framework selection
 * - localStorage persistence for draft recovery
 */
export const useDocumentBuilderStore = create<DocumentBuilderStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      addBlock: (type, position) => {
        const id = nanoid();
        const metadata = getBlockMetadata(type);
        const template = getBlockTemplate(type);

        const newBlock: PersuasionBlock = {
          id,
          type,
          position: position ?? get().blocks.length,
          content: template,
          title: metadata?.label ?? 'Custom Block',
          persuasionMeta: {
            frameworkId: get().frameworkId ?? undefined,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => {
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
        });

        return id;
      },

      removeBlock: (id) => {
        set((state) => ({
          blocks: state.blocks
            .filter((block) => block.id !== id)
            .map((block, index) => ({
              ...block,
              position: index,
            })),
          // Deselect if the removed block was selected
          selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
        }));
      },

      moveBlock: (fromIndex, toIndex) => {
        set((state) => {
          if (
            fromIndex < 0 ||
            fromIndex >= state.blocks.length ||
            toIndex < 0 ||
            toIndex >= state.blocks.length ||
            fromIndex === toIndex
          ) {
            return state;
          }

          const blocks = [...state.blocks];
          const [movedBlock] = blocks.splice(fromIndex, 1);
          blocks.splice(toIndex, 0, movedBlock);

          // Update all positions
          return {
            blocks: blocks.map((block, index) => ({
              ...block,
              position: index,
              updatedAt: block.id === movedBlock.id ? new Date().toISOString() : block.updatedAt,
            })),
          };
        });
      },

      updateBlockContent: (id, content) => {
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.id === id
              ? { ...block, content, updatedAt: new Date().toISOString() }
              : block
          ),
        }));
      },

      updateBlockTitle: (id, title) => {
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.id === id
              ? { ...block, title, updatedAt: new Date().toISOString() }
              : block
          ),
        }));
      },

      updateBlockStyling: (id, styling) => {
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.id === id
              ? {
                  ...block,
                  styling: { ...block.styling, ...styling },
                  updatedAt: new Date().toISOString(),
                }
              : block
          ),
        }));
      },

      selectBlock: (id) => {
        set({ selectedBlockId: id });
      },

      setFramework: (frameworkId, frameworkName) => {
        set({
          frameworkId,
          frameworkName: frameworkName ?? null,
        });
      },

      setProposalId: (proposalId) => {
        set({ proposalId });
      },

      initialize: (blocks, frameworkId, frameworkName) => {
        set({
          blocks: blocks.map((block, index) => ({
            ...block,
            position: index,
          })),
          frameworkId: frameworkId ?? null,
          frameworkName: frameworkName ?? null,
          selectedBlockId: null,
        });
      },

      getBlockAtPosition: (position) => {
        return get().blocks.find((block) => block.position === position);
      },

      getBlockTypes: () => {
        return get().blocks.map((block) => block.type);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "document-builder-draft",
      // Only persist blocks and framework, not selection state
      partialize: (state) => ({
        blocks: state.blocks,
        frameworkId: state.frameworkId,
        frameworkName: state.frameworkName,
        proposalId: state.proposalId,
      }),
    }
  )
);

export default useDocumentBuilderStore;

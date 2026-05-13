"use client";

/**
 * Content Library Store
 * Phase 101-04: Content Library
 *
 * Zustand store for content library panel state.
 * Manages open/close, search query, selected category, and blocks data.
 */
import { create } from "zustand";

/**
 * Content block data structure matching API response
 */
export interface ContentBlock {
  id: string;
  name: string;
  category: string;
  content: string;
  contentEn?: string;
  contentLt?: string;
  tags: string[];
  usageCount: number;
  lastUsedAt: string | null;
}

interface ContentLibraryState {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Current search query */
  searchQuery: string;
  /** Selected category filter (null = all) */
  selectedCategory: string | null;
  /** Loaded blocks */
  blocks: ContentBlock[];
  /** Loading state */
  isLoading: boolean;

  // Actions
  /** Open the panel */
  open: () => void;
  /** Close the panel */
  close: () => void;
  /** Toggle panel open/close */
  toggle: () => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set selected category */
  setSelectedCategory: (category: string | null) => void;
  /** Set blocks data */
  setBlocks: (blocks: ContentBlock[]) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Reset state (on close) */
  reset: () => void;
}

/**
 * Content library store
 *
 * Usage:
 * ```tsx
 * const { isOpen, open, searchQuery, setSearchQuery } = useContentLibraryStore();
 * ```
 */
export const useContentLibraryStore = create<ContentLibraryState>((set) => ({
  isOpen: false,
  searchQuery: "",
  selectedCategory: null,
  blocks: [],
  isLoading: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, searchQuery: "", selectedCategory: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setBlocks: (blocks) => set({ blocks }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set({ searchQuery: "", selectedCategory: null, blocks: [], isLoading: false }),
}));

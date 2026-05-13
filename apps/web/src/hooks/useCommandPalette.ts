"use client";

/**
 * Command palette state store - Phase 101-03
 *
 * Zustand store for global command palette state.
 * Manages open/close, current view context, and selected deal info.
 */
import { create } from "zustand";
import type { CommandView } from "@/components/command-palette/command-groups";

interface CommandPaletteState {
  /** Whether the command palette is open */
  isOpen: boolean;
  /** Current view context for context-aware commands */
  view: CommandView;
  /** Currently selected deal ID (for deal-detail view) */
  selectedDealId?: string;
  /** Currently selected deal stage (for filtering commands) */
  selectedDealStage?: string;
  /** Open the command palette */
  open: () => void;
  /** Close the command palette */
  close: () => void;
  /** Toggle the command palette */
  toggle: () => void;
  /** Set the current view context */
  setContext: (view: CommandView, dealId?: string, dealStage?: string) => void;
}

/**
 * Global command palette store.
 *
 * Usage:
 * ```tsx
 * const { isOpen, toggle, setContext } = useCommandPalette();
 *
 * // In a deal detail page:
 * useEffect(() => {
 *   setContext("deal-detail", deal.id, deal.stage);
 * }, [deal.id, deal.stage]);
 * ```
 */
export const useCommandPalette = create<CommandPaletteState>((set) => ({
  isOpen: false,
  view: "default",
  selectedDealId: undefined,
  selectedDealStage: undefined,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setContext: (view, dealId, dealStage) =>
    set({ view, selectedDealId: dealId, selectedDealStage: dealStage }),
}));

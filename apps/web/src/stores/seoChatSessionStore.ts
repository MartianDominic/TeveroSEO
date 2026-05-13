"use client";

/**
 * SEO Chat Session Store
 * Phase 98-01: Session context and UI state
 *
 * Manages current session state and UI indicators:
 * - Current session ID and context
 * - Analysis progress indicators
 * - Proposal generation state
 *
 * DOES NOT use persist middleware - session context comes from server.
 */

import { create } from "zustand";
import type { SessionContext } from "@/lib/seo-chat/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * SEO Chat Session Store state.
 */
export interface SeoChatSessionState {
  /** Current session ID */
  currentSessionId: string | null;
  /** Session context (from database) */
  context: SessionContext | null;
  /** Currently executing tool (null if idle) */
  analyzing: string | null;
  /** Proposal generation in progress */
  generatingProposal: boolean;
}

/**
 * SEO Chat Session Store actions.
 */
export interface SeoChatSessionActions {
  /** Set current session */
  setCurrentSession: (sessionId: string) => void;
  /** Update session context (merge) */
  updateContext: (updates: Partial<SessionContext>) => void;
  /** Set analyzing state */
  setAnalyzing: (tool: string | null) => void;
  /** Set proposal generation state */
  setGeneratingProposal: (generating: boolean) => void;
  /** Reset store to initial state */
  reset: () => void;
}

/**
 * Combined store type.
 */
export type SeoChatSessionStore = SeoChatSessionState & SeoChatSessionActions;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState: SeoChatSessionState = {
  currentSessionId: null,
  context: null,
  analyzing: null,
  generatingProposal: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * SEO Chat Session Store (no persist middleware).
 *
 * Session context is fetched from server and updated via updateContext().
 */
export const useSeoChatSessionStore = create<SeoChatSessionStore>()((set, get) => ({
  // State
  ...initialState,

  // Actions
  setCurrentSession: (sessionId) => {
    set({ currentSessionId: sessionId });
  },

  updateContext: (updates) => {
    const { context } = get();
    if (!context) {
      // If no context exists, create new one with updates
      // (sessionId and workspaceId must be provided in updates)
      set({
        context: {
          sessionId: updates.sessionId ?? "",
          workspaceId: updates.workspaceId ?? "",
          prospectDomain: updates.prospectDomain ?? null,
          prospectName: updates.prospectName ?? null,
          prospectEmail: updates.prospectEmail ?? null,
          niche: updates.niche ?? null,
          location: updates.location ?? null,
          keywordsAnalyzed: updates.keywordsAnalyzed ?? 0,
          analysisHistory: updates.analysisHistory ?? [],
          proposalId: updates.proposalId ?? null,
          proposalStatus: updates.proposalStatus ?? null,
        },
      });
    } else {
      // Merge updates into existing context
      set({
        context: {
          ...context,
          ...updates,
          // Concat arrays instead of replacing
          analysisHistory: [
            ...context.analysisHistory,
            ...(updates.analysisHistory ?? []),
          ],
        },
      });
    }
  },

  setAnalyzing: (tool) => {
    set({ analyzing: tool });
  },

  setGeneratingProposal: (generating) => {
    set({ generatingProposal: generating });
  },

  reset: () => {
    set(initialState);
  },
}));

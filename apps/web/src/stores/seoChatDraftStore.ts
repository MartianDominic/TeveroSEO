"use client";

/**
 * SEO Chat Draft Store
 * Phase 98-01: Proposal draft state with persist middleware
 *
 * Manages accumulated proposal draft state during SEO Chat sessions:
 * - Keywords selected from analysis results
 * - Package selection (Pamatas/Augimas/Autoritetas)
 * - Analysis results for proposal context
 *
 * Uses Zustand persist middleware with skipHydration to prevent
 * race conditions during server-side rendering (per 98-RESEARCH.md Pitfall 2).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ProposalDraft,
  Keyword,
  DomainHealthResult,
  KeywordAnalysisResult,
  FeasibilityResult,
} from "@/lib/seo-chat/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * SEO Chat Draft Store state.
 */
export interface SeoChatDraftState {
  /** Current proposal draft */
  draft: ProposalDraft;
}

/**
 * SEO Chat Draft Store actions.
 */
export interface SeoChatDraftActions {
  /** Initialize draft for a new session */
  setSession: (sessionId: string, domain: string) => void;
  /** Add keywords to draft */
  addKeywords: (keywords: Keyword[]) => void;
  /** Remove a keyword by ID */
  removeKeyword: (keywordId: string) => void;
  /** Set selected package */
  setPackage: (pkg: ProposalDraft["package"]) => void;
  /** Set an analysis result */
  setAnalysisResult: (
    type: "domainHealth" | "keywordAnalysis" | "feasibility",
    result: DomainHealthResult | KeywordAnalysisResult | FeasibilityResult
  ) => void;
  /** Clear draft (reset to initial state) */
  clearDraft: () => void;
  /** Hydrate draft from external source (e.g., database) */
  hydrate: (draft: Partial<ProposalDraft>) => void;
}

/**
 * Combined store type.
 */
export type SeoChatDraftStore = SeoChatDraftState & SeoChatDraftActions;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialDraft: ProposalDraft = {
  sessionId: null,
  domain: null,
  keywords: [],
  package: null,
  analysisResults: {
    domainHealth: null,
    keywordAnalysis: null,
    feasibilityResults: [],
  },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * SEO Chat Draft Store with persist middleware.
 *
 * IMPORTANT: Uses skipHydration: true to prevent race conditions during SSR.
 * Components must call useSeoChatDraftStore.persist.rehydrate() in useEffect.
 */
export const useSeoChatDraftStore = create<SeoChatDraftStore>()(
  persist(
    (set, get) => ({
      // State
      draft: initialDraft,

      // Actions
      setSession: (sessionId, domain) => {
        set({
          draft: {
            ...initialDraft,
            sessionId,
            domain,
          },
        });
      },

      addKeywords: (keywords) => {
        const { draft } = get();
        const existingIds = new Set(draft.keywords.map((k) => k.id));
        const newKeywords = keywords.filter((k) => !existingIds.has(k.id));

        set({
          draft: {
            ...draft,
            keywords: [...draft.keywords, ...newKeywords],
          },
        });
      },

      removeKeyword: (keywordId) => {
        const { draft } = get();
        set({
          draft: {
            ...draft,
            keywords: draft.keywords.filter((k) => k.id !== keywordId),
          },
        });
      },

      setPackage: (pkg) => {
        const { draft } = get();
        set({
          draft: {
            ...draft,
            package: pkg,
          },
        });
      },

      setAnalysisResult: (type, result) => {
        const { draft } = get();

        if (type === "domainHealth") {
          set({
            draft: {
              ...draft,
              analysisResults: {
                ...draft.analysisResults,
                domainHealth: result as DomainHealthResult,
              },
            },
          });
        } else if (type === "keywordAnalysis") {
          set({
            draft: {
              ...draft,
              analysisResults: {
                ...draft.analysisResults,
                keywordAnalysis: result as KeywordAnalysisResult,
              },
            },
          });
        } else if (type === "feasibility") {
          set({
            draft: {
              ...draft,
              analysisResults: {
                ...draft.analysisResults,
                feasibilityResults: [
                  ...draft.analysisResults.feasibilityResults,
                  result as FeasibilityResult,
                ],
              },
            },
          });
        }
      },

      clearDraft: () => {
        set({ draft: initialDraft });
      },

      hydrate: (draftUpdate) => {
        const { draft } = get();
        set({
          draft: {
            ...draft,
            ...draftUpdate,
          },
        });
      },
    }),
    {
      name: "seo-chat-draft",
      storage: createJSONStorage(() => localStorage),
      // Skip hydration to prevent race conditions (98-RESEARCH.md Pitfall 2)
      skipHydration: true,
      // Only persist draft state (exclude functions)
      partialize: (state) => ({ draft: state.draft }),
    }
  )
);

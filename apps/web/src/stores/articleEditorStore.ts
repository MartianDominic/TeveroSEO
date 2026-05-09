"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { logger } from "@/lib/logger";

// Safe localStorage wrapper with quota error handling
const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem(name);
    } catch (error) {
      logger.error("[articleEditorStore] localStorage getItem failed", { name, error });
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(name, value);
    } catch (error) {
      // Handle quota exceeded or other localStorage errors gracefully
      logger.error("[articleEditorStore] localStorage setItem failed (quota exceeded?)", { name, error });
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem(name);
    } catch (error) {
      logger.error("[articleEditorStore] localStorage removeItem failed", { name, error });
    }
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationStatus = "idle" | "generating" | "generated" | "error";

export type ArticleStatus =
  | "idle"
  | "generating"
  | "generated"
  | "pending_review"
  | "approved"
  | "publishing"
  | "published"
  | "failed";

export interface ArticleEditorState {
  /** Article UUID — null when creating a new article */
  articleId: string | null;
  clientId: string | null;
  title: string;
  keyword: string;
  wordCount: number;
  voiceTemplateId: string | null;
  blendWeight: number;
  customInstructions: string;
  /** Generated HTML content */
  htmlContent: string | null;
  /** Server-side article status */
  articleStatus: ArticleStatus;
  /** Quick notes (optional sidebar field) */
  quickNotes: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ArticleEditorActions {
  article: ArticleEditorState | null;
  isGenerating: boolean;
  generationStatus: GenerationStatus;
  /** URL of the most recently generated image (base64 data URL or remote URL) */
  generatedImageUrl: string | null;
  /** True while an image generation request is in flight */
  imageGenerating: boolean;
  setArticle: (article: ArticleEditorState | null) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setGeneratedImageUrl: (url: string | null) => void;
  setImageGenerating: (generating: boolean) => void;
  /** Merge partial updates into the current article state */
  patchArticle: (patch: Partial<ArticleEditorState>) => void;
  resetEditor: () => void;
}

// ---------------------------------------------------------------------------
// Default article state for a new article
// ---------------------------------------------------------------------------

const DEFAULT_ARTICLE: ArticleEditorState = {
  articleId: null,
  clientId: null,
  title: "",
  keyword: "",
  wordCount: 1200,
  voiceTemplateId: null,
  blendWeight: 0.5,
  customInstructions: "",
  htmlContent: null,
  articleStatus: "idle",
  quickNotes: "",
  createdAt: null,
  updatedAt: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useArticleEditorStore = create<ArticleEditorActions>()(
  persist(
    (set, get) => ({
      article: null,
      isGenerating: false,
      generationStatus: "idle",
      generatedImageUrl: null,
      imageGenerating: false,

      setArticle: (article) => set({ article }),

      setGenerating: (isGenerating) => set({ isGenerating }),

      setGenerationStatus: (generationStatus) => set({ generationStatus }),

      setGeneratedImageUrl: (generatedImageUrl) => set({ generatedImageUrl }),

      setImageGenerating: (imageGenerating) => set({ imageGenerating }),

      patchArticle: (patch) => {
        const current = get().article ?? DEFAULT_ARTICLE;
        set({ article: { ...current, ...patch } });
      },

      resetEditor: () =>
        set({
          article: null,
          isGenerating: false,
          generationStatus: "idle",
          generatedImageUrl: null,
          imageGenerating: false,
        }),
    }),
    {
      name: "article_editor_store",
      // Use safe localStorage wrapper with quota error handling
      storage: createJSONStorage(() => safeLocalStorage),
      // Persist only the article state, not transient UI state
      partialize: (state) => ({ article: state.article }),
    }
  )
);

export { DEFAULT_ARTICLE };

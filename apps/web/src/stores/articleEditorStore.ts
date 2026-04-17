"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      // Persist only the article state, not transient UI state
      partialize: (state) => ({ article: state.article }),
    }
  )
);

export { DEFAULT_ARTICLE };

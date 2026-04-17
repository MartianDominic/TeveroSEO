"use client";

import { create } from "zustand";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";

export interface Article {
  id: string;
  client_id: string;
  title: string;
  keyword?: string;
  status:
    | "draft"
    | "generating"
    | "generated"
    | "pending_review"
    | "approved"
    | "publishing"
    | "published"
    | "failed";
  publish_date?: string;
  published_at?: string;
  cms_post_id?: string;
  cms_post_url?: string;
  retry_count: number;
  error_detail?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

export interface PublishingSettings {
  id?: string;
  client_id?: string;
  articles_per_week: number;
  min_word_count: number;
  max_word_count: number;
  writing_instructions?: string;
  internal_links?: string;
  location_targeting?: string;
  competitor_urls?: string;
  business_offerings?: string;
  auto_publish: boolean;
  review_delay_hours: number;
  include_toc: boolean;
  include_infographics: boolean;
  include_key_takeaways: boolean;
  include_faq: boolean;
}

interface ContentCalendarState {
  articles: Article[];
  publishingSettings: PublishingSettings | null;
  loading: boolean;
  settingsLoading: boolean;
  error: string | null;

  fetchArticles: (clientId: string) => Promise<void>;
  fetchPendingReview: () => Promise<Article[]>;
  fetchPublishingSettings: (clientId: string) => Promise<void>;
  updatePublishingSettings: (
    clientId: string,
    settings: Partial<PublishingSettings>
  ) => Promise<void>;
  approveArticle: (articleId: string) => Promise<void>;
  rejectArticle: (articleId: string) => Promise<void>;
  submitForReview: (articleId: string) => Promise<void>;
  generateArticle: (articleId: string) => Promise<void>;
}

export const useContentCalendarStore = create<ContentCalendarState>(
  (set, get) => ({
    articles: [],
    publishingSettings: null,
    loading: false,
    settingsLoading: false,
    error: null,

    fetchArticles: async (clientId: string) => {
      set({ loading: true, error: null });
      try {
        const data = await apiGet<Article[]>(
          `/api/content-calendar?client_id=${clientId}`
        );
        set({ articles: data, loading: false });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch articles";
        set({ error: message, loading: false });
      }
    },

    fetchPendingReview: async () => {
      const data = await apiGet<Article[]>(
        "/api/content-calendar?status=pending_review"
      );
      return data;
    },

    fetchPublishingSettings: async (clientId: string) => {
      set({ settingsLoading: true });
      try {
        const data = await apiGet<PublishingSettings>(
          `/api/client-settings/${clientId}`
        );
        set({ publishingSettings: data, settingsLoading: false });
      } catch {
        set({ settingsLoading: false });
      }
    },

    updatePublishingSettings: async (
      clientId: string,
      settings: Partial<PublishingSettings>
    ) => {
      const data = await apiPut<PublishingSettings>(
        `/api/client-settings/${clientId}`,
        settings
      );
      set({ publishingSettings: data });
    },

    approveArticle: async (articleId: string) => {
      await apiPost(`/api/content-calendar/${articleId}/approve`, {});
      const { articles } = get();
      set({
        articles: articles.map((a) =>
          a.id === articleId ? { ...a, status: "approved" as const } : a
        ),
      });
    },

    rejectArticle: async (articleId: string) => {
      await apiPost(`/api/content-calendar/${articleId}/reject`, {});
      const { articles } = get();
      set({
        articles: articles.map((a) =>
          a.id === articleId ? { ...a, status: "generated" as const } : a
        ),
      });
    },

    submitForReview: async (articleId: string) => {
      await apiPost(
        `/api/content-calendar/${articleId}/submit-for-review`,
        {}
      );
      const { articles } = get();
      set({
        articles: articles.map((a) =>
          a.id === articleId
            ? { ...a, status: "pending_review" as const }
            : a
        ),
      });
    },

    generateArticle: async (articleId: string) => {
      await apiPost(`/api/content-calendar/${articleId}/generate`, {});
      const { articles } = get();
      set({
        articles: articles.map((a) =>
          a.id === articleId ? { ...a, status: "generating" as const } : a
        ),
      });
    },
  })
);

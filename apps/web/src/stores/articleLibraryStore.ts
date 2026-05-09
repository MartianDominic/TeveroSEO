"use client";

/**
 * Article Library Store - Article listing with filtering and sorting
 *
 * TODO [HIGH-42]: Migrate to TanStack Query for server state
 * This store currently manages server state which should use React Query for:
 * - Automatic caching and background refetching
 * - Stale-while-revalidate patterns
 * - Request deduplication
 * - Built-in loading/error states
 * - Infinite scroll / pagination support
 *
 * Migration path:
 * 1. Create useArticles query hook with filter/sort params
 * 2. Keep local UI state (selectedIds, sortField, sortDir) in component or separate store
 * 3. Replace store usage with query hooks in components
 * 4. Remove this store
 *
 * See: https://tanstack.com/query/latest
 */
import { create } from "zustand";

import { apiGet } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export type SortField = "title" | "status" | "publish_date" | "created_at";
export type SortDir = "asc" | "desc";

interface ArticleLibraryState {
  articles: Article[];
  loading: boolean;
  error: string | null;
  statusFilter: string;
  sortField: SortField;
  sortDir: SortDir;
  selectedIds: Set<string>;

  fetchArticles(clientId: string, status?: string): Promise<void>;
  setStatusFilter(status: string): void;
  setSort(field: SortField, dir: SortDir): void;
  toggleSelect(id: string): void;
  selectAll(ids: string[]): void;
  clearSelection(): void;
}

export const useArticleLibraryStore = create<ArticleLibraryState>((set, get) => ({
  articles: [],
  loading: false,
  error: null,
  statusFilter: "",
  sortField: "created_at",
  sortDir: "desc",
  selectedIds: new Set<string>(),

  fetchArticles: async (clientId: string, status?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ client_id: clientId });
      if (status) {
        params.set("status", status);
      }
      const articles = await apiGet<Article[]>(`/api/articles?${params.toString()}`);
      set({ articles, loading: false });
    } catch {
      set({ loading: false, error: "Failed to load articles. Please try again." });
    }
  },

  setStatusFilter: (status: string) => {
    set({ statusFilter: status });
  },

  setSort: (field: SortField, dir: SortDir) => {
    set({ sortField: field, sortDir: dir });
  },

  toggleSelect: (id: string) => {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedIds: next });
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: new Set(ids) });
  },

  clearSelection: () => {
    set({ selectedIds: new Set<string>() });
  },
}));

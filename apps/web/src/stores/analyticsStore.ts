"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api-client";

export interface ClientAnalytics {
  client_id: string;
  articles_published_this_month: number;
  total_word_count_this_month: number;
  failed_count_this_month: number;
  last_published_at: string | null;
  cms_type: string | null;
}

export interface PublishingLogEntry {
  id: string;
  article_id: string;
  attempt_number: number;
  cms_type: string | null;
  status: string;
  http_status_code: number | null;
  response_detail: string | null;
  attempted_at: string;
}

interface AnalyticsState {
  analytics: ClientAnalytics | null;
  publishingLogs: PublishingLogEntry[];
  loading: boolean;
  logsLoading: boolean;
  error: string | null;

  fetchAnalytics: (clientId: string) => Promise<void>;
  fetchPublishingLogs: (clientId: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  analytics: null,
  publishingLogs: [],
  loading: false,
  logsLoading: false,
  error: null,

  fetchAnalytics: async (clientId: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiGet<ClientAnalytics>(`/api/analytics/${clientId}`);
      set({ analytics: data, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load analytics";
      set({ error: msg, loading: false });
    }
  },

  fetchPublishingLogs: async (clientId: string) => {
    set({ logsLoading: true });
    try {
      const data = await apiGet<PublishingLogEntry[]>(`/api/analytics/${clientId}/publishing-logs`);
      set({ publishingLogs: data, logsLoading: false });
    } catch {
      set({ logsLoading: false });
    }
  },
}));

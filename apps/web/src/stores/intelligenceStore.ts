"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types — mirror IntelligenceResponse from backend/api/intelligence.py
// ---------------------------------------------------------------------------

export interface OrganicKeyword {
  keyword: string;
  position: number;
  search_volume: number;
}

export interface BrandVoice {
  writing_style?: {
    tone?: string;
    voice?: string;
    [key: string]: unknown;
  };
  brand_analysis?: {
    brand_voice?: string;
    [key: string]: unknown;
  };
  target_audience?: {
    expertise_level?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface IcpPsychology {
  awareness_stage?: string;
  core_fears?: string[];
  identity_aspirations?: string[];
  content_implications?: string[];
  [key: string]: unknown;
}

export interface IntelligenceData {
  id?: string | null;
  client_id?: string | null;
  scrape_status: string;
  scrape_error?: string | null;
  last_scraped_at?: string | null;
  brand_voice?: BrandVoice | null;
  target_audience?: unknown;
  content_structure?: unknown;
  icp_psychology?: IcpPsychology | null;
  organic_keywords?: OrganicKeyword[] | null;
  traffic_estimate?: number | null;
  domain_rating?: number | null;
  top_competitors?: string[] | null;
  technical_issues?: string[] | null;
  content_gaps?: string[] | null;
  recommended_topics?: string[] | null;
  crawl_budget_config?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface KeywordIdea {
  keyword: string;
  search_volume: number;
  competition: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface IntelligenceState {
  intelligence: IntelligenceData | null;
  loading: boolean;
  error: string | null;

  fetchIntelligence: (clientId: string) => Promise<void>;
  clearIntelligence: () => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set) => ({
  intelligence: null,
  loading: false,
  error: null,

  fetchIntelligence: async (clientId: string) => {
    set({ intelligence: null, loading: true, error: null });
    try {
      const data = await apiGet<IntelligenceData>(
        `/api/client-intelligence/${clientId}`
      );
      set({ intelligence: data, loading: false });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load intelligence data";
      set({ error: msg, loading: false });
    }
  },

  clearIntelligence: () => {
    set({ intelligence: null, error: null });
  },
}));

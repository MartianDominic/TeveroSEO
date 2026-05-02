/**
 * useNeedsAttention Hook
 * Phase 62-06: Needs Attention List
 *
 * Fetches items requiring attention for the command center dashboard.
 * Auto-refreshes every 60 seconds to keep data current.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { AttentionItem } from "@/types/command-center";

export interface NeedsAttentionResponse {
  items: AttentionItem[];
}

/**
 * Fetch attention items for a workspace.
 *
 * @param workspaceId - Workspace ID for scoping
 * @returns Query result with items array
 */
export function useNeedsAttention(workspaceId: string) {
  return useQuery({
    queryKey: ["needs-attention", workspaceId],
    queryFn: async (): Promise<NeedsAttentionResponse> => {
      const res = await fetch("/api/command-center/needs-attention", {
        headers: { "X-Workspace-Id": workspaceId },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch attention items");
      }
      return res.json();
    },
    // Refresh every minute to keep data current
    refetchInterval: 60 * 1000,
    // Don't refetch on window focus (prevents UI jank)
    refetchOnWindowFocus: false,
    // Keep previous data while refetching
    staleTime: 30 * 1000,
  });
}

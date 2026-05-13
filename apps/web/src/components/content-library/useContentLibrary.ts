"use client";

/**
 * Content Library Hook
 * Phase 101-04: Content Library
 *
 * React Query hook for fetching and managing content library blocks.
 * Provides search, fetch, and usage tracking functionality.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useContentLibraryStore, type ContentBlock } from "@/stores/contentLibraryStore";
import { useEffect } from "react";

/**
 * API response structure
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch content blocks with optional filters
 */
async function fetchBlocks(
  query?: string,
  category?: string
): Promise<ContentBlock[]> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (category) params.set("category", category);

  const res = await fetch(`/api/content-library/blocks?${params}`);
  const data: ApiResponse<ContentBlock[]> = await res.json();

  if (!data.success) {
    throw new Error(data.error ?? "Failed to fetch blocks");
  }

  return data.data ?? [];
}

/**
 * Record block usage when inserted into a document
 */
async function recordBlockUsage(
  blockId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  const res = await fetch("/api/content-library/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockId, entityType, entityId }),
  });

  const data: ApiResponse<void> = await res.json();

  if (!data.success) {
    throw new Error(data.error ?? "Failed to record usage");
  }
}

/**
 * Hook for content library operations
 *
 * @returns Object with blocks, loading state, refetch function, and recordUsage mutation
 *
 * @example
 * ```tsx
 * const { blocks, isLoading, recordUsage } = useContentLibrary();
 *
 * const handleInsert = (block: ContentBlock) => {
 *   onInsert(block.content);
 *   recordUsage({ blockId: block.id, entityType: "proposal", entityId });
 * };
 * ```
 */
export function useContentLibrary() {
  const {
    searchQuery,
    selectedCategory,
    setBlocks,
    setLoading,
  } = useContentLibraryStore();

  const queryClient = useQueryClient();

  // Fetch blocks with debounced search query
  const {
    data: blocks = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["content-library", searchQuery, selectedCategory],
    queryFn: () =>
      fetchBlocks(searchQuery || undefined, selectedCategory || undefined),
    staleTime: 30000, // 30 seconds
    enabled: true, // Always enabled, will show empty state when no blocks
  });

  // Sync React Query state to Zustand store
  useEffect(() => {
    setBlocks(blocks);
    setLoading(isLoading);
  }, [blocks, isLoading, setBlocks, setLoading]);

  // Record usage mutation
  const recordUsageMutation = useMutation({
    mutationFn: ({
      blockId,
      entityType,
      entityId,
    }: {
      blockId: string;
      entityType: string;
      entityId: string;
    }) => recordBlockUsage(blockId, entityType, entityId),
    onSuccess: () => {
      // Invalidate queries to refresh usage counts
      queryClient.invalidateQueries({ queryKey: ["content-library"] });
    },
  });

  return {
    /** Content blocks */
    blocks,
    /** Loading state */
    isLoading,
    /** Refetch blocks */
    refetch,
    /** Record usage (fire and forget) */
    recordUsage: recordUsageMutation.mutate,
    /** Is recording usage */
    isRecordingUsage: recordUsageMutation.isPending,
  };
}

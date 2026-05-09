/**
 * TanStack Query Hooks for Client Data
 *
 * Phase 68-04: State Management Migration
 * HIGH-STATE-01 FIX: Migrate server state to TanStack Query
 *
 * This replaces the fetch logic in clientStore.ts with proper React Query
 * patterns for:
 * - Automatic caching and background refetching
 * - Stale-while-revalidate patterns
 * - Request deduplication
 * - Built-in loading/error states
 *
 * The clientStore retains activeClientId as UI state (persisted to cookies),
 * while useClients() manages the client list as server state.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { broadcastSync } from "@/lib/state/broadcast-sync";
import { useClientStore } from "@/stores/clientStore";

import type { Client } from "@tevero/types";

// ============================================================================
// Query Configuration
// ============================================================================

/**
 * Stale time for client data.
 * Data is considered fresh for 5 minutes before refetching.
 */
const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Garbage collection time for client data.
 * Unused data is removed from cache after 10 minutes.
 */
const GC_TIME_MS = 10 * 60 * 1000;

// ============================================================================
// useClients Hook
// ============================================================================

/**
 * Fetch and cache the client list using TanStack Query.
 *
 * @returns Query result with clients array, loading/error states
 *
 * @example
 * ```tsx
 * const { data: clients, isLoading, error } = useClients();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <ClientList clients={clients} />;
 * ```
 */
export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients.all,
    queryFn: async (): Promise<Client[]> => {
      const response = await fetch("/api/clients", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch clients (${response.status})`);
      }

      return response.json();
    },
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
}

// ============================================================================
// useActiveClient Hook
// ============================================================================

/**
 * Get the currently active client by combining store state with query data.
 *
 * This hook derives the active client from:
 * 1. activeClientId from Zustand store (UI state, persisted to cookies)
 * 2. clients array from useClients query (server state)
 *
 * @returns The active client object or null if none selected/found
 *
 * @example
 * ```tsx
 * const activeClient = useActiveClient();
 *
 * if (!activeClient) {
 *   return <NoClientSelected />;
 * }
 *
 * return <ClientDetails client={activeClient} />;
 * ```
 */
export function useActiveClient(): Client | null {
  const activeClientId = useClientStore((state) => state.activeClientId);
  const { data: clients } = useClients();

  if (!activeClientId || !clients) {
    return null;
  }

  return clients.find((client) => client.id === activeClientId) ?? null;
}

// ============================================================================
// useSetActiveClient Hook
// ============================================================================

/**
 * Hook to set the active client with cache invalidation and cross-tab sync.
 *
 * When called:
 * 1. Updates activeClientId in Zustand store (persisted to cookies)
 * 2. Invalidates client-specific queries (audits, etc.)
 * 3. Broadcasts change to other browser tabs via BroadcastChannel
 *
 * @returns Function to set active client by ID
 *
 * @example
 * ```tsx
 * const setActiveClient = useSetActiveClient();
 *
 * // In a client selector component
 * <button onClick={() => setActiveClient(client.id)}>
 *   {client.name}
 * </button>
 * ```
 */
/**
 * Minimum overlay duration to prevent jarring flash.
 * Users perceive instant switches as glitchy - a brief overlay feels intentional.
 */
const MIN_OVERLAY_DURATION_MS = 300;

export function useSetActiveClient() {
  const queryClient = useQueryClient();
  const setActiveClient = useClientStore((state) => state.setActiveClient);
  const setIsSwitching = useClientStore((state) => state.setIsSwitching);

  return async (clientId: string) => {
    const startTime = Date.now();

    // HIGH-UX-01: Show loading overlay during client switch
    setIsSwitching(true);

    // Update store (includes abort of previous client's requests)
    setActiveClient(clientId);

    // Broadcast to other tabs
    broadcastSync.broadcastClientChange(clientId);

    // Invalidate client-specific queries so they refetch with new context
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.audits.byClient(clientId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.byClient(clientId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.client(clientId) }),
    ]);

    // Ensure minimum overlay duration to prevent jarring flash
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_OVERLAY_DURATION_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_OVERLAY_DURATION_MS - elapsed));
    }

    // Hide loading overlay
    setIsSwitching(false);
  };
}

// ============================================================================
// useInvalidateClients Hook
// ============================================================================

/**
 * Hook to invalidate the clients cache.
 *
 * Use this when you know client data has changed (e.g., after creating
 * or archiving a client) to trigger a refetch.
 *
 * @returns Function to invalidate clients cache
 *
 * @example
 * ```tsx
 * const invalidateClients = useInvalidateClients();
 *
 * const handleArchive = async (clientId: string) => {
 *   await archiveClient(clientId);
 *   invalidateClients();
 * };
 * ```
 */
export function useInvalidateClients() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
  };
}

// ============================================================================
// useClientById Hook
// ============================================================================

/**
 * Get a specific client by ID from the cached clients list.
 *
 * This hook uses the same cache as useClients() - it doesn't make
 * a separate request. If the client isn't in cache, returns null.
 *
 * @param clientId - The client ID to find
 * @returns The client or null if not found
 *
 * @example
 * ```tsx
 * const client = useClientById(params.clientId);
 *
 * if (!client) {
 *   return <ClientNotFound />;
 * }
 *
 * return <ClientHeader client={client} />;
 * ```
 */
export function useClientById(clientId: string | null | undefined): Client | null {
  const { data: clients } = useClients();

  if (!clientId || !clients) {
    return null;
  }

  return clients.find((client) => client.id === clientId) ?? null;
}

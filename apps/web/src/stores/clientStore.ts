"use client";

/**
 * Client Store - Client list and active client selection
 *
 * FIX-17 HIGH-UJ-12: Added invalidation and refetch mechanisms
 * - invalidateClients(): Mark data as stale, triggering refetch on next access
 * - refetchOnNavigation: Auto-refetch when data is older than STALE_TIME
 * - lastFetchedAt: Track when data was last fetched
 *
 * FIX-03 HIGH-CW-01, HIGH-CW-03: Improved active client handling
 * - Validates active client exists before use
 * - Clears stale client ID on deletion/archival
 * - validateActiveClient(): Server-side existence check
 * - handleClientDeleted(): Handle deletion events
 *
 * TODO [HIGH-42]: Migrate to TanStack Query for server state
 * This store currently manages server state which should use React Query for:
 * - Automatic caching and background refetching
 * - Stale-while-revalidate patterns
 * - Request deduplication
 * - Built-in loading/error states
 *
 * Migration path:
 * 1. Create useClients query hook for fetching client list
 * 2. Keep activeClientId in persisted Zustand store (this is UI state)
 * 3. Derive activeClient from query data + activeClientId
 * 4. Replace fetchClients calls with query hook
 * 5. Simplify this store to only manage activeClientId
 *
 * Note: The persist middleware for activeClientId is valid UI state
 * and should remain in Zustand even after migration.
 *
 * See: https://tanstack.com/query/latest
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Client } from "@tevero/types";
import { ACTIVE_CLIENT_COOKIE, cookieStorage } from "@/lib/cookies";
import { abortManager } from "@/lib/client-context/abort-manager";

// FIX-17 HIGH-UJ-12: Stale time for client data (5 minutes)
const STALE_TIME_MS = 5 * 60 * 1000;

interface ClientState {
  clients: Client[];
  activeClientId: string | null;
  activeClient: Client | null;
  isLoading: boolean;
  error: string | null;
  /** FIX-17: Track when data was last fetched */
  lastFetchedAt: number | null;
  /** FIX-17: Whether data has been explicitly invalidated */
  isStale: boolean;
  /** FIX-03: Track last validation timestamp */
  lastValidatedAt: number | null;
}

interface ClientActions {
  fetchClients: () => Promise<void>;
  setActiveClient: (id: string) => void;
  clearActiveClient: () => void;
  clearError: () => void;
  retryFetchClients: () => Promise<void>;
  /** FIX-17: Mark client data as stale, will refetch on next access */
  invalidateClients: () => void;
  /** FIX-17: Refetch if data is stale or older than STALE_TIME */
  refetchIfStale: () => Promise<void>;
  /** FIX-17: Check if data needs refresh */
  isDataStale: () => boolean;
  /** FIX-03 HIGH-CW-03: Validate active client exists, clear if deleted */
  validateActiveClient: () => Promise<boolean>;
  /** FIX-03: Handle client deletion event */
  handleClientDeleted: (clientId: string) => void;
}

export type ClientStore = ClientState & ClientActions;

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      clients: [],
      activeClientId: null,
      activeClient: null,
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      isStale: false,
      lastValidatedAt: null,

      fetchClients: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/clients", { credentials: "include" });
          if (!res.ok) throw new Error(`Failed to fetch clients (${res.status})`);
          const clients = (await res.json()) as Client[];
          const { activeClientId } = get();

          // FIX-03 HIGH-CW-03: Validate active client still exists in fetched list
          let validActiveClientId = activeClientId;
          let activeClient: Client | null = null;

          if (activeClientId) {
            activeClient = clients.find((c) => c.id === activeClientId) ?? null;
            if (!activeClient) {
              // Active client no longer exists (deleted/archived) - clear it
              validActiveClientId = null;
              console.warn(
                `[ClientStore] Active client ${activeClientId} no longer exists, clearing selection`
              );
            }
          }

          // FIX-17: Track fetch time and clear stale flag
          set({
            clients,
            activeClientId: validActiveClientId,
            activeClient,
            isLoading: false,
            lastFetchedAt: Date.now(),
            isStale: false,
            lastValidatedAt: Date.now(),
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to fetch clients";
          set({ error: message, isLoading: false });
        }
      },

      setActiveClient: (id: string) => {
        const { clients, activeClientId: previousClientId } = get();
        const activeClient = clients.find((c) => c.id === id) ?? null;

        // FIX-03 HIGH-CW-01: Don't set if client doesn't exist in local list
        if (!activeClient) {
          console.warn(`[ClientStore] Cannot set active client: ${id} not found in client list`);
          return;
        }

        // Phase 68-02 HIGH-01 FIX: Abort in-flight requests for previous client
        // This prevents race conditions where stale responses could be processed
        if (previousClientId && previousClientId !== id) {
          abortManager.abortClient(previousClientId);
        }

        set({ activeClientId: id, activeClient, lastValidatedAt: Date.now() });
      },

      clearActiveClient: () => {
        set({ activeClientId: null, activeClient: null });
      },

      clearError: () => {
        set({ error: null });
      },

      retryFetchClients: async () => {
        const { fetchClients } = get();
        await fetchClients();
      },

      // FIX-17 HIGH-UJ-12: Mark data as stale for refetch
      invalidateClients: () => {
        set({ isStale: true });
      },

      // FIX-17 HIGH-UJ-12: Refetch if data is stale or expired
      refetchIfStale: async () => {
        const { isDataStale, fetchClients, isLoading } = get();
        if (!isLoading && isDataStale()) {
          await fetchClients();
        }
      },

      // FIX-17 HIGH-UJ-12: Check if data needs refresh
      isDataStale: () => {
        const { lastFetchedAt, isStale, clients } = get();

        // Explicitly marked as stale
        if (isStale) return true;

        // Never fetched
        if (!lastFetchedAt) return true;

        // No clients loaded
        if (clients.length === 0) return true;

        // Data is older than STALE_TIME
        const age = Date.now() - lastFetchedAt;
        return age > STALE_TIME_MS;
      },

      // FIX-03 HIGH-CW-03: Validate active client exists via API
      validateActiveClient: async () => {
        const { activeClientId } = get();
        if (!activeClientId) return false;

        try {
          // Fetch fresh client list to validate
          const res = await fetch("/api/clients", { credentials: "include" });
          if (!res.ok) {
            // If fetch fails, keep current state but mark as potentially stale
            return false;
          }

          const clients = (await res.json()) as Client[];
          const exists = clients.some((c) => c.id === activeClientId);

          if (!exists) {
            // Client was deleted/archived - clear selection
            set({
              activeClientId: null,
              activeClient: null,
              clients,
              lastFetchedAt: Date.now(),
              isStale: false,
            });
            return false;
          }

          // Update client list and confirm active client
          const activeClient = clients.find((c) => c.id === activeClientId) ?? null;
          set({
            clients,
            activeClient,
            lastFetchedAt: Date.now(),
            lastValidatedAt: Date.now(),
            isStale: false,
          });
          return true;
        } catch {
          return false;
        }
      },

      // FIX-03: Handle deletion events (called from event listener)
      handleClientDeleted: (clientId: string) => {
        const { activeClientId, clients } = get();

        // Remove from local list
        const updatedClients = clients.filter((c) => c.id !== clientId);

        // Clear active if it was deleted
        if (activeClientId === clientId) {
          set({
            clients: updatedClients,
            activeClientId: null,
            activeClient: null,
          });
        } else {
          set({ clients: updatedClients });
        }
      },
    }),
    {
      name: ACTIVE_CLIENT_COOKIE,
      storage: createJSONStorage(() => cookieStorage),
      // FIX-03: Only persist activeClientId, not timestamps
      partialize: (state) => ({ activeClientId: state.activeClientId }),
    }
  )
);

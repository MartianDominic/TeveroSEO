"use client";

/**
 * Client Store - Client list and active client selection
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

interface ClientState {
  clients: Client[];
  activeClientId: string | null;
  activeClient: Client | null;
  isLoading: boolean;
  error: string | null;
}

interface ClientActions {
  fetchClients: () => Promise<void>;
  setActiveClient: (id: string) => void;
  clearActiveClient: () => void;
  clearError: () => void;
  retryFetchClients: () => Promise<void>;
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

      fetchClients: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/clients", { credentials: "include" });
          if (!res.ok) throw new Error(`Failed to fetch clients (${res.status})`);
          const clients = (await res.json()) as Client[];
          const { activeClientId } = get();
          const activeClient = activeClientId
            ? (clients.find((c) => c.id === activeClientId) ?? null)
            : null;
          set({ clients, activeClient, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to fetch clients";
          set({ error: message, isLoading: false });
        }
      },

      setActiveClient: (id: string) => {
        const { clients } = get();
        const activeClient = clients.find((c) => c.id === id) ?? null;
        set({ activeClientId: id, activeClient });
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
    }),
    {
      name: ACTIVE_CLIENT_COOKIE,
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({ activeClientId: state.activeClientId }),
    }
  )
);

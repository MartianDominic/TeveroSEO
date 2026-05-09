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
 * Phase 68-04: State Management Migration (HIGH-STATE-01, HIGH-STATE-02)
 *
 * TanStack Query migration is now available via:
 * - useClients(): Fetch client list with 5-min staleTime
 * - useActiveClient(): Derive active client from store + query
 * - useSetActiveClient(): Switch client with cache invalidation
 *
 * This store retains:
 * - activeClientId: UI state, persisted to cookies
 * - fetchClients/etc: Legacy methods for gradual migration
 *
 * New code should prefer the hooks in @/hooks/use-clients.ts.
 * Legacy methods remain for backwards compatibility.
 *
 * Multi-tab sync via BroadcastChannel:
 * - Client switches sync across tabs
 * - Logout in one tab logs out all tabs
 *
 * See: @/hooks/use-clients.ts, @/lib/state/broadcast-sync.ts
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { abortManager } from "@/lib/client-context/abort-manager";
import { ACTIVE_CLIENT_COOKIE, cookieStorage } from "@/lib/cookies";
import { broadcastSync } from "@/lib/state/broadcast-sync";

import type { Client } from "@tevero/types";

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
  /** HIGH-UX-01: Track client switching state for loading overlay */
  isSwitching: boolean;
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
  /** HIGH-UX-01: Set switching state for loading overlay */
  setIsSwitching: (switching: boolean) => void;
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
      isSwitching: false,

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

      // HIGH-UX-01: Set switching state for loading overlay
      setIsSwitching: (switching: boolean) => {
        set({ isSwitching: switching });
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

// ============================================================================
// BroadcastChannel Subscription for Multi-Tab Sync
// ============================================================================

/**
 * Phase 68-04: Subscribe to cross-tab state changes.
 *
 * This runs once when the module loads (client-side only).
 * Handles:
 * - CLIENT_CHANGED: Sync active client across tabs
 * - LOGOUT: Clear state and redirect to sign-out
 */
if (typeof window !== "undefined") {
  // Initialize broadcast channel
  broadcastSync.init();

  // Subscribe to cross-tab messages
  broadcastSync.subscribe("clientStore", (message) => {
    const store = useClientStore.getState();

    switch (message.type) {
      case "CLIENT_CHANGED": {
        // Another tab changed the active client - sync it here
        const { clients } = store;
        const activeClient = clients.find((c) => c.id === message.clientId) ?? null;

        if (activeClient) {
          // Use setState directly to avoid circular broadcast
          useClientStore.setState({
            activeClientId: message.clientId,
            activeClient,
            lastValidatedAt: Date.now(),
          });
        } else {
          // Client not in local list - may need to refetch
          useClientStore.setState({
            activeClientId: message.clientId,
            activeClient: null,
            isStale: true,
          });
        }
        break;
      }

      case "LOGOUT": {
        // Another tab logged out - clear state and redirect
        useClientStore.setState({
          activeClientId: null,
          activeClient: null,
          clients: [],
          lastFetchedAt: null,
          isStale: false,
        });

        // Redirect to sign-out page
        window.location.href = "/sign-out";
        break;
      }

      case "CACHE_INVALIDATE": {
        // Mark clients as stale if the 'clients' key is in the invalidation list
        if (message.keys.includes("clients")) {
          useClientStore.setState({ isStale: true });
        }
        break;
      }
    }
  });
}

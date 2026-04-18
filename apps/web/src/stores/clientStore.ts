"use client";

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
    }),
    {
      name: ACTIVE_CLIENT_COOKIE,
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({ activeClientId: state.activeClientId }),
    }
  )
);

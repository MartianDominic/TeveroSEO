"use client";

import { useMemo } from "react";
import type { ClientMetrics, ClientTableFilters } from "@/lib/dashboard/types";

export interface UseClientFilteringOptions {
  clients: ClientMetrics[];
  filters: ClientTableFilters;
  /** Whether to skip client-side filtering (for server-side pagination mode) */
  skipFiltering?: boolean;
}

export interface UseClientFilteringResult {
  filtered: ClientMetrics[];
  filteredCount: number;
  totalCount: number;
}

/**
 * Hook for filtering client metrics based on search and filter criteria.
 * Supports search, health range, connection status, and alerts filtering.
 */
export function useClientFiltering({
  clients,
  filters,
  skipFiltering = false,
}: UseClientFilteringOptions): UseClientFilteringResult {
  const filtered = useMemo(() => {
    if (skipFiltering) return clients;

    return clients.filter((client) => {
      // Search filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        if (!client.clientName.toLowerCase().includes(query)) return false;
      }

      // Health range filter
      if (
        client.healthScore < filters.healthRange[0] ||
        client.healthScore > filters.healthRange[1]
      ) {
        return false;
      }

      // Connection status filter
      if (
        filters.connectionStatus.length > 0 &&
        !filters.connectionStatus.includes(client.connectionStatus)
      ) {
        return false;
      }

      // Has alerts filter
      if (filters.hasAlerts === true && client.alertsOpen === 0) return false;
      if (filters.hasAlerts === false && client.alertsOpen > 0) return false;

      return true;
    });
  }, [clients, filters, skipFiltering]);

  return {
    filtered,
    filteredCount: filtered.length,
    totalCount: clients.length,
  };
}

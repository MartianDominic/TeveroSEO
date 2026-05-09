"use client";

import { useState, useMemo, useCallback } from "react";

import type { ClientMetrics, ClientSortKey } from "@/lib/dashboard/types";

export interface UseClientSortingOptions {
  clients: ClientMetrics[];
  initialSortKey?: ClientSortKey;
  initialSortDir?: "asc" | "desc";
  /** Whether to skip client-side sorting (for server-side pagination mode) */
  skipSorting?: boolean;
}

export interface UseClientSortingResult {
  sorted: ClientMetrics[];
  sortKey: ClientSortKey;
  sortDir: "asc" | "desc";
  toggleSort: (key: ClientSortKey) => void;
  setSortKey: (key: ClientSortKey) => void;
  setSortDir: (dir: "asc" | "desc") => void;
}

/**
 * Hook for sorting client metrics by various columns.
 * Supports toggling sort direction and switching sort keys.
 */
export function useClientSorting({
  clients,
  initialSortKey = "healthScore",
  initialSortDir = "desc",
  skipSorting = false,
}: UseClientSortingOptions): UseClientSortingResult {
  const [sortKey, setSortKey] = useState<ClientSortKey>(initialSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);

  const toggleSort = useCallback(
    (key: ClientSortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        // Default descending for numeric, ascending for text
        setSortDir(key === "clientName" ? "asc" : "desc");
      }
    },
    [sortKey]
  );

  const sorted = useMemo(() => {
    if (skipSorting) return clients;

    return [...clients].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      // Handle optional fields that may not exist on ClientMetrics or can be null
      if (sortKey === "addedAt") {
        aVal = 0;
        bVal = 0;
      } else if (sortKey === "goalAttainmentPct") {
        aVal = a.goalAttainmentPct ?? 0;
        bVal = b.goalAttainmentPct ?? 0;
      } else if (sortKey === "priorityScore") {
        aVal = a.priorityScore ?? 0;
        bVal = b.priorityScore ?? 0;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [clients, sortKey, sortDir, skipSorting]);

  return {
    sorted,
    sortKey,
    sortDir,
    toggleSort,
    setSortKey,
    setSortDir,
  };
}

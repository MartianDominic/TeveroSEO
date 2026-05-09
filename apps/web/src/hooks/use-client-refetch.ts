/**
 * useClientRefetch Hook
 * FIX-17 HIGH-UJ-12: Automatic client data refetch on navigation
 *
 * This hook ensures client data stays fresh by:
 * - Refetching when data is stale (older than 5 minutes)
 * - Refetching when explicitly invalidated
 * - Refetching on route changes to prevent stale UI
 *
 * Usage:
 * ```tsx
 * // In a layout or page component
 * import { useClientRefetch } from "@/hooks/use-client-refetch";
 *
 * function ClientLayout() {
 *   useClientRefetch(); // Auto-refetch stale data
 *   // ...
 * }
 * ```
 */
"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";

import { useClientStore } from "@/stores/clientStore";

/**
 * Hook that automatically refetches client data when stale.
 * Should be used in layouts that depend on client data.
 */
export function useClientRefetch(): void {
  const pathname = usePathname();
  const refetchIfStale = useClientStore((s) => s.refetchIfStale);

  // Refetch on route change if data is stale
  useEffect(() => {
    refetchIfStale();
  }, [pathname, refetchIfStale]);
}

/**
 * Hook to invalidate client data after mutations.
 * Returns a function that marks client data as stale.
 *
 * Usage:
 * ```tsx
 * const invalidateClients = useInvalidateClients();
 *
 * async function handleArchiveClient() {
 *   await archiveClient(clientId);
 *   invalidateClients(); // Data will be refetched on next navigation
 * }
 * ```
 */
export function useInvalidateClients(): () => void {
  return useClientStore((s) => s.invalidateClients);
}

/**
 * Combined hook for components that both read and mutate client data.
 *
 * Returns:
 * - invalidate: Mark data as stale
 * - refetch: Force immediate refetch
 * - isStale: Check if data needs refresh
 */
export function useClientDataManagement() {
  const invalidate = useClientStore((s) => s.invalidateClients);
  const refetch = useClientStore((s) => s.fetchClients);
  const isStale = useClientStore((s) => s.isDataStale);

  return {
    invalidate,
    refetch,
    isStale,
  };
}

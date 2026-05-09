"use client";

/**
 * useSmartAlerts Hook
 * Phase 62-07: Smart Alert Detection
 *
 * TanStack Query hook for fetching and managing smart alerts.
 * Includes dismiss mutation with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { dismissAlert } from "@/app/(dashboard)/command-center/actions";

/**
 * Smart alert from the backend.
 */
export interface SmartAlert {
  id: string;
  workspaceId: string;
  alertType: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  metricCurrent: string | null;
  metricPrevious: string | null;
  metricUnit: string | null;
  suggestedAction: string | null;
  actionUrl: string | null;
  isDismissed: boolean;
  dismissedBy: string | null;
  dismissedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
}

/**
 * Response from the alerts API.
 */
interface AlertsResponse {
  alerts: SmartAlert[];
}

/**
 * Query key factory for smart alerts.
 */
export const alertKeys = {
  all: ["smart-alerts"] as const,
  workspace: (workspaceId: string) =>
    [...alertKeys.all, workspaceId] as const,
};

/**
 * Fetches smart alerts from the command center API.
 *
 * @param workspaceId - The workspace ID to fetch alerts for
 * @returns Alerts response
 */
async function fetchSmartAlerts(workspaceId: string): Promise<AlertsResponse> {
  const res = await fetch("/api/command-center/alerts", {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch alerts");
  }

  return res.json();
}

interface UseSmartAlertsOptions {
  /** Initial data from server-side fetch */
  initialData?: AlertsResponse;
  /** Only return active (not dismissed or resolved) alerts */
  activeOnly?: boolean;
}

interface UseSmartAlertsReturn {
  /** All alerts */
  alerts: SmartAlert[];
  /** Active alerts only (not dismissed or resolved) */
  activeAlerts: SmartAlert[];
  /** Whether alerts are loading */
  isLoading: boolean;
  /** Whether refetch is in progress */
  isRefetching: boolean;
  /** Error if any */
  error: Error | null;
  /** Dismiss an alert */
  dismiss: ReturnType<typeof useMutation<{ success: boolean }, Error, string>>;
  /** Refetch alerts */
  refetch: () => void;
}

/**
 * Hook for fetching and managing smart alerts.
 *
 * @param workspaceId - The workspace ID to fetch alerts for
 * @param options - Hook options
 * @returns Alert state and methods
 *
 * @example
 * ```tsx
 * const { activeAlerts, dismiss, isLoading } = useSmartAlerts(workspaceId);
 *
 * // Dismiss an alert
 * dismiss.mutate(alertId);
 * ```
 */
export function useSmartAlerts(
  workspaceId: string,
  options: UseSmartAlertsOptions = {}
): UseSmartAlertsReturn {
  const { initialData } = options;
  const queryClient = useQueryClient();

  const query = useQuery<AlertsResponse, Error>({
    queryKey: alertKeys.workspace(workspaceId),
    queryFn: () => fetchSmartAlerts(workspaceId),
    initialData,
    // Refresh every minute
    refetchInterval: 60 * 1000,
    // Consider data stale after 30 seconds
    staleTime: 30 * 1000,
    // Refetch on window focus
    refetchOnWindowFocus: true,
    // Enable when we have a workspace
    enabled: !!workspaceId,
  });

  const dismiss = useMutation<
    { success: boolean },
    Error,
    string,
    { previousData: AlertsResponse | undefined }
  >({
    mutationFn: async (alertId: string) => {
      const result = await dismissAlert(alertId);
      return result;
    },
    onMutate: async (alertId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: alertKeys.workspace(workspaceId),
      });

      // Snapshot current data
      const previousData = queryClient.getQueryData<AlertsResponse>(
        alertKeys.workspace(workspaceId)
      );

      // Optimistically update the cache
      queryClient.setQueryData<AlertsResponse>(
        alertKeys.workspace(workspaceId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            alerts: old.alerts.map((alert) =>
              alert.id === alertId
                ? { ...alert, isDismissed: true, dismissedAt: new Date().toISOString() }
                : alert
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _alertId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          alertKeys.workspace(workspaceId),
          context.previousData
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: alertKeys.workspace(workspaceId),
      });
    },
  });

  const alerts = query.data?.alerts ?? [];
  const activeAlerts = alerts.filter(
    (alert) => !alert.isDismissed && !alert.resolvedAt
  );

  return {
    alerts,
    activeAlerts,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    dismiss,
    refetch: query.refetch,
  };
}

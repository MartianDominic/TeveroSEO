import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeamMetrics, reassignClient } from "@/actions/team/get-team-metrics";
import type { TeamMetrics } from "@/types/team";

/**
 * Query key factory for team metrics.
 */
export const teamKeys = {
  all: ["team"] as const,
  metrics: (workspaceId: string) => [...teamKeys.all, "metrics", workspaceId] as const,
};

interface UseTeamMetricsOptions {
  workspaceId?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching team metrics with workload data.
 * Uses React Query for caching and automatic refetching.
 */
export function useTeamMetrics(options: UseTeamMetricsOptions = {}) {
  const { workspaceId, enabled = true } = options;

  return useQuery<TeamMetrics>({
    queryKey: teamKeys.metrics(workspaceId ?? "default"),
    queryFn: () => getTeamMetrics(workspaceId ?? "default"),
    enabled: enabled && !!workspaceId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

interface UseReassignClientOptions {
  workspaceId: string;
}

/**
 * Mutation hook for reassigning a client to a different team member.
 */
export function useReassignClient({ workspaceId }: UseReassignClientOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      toMemberId,
    }: {
      clientId: string;
      toMemberId: string;
    }) => reassignClient(workspaceId, clientId, toMemberId),
    onSuccess: () => {
      // Invalidate team metrics to refetch updated workloads
      queryClient.invalidateQueries({ queryKey: teamKeys.metrics(workspaceId) });
      // Also invalidate dashboard metrics as client ownership changed
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

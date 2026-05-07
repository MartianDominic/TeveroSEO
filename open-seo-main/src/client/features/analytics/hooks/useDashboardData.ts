/**
 * Dashboard Data Hook
 * Phase 96-02: Master Dashboard
 *
 * Fetches aggregated metrics with date range and tag filtering.
 * Uses TanStack Query for caching and refetching.
 */
import { useQuery } from '@tanstack/react-query';
import type {
  DashboardFilters,
  DashboardAggregates,
} from '@/server/features/analytics/types';

interface UseDashboardDataOptions {
  filters: DashboardFilters;
  enabled?: boolean;
}

export function useDashboardData({ filters, enabled = true }: UseDashboardDataOptions) {
  return useQuery({
    queryKey: ['analytics-dashboard', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filters.dateRange.startDate,
        endDate: filters.dateRange.endDate,
      });

      if (filters.comparison) {
        params.set('comparison', filters.comparison);
      }
      if (filters.tags?.length) {
        params.set('tags', filters.tags.join(','));
      }
      if (filters.siteIds?.length) {
        params.set('siteIds', filters.siteIds.join(','));
      }

      const res = await fetch(`/api/analytics/master?${params}`, {
        headers: {
          'X-Workspace-ID': 'workspace-1', // TODO: Get from auth context
        },
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: DashboardAggregates;
        error?: string;
      };

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch dashboard data');
      }

      return json.data!;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['analytics-tags'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/tags', {
        headers: {
          'X-Workspace-ID': 'workspace-1', // TODO: Get from auth context
        },
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: Array<{ name: string; count: number }>;
      };

      return json.data ?? [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

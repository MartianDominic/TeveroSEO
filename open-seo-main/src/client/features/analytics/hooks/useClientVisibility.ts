/**
 * useClientVisibility Hook
 * Phase 96-05: Client Portal
 *
 * Fetches and caches visibility configuration for a client.
 * Used to conditionally render metrics in the client portal.
 */
import { useState, useEffect, useCallback } from 'react';

export interface VisibilityConfig {
  showClicks: boolean;
  showImpressions: boolean;
  showPosition: boolean;
  showCtr: boolean;
  showQueries: boolean;
  showPages: boolean;
  showCompetitors: boolean;
  canViewGrowing: boolean;
  canViewDecaying: boolean;
  canViewCannibalization: boolean;
  canExport: boolean;
}

const DEFAULT_VISIBILITY: VisibilityConfig = {
  showClicks: true,
  showImpressions: true,
  showPosition: true,
  showCtr: true,
  showQueries: false,
  showPages: true,
  showCompetitors: false,
  canViewGrowing: true,
  canViewDecaying: true,
  canViewCannibalization: false,
  canExport: false,
};

interface UseClientVisibilityResult {
  visibilityConfig: VisibilityConfig;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useClientVisibility(
  clientId: string | undefined,
  workspaceId: string | undefined
): UseClientVisibilityResult {
  const [visibilityConfig, setVisibilityConfig] = useState<VisibilityConfig>(DEFAULT_VISIBILITY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisibility = useCallback(async () => {
    if (!clientId || !workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/visibility/${clientId}`, {
        headers: {
          'X-Workspace-ID': workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Failed to fetch visibility config');
      }

      const result = await response.json() as { success: boolean; data?: VisibilityConfig };
      if (result.success && result.data) {
        setVisibilityConfig(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Keep default visibility on error
      setVisibilityConfig(DEFAULT_VISIBILITY);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, workspaceId]);

  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  return {
    visibilityConfig,
    isLoading,
    error,
    refetch: fetchVisibility,
  };
}

/**
 * Helper to check if a metric should be shown based on visibility config
 */
export function shouldShowMetric(
  config: VisibilityConfig,
  metric: keyof VisibilityConfig
): boolean {
  return config[metric] === true;
}

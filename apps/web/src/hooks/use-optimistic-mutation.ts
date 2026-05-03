/**
 * Optimistic Mutation Hook
 *
 * Provides optimistic updates with automatic rollback on error.
 * Resolves HIGH-STATE-001: Optimistic updates without rollback.
 * HIGH-STATE-03 FIX: Added version/timestamp conflict detection and resolution.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Versioned data interface for conflict detection.
 * Entities should include version or updatedAt for optimistic update safety.
 */
export interface VersionedData {
  version?: number;
  updatedAt?: string | Date;
}

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy = 'rollback' | 'server-wins' | 'client-wins' | 'merge';

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: unknown[];
  optimisticUpdate: (old: TData | undefined, variables: TVariables) => TData;
  onError?: (error: Error, variables: TVariables, context: { previous?: TData }) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
  /**
   * HIGH-STATE-03: Conflict resolution strategy when server response differs from optimistic update.
   * - 'rollback': Revert to server state (default, safest)
   * - 'server-wins': Accept server response
   * - 'client-wins': Keep optimistic state (risky, may lose server changes)
   * - 'merge': Use custom merge function
   */
  conflictStrategy?: ConflictStrategy;
  /**
   * HIGH-STATE-03: Custom merge function for 'merge' strategy.
   * Receives server data and optimistic data, returns merged result.
   */
  mergeConflict?: (serverData: TData, optimisticData: TData, variables: TVariables) => TData;
  /**
   * HIGH-STATE-03: Called when a conflict is detected.
   */
  onConflict?: (serverData: TData, optimisticData: TData | undefined, variables: TVariables) => void;
}

/**
 * HIGH-STATE-03: Helper to detect version conflicts between optimistic and server data.
 */
function hasVersionConflict<TData extends VersionedData>(
  serverData: TData,
  optimisticData: TData | undefined
): boolean {
  if (!optimisticData) return false;

  // Check version number conflict
  if (typeof serverData.version === 'number' && typeof optimisticData.version === 'number') {
    return serverData.version !== optimisticData.version;
  }

  // Check updatedAt timestamp conflict
  if (serverData.updatedAt && optimisticData.updatedAt) {
    const serverTime = new Date(serverData.updatedAt).getTime();
    const optimisticTime = new Date(optimisticData.updatedAt).getTime();
    return serverTime !== optimisticTime;
  }

  return false;
}

export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  onError,
  onSuccess,
  conflictStrategy = 'rollback',
  mergeConflict,
  onConflict,
}: OptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update the cache
      const optimistic = optimisticUpdate(previous, variables);
      queryClient.setQueryData<TData>(queryKey, optimistic);

      // HIGH-STATE-03: Store optimistic data for conflict detection
      return { previous, optimistic };
    },
    onError: (error, variables, context) => {
      // Rollback to previous state on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      onError?.(error as Error, variables, context ?? {});
    },
    onSuccess: (serverData, variables, context) => {
      // HIGH-STATE-03: Check for version conflicts
      const optimisticData = context?.optimistic as TData | undefined;
      const versionedServerData = serverData as TData & VersionedData;
      const versionedOptimisticData = optimisticData as (TData & VersionedData) | undefined;

      if (hasVersionConflict(versionedServerData, versionedOptimisticData)) {
        // Notify about conflict
        onConflict?.(serverData, optimisticData, variables);

        // Apply conflict resolution strategy
        switch (conflictStrategy) {
          case 'server-wins':
            // Server data will be applied via invalidateQueries in onSettled
            break;
          case 'client-wins':
            // Keep optimistic data (skip invalidation handled separately)
            if (optimisticData) {
              queryClient.setQueryData(queryKey, optimisticData);
            }
            break;
          case 'merge':
            if (mergeConflict && optimisticData) {
              const merged = mergeConflict(serverData, optimisticData, variables);
              queryClient.setQueryData(queryKey, merged);
            }
            break;
          case 'rollback':
          default:
            // Let onSettled handle the refetch for server state
            break;
        }
      }

      onSuccess?.(serverData, variables);
    },
    onSettled: (_data, _error, _variables, context) => {
      // HIGH-STATE-03: Skip invalidation for client-wins strategy to preserve optimistic state
      const strategy = conflictStrategy;
      if (strategy === 'client-wins' && context?.optimistic) {
        return;
      }
      // Refetch to ensure server-client consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

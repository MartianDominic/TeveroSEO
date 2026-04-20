/**
 * Optimistic update utilities for React Query mutations.
 * Provides instant UI feedback while mutations are in flight.
 */

import type { QueryClient } from "@tanstack/react-query";

interface OptimisticContext<T> {
  previousData: T | undefined;
}

/**
 * Create optimistic update handlers for a mutation.
 * Returns onMutate, onError, and onSettled handlers that:
 * - Snapshot previous data
 * - Apply optimistic update
 * - Rollback on error
 * - Refetch on settle
 */
export function createOptimisticUpdate<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updater: (oldData: TData, variables: TVariables) => TData
) {
  return {
    onMutate: async (
      variables: TVariables
    ): Promise<OptimisticContext<TData>> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<TData>(queryKey, (old) =>
          old ? updater(old, variables) : old
        );
      }

      return { previousData };
    },
    onError: (
      _error: Error,
      _variables: TVariables,
      context?: OptimisticContext<TData>
    ) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Goal type for optimistic updates.
 */
export interface ClientGoal {
  id: string;
  clientId: string;
  templateId: string | null;
  metricType: string;
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  status: "not_started" | "on_track" | "at_risk" | "achieved" | "missed";
  notes: string | null;
}

/**
 * Update variables for goal mutations.
 */
export interface UpdateGoalVariables {
  goalId: string;
  updates: Partial<ClientGoal>;
}

/**
 * Delete variables for goal mutations.
 */
export interface DeleteGoalVariables {
  goalId: string;
}

/**
 * Client data structure with goals for optimistic updates.
 */
export interface ClientWithGoals {
  goals: ClientGoal[];
  [key: string]: unknown;
}

/**
 * Create an optimistic updater for updating a goal within client data.
 */
export function createGoalUpdateOptimistic(
  queryClient: QueryClient,
  queryKey: unknown[]
) {
  return createOptimisticUpdate<ClientWithGoals, UpdateGoalVariables>(
    queryClient,
    queryKey,
    (oldData, variables) => ({
      ...oldData,
      goals: oldData.goals.map((g) =>
        g.id === variables.goalId ? { ...g, ...variables.updates } : g
      ),
    })
  );
}

/**
 * Create an optimistic updater for deleting a goal from client data.
 */
export function createGoalDeleteOptimistic(
  queryClient: QueryClient,
  queryKey: unknown[]
) {
  return createOptimisticUpdate<ClientWithGoals, DeleteGoalVariables>(
    queryClient,
    queryKey,
    (oldData, variables) => ({
      ...oldData,
      goals: oldData.goals.filter((g) => g.id !== variables.goalId),
    })
  );
}

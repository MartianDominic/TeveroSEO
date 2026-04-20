/**
 * Goal mutation hooks with optimistic updates.
 * Provides instant UI feedback for goal CRUD operations.
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createGoalUpdateOptimistic,
  createGoalDeleteOptimistic,
  type UpdateGoalVariables,
  type DeleteGoalVariables,
} from "@/lib/optimistic";
import { cacheInvalidateByTag, cacheTags } from "@/lib/cache";

/**
 * Server action types (to be implemented in goals actions).
 */
interface UpdateGoalInput {
  goalId: string;
  updates: Record<string, unknown>;
}

interface DeleteGoalInput {
  goalId: string;
}

/**
 * Placeholder server actions - wire these to actual implementations.
 */
async function updateGoalAction(input: UpdateGoalInput): Promise<void> {
  const response = await fetch("/api/goals/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to update goal");
  }
}

async function deleteGoalAction(input: DeleteGoalInput): Promise<void> {
  const response = await fetch("/api/goals/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to delete goal");
  }
}

/**
 * Hook for updating a goal with optimistic updates.
 *
 * @param clientId - The client ID for cache invalidation
 * @returns Mutation object with mutate/mutateAsync functions
 */
export function useUpdateGoal(clientId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["clients", "goals", clientId];

  return useMutation({
    mutationFn: (variables: UpdateGoalVariables) =>
      updateGoalAction({
        goalId: variables.goalId,
        updates: variables.updates,
      }),
    ...createGoalUpdateOptimistic(queryClient, queryKey),
    onSuccess: async () => {
      // Invalidate related Redis caches
      await cacheInvalidateByTag(cacheTags.client(clientId));
    },
  });
}

/**
 * Hook for deleting a goal with optimistic updates.
 *
 * @param clientId - The client ID for cache invalidation
 * @returns Mutation object with mutate/mutateAsync functions
 */
export function useDeleteGoal(clientId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["clients", "goals", clientId];

  return useMutation({
    mutationFn: (variables: DeleteGoalVariables) =>
      deleteGoalAction({ goalId: variables.goalId }),
    ...createGoalDeleteOptimistic(queryClient, queryKey),
    onSuccess: async () => {
      // Invalidate related Redis caches
      await cacheInvalidateByTag(cacheTags.client(clientId));
    },
  });
}

/**
 * Combined hook for all goal mutations.
 *
 * @param clientId - The client ID for cache invalidation
 * @returns Object with updateGoal and deleteGoal mutation objects
 */
export function useGoalMutations(clientId: string) {
  const updateGoal = useUpdateGoal(clientId);
  const deleteGoal = useDeleteGoal(clientId);

  return {
    updateGoal,
    deleteGoal,
  };
}

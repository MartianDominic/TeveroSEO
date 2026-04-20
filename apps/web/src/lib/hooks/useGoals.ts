/**
 * React Query hooks for goal management.
 * Phase 22: Goal-Based Metrics System
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGoalTemplates,
  getClientGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  bulkCreateGoals,
  type GoalTemplate,
  type GoalWithTemplate,
  type CreateGoalInput,
  type UpdateGoalInput,
} from "@/lib/api/goals";

/**
 * Query key factory for goals.
 */
export const goalKeys = {
  all: ["goals"] as const,
  templates: () => [...goalKeys.all, "templates"] as const,
  clientGoals: (clientId: string) =>
    [...goalKeys.all, "client", clientId] as const,
  goal: (clientId: string, goalId: string) =>
    [...goalKeys.all, "client", clientId, goalId] as const,
};

/**
 * Fetch all goal templates.
 * Templates rarely change, so use long stale time.
 */
export function useGoalTemplates() {
  return useQuery<GoalTemplate[]>({
    queryKey: goalKeys.templates(),
    queryFn: getGoalTemplates,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Fetch all goals for a client.
 */
export function useClientGoals(clientId: string) {
  return useQuery<GoalWithTemplate[]>({
    queryKey: goalKeys.clientGoals(clientId),
    queryFn: () => getClientGoals(clientId),
    enabled: !!clientId,
  });
}

/**
 * Create a new goal.
 */
export function useCreateGoal(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(clientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.clientGoals(clientId) });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

/**
 * Update an existing goal.
 */
export function useUpdateGoal(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ goalId, updates }: { goalId: string; updates: UpdateGoalInput }) =>
      updateGoal(clientId, goalId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.clientGoals(clientId) });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

/**
 * Delete a goal.
 */
export function useDeleteGoal(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goalId: string) => deleteGoal(clientId, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.clientGoals(clientId) });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

/**
 * Bulk create goals.
 */
export function useBulkCreateGoals(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      goals,
    }: {
      workspaceId: string;
      goals: Omit<CreateGoalInput, "workspaceId">[];
    }) => bulkCreateGoals(clientId, workspaceId, goals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.clientGoals(clientId) });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

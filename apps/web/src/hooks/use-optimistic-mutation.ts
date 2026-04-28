/**
 * Optimistic Mutation Hook
 *
 * Provides optimistic updates with automatic rollback on error.
 * Resolves HIGH-STATE-001: Optimistic updates without rollback.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: unknown[];
  optimisticUpdate: (old: TData | undefined, variables: TVariables) => TData;
  onError?: (error: Error, variables: TVariables, context: { previous?: TData }) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
}

export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  onError,
  onSuccess,
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
      queryClient.setQueryData<TData>(queryKey, (old) =>
        optimisticUpdate(old, variables)
      );

      return { previous };
    },
    onError: (error, variables, context) => {
      // Rollback to previous state on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      onError?.(error as Error, variables, context ?? {});
    },
    onSuccess: (data, variables) => {
      onSuccess?.(data, variables);
    },
    onSettled: () => {
      // Refetch to ensure server-client consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

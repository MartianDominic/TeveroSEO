import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSavedViewsWithConfig,
  createSavedViewWithConfig,
  updateSavedViewWithConfig,
  deleteSavedViewById,
  setDefaultViewById,
} from "@/actions/views/saved-views";
import type {
  SavedView,
  CreateSavedViewInput,
  UpdateSavedViewInput,
} from "@/types/saved-views";

interface UseSavedViewsOptions {
  workspaceId: string;
  enabled?: boolean;
}

/**
 * Hook for managing saved views with column customization.
 * Uses React Query for fetching and mutating views.
 */
export function useSavedViews({ workspaceId, enabled = true }: UseSavedViewsOptions) {
  const queryClient = useQueryClient();
  const queryKey = ["saved-views", workspaceId];

  // Fetch all views for the workspace
  const {
    data: views = [],
    isLoading,
    error,
    refetch,
  } = useQuery<SavedView[]>({
    queryKey,
    queryFn: () => getSavedViewsWithConfig(workspaceId),
    enabled: enabled && Boolean(workspaceId),
  });

  // Create a new view
  const createMutation = useMutation({
    mutationFn: (input: CreateSavedViewInput) =>
      createSavedViewWithConfig(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Update an existing view
  const updateMutation = useMutation({
    mutationFn: ({ viewId, input }: { viewId: string; input: UpdateSavedViewInput }) =>
      updateSavedViewWithConfig(viewId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete a view
  const deleteMutation = useMutation({
    mutationFn: (viewId: string) => deleteSavedViewById(viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Set a view as default
  const setDefaultMutation = useMutation({
    mutationFn: (viewId: string) => setDefaultViewById(viewId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Get the current default view
  const defaultView = views.find((v) => v.isDefault);

  return {
    views,
    defaultView,
    isLoading,
    error,
    refetch,

    // Create
    createView: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    // Update
    updateView: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,

    // Delete
    deleteView: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,

    // Set Default
    setDefault: setDefaultMutation.mutateAsync,
    isSettingDefault: setDefaultMutation.isPending,
    setDefaultError: setDefaultMutation.error,
  };
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { getFastApi } from "@/lib/server-fetch";
import type {
  SavedView,
  ViewConfig,
  CreateSavedViewInput,
  UpdateSavedViewInput,
} from "@/types/saved-views";

/**
 * API response type for saved views from backend.
 */
interface SavedViewApiResponse {
  id: string;
  name: string;
  description?: string;
  columns: string;       // JSON string
  filters: string;       // JSON string
  sortBy?: string;
  sortDir?: string;
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
  userId: string;
}

/**
 * Transform API response to SavedView type.
 */
function transformView(raw: SavedViewApiResponse): SavedView {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    config: {
      columns: JSON.parse(raw.columns) as string[],
      filters: JSON.parse(raw.filters),
      sortBy: raw.sortBy,
      sortDir: raw.sortDir as "asc" | "desc" | undefined,
    },
    isShared: raw.isShared,
    isDefault: raw.isDefault,
    createdAt: new Date(raw.createdAt),
    userId: raw.userId,
  };
}

/**
 * Get all saved views for a workspace (user's own + shared views).
 */
export async function getSavedViewsWithConfig(workspaceId: string): Promise<SavedView[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const response = await getFastApi<SavedViewApiResponse[]>(
      `/api/dashboard/views?workspaceId=${workspaceId}`
    );
    return response.map(transformView);
  } catch (error) {
    // Return empty array on error for graceful degradation
    return [];
  }
}

/**
 * Create a new saved view with column configuration.
 */
export async function createSavedViewWithConfig(
  workspaceId: string,
  input: CreateSavedViewInput
): Promise<SavedView> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const body = {
    name: input.name,
    description: input.description,
    columns: JSON.stringify(input.config.columns),
    filters: JSON.stringify(input.config.filters),
    sortBy: input.config.sortBy,
    sortDir: input.config.sortDir,
    isShared: input.isShared ?? false,
    workspaceId,
  };

  const response = await getFastApi<SavedViewApiResponse>("/api/dashboard/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return transformView(response);
}

/**
 * Update an existing saved view.
 */
export async function updateSavedViewWithConfig(
  viewId: string,
  input: UpdateSavedViewInput
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const body: Record<string, unknown> = {};

  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.isShared !== undefined) body.isShared = input.isShared;
  if (input.config) {
    body.columns = JSON.stringify(input.config.columns);
    body.filters = JSON.stringify(input.config.filters);
    body.sortBy = input.config.sortBy;
    body.sortDir = input.config.sortDir;
  }

  await getFastApi(`/api/dashboard/views/${viewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Delete a saved view.
 */
export async function deleteSavedViewById(viewId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await getFastApi(`/api/dashboard/views/${viewId}`, {
    method: "DELETE",
  });
}

/**
 * Set a view as the default for the user in the workspace.
 */
export async function setDefaultViewById(viewId: string, workspaceId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await getFastApi(`/api/dashboard/views/${viewId}/default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });
}

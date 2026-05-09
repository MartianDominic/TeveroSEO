"use server";

import { z } from "zod";

import { requireActionAuth, validateWorkspaceMembership } from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";
import { getFastApi, postFastApi, patchFastApi, deleteFastApi } from "@/lib/server-fetch";
import type {
  SavedView,
  ViewConfig,
  CreateSavedViewInput,
  UpdateSavedViewInput,
} from "@/types/saved-views";

// Resource limits to prevent abuse
const MAX_SAVED_VIEWS_PER_USER = 50;

// Validation schemas
const workspaceIdSchema = z.string().uuid("Invalid workspace ID");
const viewIdSchema = z.string().uuid("Invalid view ID");

const viewConfigSchema = z.object({
  columns: z.array(z.string().min(1).max(100)).max(50),
  filters: z.record(z.string(), z.unknown()).optional(),
  sortBy: z.string().max(100).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const createViewInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500).optional(),
  config: viewConfigSchema,
  isShared: z.boolean().optional(),
});

const updateViewInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: viewConfigSchema.optional(),
  isShared: z.boolean().optional(),
});

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
 * Schema for validating parsed JSON columns.
 */
const columnsJsonSchema = z.array(z.string());

/**
 * Schema for validating parsed JSON filters.
 */
const filtersJsonSchema = z.record(z.string(), z.unknown());

/**
 * Safely parse JSON column with schema validation.
 * Returns fallback value on parse or validation error.
 */
function parseJsonColumn<T>(
  raw: string | null | undefined,
  schema: z.ZodType<T>,
  fallback: T
): T {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    logger.warn('[SavedViews] Invalid JSON structure', { detail: result.error });
    return fallback;
  } catch (err) {
    logger.warn('[SavedViews] JSON parse error', { value: err });
    return fallback;
  }
}

/**
 * Schema for validating sortDir values.
 */
const sortDirSchema = z.enum(["asc", "desc"]).optional();

/**
 * Transform API response to SavedView type.
 */
function transformView(raw: SavedViewApiResponse): SavedView {
  // Use Zod validation instead of unsafe type assertion for sortDir
  const sortDirResult = sortDirSchema.safeParse(raw.sortDir?.toLowerCase());
  const validatedSortDir = sortDirResult.success ? sortDirResult.data : undefined;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    config: {
      columns: parseJsonColumn(raw.columns, columnsJsonSchema, []),
      filters: parseJsonColumn(raw.filters, filtersJsonSchema, {}),
      sortBy: raw.sortBy,
      sortDir: validatedSortDir,
    },
    isShared: raw.isShared,
    isDefault: raw.isDefault,
    createdAt: raw.createdAt,
    userId: raw.userId,
  };
}

/**
 * Get a single saved view by ID.
 * SECURITY: Only returns views the user owns OR shared views they can access.
 * Prevents IDOR by checking ownership/sharing permissions.
 */
export async function getSavedView(viewId: string): Promise<SavedView | null> {
  // Validate viewId format
  const validatedViewId = viewIdSchema.parse(viewId);

  const auth = await requireActionAuth();

  try {
    const response = await getFastApi<SavedViewApiResponse & { workspaceId?: string }>(
      `/api/dashboard/views/${validatedViewId}`
    );

    // SECURITY: Only allow access if user owns the view OR if it's shared
    if (response.userId !== auth.userId && !response.isShared) {
      throw new Error("View not found");
    }

    // If it's a shared view, also validate workspace membership
    if (response.isShared && response.workspaceId) {
      await validateWorkspaceMembership(response.workspaceId, auth);
    }

    return transformView(response);
  } catch (error) {
    logger.error("[getSavedView] Failed to fetch saved view", error instanceof Error ? error : { error: String(error) });
    return null;
  }
}

/**
 * Get all saved views for a workspace (user's own + shared views).
 * Validates workspace membership before fetching.
 */
export async function getSavedViewsWithConfig(workspaceId: string): Promise<SavedView[]> {
  // Validate workspaceId format
  const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);

  const auth = await requireActionAuth();

  // Validate workspace membership before accessing workspace views
  await validateWorkspaceMembership(validatedWorkspaceId, auth);

  try {
    const response = await getFastApi<SavedViewApiResponse[]>(
      `/api/dashboard/views?workspaceId=${validatedWorkspaceId}`
    );
    return response.map(transformView);
  } catch (error) {
    logger.error("[getSavedViewsWithConfig] Failed to fetch saved views", error instanceof Error ? error : { error: String(error) });
    // Return empty array on error for graceful degradation
    return [];
  }
}

/**
 * Create a new saved view with column configuration.
 * Validates workspace membership before creating.
 * Rate limited: 60 operations per hour.
 *
 * RESOURCE LIMIT: Users are limited to MAX_SAVED_VIEWS_PER_USER views per workspace.
 */
export async function createSavedViewWithConfig(
  workspaceId: string,
  input: CreateSavedViewInput
): Promise<SavedView> {
  // Validate inputs
  const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);
  const validatedInput = createViewInputSchema.parse(input);

  const auth = await requireActionAuth();

  // Rate limit: prevent spam creation
  await checkActionRateLimit("savedViews", auth.userId);

  // Validate workspace membership before creating view
  await validateWorkspaceMembership(validatedWorkspaceId, auth);

  // RESOURCE LIMIT FIX: Check user's current view count before allowing creation
  const existingViews = await getFastApi<SavedViewApiResponse[]>(
    `/api/dashboard/views?workspaceId=${validatedWorkspaceId}`
  );
  const userViewCount = existingViews.filter(v => v.userId === auth.userId).length;
  if (userViewCount >= MAX_SAVED_VIEWS_PER_USER) {
    throw new Error(
      `View limit reached. Maximum ${MAX_SAVED_VIEWS_PER_USER} saved views allowed per user per workspace.`
    );
  }

  const body = {
    name: validatedInput.name,
    description: validatedInput.description,
    columns: JSON.stringify(validatedInput.config.columns),
    filters: JSON.stringify(validatedInput.config.filters),
    sortBy: validatedInput.config.sortBy,
    sortDir: validatedInput.config.sortDir,
    isShared: validatedInput.isShared ?? false,
    workspaceId: validatedWorkspaceId,
  };

  const response = await postFastApi<SavedViewApiResponse>("/api/dashboard/views", body);

  return transformView(response);
}

/**
 * Update an existing saved view.
 * Validates that the current user owns the view before updating.
 * Rate limited: 60 operations per hour.
 */
export async function updateSavedViewWithConfig(
  viewId: string,
  input: UpdateSavedViewInput
): Promise<void> {
  // Validate inputs
  const validatedViewId = viewIdSchema.parse(viewId);
  const validatedInput = updateViewInputSchema.parse(input);

  const auth = await requireActionAuth();

  // Rate limit: prevent spam updates
  await checkActionRateLimit("savedViews", auth.userId);

  // Fetch view to verify ownership - only view owner can update
  const view = await getFastApi<SavedViewApiResponse & { workspaceId?: string }>(
    `/api/dashboard/views/${validatedViewId}`
  );
  if (view.userId !== auth.userId) {
    throw new Error("Access denied: You do not own this view");
  }

  const body: Record<string, unknown> = {};

  if (validatedInput.name !== undefined) body.name = validatedInput.name;
  if (validatedInput.description !== undefined) body.description = validatedInput.description;
  if (validatedInput.isShared !== undefined) body.isShared = validatedInput.isShared;
  if (validatedInput.config) {
    body.columns = JSON.stringify(validatedInput.config.columns);
    body.filters = JSON.stringify(validatedInput.config.filters);
    body.sortBy = validatedInput.config.sortBy;
    body.sortDir = validatedInput.config.sortDir;
  }

  await patchFastApi(`/api/dashboard/views/${validatedViewId}`, body);
}

/**
 * Delete a saved view.
 * Validates that the current user owns the view before deleting.
 * Rate limited: 60 operations per hour.
 */
export async function deleteSavedViewById(viewId: string): Promise<void> {
  // Validate viewId format
  const validatedViewId = viewIdSchema.parse(viewId);

  const auth = await requireActionAuth();

  // Rate limit: prevent spam deletions
  await checkActionRateLimit("savedViews", auth.userId);

  // Fetch view to verify ownership - only view owner can delete
  const view = await getFastApi<SavedViewApiResponse>(
    `/api/dashboard/views/${validatedViewId}`
  );
  if (view.userId !== auth.userId) {
    throw new Error("Access denied: You do not own this view");
  }

  await deleteFastApi(`/api/dashboard/views/${validatedViewId}`);
}

/**
 * Set a view as the default for the user in the workspace.
 * Validates workspace membership before setting default.
 */
export async function setDefaultViewById(viewId: string, workspaceId: string): Promise<void> {
  // Validate inputs
  const validatedViewId = viewIdSchema.parse(viewId);
  const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);

  const auth = await requireActionAuth();

  // Validate workspace membership before setting default view
  await validateWorkspaceMembership(validatedWorkspaceId, auth);

  await postFastApi(`/api/dashboard/views/${validatedViewId}/default`, {
    workspaceId: validatedWorkspaceId,
  });
}

"use server";

import { z } from "zod";
import { requireActionAuth, validateWorkspaceMembership } from "@/lib/auth/action-auth";
import { getFastApi } from "@/lib/server-fetch";
import type { CursorPaginationParams, CursorPaginationResult, FilterParams } from "@/types/pagination";
import { encodeCursor } from "@/types/pagination";
import type { ClientMetrics } from "@/lib/dashboard/types";
import { cacheGet, cacheSet, cacheKeys, cacheTags, getCachedWithSingleflight } from "@/lib/cache";
import { hashParams } from "@/lib/cache/with-cache";

// Validation schema for pagination input
const paginationInputSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),  // Required for IDOR prevention
  cursor: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  sortBy: z.string().max(50).default("priorityScore"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().max(200).optional(),
  status: z.array(z.string().max(50)).optional(),
  goalAttainmentMin: z.number().min(0).max(100).optional(),
  goalAttainmentMax: z.number().min(0).max(100).optional(),
  hasAlerts: z.boolean().optional(),
  alertSeverity: z.array(z.enum(["critical", "warning", "info"])).optional(),
  ownerId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).optional(),
}).strict();

interface GetClientsPaginatedInput extends CursorPaginationParams, FilterParams {
  workspaceId: string;  // Required for IDOR prevention
}

/**
 * Fetch paginated clients with server-side filtering and sorting.
 * Uses cursor-based pagination for efficient large dataset handling.
 * Results are cached for 60 seconds with workspace tag for invalidation.
 *
 * SECURITY: workspaceId is REQUIRED to prevent IDOR - users can only
 * access clients within workspaces they are members of.
 */
export async function getClientsPaginated(
  input: GetClientsPaginatedInput
): Promise<CursorPaginationResult<ClientMetrics>> {
  // Validate input schema
  const validatedInput = paginationInputSchema.parse(input);

  const auth = await requireActionAuth();

  // SECURITY: workspaceId is required to prevent IDOR across workspaces
  // Users can only access clients within workspaces they are members of
  if (!validatedInput.workspaceId) {
    throw new Error("Workspace ID is required");
  }

  // Validate workspace membership - prevents IDOR
  await validateWorkspaceMembership(validatedInput.workspaceId, auth);

  const {
    cursor,
    limit,
    sortBy,
    sortDir,
    search,
    status,
    goalAttainmentMin,
    goalAttainmentMax,
    hasAlerts,
    alertSeverity,
    ownerId,
    tags,
    workspaceId,
  } = validatedInput;

  // Generate cache key from query params
  const queryParams = { cursor, limit, sortBy, sortDir, search, status, goalAttainmentMin, goalAttainmentMax, hasAlerts, alertSeverity, ownerId, tags };
  const paramsHash = hashParams(queryParams);
  const cacheKey = cacheKeys.clientsPaginated(workspaceId ?? "default", paramsHash);

  // Build query params
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);
  if (search) params.set("search", search);
  if (status?.length) params.set("status", status.join(","));
  if (goalAttainmentMin !== undefined) params.set("goalAttainmentMin", String(goalAttainmentMin));
  if (goalAttainmentMax !== undefined) params.set("goalAttainmentMax", String(goalAttainmentMax));
  if (hasAlerts !== undefined) params.set("hasAlerts", String(hasAlerts));
  if (alertSeverity?.length) params.set("alertSeverity", alertSeverity.join(","));
  if (ownerId) params.set("ownerId", ownerId);
  if (tags?.length) params.set("tags", tags.join(","));

  try {
    // Use singleflight to prevent cache stampede:
    // Multiple concurrent requests with same params share a single backend fetch
    return await getCachedWithSingleflight<CursorPaginationResult<ClientMetrics>>(
      cacheKey,
      60, // 60 second TTL
      async () => {
        // Call backend API with pagination params
        const response = await getFastApi<{
          data: ClientMetrics[];
          hasMore: boolean;
          totalCount: number;
        }>(`/api/dashboard/metrics/paginated?${params.toString()}`);

        const { data, hasMore, totalCount } = response;

        // Generate cursors from response data
        const lastRow = data[data.length - 1];
        const firstRow = data[0];

        const getSortValue = (row: ClientMetrics): string | number => {
          const sortKeyMap: Record<string, keyof ClientMetrics> = {
            priorityScore: "priorityScore",
            goalAttainmentPct: "goalAttainmentPct",
            trafficCurrent: "trafficCurrent",
            keywordsTop10: "keywordsTop10",
            alertsOpen: "alertsOpen",
            healthScore: "healthScore",
          };
          const key = sortKeyMap[sortBy] ?? "priorityScore";
          return (row[key] as string | number) ?? 0;
        };

        const result: CursorPaginationResult<ClientMetrics> = {
          data,
          nextCursor: hasMore && lastRow
            ? encodeCursor(lastRow.clientId, getSortValue(lastRow))
            : null,
          prevCursor: cursor && firstRow
            ? encodeCursor(firstRow.clientId, getSortValue(firstRow))
            : null,
          hasMore,
          totalCount,
        };

        return result;
      },
      cacheGet,
      cacheSet,
      workspaceId ? [cacheTags.workspace(workspaceId)] : []
    );
  } catch (error) {
    console.error("[getClientsPaginated] Failed:", error);
    // Return empty result on error for graceful degradation
    // Include error field so callers can detect and display failures
    return {
      data: [],
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      totalCount: 0,
      error: "Failed to load clients. Please try again.",
    };
  }
}

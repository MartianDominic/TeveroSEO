"use server";

import { getFastApi } from "@/lib/server-fetch";
import type { CursorPaginationParams, CursorPaginationResult, FilterParams } from "@/types/pagination";
import { encodeCursor } from "@/types/pagination";
import type { ClientMetrics } from "@/lib/dashboard/types";

interface GetClientsPaginatedInput extends CursorPaginationParams, FilterParams {
  workspaceId?: string;
}

/**
 * Fetch paginated clients with server-side filtering and sorting.
 * Uses cursor-based pagination for efficient large dataset handling.
 */
export async function getClientsPaginated(
  input: GetClientsPaginatedInput
): Promise<CursorPaginationResult<ClientMetrics>> {
  const {
    cursor,
    limit = 50,
    sortBy = "priorityScore",
    sortDir = "desc",
    search,
    status,
    goalAttainmentMin,
    goalAttainmentMax,
    hasAlerts,
    alertSeverity,
    ownerId,
    tags,
  } = input;

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

    return {
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
  } catch (error) {
    // Return empty result on error for graceful degradation
    return {
      data: [],
      nextCursor: null,
      prevCursor: null,
      hasMore: false,
      totalCount: 0,
    };
  }
}

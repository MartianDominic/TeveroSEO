"use server";

import { z } from "zod";
import { getFastApi } from "@/lib/server-fetch";
import { requireActionAuth } from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet, cacheTags, getCachedWithSingleflight } from "@/lib/cache";
import type {
  ClientMetrics,
  PortfolioSummary,
  AttentionItem,
  WinItem,
  SavedView,
  TeamMember,
  ScheduledItem,
  ClientTableFilters
} from "@/lib/dashboard/types";

// =============================================================================
// Input Validation Schemas
// =============================================================================

/**
 * UUID validation schema.
 * Validates standard UUID v4 format to prevent injection attacks.
 */
const uuidSchema = z.string().uuid("Invalid ID format");

/**
 * Dismiss action schema.
 */
const dismissActionSchema = z.enum(["snooze", "dismiss"]);

/**
 * Card order schema with length limit to prevent DoS.
 * Max 100 cards is generous for any reasonable dashboard layout.
 */
const cardOrderSchema = z.array(z.string().max(100)).max(100, "Card order exceeds maximum of 100 items");

/**
 * Connection status enum for filters.
 */
const connectionStatusSchema = z.enum(["connected", "stale", "disconnected"]);

/**
 * Client table filters schema with depth limits.
 * Validates all filter fields with reasonable constraints.
 */
const clientTableFiltersSchema = z.object({
  search: z.string().max(200, "Search query too long").default(""),
  healthRange: z.tuple([
    z.number().int().min(0).max(100),
    z.number().int().min(0).max(100)
  ]).default([0, 100]),
  connectionStatus: z.array(connectionStatusSchema).max(3).default([]),
  tags: z.array(z.string().max(50)).max(50, "Too many tags").default([]),
  hasAlerts: z.boolean().nullable().default(null),
});

/**
 * Saved view name schema.
 */
const viewNameSchema = z.string()
  .min(1, "View name is required")
  .max(100, "View name too long")
  .regex(/^[a-zA-Z0-9\s\-_]+$/, "View name contains invalid characters");

/**
 * Default empty summary for graceful degradation.
 */
const defaultSummary: PortfolioSummary = {
  totalClients: 0,
  clientsNeedingAttention: 0,
  winsThisWeek: 0,
  totalClicks30d: 0,
  totalImpressions30d: 0,
  avgTrafficChange: 0,
  keywordsTotal: 0,
  keywordsTop10: 0,
  keywordsTop3: 0,
  keywordsPosition1: 0,
  avgGoalAttainment: 0,
  avgGoalAttainmentTrend: 0,
  clientsOnTrack: 0,
  clientsWatching: 0,
  clientsCritical: 0,
  goalsMet: 0,
  goalsTotal: 0,
};

/**
 * Fetch all client metrics from pre-computed table.
 * PERF FIX (MEDIUM-02): Uses singleflight to deduplicate concurrent requests.
 */
export async function getDashboardMetrics(): Promise<ClientMetrics[]> {
  await requireActionAuth();
  try {
    // PERF FIX: Use singleflight to deduplicate parallel calls
    return await getCachedWithSingleflight<ClientMetrics[]>(
      "dashboard:metrics",
      60, // 60 second cache
      async () => getFastApi<ClientMetrics[]>("/api/dashboard/metrics"),
      cacheGet,
      cacheSet,
      []
    );
  } catch (error) {
    logger.error("[getDashboardMetrics] Failed to fetch metrics", error instanceof Error ? error : { error: String(error) });
    return [];
  }
}

/**
 * Fetch portfolio-wide summary statistics.
 * PERF FIX (MEDIUM-02): Uses singleflight to deduplicate concurrent requests.
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  await requireActionAuth();
  try {
    // PERF FIX: Use singleflight to deduplicate parallel calls
    return await getCachedWithSingleflight<PortfolioSummary>(
      "dashboard:summary",
      60, // 60 second cache
      async () => getFastApi<PortfolioSummary>("/api/dashboard/summary"),
      cacheGet,
      cacheSet,
      []
    );
  } catch (error) {
    logger.error("[getPortfolioSummary] Failed to fetch summary", error instanceof Error ? error : { error: String(error) });
    return defaultSummary;
  }
}

/**
 * Fetch items needing attention (alerts, low health, connection issues).
 * PERF FIX (MEDIUM-02): Uses singleflight to deduplicate concurrent requests.
 */
export async function getAttentionItems(): Promise<AttentionItem[]> {
  await requireActionAuth();
  try {
    // PERF FIX: Use singleflight to deduplicate parallel calls
    return await getCachedWithSingleflight<AttentionItem[]>(
      "dashboard:attention",
      60, // 60 second cache
      async () => getFastApi<AttentionItem[]>("/api/dashboard/attention"),
      cacheGet,
      cacheSet,
      []
    );
  } catch (error) {
    logger.error("[getAttentionItems] Failed to fetch attention items", error instanceof Error ? error : { error: String(error) });
    return [];
  }
}

/**
 * Fetch recent wins and milestones.
 * PERF FIX (MEDIUM-02): Uses singleflight to deduplicate concurrent requests.
 */
export async function getWins(): Promise<WinItem[]> {
  await requireActionAuth();
  try {
    // PERF FIX: Use singleflight to deduplicate parallel calls
    return await getCachedWithSingleflight<WinItem[]>(
      "dashboard:wins",
      60, // 60 second cache
      async () => getFastApi<WinItem[]>("/api/dashboard/wins"),
      cacheGet,
      cacheSet,
      []
    );
  } catch (error) {
    logger.error("[getWins] Failed to fetch wins", error instanceof Error ? error : { error: String(error) });
    return [];
  }
}

/**
 * Dismiss an attention item (snooze or acknowledge).
 *
 * Security: Validates itemId as UUID before API call.
 * The backend API validates ownership via the auth token.
 */
export async function dismissAttentionItem(itemId: string, action: "snooze" | "dismiss"): Promise<void> {
  await requireActionAuth();

  // Validate inputs
  const validatedItemId = uuidSchema.parse(itemId);
  const validatedAction = dismissActionSchema.parse(action);

  // POST to alerts API to update status
  await getFastApi(`/api/alerts/${validatedItemId}/${validatedAction}`, {
    method: "POST",
  });
}

/**
 * Save card layout to user preferences.
 *
 * Security: Validates cardOrder array with max length of 100 to prevent DoS.
 */
export async function saveCardLayout(cardOrder: string[]): Promise<void> {
  await requireActionAuth();

  // Validate cardOrder array
  const validatedCardOrder = cardOrderSchema.parse(cardOrder);

  try {
    await getFastApi("/api/dashboard/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardOrder: validatedCardOrder }),
    });
  } catch (error) {
    logger.error("Failed to save card layout", error instanceof Error ? error : { error: String(error) });
    throw error;
  }
}

/**
 * Get saved card layout for current user.
 */
export async function getCardLayout(): Promise<string[] | null> {
  await requireActionAuth();
  try {
    const result = await getFastApi<{ cardOrder: string[] | null }>("/api/dashboard/layout");
    return result.cardOrder;
  } catch (error) {
    logger.error("[getCardLayout] Failed to fetch card layout", error instanceof Error ? error : { error: String(error) });
    return null;
  }
}

/**
 * Get all saved views for current user/workspace.
 */
export async function getSavedViews(): Promise<SavedView[]> {
  await requireActionAuth();
  try {
    return await getFastApi<SavedView[]>("/api/dashboard/views");
  } catch (error) {
    logger.error("[getSavedViews] Failed to fetch saved views", error instanceof Error ? error : { error: String(error) });
    // Return default views on error
    return [
      {
        id: "default-all",
        name: "All Clients",
        filters: { search: "", healthRange: [0, 100], connectionStatus: [], tags: [], hasAlerts: null },
        isDefault: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "default-attention",
        name: "Needs Attention",
        filters: { search: "", healthRange: [0, 60], connectionStatus: [], tags: [], hasAlerts: true },
        isDefault: false,
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

/**
 * Create a new saved view.
 *
 * Security: Validates name, filters schema, and optional cardLayout.
 */
export async function createSavedView(
  name: string,
  filters: ClientTableFilters,
  cardLayout?: string[]
): Promise<SavedView> {
  await requireActionAuth();

  // Validate all inputs
  const validatedName = viewNameSchema.parse(name);
  const validatedFilters = clientTableFiltersSchema.parse(filters);
  const validatedCardLayout = cardLayout ? cardOrderSchema.parse(cardLayout) : undefined;

  return await getFastApi<SavedView>("/api/dashboard/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: validatedName,
      filters: validatedFilters,
      cardLayout: validatedCardLayout,
    }),
  });
}

/**
 * Delete a saved view.
 *
 * Security: Validates viewId as UUID before API call.
 * The backend API validates ownership via the auth token.
 */
export async function deleteSavedView(viewId: string): Promise<void> {
  await requireActionAuth();

  // Validate viewId as UUID
  const validatedViewId = uuidSchema.parse(viewId);

  await getFastApi(`/api/dashboard/views/${validatedViewId}`, {
    method: "DELETE",
  });
}

/**
 * Set a view as default.
 *
 * Security: Validates viewId as UUID before API call.
 * The backend API validates ownership via the auth token.
 */
export async function setDefaultView(viewId: string): Promise<void> {
  await requireActionAuth();

  // Validate viewId as UUID
  const validatedViewId = uuidSchema.parse(viewId);

  await getFastApi(`/api/dashboard/views/${validatedViewId}/default`, {
    method: "POST",
  });
}

/**
 * Get team workload data.
 * PERF FIX (MEDIUM-02): Uses singleflight to deduplicate concurrent requests.
 */
export async function getTeamWorkload(): Promise<TeamMember[]> {
  await requireActionAuth();
  try {
    // PERF FIX: Use singleflight to deduplicate parallel calls
    return await getCachedWithSingleflight<TeamMember[]>(
      "dashboard:team-workload",
      60, // 60 second cache
      async () => getFastApi<TeamMember[]>("/api/dashboard/team-workload"),
      cacheGet,
      cacheSet,
      []
    );
  } catch (error) {
    logger.error("[getTeamWorkload] Failed to fetch team workload", error instanceof Error ? error : { error: String(error) });
    return [];
  }
}

/**
 * Get upcoming scheduled items (reports, audits).
 * PERF FIX (MEDIUM-02): Uses singleflight to deduplicate concurrent requests.
 */
export async function getUpcomingScheduled(): Promise<ScheduledItem[]> {
  await requireActionAuth();
  try {
    // PERF FIX: Use singleflight to deduplicate parallel calls
    return await getCachedWithSingleflight<ScheduledItem[]>(
      "dashboard:upcoming",
      60, // 60 second cache
      async () => getFastApi<ScheduledItem[]>("/api/dashboard/upcoming"),
      cacheGet,
      cacheSet,
      []
    );
  } catch (error) {
    logger.error("[getUpcomingScheduled] Failed to fetch upcoming items", error instanceof Error ? error : { error: String(error) });
    return [];
  }
}

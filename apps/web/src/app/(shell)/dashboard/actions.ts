"use server";

import { z } from "zod";
import { getFastApi } from "@/lib/server-fetch";
import { requireActionAuth } from "@/lib/auth/action-auth";
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
 * Fetch all client metrics from pre-computed table.
 */
export async function getDashboardMetrics(): Promise<ClientMetrics[]> {
  await requireActionAuth();
  try {
    // Call open-seo API endpoint that queries client_dashboard_metrics
    return await getFastApi<ClientMetrics[]>("/api/dashboard/metrics");
  } catch (error) {
    console.error("[getDashboardMetrics] Failed to fetch metrics:", error);
    return [];
  }
}

/**
 * Fetch portfolio-wide summary statistics.
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  await requireActionAuth();
  try {
    return await getFastApi<PortfolioSummary>("/api/dashboard/summary");
  } catch (error) {
    console.error("[getPortfolioSummary] Failed to fetch summary:", error);
    return {
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
      // Goal-based metrics
      avgGoalAttainment: 0,
      avgGoalAttainmentTrend: 0,
      clientsOnTrack: 0,
      clientsWatching: 0,
      clientsCritical: 0,
      goalsMet: 0,
      goalsTotal: 0,
    };
  }
}

/**
 * Fetch items needing attention (alerts, low health, connection issues).
 */
export async function getAttentionItems(): Promise<AttentionItem[]> {
  await requireActionAuth();
  try {
    return await getFastApi<AttentionItem[]>("/api/dashboard/attention");
  } catch (error) {
    console.error("[getAttentionItems] Failed to fetch attention items:", error);
    return [];
  }
}

/**
 * Fetch recent wins and milestones.
 */
export async function getWins(): Promise<WinItem[]> {
  await requireActionAuth();
  try {
    return await getFastApi<WinItem[]>("/api/dashboard/wins");
  } catch (error) {
    console.error("[getWins] Failed to fetch wins:", error);
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
    console.error("Failed to save card layout:", error);
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
    console.error("[getCardLayout] Failed to fetch card layout:", error);
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
    console.error("[getSavedViews] Failed to fetch saved views:", error);
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
 */
export async function getTeamWorkload(): Promise<TeamMember[]> {
  await requireActionAuth();
  try {
    return await getFastApi<TeamMember[]>("/api/dashboard/team-workload");
  } catch (error) {
    console.error("[getTeamWorkload] Failed to fetch team workload:", error);
    return [];
  }
}

/**
 * Get upcoming scheduled items (reports, audits).
 */
export async function getUpcomingScheduled(): Promise<ScheduledItem[]> {
  await requireActionAuth();
  try {
    return await getFastApi<ScheduledItem[]>("/api/dashboard/upcoming");
  } catch (error) {
    console.error("[getUpcomingScheduled] Failed to fetch upcoming items:", error);
    return [];
  }
}

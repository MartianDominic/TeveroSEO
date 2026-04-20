"use server";

import { getFastApi } from "@/lib/server-fetch";
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

/**
 * Fetch all client metrics from pre-computed table.
 */
export async function getDashboardMetrics(): Promise<ClientMetrics[]> {
  try {
    // Call open-seo API endpoint that queries client_dashboard_metrics
    return await getFastApi<ClientMetrics[]>("/api/dashboard/metrics");
  } catch (error) {
    return [];
  }
}

/**
 * Fetch portfolio-wide summary statistics.
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    return await getFastApi<PortfolioSummary>("/api/dashboard/summary");
  } catch (error) {
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
  try {
    return await getFastApi<AttentionItem[]>("/api/dashboard/attention");
  } catch (error) {
    return [];
  }
}

/**
 * Fetch recent wins and milestones.
 */
export async function getWins(): Promise<WinItem[]> {
  try {
    return await getFastApi<WinItem[]>("/api/dashboard/wins");
  } catch (error) {
    return [];
  }
}

/**
 * Dismiss an attention item (snooze or acknowledge).
 */
export async function dismissAttentionItem(itemId: string, action: "snooze" | "dismiss"): Promise<void> {
  // POST to alerts API to update status
  await getFastApi(`/api/alerts/${itemId}/${action}`, {
    method: "POST",
  });
}

/**
 * Save card layout to user preferences.
 */
export async function saveCardLayout(cardOrder: string[]): Promise<void> {
  try {
    await getFastApi("/api/dashboard/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardOrder }),
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
  try {
    const result = await getFastApi<{ cardOrder: string[] | null }>("/api/dashboard/layout");
    return result.cardOrder;
  } catch {
    return null;
  }
}

/**
 * Get all saved views for current user/workspace.
 */
export async function getSavedViews(): Promise<SavedView[]> {
  try {
    return await getFastApi<SavedView[]>("/api/dashboard/views");
  } catch {
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
 */
export async function createSavedView(
  name: string,
  filters: ClientTableFilters,
  cardLayout?: string[]
): Promise<SavedView> {
  return await getFastApi<SavedView>("/api/dashboard/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, filters, cardLayout }),
  });
}

/**
 * Delete a saved view.
 */
export async function deleteSavedView(viewId: string): Promise<void> {
  await getFastApi(`/api/dashboard/views/${viewId}`, {
    method: "DELETE",
  });
}

/**
 * Set a view as default.
 */
export async function setDefaultView(viewId: string): Promise<void> {
  await getFastApi(`/api/dashboard/views/${viewId}/default`, {
    method: "POST",
  });
}

/**
 * Get team workload data.
 */
export async function getTeamWorkload(): Promise<TeamMember[]> {
  try {
    return await getFastApi<TeamMember[]>("/api/dashboard/team-workload");
  } catch {
    return [];
  }
}

/**
 * Get upcoming scheduled items (reports, audits).
 */
export async function getUpcomingScheduled(): Promise<ScheduledItem[]> {
  try {
    return await getFastApi<ScheduledItem[]>("/api/dashboard/upcoming");
  } catch {
    return [];
  }
}

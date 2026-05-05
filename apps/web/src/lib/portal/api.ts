/**
 * Portal API Functions
 *
 * Fetch functions for portal API endpoints.
 * Base URL from NEXT_PUBLIC_API_URL environment variable.
 */

import type {
  DashboardResponse,
  KeywordsResponse,
  ActivityResponse,
  NotificationsResponse,
  NotificationSettingsResponse,
  NotificationSettings,
  KeywordQueryOptions,
  ActivityQueryOptions,
  ApiError,
} from "./types";

// Base URL for API calls - points to open-seo-main backend
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Helper to build URL with query params
 */
function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined>
): string {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

/**
 * Helper to make authenticated requests
 * Token passed via Authorization header (never logged)
 */
async function fetchWithAuth<T>(
  url: string,
  token: string
): Promise<T | ApiError> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { success: false, error: "Unauthorized - invalid or expired token" };
    }
    if (response.status === 403) {
      return { success: false, error: "Forbidden - access denied" };
    }
    return { success: false, error: `Request failed with status ${response.status}` };
  }

  return response.json();
}

// ============================================================================
// Dashboard API
// ============================================================================

/**
 * Fetch dashboard metrics for a client
 * Returns GSC-verified metrics with deltas, wins, and attention items
 */
export async function fetchDashboard(
  clientId: string,
  token: string
): Promise<DashboardResponse | ApiError> {
  const url = buildUrl(`/api/portal/dashboard/${clientId}`);
  return fetchWithAuth<DashboardResponse>(url, token);
}

// ============================================================================
// Keywords API
// ============================================================================

/**
 * Fetch keywords for a client with optional filtering and sorting
 */
export async function fetchKeywords(
  clientId: string,
  token: string,
  options?: KeywordQueryOptions
): Promise<KeywordsResponse | ApiError> {
  const url = buildUrl(`/api/portal/keywords/${clientId}`, {
    filter: options?.filter,
    sort: options?.sort,
    order: options?.order,
    limit: options?.limit,
    offset: options?.offset,
  });
  return fetchWithAuth<KeywordsResponse>(url, token);
}

// ============================================================================
// Activity API
// ============================================================================

/**
 * Fetch activity feed for a client with optional category filter
 */
export async function fetchActivity(
  clientId: string,
  token: string,
  options?: ActivityQueryOptions
): Promise<ActivityResponse | ApiError> {
  const url = buildUrl(`/api/portal/activity/${clientId}`, {
    category: options?.category,
    limit: options?.limit,
    offset: options?.offset,
  });
  return fetchWithAuth<ActivityResponse>(url, token);
}

// ============================================================================
// Notifications API
// ============================================================================

/**
 * Fetch in-app notifications for a client
 */
export async function fetchNotifications(
  clientId: string,
  token: string
): Promise<NotificationsResponse | ApiError> {
  const url = buildUrl(`/api/portal/notifications/${clientId}`);
  return fetchWithAuth<NotificationsResponse>(url, token);
}

/**
 * Fetch notification settings for a client
 */
export async function fetchNotificationSettings(
  clientId: string,
  token: string
): Promise<NotificationSettingsResponse | ApiError> {
  const url = buildUrl(`/api/portal/notifications/settings/${clientId}`);
  return fetchWithAuth<NotificationSettingsResponse>(url, token);
}

/**
 * Update notification settings for a client
 */
export async function updateNotificationSettings(
  clientId: string,
  token: string,
  settings: Partial<NotificationSettings>
): Promise<NotificationSettingsResponse | ApiError> {
  const url = buildUrl(`/api/portal/notifications/settings/${clientId}`);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { success: false, error: "Unauthorized" };
    }
    if (response.status === 403) {
      return { success: false, error: "Forbidden" };
    }
    return { success: false, error: `Request failed with status ${response.status}` };
  }

  return response.json();
}

// ============================================================================
// Mark notification as read
// ============================================================================

/**
 * Mark a notification as read
 */
export async function markNotificationRead(
  clientId: string,
  notificationId: string,
  token: string
): Promise<{ success: boolean } | ApiError> {
  const url = buildUrl(`/api/portal/notifications/${clientId}/${notificationId}/read`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return { success: false, error: `Request failed with status ${response.status}` };
  }

  return response.json();
}

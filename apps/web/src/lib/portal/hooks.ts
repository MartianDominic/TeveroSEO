/**
 * Portal Hooks
 *
 * TanStack Query hooks for portal data fetching.
 * - 30-second stale time for dashboard (data updates slowly from GSC)
 * - 5-minute cache time
 * - Retry on network errors only
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboard,
  fetchKeywords,
  fetchActivity,
  fetchNotifications,
  fetchNotificationSettings,
  updateNotificationSettings,
  markNotificationRead,
} from "./api";
import type {
  DashboardData,
  KeywordsData,
  ActivityData,
  NotificationsData,
  NotificationSettings,
  KeywordQueryOptions,
  ActivityQueryOptions,
} from "./types";

// ============================================================================
// Query Key Factories
// ============================================================================

export const portalKeys = {
  all: ["portal"] as const,
  dashboard: (clientId: string) => [...portalKeys.all, "dashboard", clientId] as const,
  keywords: (clientId: string, options?: KeywordQueryOptions) =>
    [...portalKeys.all, "keywords", clientId, options] as const,
  activity: (clientId: string, options?: ActivityQueryOptions) =>
    [...portalKeys.all, "activity", clientId, options] as const,
  notifications: (clientId: string) =>
    [...portalKeys.all, "notifications", clientId] as const,
  notificationSettings: (clientId: string) =>
    [...portalKeys.all, "notification-settings", clientId] as const,
};

// ============================================================================
// Common Query Options
// ============================================================================

const defaultOptions = {
  staleTime: 30 * 1000, // 30 seconds (GSC data updates slowly)
  gcTime: 5 * 60 * 1000, // 5 minutes cache
  retry: (failureCount: number, error: unknown) => {
    // Only retry on network errors, not auth errors
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return false;
    }
    return failureCount < 3;
  },
};

// ============================================================================
// Dashboard Hook
// ============================================================================

export function useDashboard(clientId: string, token: string) {
  return useQuery({
    queryKey: portalKeys.dashboard(clientId),
    queryFn: async () => {
      const response = await fetchDashboard(clientId, token);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    },
    enabled: Boolean(clientId && token),
    ...defaultOptions,
  });
}

// ============================================================================
// Keywords Hook
// ============================================================================

export function useKeywords(
  clientId: string,
  token: string,
  options?: KeywordQueryOptions
) {
  return useQuery({
    queryKey: portalKeys.keywords(clientId, options),
    queryFn: async () => {
      const response = await fetchKeywords(clientId, token, options);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    },
    enabled: Boolean(clientId && token),
    ...defaultOptions,
  });
}

// ============================================================================
// Activity Hook
// ============================================================================

export function useActivity(
  clientId: string,
  token: string,
  options?: ActivityQueryOptions
) {
  return useQuery({
    queryKey: portalKeys.activity(clientId, options),
    queryFn: async () => {
      const response = await fetchActivity(clientId, token, options);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    },
    enabled: Boolean(clientId && token),
    ...defaultOptions,
  });
}

// ============================================================================
// Notifications Hook
// ============================================================================

export function useNotifications(clientId: string, token: string) {
  return useQuery({
    queryKey: portalKeys.notifications(clientId),
    queryFn: async () => {
      const response = await fetchNotifications(clientId, token);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    },
    enabled: Boolean(clientId && token),
    staleTime: 10 * 1000, // 10 seconds for notifications (more frequent updates)
    gcTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Notification Settings Hook
// ============================================================================

export function useNotificationSettings(clientId: string, token: string) {
  return useQuery({
    queryKey: portalKeys.notificationSettings(clientId),
    queryFn: async () => {
      const response = await fetchNotificationSettings(clientId, token);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    },
    enabled: Boolean(clientId && token),
    ...defaultOptions,
  });
}

// ============================================================================
// Update Notification Settings Mutation
// ============================================================================

export function useUpdateNotificationSettings(clientId: string, token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<NotificationSettings>) =>
      updateNotificationSettings(clientId, token, settings),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.setQueryData(
          portalKeys.notificationSettings(clientId),
          response.data
        );
      }
    },
  });
}

// ============================================================================
// Mark Notification Read Mutation
// ============================================================================

export function useMarkNotificationRead(clientId: string, token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(clientId, notificationId, token),
    onSuccess: () => {
      // Invalidate notifications to refetch with updated read status
      queryClient.invalidateQueries({
        queryKey: portalKeys.notifications(clientId),
      });
    },
  });
}

// ============================================================================
// Type exports for consumers
// ============================================================================

export type { DashboardData, KeywordsData, ActivityData, NotificationsData };

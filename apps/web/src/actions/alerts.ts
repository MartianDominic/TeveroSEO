"use server";

import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, patchOpenSeo } from "@/lib/server-fetch";

export interface Alert {
  id: string;
  clientId: string;
  alertType: string;
  severity: "info" | "warning" | "critical";
  status: "pending" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  emailSentAt: string | null;
}

export interface AlertRule {
  id: string;
  clientId: string;
  alertType: string;
  enabled: boolean;
  threshold: number | null;
  severity: "info" | "warning" | "critical";
  emailNotify: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get alert count for badge display.
 */
export async function getAlertCount(clientId: string): Promise<number> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  const result = await getOpenSeo(`/api/clients/${clientId}/alerts?count_only=true`);
  return (result as { count: number }).count ?? 0;
}

/**
 * Get alerts for a client.
 */
export async function getClientAlerts(
  clientId: string,
  status?: string,
): Promise<Alert[]> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  const query = status ? `?status=${status}` : "";
  return getOpenSeo(`/api/clients/${clientId}/alerts${query}`) as Promise<Alert[]>;
}

/**
 * Update alert status.
 */
export async function updateAlertStatus(
  clientId: string,
  alertId: string,
  action: "acknowledge" | "resolve" | "dismiss",
): Promise<{ success: boolean }> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return patchOpenSeo(`/api/clients/${clientId}/alerts`, {
    alertId,
    action,
  }) as Promise<{ success: boolean }>;
}

/**
 * Get alert rules for a client.
 */
export async function getAlertRules(clientId: string): Promise<AlertRule[]> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return getOpenSeo(`/api/clients/${clientId}/alert-rules`) as Promise<AlertRule[]>;
}

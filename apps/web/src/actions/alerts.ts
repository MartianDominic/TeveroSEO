"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, patchOpenSeo } from "@/lib/server-fetch";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID format");
const alertIdSchema = z.string().uuid("Invalid alert ID format");
const statusSchema = z.enum(["pending", "acknowledged", "resolved", "dismissed"]).optional();
const actionSchema = z.enum(["acknowledge", "resolve", "dismiss"]);

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
  const validatedClientId = clientIdSchema.parse(clientId);
  const auth = await requireActionAuth();
  await validateClientOwnership(validatedClientId, auth);
  const result = await getOpenSeo(`/api/clients/${validatedClientId}/alerts?count_only=true`);
  return (result as { count: number }).count ?? 0;
}

/**
 * Get alerts for a client.
 */
export async function getClientAlerts(
  clientId: string,
  status?: string,
): Promise<Alert[]> {
  const validatedClientId = clientIdSchema.parse(clientId);
  const validatedStatus = statusSchema.parse(status);
  const auth = await requireActionAuth();
  await validateClientOwnership(validatedClientId, auth);
  const query = validatedStatus ? `?status=${validatedStatus}` : "";
  return getOpenSeo(`/api/clients/${validatedClientId}/alerts${query}`) as Promise<Alert[]>;
}

/**
 * Update alert status.
 */
export async function updateAlertStatus(
  clientId: string,
  alertId: string,
  action: "acknowledge" | "resolve" | "dismiss",
): Promise<{ success: boolean }> {
  const validatedClientId = clientIdSchema.parse(clientId);
  const validatedAlertId = alertIdSchema.parse(alertId);
  const validatedAction = actionSchema.parse(action);
  const auth = await requireActionAuth();
  await validateClientOwnership(validatedClientId, auth);
  return patchOpenSeo(`/api/clients/${validatedClientId}/alerts`, {
    alertId: validatedAlertId,
    action: validatedAction,
  }) as Promise<{ success: boolean }>;
}

/**
 * Get alert rules for a client.
 */
export async function getAlertRules(clientId: string): Promise<AlertRule[]> {
  const validatedClientId = clientIdSchema.parse(clientId);
  const auth = await requireActionAuth();
  await validateClientOwnership(validatedClientId, auth);
  return getOpenSeo(`/api/clients/${validatedClientId}/alert-rules`) as Promise<AlertRule[]>;
}

// Validation schema for alert rule updates
const alertRuleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().nullable().optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  emailNotify: z.boolean().optional(),
});

/**
 * Update an alert rule configuration.
 * SECURITY: Validates that the user owns the client before allowing updates.
 */
export async function updateAlertConfig(
  clientId: string,
  ruleId: string,
  updates: {
    enabled?: boolean;
    threshold?: number | null;
    severity?: "info" | "warning" | "critical";
    emailNotify?: boolean;
  }
): Promise<{ success: boolean }> {
  const validatedClientId = clientIdSchema.parse(clientId);
  const validatedRuleId = alertIdSchema.parse(ruleId);
  const validatedUpdates = alertRuleUpdateSchema.parse(updates);

  const auth = await requireActionAuth();

  // SECURITY: Verify user has access to this client before updating alert config
  await validateClientOwnership(validatedClientId, auth);

  return patchOpenSeo(`/api/clients/${validatedClientId}/alert-rules/${validatedRuleId}`, validatedUpdates) as Promise<{ success: boolean }>;
}

/**
 * Create a new alert rule for a client.
 * SECURITY: Validates that the user owns the client before allowing creation.
 */
export async function createAlertRule(
  clientId: string,
  rule: {
    alertType: string;
    enabled: boolean;
    threshold?: number | null;
    severity: "info" | "warning" | "critical";
    emailNotify: boolean;
  }
): Promise<AlertRule> {
  const validatedClientId = clientIdSchema.parse(clientId);
  const validatedRule = z.object({
    alertType: z.string().min(1).max(100),
    enabled: z.boolean(),
    threshold: z.number().nullable().optional(),
    severity: z.enum(["info", "warning", "critical"]),
    emailNotify: z.boolean(),
  }).parse(rule);

  const auth = await requireActionAuth();

  // SECURITY: Verify user has access to this client before creating alert rule
  await validateClientOwnership(validatedClientId, auth);

  const response = await patchOpenSeo(`/api/clients/${validatedClientId}/alert-rules`, {
    method: "POST",
    ...validatedRule,
  });

  return response as AlertRule;
}

/**
 * Delete an alert rule.
 * SECURITY: Validates that the user owns the client before allowing deletion.
 */
export async function deleteAlertRule(
  clientId: string,
  ruleId: string
): Promise<{ success: boolean }> {
  const validatedClientId = clientIdSchema.parse(clientId);
  const validatedRuleId = alertIdSchema.parse(ruleId);

  const auth = await requireActionAuth();

  // SECURITY: Verify user has access to this client before deleting alert rule
  await validateClientOwnership(validatedClientId, auth);

  await patchOpenSeo(`/api/clients/${validatedClientId}/alert-rules/${validatedRuleId}`, {
    method: "DELETE",
  });

  return { success: true };
}

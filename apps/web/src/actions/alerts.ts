"use server";

import { z } from "zod";

import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { logger } from "@/lib/logger";
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";
import { getOpenSeo, patchOpenSeo, postOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";
import { generateAlertIdempotencyKey } from "@/lib/utils/idempotency";
import {
  AlertArraySchema,
  AlertRuleArraySchema,
  AlertRuleSchema,
  AlertCountResponseSchema,
  SuccessResponseSchema,
  type Alert,
  type AlertRule,
} from "@/lib/validations/api-response-schemas";

// Re-export types for consumers
export type { Alert, AlertRule };

// Validation schemas for input
const clientIdSchema = z.string().uuid("Invalid client ID format");
const alertIdSchema = z.string().uuid("Invalid alert ID format");
const statusSchema = z.enum(["pending", "acknowledged", "resolved", "dismissed"]).optional();
const actionSchema = z.enum(["acknowledge", "resolve", "dismiss"]);

/**
 * Get alert count for badge display.
 */
export async function getAlertCount(clientId: string): Promise<ActionResult<number>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);
    const result = await getOpenSeo(`/api/clients/${validatedClientId}/alerts?count_only=true`);
    const parsed = AlertCountResponseSchema.safeParse(result);
    if (!parsed.success) {
      logger.error("[getAlertCount] Invalid response format", { error: parsed.error.message });
      return { success: false, error: "Invalid response format from server" };
    }
    return { success: true, data: parsed.data.count };
  } catch (error) {
    logger.error("[getAlertCount] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get alert count",
    };
  }
}

/**
 * Get alerts for a client.
 */
export async function getClientAlerts(
  clientId: string,
  status?: string,
): Promise<ActionResult<Alert[]>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedStatus = statusSchema.parse(status);
    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);
    const query = validatedStatus ? `?status=${validatedStatus}` : "";
    const rawData = await getOpenSeo(`/api/clients/${validatedClientId}/alerts${query}`);
    const parsed = AlertArraySchema.safeParse(rawData);
    if (!parsed.success) {
      logger.error("[getClientAlerts] Invalid response format", { error: parsed.error.message });
      return { success: false, error: "Invalid response format from server" };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    logger.error("[getClientAlerts] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get alerts",
    };
  }
}

/**
 * Update alert status.
 */
export async function updateAlertStatus(
  clientId: string,
  alertId: string,
  action: "acknowledge" | "resolve" | "dismiss",
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedAlertId = alertIdSchema.parse(alertId);
    const validatedAction = actionSchema.parse(action);
    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);
    const rawData = await patchOpenSeo(`/api/clients/${validatedClientId}/alerts`, {
      alertId: validatedAlertId,
      action: validatedAction,
    });
    const parsed = SuccessResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      logger.error("[updateAlertStatus] Invalid response format", { error: parsed.error.message });
      return { success: false, error: "Invalid response format from server" };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    logger.error("[updateAlertStatus] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update alert status",
    };
  }
}

/**
 * Get alert rules for a client.
 */
export async function getAlertRules(clientId: string): Promise<ActionResult<AlertRule[]>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);
    const rawData = await getOpenSeo(`/api/clients/${validatedClientId}/alert-rules`);
    const parsed = AlertRuleArraySchema.safeParse(rawData);
    if (!parsed.success) {
      logger.error("[getAlertRules] Invalid response format", { error: parsed.error.message });
      return { success: false, error: "Invalid response format from server" };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    logger.error("[getAlertRules] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get alert rules",
    };
  }
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
 * Rate limited: 50 changes per hour.
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
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedRuleId = alertIdSchema.parse(ruleId);
    const validatedUpdates = alertRuleUpdateSchema.parse(updates);

    const auth = await requireActionAuth();

    // Rate limit: prevent alert config abuse
    await checkActionRateLimit("alertConfig", auth.userId);

    // SECURITY: Verify user has access to this client before updating alert config
    await validateClientOwnership(validatedClientId, auth);

    const rawData = await patchOpenSeo(`/api/clients/${validatedClientId}/alert-rules/${validatedRuleId}`, validatedUpdates);
    const parsed = SuccessResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      logger.error("[updateAlertConfig] Invalid response format", { error: parsed.error.message });
      return { success: false, error: "Invalid response format from server" };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    logger.error("[updateAlertConfig] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update alert configuration",
    };
  }
}

/**
 * Create a new alert rule for a client.
 * SECURITY: Validates that the user owns the client before allowing creation.
 * Rate limited: 50 changes per hour.
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
): Promise<ActionResult<AlertRule>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedRule = z.object({
      alertType: z.string().min(1).max(100),
      enabled: z.boolean(),
      threshold: z.number().nullable().optional(),
      severity: z.enum(["info", "warning", "critical"]),
      emailNotify: z.boolean(),
    }).parse(rule);

    const auth = await requireActionAuth();

    // Rate limit: prevent alert rule spam
    await checkActionRateLimit("alertConfig", auth.userId);

    // SECURITY: Verify user has access to this client before creating alert rule
    await validateClientOwnership(validatedClientId, auth);

    // DB-H08 FIX: Generate idempotency key to prevent duplicate alert rule creation
    const idempotencyKey = generateAlertIdempotencyKey('create', {
      clientId: validatedClientId,
      alertType: validatedRule.alertType,
    });

    // HIGH-TXN-004 FIX: Use correct HTTP method (POST) for create operation
    const rawData = await postOpenSeo(`/api/clients/${validatedClientId}/alert-rules`, {
      ...validatedRule,
      idempotencyKey, // Backend should use this to deduplicate
    });
    const parsed = AlertRuleSchema.safeParse(rawData);
    if (!parsed.success) {
      logger.error("[createAlertRule] Invalid response format", { error: parsed.error.message });
      return { success: false, error: "Invalid response format from server" };
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    logger.error("[createAlertRule] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create alert rule",
    };
  }
}

/**
 * Delete an alert rule.
 * SECURITY: Validates that the user owns the client before allowing deletion.
 * Rate limited: 50 changes per hour.
 */
export async function deleteAlertRule(
  clientId: string,
  ruleId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedRuleId = alertIdSchema.parse(ruleId);

    const auth = await requireActionAuth();

    // Rate limit: prevent mass deletion abuse
    await checkActionRateLimit("alertConfig", auth.userId);

    // SECURITY: Verify user has access to this client before deleting alert rule
    await validateClientOwnership(validatedClientId, auth);

    // HIGH-TXN-004 FIX: Use correct HTTP method (DELETE) for delete operation
    await deleteOpenSeo(`/api/clients/${validatedClientId}/alert-rules/${validatedRuleId}`);

    return { success: true, data: { success: true } };
  } catch (error) {
    logger.error("[deleteAlertRule] Error", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete alert rule",
    };
  }
}

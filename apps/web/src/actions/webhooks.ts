"use server";

import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo, postOpenSeo, patchOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";

export interface Webhook {
  id: string;
  scope: "global" | "workspace" | "client";
  scopeId: string | null;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  eventType: string;
  status: "pending" | "delivered" | "failed" | "exhausted";
  attempts: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookEvent {
  type: string;
  category: string;
  tier: number;
  description: string;
  samplePayload: Record<string, unknown>;
}

/**
 * Get all webhooks for a client.
 */
export async function getClientWebhooks(clientId: string): Promise<Webhook[]> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return getOpenSeo<Webhook[]>(
    `/api/webhooks?scope=client&scope_id=${clientId}`,
  );
}

/**
 * Get webhook by ID with optional deliveries.
 * Note: Webhook ownership is validated by the backend based on scope.
 */
export async function getWebhook(
  webhookId: string,
  includeDeliveries = false,
): Promise<Webhook & { deliveries?: WebhookDelivery[] }> {
  await requireActionAuth();
  const query = includeDeliveries ? "?deliveries=true" : "";
  return getOpenSeo(`/api/webhooks/${webhookId}${query}`);
}

/**
 * Get event registry.
 */
export async function getEventRegistry(): Promise<{
  events: WebhookEvent[];
  categories: string[];
}> {
  await requireActionAuth();
  return getOpenSeo("/api/webhooks?events=true");
}

/**
 * Create a webhook.
 */
export async function createWebhook(params: {
  clientId: string;
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
}): Promise<{ id: string; secret: string }> {
  const auth = await requireActionAuth();
  await validateClientOwnership(params.clientId, auth);
  return postOpenSeo("/api/webhooks", {
    scope: "client",
    scopeId: params.clientId,
    name: params.name,
    url: params.url,
    events: params.events,
    headers: params.headers,
  });
}

/**
 * Update a webhook.
 * Note: Backend validates webhook ownership.
 */
export async function updateWebhook(
  webhookId: string,
  params: {
    name?: string;
    url?: string;
    events?: string[];
    headers?: Record<string, string>;
    enabled?: boolean;
    regenerateSecret?: boolean;
  },
): Promise<{ success: boolean; secret?: string }> {
  await requireActionAuth();
  return patchOpenSeo(`/api/webhooks/${webhookId}`, params);
}

/**
 * Delete a webhook.
 * Note: Backend validates webhook ownership.
 */
export async function deleteWebhookAction(
  webhookId: string,
): Promise<{ success: boolean }> {
  await requireActionAuth();
  return deleteOpenSeo(`/api/webhooks/${webhookId}`);
}

/**
 * Get webhook deliveries.
 * Note: Backend validates webhook ownership.
 */
export async function getWebhookDeliveries(
  webhookId: string,
): Promise<WebhookDelivery[]> {
  await requireActionAuth();
  const result = await getOpenSeo<Webhook & { deliveries: WebhookDelivery[] }>(
    `/api/webhooks/${webhookId}?deliveries=true`,
  );
  return result.deliveries ?? [];
}

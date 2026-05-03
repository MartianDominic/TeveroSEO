/**
 * ClientSyncService - Lazy client synchronization from AI-Writer.
 * Phase 40: Gap Closure - CRIT-SYNC-01
 *
 * When open-seo-main receives a request for a client that doesn't exist locally,
 * this service fetches the client details from AI-Writer (source of truth) and
 * creates a local record. This enables seamless cross-service client access
 * without requiring webhooks or dual-write orchestration.
 *
 * Architecture:
 *   AI-Writer (source of truth) -> ClientSyncService -> open-seo-main clients table
 *
 * Usage:
 *   const client = await ClientSyncService.ensureClient(clientId, workspaceId);
 */

import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "ClientSyncService" });

// AI-Writer API URL (matches AIWriterClient.ts configuration)
const AI_WRITER_API =
  process.env.AI_WRITER_URL ||
  process.env.AIWRITER_INTERNAL_URL ||
  "http://localhost:8000";

// Timeout for fetching client from AI-Writer
const FETCH_TIMEOUT_MS = 10000;

/**
 * Client data returned from AI-Writer API.
 */
export interface AIWriterClient {
  id: string;
  name: string;
  website_url: string | null;
  is_archived: boolean;
}

/**
 * Local client record in open-seo-main database.
 */
export interface LocalClient {
  id: string;
  workspaceId: string;
  name: string;
  domain: string | null;
  status: string;
}

/**
 * Extract domain from website URL for storage in open-seo-main.
 * Returns null if URL is invalid or empty.
 */
function extractDomain(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;

  try {
    const url = new URL(websiteUrl);
    return url.hostname;
  } catch {
    // If URL parsing fails, try to extract domain-like portion
    const domainMatch = websiteUrl.match(
      /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,})/i
    );
    return domainMatch ? domainMatch[1] : null;
  }
}

/**
 * Fetch client details from AI-Writer API.
 * Returns null if client not found or API unavailable.
 *
 * @param clientId - UUID of the client to fetch
 * @param authToken - Bearer token for authentication (optional for internal calls)
 */
async function fetchClientFromAIWriter(
  clientId: string,
  authToken?: string
): Promise<AIWriterClient | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add auth header if provided (for user-context requests)
    if (authToken) {
      headers["Authorization"] = authToken.startsWith("Bearer ")
        ? authToken
        : `Bearer ${authToken}`;
    }

    const response = await fetch(`${AI_WRITER_API}/api/clients/${clientId}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status === 404) {
      log.debug("Client not found in AI-Writer", { clientId });
      return null;
    }

    if (!response.ok) {
      log.warn("AI-Writer client fetch failed", {
        clientId,
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as AIWriterClient;
    return data;
  } catch (error) {
    log.error(
      "Failed to fetch client from AI-Writer",
      error instanceof Error ? error : new Error(String(error)),
      { clientId }
    );
    return null;
  }
}

/**
 * Check if client exists locally in open-seo-main database.
 */
async function getLocalClient(clientId: string): Promise<LocalClient | null> {
  const result = await db
    .select({
      id: clients.id,
      workspaceId: clients.workspaceId,
      name: clients.name,
      domain: clients.domain,
      status: clients.status,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Create a local client record from AI-Writer data.
 * Uses INSERT ... ON CONFLICT DO NOTHING to handle race conditions.
 */
async function createLocalClient(
  aiWriterClient: AIWriterClient,
  workspaceId: string
): Promise<LocalClient> {
  const domain = extractDomain(aiWriterClient.website_url);

  // Use INSERT with returning to get the inserted/existing record
  const result = await db
    .insert(clients)
    .values({
      id: aiWriterClient.id,
      workspaceId,
      name: aiWriterClient.name,
      domain: domain ?? "unknown.domain", // domain is required in open-seo-main
      status: aiWriterClient.is_archived ? "churned" : "active",
      contactEmail: null,
      contactName: null,
      industry: null,
    })
    .onConflictDoNothing({ target: clients.id })
    .returning({
      id: clients.id,
      workspaceId: clients.workspaceId,
      name: clients.name,
      domain: clients.domain,
      status: clients.status,
    });

  // If nothing was inserted (conflict), fetch the existing record
  if (result.length === 0) {
    const existing = await getLocalClient(aiWriterClient.id);
    if (!existing) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Failed to create or retrieve client record"
      );
    }
    return existing;
  }

  log.info("Created local client from AI-Writer sync", {
    clientId: aiWriterClient.id,
    workspaceId,
    name: aiWriterClient.name,
  });

  return result[0];
}

/**
 * Ensure a client exists locally, syncing from AI-Writer if necessary.
 *
 * This is the primary entry point for lazy client synchronization.
 * Call this before any operation that requires a local client record.
 *
 * @param clientId - UUID of the client
 * @param workspaceId - Workspace/organization ID for the client
 * @param authToken - Optional auth token for AI-Writer API
 * @returns Local client record, or null if client doesn't exist anywhere
 *
 * @example
 * ```ts
 * const client = await ClientSyncService.ensureClient(clientId, workspaceId);
 * if (!client) {
 *   throw new AppError("NOT_FOUND", "Client not found");
 * }
 * // Client exists locally, proceed with operation
 * ```
 */
export async function ensureClient(
  clientId: string,
  workspaceId: string,
  authToken?: string
): Promise<LocalClient | null> {
  // Step 1: Check if client exists locally
  const localClient = await getLocalClient(clientId);
  if (localClient) {
    return localClient;
  }

  // Step 2: Client not found locally, try to sync from AI-Writer
  log.debug("Client not found locally, attempting AI-Writer sync", {
    clientId,
    workspaceId,
  });

  const aiWriterClient = await fetchClientFromAIWriter(clientId, authToken);
  if (!aiWriterClient) {
    // Client doesn't exist in AI-Writer either
    return null;
  }

  // Step 3: Create local record
  return createLocalClient(aiWriterClient, workspaceId);
}

/**
 * Force sync a client from AI-Writer, updating local record if it exists.
 * Use this for explicit sync operations (e.g., refresh button, webhooks).
 *
 * @param clientId - UUID of the client
 * @param workspaceId - Workspace/organization ID
 * @param authToken - Optional auth token for AI-Writer API
 * @returns Updated local client record, or null if client doesn't exist
 */
export async function syncClient(
  clientId: string,
  workspaceId: string,
  authToken?: string
): Promise<LocalClient | null> {
  const aiWriterClient = await fetchClientFromAIWriter(clientId, authToken);
  if (!aiWriterClient) {
    return null;
  }

  const domain = extractDomain(aiWriterClient.website_url);

  // Upsert: update if exists, insert if not
  const result = await db
    .insert(clients)
    .values({
      id: aiWriterClient.id,
      workspaceId,
      name: aiWriterClient.name,
      domain: domain ?? "unknown.domain",
      status: aiWriterClient.is_archived ? "churned" : "active",
      contactEmail: null,
      contactName: null,
      industry: null,
    })
    .onConflictDoUpdate({
      target: clients.id,
      set: {
        name: aiWriterClient.name,
        domain: domain ?? "unknown.domain",
        status: aiWriterClient.is_archived ? "churned" : "active",
        updatedAt: new Date(),
      },
    })
    .returning({
      id: clients.id,
      workspaceId: clients.workspaceId,
      name: clients.name,
      domain: clients.domain,
      status: clients.status,
    });

  log.info("Synced client from AI-Writer", {
    clientId: aiWriterClient.id,
    workspaceId,
    name: aiWriterClient.name,
  });

  return result[0];
}

/**
 * ClientSyncService namespace for organized exports.
 */
export const ClientSyncService = {
  ensureClient,
  syncClient,
  extractDomain,
};

export default ClientSyncService;

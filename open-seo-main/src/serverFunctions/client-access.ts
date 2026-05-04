/**
 * Shared client access verification utilities for server functions.
 * M-TSK-06 FIX: DRY up duplicated verifyClientAccess logic across serverFunctions.
 *
 * This module provides a consistent way to verify that the current user
 * has access to a specific client via workspace ownership.
 *
 * Usage:
 * ```ts
 * import { verifyClientAccess } from "@/serverFunctions/client-access";
 *
 * // In a server function handler:
 * await verifyClientAccess(clientId, context.organizationId);
 * ```
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { AppError } from "@/server/lib/errors";

/**
 * Verify that the user has access to a specific client.
 * Checks that the client exists and belongs to the specified workspace.
 *
 * @param clientId - The client ID to verify access for
 * @param workspaceId - The user's organization/workspace ID from auth context
 * @throws AppError NOT_FOUND if client doesn't exist
 * @throws AppError FORBIDDEN if client belongs to different workspace
 */
export async function verifyClientAccess(
  clientId: string,
  workspaceId: string
): Promise<void> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });

  if (!client) {
    throw new AppError("NOT_FOUND", "Client not found");
  }

  if (client.workspaceId !== workspaceId) {
    throw new AppError("FORBIDDEN", "Access denied to this client");
  }
}

/**
 * Verify client access and return the client data if successful.
 * Useful when you need both the access check and the client data.
 *
 * @param clientId - The client ID to verify access for
 * @param workspaceId - The user's organization/workspace ID from auth context
 * @returns The client record if access is granted
 * @throws AppError NOT_FOUND if client doesn't exist
 * @throws AppError FORBIDDEN if client belongs to different workspace
 */
export async function verifyClientAccessAndGet(
  clientId: string,
  workspaceId: string
): Promise<typeof clients.$inferSelect> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });

  if (!client) {
    throw new AppError("NOT_FOUND", "Client not found");
  }

  if (client.workspaceId !== workspaceId) {
    throw new AppError("FORBIDDEN", "Access denied to this client");
  }

  return client;
}

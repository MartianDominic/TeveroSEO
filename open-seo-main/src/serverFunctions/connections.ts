/**
 * Connection management server functions.
 * Phase 31-04: Connection Wizard UI
 *
 * TanStack Start server functions for site connection CRUD operations.
 * All endpoints require authentication and verify workspace ownership.
 *
 * Security:
 * - T-31-15: Server functions never return encrypted credentials
 * - T-31-16: Server verifies user has access to clientId via session
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  detectPlatform,
  connectionService,
  PLATFORM_TYPES,
} from "@/server/features/connections";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { clients } from "@/db/client-schema";

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Schema for platform detection.
 */
const detectPlatformSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
});

/**
 * Schema for creating a connection.
 */
const createConnectionSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  platform: z.enum(PLATFORM_TYPES),
  siteUrl: z.string().url("Invalid site URL"),
  displayName: z.string().optional(),
  credentials: z.record(z.string(), z.unknown()),
});

/**
 * Schema for connection ID operations.
 */
const connectionIdSchema = z.object({
  connectionId: z.string().min(1, "Connection ID is required"),
});

/**
 * Schema for client ID operations.
 */
const clientIdSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify that the user has access to the specified client.
 * Throws AppError if client doesn't exist or belongs to different workspace.
 */
async function verifyClientAccess(
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

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Detect platform for a domain.
 * Does not require client context - public detection.
 */
export const detectPlatformFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => detectPlatformSchema.parse(data))
  .handler(async ({ data }) => {
    return detectPlatform(data.domain);
  });

/**
 * Create a new site connection.
 * Credentials are encrypted server-side before storage.
 *
 * T-31-16: Verifies user has access to clientId before creating connection.
 */
export const createConnectionFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createConnectionSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify client access
    await verifyClientAccess(data.clientId, context.organizationId);

    // Create connection (encrypts credentials internally)
    const connection = await connectionService.createConnection({
      clientId: data.clientId,
      platform: data.platform,
      siteUrl: data.siteUrl,
      displayName: data.displayName,
      credentials: data.credentials,
    });

    return connection;
  });

/**
 * Verify a connection and update status.
 * Returns success status and error message if failed.
 */
export const verifyConnectionFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => connectionIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Get connection to verify ownership
    const connection = await connectionService.getConnection(data.connectionId);

    if (!connection) {
      throw new AppError("NOT_FOUND", "Connection not found");
    }

    // Verify client access
    await verifyClientAccess(connection.clientId, context.organizationId);

    // Verify connection
    return connectionService.verifyConnection(data.connectionId);
  });

/**
 * Get connections for a client.
 *
 * T-31-15: Returns connections without decrypted credentials.
 */
export const getConnectionsFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => clientIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify client access
    await verifyClientAccess(data.clientId, context.organizationId);

    return connectionService.getConnectionsForClient(data.clientId);
  });

/**
 * Delete a connection.
 */
export const deleteConnectionFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => connectionIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Get connection to verify ownership
    const connection = await connectionService.getConnection(data.connectionId);

    if (!connection) {
      throw new AppError("NOT_FOUND", "Connection not found");
    }

    // Verify client access
    await verifyClientAccess(connection.clientId, context.organizationId);

    await connectionService.deleteConnection(data.connectionId);
    return { success: true };
  });

/**
 * Get a single connection by ID.
 *
 * T-31-15: Returns connection without decrypted credentials.
 */
export const getConnectionFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => connectionIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const connection = await connectionService.getConnection(data.connectionId);

    if (!connection) {
      throw new AppError("NOT_FOUND", "Connection not found");
    }

    // Verify client access
    await verifyClientAccess(connection.clientId, context.organizationId);

    return connection;
  });

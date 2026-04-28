/**
 * Manages Socket.IO room membership for workspace isolation.
 *
 * SECURITY: All room joins are authorized against workspace membership.
 * Users can only join rooms for workspaces they belong to.
 */

import type { Socket } from "socket.io";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { member } from "@/db/user-schema";
import { eq, and } from "drizzle-orm";
import { redis } from "@/server/lib/redis";
import type {
  AuthenticatedSocketData,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./types";

const log = createLogger({ module: "room-manager" });

/**
 * Typed Socket with authentication context.
 */
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  AuthenticatedSocketData
>;

/**
 * Cache TTL for workspace membership checks (5 minutes).
 * Membership changes are infrequent, so caching is safe.
 */
const MEMBERSHIP_CACHE_TTL = 5 * 60;

/**
 * Maximum allowed workspaceId length to prevent DoS.
 */
const MAX_WORKSPACE_ID_LENGTH = 100;

/**
 * Validate workspaceId format.
 * Must be a non-empty string with reasonable length.
 */
function isValidWorkspaceId(workspaceId: unknown): workspaceId is string {
  return (
    typeof workspaceId === "string" &&
    workspaceId.length > 0 &&
    workspaceId.length <= MAX_WORKSPACE_ID_LENGTH &&
    // Only allow alphanumeric, hyphens, and underscores
    /^[a-zA-Z0-9_-]+$/.test(workspaceId)
  );
}

/**
 * Verify that a user is a member of the specified workspace.
 * Results are cached in Redis for performance.
 *
 * @param userId - The authenticated user's ID
 * @param workspaceId - The workspace/organization ID to check
 * @returns true if user is a member, false otherwise
 */
async function verifyWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const cacheKey = `ws:membership:${userId}:${workspaceId}`;

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const isMember = cached === "1";
      log.debug("Workspace membership cache hit", {
        userId,
        workspaceId,
        isMember,
      });
      return isMember;
    }
  } catch (err) {
    // Cache failure is non-fatal, continue with DB check
    log.warn("Membership cache read failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cache miss: check database
  try {
    const membership = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, workspaceId)))
      .limit(1);

    const isMember = membership.length > 0;

    // Cache the result
    try {
      await redis.setex(cacheKey, MEMBERSHIP_CACHE_TTL, isMember ? "1" : "0");
    } catch (err) {
      log.warn("Membership cache write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    log.debug("Workspace membership check", {
      userId,
      workspaceId,
      isMember,
    });

    return isMember;
  } catch (err) {
    log.error(
      "Database error during membership check",
      err instanceof Error ? err : new Error(String(err)),
      { userId, workspaceId }
    );
    // Fail closed: deny access on database error
    return false;
  }
}

// Track connected sockets per workspace for debugging
const workspaceConnections = new Map<string, Set<string>>();

export function handleSocketConnection(socket: TypedSocket): void {
  log.info("Client connected", { socketId: socket.id });

  socket.on("join-workspace", async (workspaceId) => {
    // SECURITY: Validate workspaceId format
    // Cast to unknown first since Socket.IO guarantees string type but we want to validate
    const rawWorkspaceId = workspaceId as unknown;
    if (!isValidWorkspaceId(rawWorkspaceId)) {
      log.warn("Invalid workspace ID format", {
        socketId: socket.id,
        userId: socket.data.userId,
        workspaceIdType: typeof rawWorkspaceId,
        workspaceIdLength: typeof rawWorkspaceId === "string" ? rawWorkspaceId.length : 0,
      });
      socket.emit("error", { message: "Invalid workspace ID", code: "INVALID_WORKSPACE_ID" });
      return;
    }

    // After validation, rawWorkspaceId is guaranteed to be a valid string
    const validWorkspaceId = rawWorkspaceId;

    // SECURITY: Verify user has access to this workspace
    const userId = socket.data.userId;
    if (!userId) {
      log.warn("No userId in socket data", { socketId: socket.id });
      socket.emit("error", { message: "Authentication required", code: "UNAUTHENTICATED" });
      return;
    }

    const hasAccess = await verifyWorkspaceMembership(userId, validWorkspaceId);
    if (!hasAccess) {
      log.warn("Workspace access denied", {
        socketId: socket.id,
        userId,
        workspaceId: validWorkspaceId,
      });
      socket.emit("error", { message: "Access denied to workspace", code: "FORBIDDEN" });
      return;
    }

    const roomName = `workspace:${validWorkspaceId}`;
    socket.join(roomName);

    // Track connection
    if (!workspaceConnections.has(validWorkspaceId)) {
      workspaceConnections.set(validWorkspaceId, new Set());
    }
    workspaceConnections.get(validWorkspaceId)!.add(socket.id);

    log.info("Client joined workspace", {
      socketId: socket.id,
      userId,
      workspaceId: validWorkspaceId,
      roomSize: workspaceConnections.get(validWorkspaceId)!.size,
    });

    // Acknowledge successful join
    socket.emit("workspace-joined", { workspaceId: validWorkspaceId });
  });

  socket.on("leave-workspace", (workspaceId: string) => {
    const roomName = `workspace:${workspaceId}`;
    socket.leave(roomName);

    // Remove tracking and clean up empty sets to prevent memory leak
    const connections = workspaceConnections.get(workspaceId);
    if (connections) {
      connections.delete(socket.id);
      // Clean up empty sets to prevent accumulation
      if (connections.size === 0) {
        workspaceConnections.delete(workspaceId);
      }
    }

    log.info("Client left workspace", { socketId: socket.id, workspaceId });
  });

  socket.on("disconnect", (reason: string) => {
    // Clean up all workspace memberships
    for (const [workspaceId, sockets] of workspaceConnections.entries()) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        workspaceConnections.delete(workspaceId);
      }
    }

    log.info("Client disconnected", { socketId: socket.id, reason });
  });
}

export function getWorkspaceConnectionCount(workspaceId: string): number {
  return workspaceConnections.get(workspaceId)?.size ?? 0;
}

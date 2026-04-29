/**
 * Socket.IO server for real-time dashboard updates.
 * Multi-tenant: uses workspace-level rooms for isolation.
 *
 * SECURITY: All connections require valid Clerk JWT authentication.
 * Room joins are authorized against workspace membership.
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createLogger } from "@/server/lib/logger";
import { verifyClerkJWT } from "@/server/lib/clerk-jwt";
import { handleSocketConnection } from "./room-manager";
import { redis } from "@/server/lib/redis";
import {
  canConnect,
  addConnection,
  removeConnection,
  bufferEvent,
} from "./connection-manager";
import type {
  AuthenticatedSocketData,
  ServerToClientEvents,
  ClientToServerEvents,
  ActivityEvent,
} from "./types";

const log = createLogger({ module: "socket-server" });

/**
 * Typed Socket.IO server with authentication context.
 */
type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  AuthenticatedSocketData
>;

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
 * Rate limit configuration for WebSocket connections.
 * 10 connections per minute per IP address.
 */
const CONNECTION_RATE_LIMIT = {
  window: 60, // seconds
  maxConnections: 10,
  keyPrefix: "ws:ratelimit:connect:",
};

/**
 * Check connection rate limit by IP address.
 * Returns true if connection is allowed, false if rate limited.
 */
async function checkConnectionRateLimit(ip: string): Promise<boolean> {
  const key = `${CONNECTION_RATE_LIMIT.keyPrefix}${ip}`;
  const now = Date.now();
  const windowStart = now - CONNECTION_RATE_LIMIT.window * 1000;

  try {
    // Use Redis sorted set for sliding window rate limiting
    const pipeline = redis.pipeline();
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Count current entries
    pipeline.zcard(key);
    // Add current timestamp
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    // Set expiry on the key
    pipeline.expire(key, CONNECTION_RATE_LIMIT.window);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= CONNECTION_RATE_LIMIT.maxConnections) {
      log.warn("WebSocket connection rate limit exceeded", {
        ip,
        count: currentCount,
        limit: CONNECTION_RATE_LIMIT.maxConnections,
      });
      return false;
    }

    return true;
  } catch (error) {
    // SECURITY: Fail-closed in production to prevent rate limit bypass
    if (process.env.NODE_ENV === "production") {
      log.error(
        "Rate limit check failed, blocking connection for safety",
        error instanceof Error ? error : new Error(String(error)),
        { ip }
      );
      return false; // Fail closed in production
    }
    // In development, allow through with warning
    log.warn("Rate limit check failed, allowing connection in development", {
      ip,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

let io: TypedServer | null = null;

// Re-export ActivityEvent from types for backwards compatibility
export type { ActivityEvent } from "./types";

/**
 * Initialize Socket.IO server.
 * Call once during server startup.
 */
export function initSocketServer(httpServer: HttpServer): TypedServer {
  if (io) {
    log.warn("Socket.IO server already initialized");
    return io;
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    // Security: Limit message size to prevent DoS
    maxHttpBufferSize: 1e5, // 100KB max message size
    // Enable connection state recovery for better UX
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    },
  });

  // SECURITY: Authentication middleware - validate JWT before connection
  io.use(async (socket: TypedSocket, next) => {
    try {
      // Get client IP for rate limiting
      const ip =
        socket.handshake.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        socket.handshake.address ||
        "unknown";

      // Check connection rate limit
      const allowed = await checkConnectionRateLimit(ip);
      if (!allowed) {
        log.warn("WebSocket connection rejected: rate limit exceeded", {
          socketId: socket.id,
          ip,
        });
        return next(new Error("Rate limit exceeded. Please try again later."));
      }

      // Extract token from auth object or Authorization header
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        log.warn("WebSocket connection rejected: no token", {
          socketId: socket.id,
          ip,
        });
        return next(new Error("Authentication required"));
      }

      // Validate token length to prevent DoS
      if (typeof token !== "string" || token.length > 4096) {
        log.warn("WebSocket connection rejected: invalid token format", {
          socketId: socket.id,
          ip,
        });
        return next(new Error("Invalid token format"));
      }

      // Verify JWT with Clerk
      const user = await verifyClerkJWT(token);

      // SECURITY: Check per-user connection limit
      if (!canConnect(user.userId)) {
        log.warn("WebSocket connection rejected: user connection limit", {
          socketId: socket.id,
          userId: user.userId,
        });
        return next(new Error("Connection limit exceeded. Close other tabs and try again."));
      }

      // Attach user context to socket for use in room-manager
      socket.data.userId = user.userId;
      socket.data.email = user.email;
      socket.data.name = user.name;

      // Register connection for tracking
      addConnection(user.userId, socket.id);

      log.info("WebSocket connection authenticated", {
        socketId: socket.id,
        userId: user.userId,
        email: user.email,
      });

      next();
    } catch (error) {
      log.warn("WebSocket authentication failed", {
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
      });
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: TypedSocket) => {
    // Handle disconnect to clean up connection tracking
    socket.on("disconnect", () => {
      removeConnection(socket.id);
    });

    // Delegate to room manager for workspace handling
    handleSocketConnection(socket);
  });

  log.info("Socket.IO server initialized", { allowedOrigins });

  return io;
}

/**
 * Emit an activity event to a workspace room.
 * Events are received by all connected clients in that workspace.
 */
export function emitActivityEvent(workspaceId: string, event: ActivityEvent): void {
  if (!io) {
    log.warn("Socket.IO not initialized, cannot emit event");
    return;
  }

  const roomName = `workspace:${workspaceId}`;
  io.to(roomName).emit("activity:new", event);

  // Buffer event for catch-up on reconnect
  bufferEvent(workspaceId, event).catch(() => {
    // Error already logged in bufferEvent
  });

  log.debug("Emitted activity event", {
    workspaceId,
    eventType: event.type,
    eventId: event.id
  });
}

/**
 * Get the Socket.IO server instance.
 * Returns null if not initialized.
 */
export function getSocketServer(): TypedServer | null {
  return io;
}

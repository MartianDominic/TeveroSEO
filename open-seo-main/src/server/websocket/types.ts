/**
 * Shared types for WebSocket authentication and authorization.
 */

/**
 * Socket data interface with authentication context.
 * Attached to every authenticated socket connection.
 */
export interface AuthenticatedSocketData {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Error codes emitted to clients on authorization failures.
 */
export type WebSocketErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_WORKSPACE_ID"
  | "RATE_LIMITED";

/**
 * Error payload emitted to clients.
 */
export interface WebSocketError {
  message: string;
  code: WebSocketErrorCode;
}

/**
 * Events emitted by the server.
 */
export interface ServerToClientEvents {
  "activity:new": (event: ActivityEvent) => void;
  "workspace-joined": (data: { workspaceId: string }) => void;
  error: (error: WebSocketError) => void;
}

/**
 * Sync request for catch-up after reconnect.
 */
export interface SyncRequest {
  workspaceId: string;
  lastEventId: string | null;
}

/**
 * Events emitted by the client.
 */
export interface ClientToServerEvents {
  "join-workspace": (workspaceId: string) => void;
  "leave-workspace": (workspaceId: string) => void;
  "sync": (request: SyncRequest) => void;
}

/**
 * Activity event emitted to workspace rooms.
 *
 * HIGH-04 SECURITY NOTE: Client Ownership Validation
 *
 * Events are broadcast to all authenticated members of a workspace room.
 * Client-level filtering (via clientId) is performed on the frontend.
 *
 * This is by design: workspace membership implies access to all clients
 * within that workspace. If finer-grained access control is needed,
 * implement client-level rooms: `client:${clientId}` with ownership
 * validation in verifyClientOwnership() before allowing room joins.
 *
 * Current security model:
 * - User must be authenticated (JWT verified)
 * - User must be a member of the workspace (DB lookup)
 * - All workspace members see all workspace events (including clientId metadata)
 * - Frontend filters by clientId for focused views
 */
export interface ActivityEvent {
  id: string;
  type: string;
  clientId?: string;
  clientName?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

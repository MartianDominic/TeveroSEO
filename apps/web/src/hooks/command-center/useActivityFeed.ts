"use client";

/**
 * useActivityFeed Hook
 * Phase 62-07: Smart Alert Detection
 *
 * Real-time activity feed via Socket.IO connection.
 * Maintains last 50 events and provides connection status.
 *
 * Security: T-62-07-01 - Token passed in auth handshake
 */

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@clerk/nextjs";

/**
 * Activity event from Socket.IO.
 */
export interface ActivityEvent {
  id: string;
  type: string;
  clientId?: string;
  clientName?: string;
  data: {
    entityType?: string;
    entityId?: string;
    title?: string;
    description?: string;
    userId?: string;
    userName?: string;
    [key: string]: unknown;
  };
  timestamp: string;
}

/**
 * Socket.IO server URL from environment.
 */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

/**
 * Maximum number of activities to keep in memory.
 */
const MAX_ACTIVITIES = 50;

/**
 * Query key factory for activity feed.
 */
export const activityKeys = {
  all: ["activity-feed"] as const,
  workspace: (workspaceId: string) =>
    [...activityKeys.all, workspaceId] as const,
};

interface UseActivityFeedOptions {
  /** Initial activities from server-side fetch */
  initialActivities?: ActivityEvent[];
  /** Whether to automatically reconnect on disconnect */
  autoReconnect?: boolean;
}

interface UseActivityFeedReturn {
  /** List of activity events, newest first */
  activities: ActivityEvent[];
  /** Whether the socket is connected */
  isConnected: boolean;
  /** Whether connection is being established */
  isConnecting: boolean;
  /** Last error message if any */
  error: string | null;
  /** Clear all activities */
  clearActivities: () => void;
}

/**
 * Hook for real-time activity feed via Socket.IO.
 *
 * @param workspaceId - The workspace ID to subscribe to
 * @param options - Hook options
 * @returns Activity feed state and methods
 *
 * @example
 * ```tsx
 * const { activities, isConnected, error } = useActivityFeed(workspaceId);
 * ```
 */
export function useActivityFeed(
  workspaceId: string,
  options: UseActivityFeedOptions = {}
): UseActivityFeedReturn {
  const { initialActivities = [], autoReconnect = true } = options;
  const { getToken } = useAuth();

  const [activities, setActivities] =
    useState<ActivityEvent[]>(initialActivities);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    let socket: Socket | null = null;
    let isMounted = true;

    async function connectSocket() {
      setIsConnecting(true);
      setError(null);

      try {
        // Get fresh token for authentication
        const token = await getToken();

        if (!token) {
          setError("Authentication required");
          setIsConnecting(false);
          return;
        }

        socket = io(WS_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnection: autoReconnect,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        socket.on("connect", () => {
          if (!isMounted) return;
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);

          // Join workspace room
          socket?.emit("join-workspace", workspaceId);
        });

        socket.on("disconnect", () => {
          if (!isMounted) return;
          setIsConnected(false);
        });

        socket.on("connect_error", (err) => {
          if (!isMounted) return;
          setError(err.message || "Connection failed");
          setIsConnecting(false);
        });

        socket.on("error", (err) => {
          if (!isMounted) return;
          setError(err.message || "Socket error");
        });

        socket.on("activity:new", (event: ActivityEvent) => {
          if (!isMounted) return;
          setActivities((prev) => {
            // Prepend new event and keep max size
            const updated = [event, ...prev.slice(0, MAX_ACTIVITIES - 1)];
            return updated;
          });
        });

        socket.on("workspace-joined", (data) => {
          // Successfully joined workspace room
          console.log("Joined workspace:", data.workspaceId);
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to connect");
        setIsConnecting(false);
      }
    }

    connectSocket();

    return () => {
      isMounted = false;
      if (socket) {
        socket.emit("leave-workspace", workspaceId);
        socket.disconnect();
      }
    };
  }, [workspaceId, getToken, autoReconnect]);

  return {
    activities,
    isConnected,
    isConnecting,
    error,
    clearActivities,
  };
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";

import { useAuth } from "@clerk/nextjs";
import { io, Socket } from "socket.io-client";

import { logger } from '@/lib/logger';

import type { ActivityEvent, ActivityEventType } from "./socket-events";

// NEXT_PUBLIC_WS_URL must be set via build args in docker-compose.vps.yml
// Fallback to relative path for same-origin WebSocket (works in both dev and prod)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

/** Token refresh interval for long-lived Socket.IO connections (5 minutes) */
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Bounded Set with automatic eviction of oldest entries.
 * Prevents unbounded memory growth in long-running sessions.
 */
class BoundedSet<T> {
  private items: T[] = [];
  private itemSet: Set<T> = new Set();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(item: T): boolean {
    if (this.itemSet.has(item)) {
      return false;
    }

    // Evict oldest if at capacity
    while (this.items.length >= this.maxSize) {
      const oldest = this.items.shift();
      if (oldest !== undefined) {
        this.itemSet.delete(oldest);
      }
    }

    this.items.push(item);
    this.itemSet.add(item);
    return true;
  }

  has(item: T): boolean {
    return this.itemSet.has(item);
  }

  clear(): void {
    this.items = [];
    this.itemSet.clear();
  }

  get size(): number {
    return this.items.length;
  }
}

// Singleton socket instance
let socket: Socket | null = null;
let connectionCount = 0;

/**
 * Creates or returns the singleton Socket.IO instance with JWT authentication.
 * Resolves CRITICAL-WS-002: Socket.IO Client Missing Authentication.
 */
function getSocket(token: string | null): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        token: token || "",
      },
    });
  } else if (token) {
    // Update auth token for existing socket
    socket.auth = { token };
  }
  return socket;
}

/**
 * Updates the authentication token on the socket.
 * Used for token refresh on long-lived connections.
 */
function updateSocketAuth(token: string): void {
  if (socket) {
    socket.auth = { token };
    // Emit token refresh event if connected
    if (socket.connected) {
      socket.emit("auth_refresh", { token });
    }
  }
}

export interface UseActivityFeedOptions {
  workspaceId: string;
  maxEvents?: number;
  filterTypes?: ActivityEventType[];
  filterClientId?: string;
}

export interface UseActivityFeedReturn {
  events: ActivityEvent[];
  isConnected: boolean;
  isAuthenticated: boolean;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
  clearEvents: () => void;
}

export function useActivityFeed({
  workspaceId,
  maxEvents = 50,
  filterTypes,
  filterClientId,
}: UseActivityFeedOptions): UseActivityFeedReturn {
  const { getToken, isSignedIn } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Track seen event IDs for deduplication (bounded to prevent memory leaks)
  const seenIds = useRef(new BoundedSet<string>(1000));
  const isPausedRef = useRef(isPaused);
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!isSignedIn) {
      setIsAuthenticated(false);
      return;
    }

    let isMounted = true;

    const initSocket = async () => {
      // Get JWT token for authentication
      const token = await getToken();
      if (!isMounted || !token) {
        setIsAuthenticated(false);
        return;
      }

      const sock = getSocket(token);
      connectionCount++;
      setIsAuthenticated(true);

      // Connect if not already connected
      if (!sock.connected) {
        sock.connect();
      }

      const handleConnect = () => {
        setIsConnected(true);
        sock.emit("join-workspace", workspaceId);
      };

      const handleDisconnect = () => {
        setIsConnected(false);
      };

      const handleConnectError = (err: Error) => {
        logger.error("[useActivityFeed] Connection error", { error: err.message });
        if (err.message.includes("auth") || err.message.includes("token")) {
          setIsAuthenticated(false);
        }
      };

      const handleEvent = (event: ActivityEvent) => {
        // Skip if paused
        if (isPausedRef.current) return;

        // Deduplicate by event ID
        if (seenIds.current.has(event.id)) return;
        seenIds.current.add(event.id);

        // Apply filters
        if (filterTypes && !filterTypes.includes(event.type as ActivityEventType)) return;
        if (filterClientId && event.clientId !== filterClientId) return;

        setEvents((prev) => [event, ...prev].slice(0, maxEvents));
      };

      sock.on("connect", handleConnect);
      sock.on("disconnect", handleDisconnect);
      sock.on("connect_error", handleConnectError);
      sock.on("activity:new", handleEvent);

      // If already connected, join workspace immediately
      if (sock.connected) {
        handleConnect();
      }

      // Set up token refresh for long-lived connections
      tokenRefreshIntervalRef.current = setInterval(async () => {
        const newToken = await getToken();
        if (newToken) {
          updateSocketAuth(newToken);
        }
      }, TOKEN_REFRESH_INTERVAL);

      return () => {
        sock.off("connect", handleConnect);
        sock.off("disconnect", handleDisconnect);
        sock.off("connect_error", handleConnectError);
        sock.off("activity:new", handleEvent);
        sock.emit("leave-workspace", workspaceId);

        if (tokenRefreshIntervalRef.current) {
          clearInterval(tokenRefreshIntervalRef.current);
          tokenRefreshIntervalRef.current = null;
        }

        connectionCount--;
        if (connectionCount === 0) {
          sock.disconnect();
        }
      };
    };

    const cleanupPromise = initSocket();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [workspaceId, maxEvents, filterTypes, filterClientId, isSignedIn, getToken]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const clearEvents = useCallback(() => {
    setEvents([]);
    seenIds.current.clear();
  }, []);

  return {
    events,
    isConnected,
    isAuthenticated,
    isPaused,
    pause,
    resume,
    clearEvents,
  };
}

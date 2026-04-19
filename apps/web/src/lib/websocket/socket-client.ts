"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ActivityEvent, ActivityEventType } from "./socket-events";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";

// Singleton socket instance
let socket: Socket | null = null;
let connectionCount = 0;

function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
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
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Track seen event IDs for deduplication
  const seenIds = useRef(new Set<string>());
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    const sock = getSocket();
    connectionCount++;

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
    sock.on("activity:new", handleEvent);

    // If already connected, join workspace immediately
    if (sock.connected) {
      handleConnect();
    }

    return () => {
      sock.off("connect", handleConnect);
      sock.off("disconnect", handleDisconnect);
      sock.off("activity:new", handleEvent);
      sock.emit("leave-workspace", workspaceId);

      connectionCount--;
      if (connectionCount === 0) {
        sock.disconnect();
      }
    };
  }, [workspaceId, maxEvents, filterTypes, filterClientId]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const clearEvents = useCallback(() => {
    setEvents([]);
    seenIds.current.clear();
  }, []);

  return {
    events,
    isConnected,
    isPaused,
    pause,
    resume,
    clearEvents,
  };
}

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { z } from 'zod';

/**
 * WebSocket URL for metrics - uses NEXT_PUBLIC_WS_URL or falls back to relative path.
 * Configure via environment variable in production.
 */
const METRICS_WS_URL = process.env.NEXT_PUBLIC_METRICS_WS_URL ||
  (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/metrics` : '');

/** Token refresh interval for long-lived connections (5 minutes) */
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000;

export interface MetricsData {
  timestamp: number;
  traffic: number;
  keywords: number;
  healthScore: number;
  [key: string]: unknown;
}

// WebSocket message schema with union for type safety (Zod v4 compatible)
const metricsPayloadSchema = z.object({
  timestamp: z.number(),
  traffic: z.number(),
  keywords: z.number(),
  healthScore: z.number(),
}).passthrough();

const wsMessageSchema = z.union([
  z.object({ type: z.literal("metrics"), payload: metricsPayloadSchema }),
  z.object({ type: z.literal("status"), payload: z.object({ connected: z.boolean() }).passthrough() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("auth_success") }),
  z.object({ type: z.literal("auth_refresh_ack") }),
]);

// Fallback schema for direct metrics payload (backwards compatibility)
const directMetricsSchema = metricsPayloadSchema;

export interface RealtimeMetricsProps {
  clientId: string;
  onMetricsUpdate?: (metrics: MetricsData) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * RealtimeMetrics component with proper WebSocket cleanup and JWT authentication.
 *
 * Addresses CRITICAL-MEM-003: Event listener accumulation.
 * Addresses CRITICAL-WS-003: RealtimeMetrics Using Raw WebSocket Without Auth.
 * - Properly cleans up WebSocket on unmount or clientId change
 * - Uses refs to avoid stale closure issues
 * - Implements reconnection with exponential backoff
 * - Clears all timeouts on cleanup
 * - JWT authentication via URL token parameter
 * - Token refresh for long-lived connections
 */
export function RealtimeMetrics({
  clientId,
  onMetricsUpdate,
  reconnectDelay = 5000,
  maxReconnectAttempts = 5,
}: RealtimeMetricsProps) {
  const { getToken, isSignedIn } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isCleaningUpRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastMetrics, setLastMetrics] = useState<MetricsData | null>(null);

  // Store callback in ref to avoid stale closures
  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  onMetricsUpdateRef.current = onMetricsUpdate;

  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear token refresh interval
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      // Remove event listeners before closing to prevent firing during cleanup
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onopen = null;

      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Component unmount');
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsAuthenticated(false);
  }, []);

  const connect = useCallback(async () => {
    // Don't connect if cleaning up or if we've exceeded max attempts
    if (isCleaningUpRef.current) return;
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.warn(`[RealtimeMetrics] Max reconnect attempts (${maxReconnectAttempts}) reached for client ${clientId}`);
      return;
    }

    // Require authentication
    if (!isSignedIn) {
      console.warn('[RealtimeMetrics] Not authenticated, skipping connection');
      setIsAuthenticated(false);
      return;
    }

    // Get JWT token
    let token: string | null = null;
    try {
      token = await getToken();
    } catch (err) {
      console.error('[RealtimeMetrics] Failed to get auth token:', err);
      setIsAuthenticated(false);
      return;
    }

    if (!token) {
      console.warn('[RealtimeMetrics] No auth token available');
      setIsAuthenticated(false);
      return;
    }

    // Clean up existing connection before creating new one
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onopen = null;
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Clear existing token refresh interval
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }

    try {
      // Build authenticated WebSocket URL with token
      const wsUrl = new URL(METRICS_WS_URL, window.location.origin);
      wsUrl.searchParams.set('clientId', clientId);
      wsUrl.searchParams.set('token', token);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleaningUpRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setIsAuthenticated(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection

        // Set up token refresh for long-lived connections
        tokenRefreshIntervalRef.current = setInterval(async () => {
          if (isCleaningUpRef.current) return;
          try {
            const newToken = await getToken();
            if (newToken && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'auth_refresh', token: newToken }));
            }
          } catch (err) {
            console.error('[RealtimeMetrics] Token refresh failed:', err);
          }
        }, TOKEN_REFRESH_INTERVAL);
      };

      ws.onmessage = (event) => {
        if (isCleaningUpRef.current) return;

        try {
          const rawData = JSON.parse(event.data) as unknown;

          // Try parsing as typed message first
          const typedParsed = wsMessageSchema.safeParse(rawData);
          if (typedParsed.success) {
            const message = typedParsed.data;
            if (message.type === 'metrics') {
              const metrics = message.payload as MetricsData;
              setLastMetrics(metrics);
              onMetricsUpdateRef.current?.(metrics);
            } else if (message.type === 'error') {
              console.warn('[RealtimeMetrics] Server error:', message.message);
            }
            // auth_success and auth_refresh_ack are handled silently
            return;
          }

          // Fallback: try parsing as direct metrics payload (backwards compatibility)
          const directParsed = directMetricsSchema.safeParse(rawData);
          if (directParsed.success) {
            const metrics = directParsed.data as MetricsData;
            setLastMetrics(metrics);
            onMetricsUpdateRef.current?.(metrics);
            return;
          }

          // Both parsers failed - log warning and ignore
          console.warn('[RealtimeMetrics] Invalid WS message format:', typedParsed.error.issues);
        } catch (e) {
          console.error('[RealtimeMetrics] Failed to parse metrics:', e);
        }
      };

      ws.onclose = (event) => {
        if (isCleaningUpRef.current) return;

        setIsConnected(false);

        // Clear token refresh interval on disconnect
        if (tokenRefreshIntervalRef.current) {
          clearInterval(tokenRefreshIntervalRef.current);
          tokenRefreshIntervalRef.current = null;
        }

        // Don't reconnect for normal closure
        if (event.code === 1000) return;

        // Don't reconnect on auth failure (custom close code 4001)
        if (event.code === 4001) {
          console.warn('[RealtimeMetrics] Authentication failed');
          setIsAuthenticated(false);
          return;
        }

        // Exponential backoff for reconnection
        reconnectAttemptsRef.current++;
        const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isCleaningUpRef.current) {
            connect();
          }
        }, Math.min(delay, 30000)); // Cap at 30 seconds
      };

      ws.onerror = (err) => {
        console.error('[RealtimeMetrics] WebSocket error:', err);
        // onclose will handle reconnection
      };
    } catch (e) {
      console.error('[RealtimeMetrics] Failed to create WebSocket:', e);
    }
  }, [clientId, reconnectDelay, maxReconnectAttempts, isSignedIn, getToken]);

  useEffect(() => {
    // Reset state for new client
    isCleaningUpRef.current = false;
    reconnectAttemptsRef.current = 0;

    if (isSignedIn) {
      connect();
    }

    // Cleanup on unmount or clientId change
    return () => {
      cleanup();
    };
  }, [clientId, connect, cleanup, isSignedIn]);

  return { isConnected, isAuthenticated, lastMetrics };
}

/**
 * Hook version of RealtimeMetrics for more flexible usage.
 */
export function useRealtimeMetrics(props: RealtimeMetricsProps) {
  return RealtimeMetrics(props);
}

export default RealtimeMetrics;

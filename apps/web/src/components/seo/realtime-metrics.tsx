'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * WebSocket URL for metrics - uses NEXT_PUBLIC_WS_URL or falls back to relative path.
 * Configure via environment variable in production.
 */
const METRICS_WS_URL = process.env.NEXT_PUBLIC_METRICS_WS_URL ||
  (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/metrics` : '');

export interface MetricsData {
  timestamp: number;
  traffic: number;
  keywords: number;
  healthScore: number;
  [key: string]: unknown;
}

export interface RealtimeMetricsProps {
  clientId: string;
  onMetricsUpdate?: (metrics: MetricsData) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * RealtimeMetrics component with proper WebSocket cleanup.
 *
 * Addresses CRITICAL-MEM-003: Event listener accumulation.
 * - Properly cleans up WebSocket on unmount or clientId change
 * - Uses refs to avoid stale closure issues
 * - Implements reconnection with exponential backoff
 * - Clears all timeouts on cleanup
 */
export function RealtimeMetrics({
  clientId,
  onMetricsUpdate,
  reconnectDelay = 5000,
  maxReconnectAttempts = 5,
}: RealtimeMetricsProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isCleaningUpRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
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
  }, []);

  const connect = useCallback(() => {
    // Don't connect if cleaning up or if we've exceeded max attempts
    if (isCleaningUpRef.current) return;
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.warn(`[RealtimeMetrics] Max reconnect attempts (${maxReconnectAttempts}) reached for client ${clientId}`);
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

    try {
      const ws = new WebSocket(`${METRICS_WS_URL}?clientId=${encodeURIComponent(clientId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleaningUpRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        if (isCleaningUpRef.current) return;

        try {
          const metrics = JSON.parse(event.data) as MetricsData;
          setLastMetrics(metrics);
          onMetricsUpdateRef.current?.(metrics);
        } catch (e) {
          console.error('[RealtimeMetrics] Failed to parse metrics:', e);
        }
      };

      ws.onclose = (event) => {
        if (isCleaningUpRef.current) return;

        setIsConnected(false);

        // Don't reconnect for normal closure
        if (event.code === 1000) return;

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
  }, [clientId, reconnectDelay, maxReconnectAttempts]);

  useEffect(() => {
    // Reset state for new client
    isCleaningUpRef.current = false;
    reconnectAttemptsRef.current = 0;

    connect();

    // Cleanup on unmount or clientId change
    return () => {
      cleanup();
    };
  }, [clientId, connect, cleanup]);

  return { isConnected, lastMetrics };
}

/**
 * Hook version of RealtimeMetrics for more flexible usage.
 */
export function useRealtimeMetrics(props: RealtimeMetricsProps) {
  return RealtimeMetrics(props);
}

export default RealtimeMetrics;

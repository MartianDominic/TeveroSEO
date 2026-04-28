/**
 * WebSocket Hook with Auto-Reconnect
 *
 * Manages WebSocket connections with exponential backoff reconnection.
 * Resolves HIGH-STATE-008: WebSocket reconnect logic missing.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempt: number;
}

export function useWebSocket({
  url,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
  enabled = true,
}: UseWebSocketOptions) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempt: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const reconnectAttemptRef = useRef(0);

  // Use refs for callbacks to avoid reconnection on callback changes
  // This resolves HIGH-STATE-009: Context provider re-renders
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    setState(s => ({ ...s, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setState({
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempt: 0,
        });
        onConnectRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch {
          // Handle non-JSON messages
          onMessageRef.current(event.data);
        }
      };

      ws.onerror = (event) => {
        onErrorRef.current?.(event);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;

        setState(s => ({
          ...s,
          isConnected: false,
          isConnecting: false,
        }));

        onDisconnectRef.current?.();

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptRef.current < maxReconnectAttempts && enabled) {
          const delay = Math.min(
            reconnectInterval * Math.pow(1.5, reconnectAttemptRef.current),
            30000 // Cap at 30 seconds
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            reconnectAttemptRef.current += 1;
            setState(s => ({ ...s, reconnectAttempt: reconnectAttemptRef.current }));
            connect();
          }, delay);
        } else if (reconnectAttemptRef.current >= maxReconnectAttempts) {
          setState(s => ({ ...s, error: 'Max reconnection attempts reached' }));
        }
      };
    } catch (err) {
      setState(s => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Failed to connect',
      }));
    }
  }, [url, reconnectInterval, maxReconnectAttempts, enabled]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, enabled]); // Reconnect on URL or enabled change

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setState(s => ({ ...s, reconnectAttempt: 0, error: null }));
    connect();
  }, [connect]);

  return {
    ...state,
    send,
    disconnect,
    reconnect,
  };
}

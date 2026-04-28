/**
 * WebSocket Hook with Auto-Reconnect and JWT Authentication
 *
 * Manages WebSocket connections with exponential backoff reconnection.
 * Resolves HIGH-STATE-008: WebSocket reconnect logic missing.
 * Resolves CRITICAL-WS-001: Client WebSocket Hook Missing Authentication.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onAuthError?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
  /** Token refresh interval in milliseconds (default: 5 minutes) */
  tokenRefreshInterval?: number;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempt: number;
  isAuthenticated: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  onAuthError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
  enabled = true,
  tokenRefreshInterval = 5 * 60 * 1000, // 5 minutes
}: UseWebSocketOptions) {
  const { getToken, isSignedIn } = useAuth();

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempt: 0,
    isAuthenticated: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const reconnectAttemptRef = useRef(0);

  // Use refs for callbacks to avoid reconnection on callback changes
  // This resolves HIGH-STATE-009: Context provider re-renders
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onAuthErrorRef = useRef(onAuthError);

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

  useEffect(() => {
    onAuthErrorRef.current = onAuthError;
  }, [onAuthError]);

  // Token refresh for long-lived connections
  const refreshToken = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const newToken = await getToken();
      if (newToken && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'auth_refresh', token: newToken }));
      }
    } catch (err) {
      console.error('[useWebSocket] Token refresh failed:', err);
    }
  }, [getToken]);

  const connect = useCallback(async () => {
    if (!mountedRef.current || !enabled) return;

    // Require authentication
    if (!isSignedIn) {
      setState(s => ({ ...s, error: 'Not authenticated', isAuthenticated: false }));
      onAuthErrorRef.current?.();
      return;
    }

    // Get fresh JWT token
    let token: string | null = null;
    try {
      token = await getToken();
    } catch (err) {
      setState(s => ({ ...s, error: 'Failed to get auth token', isAuthenticated: false }));
      onAuthErrorRef.current?.();
      return;
    }

    if (!token) {
      setState(s => ({ ...s, error: 'No auth token available', isAuthenticated: false }));
      onAuthErrorRef.current?.();
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Clear existing token refresh interval
    if (tokenRefreshTimeoutRef.current) {
      clearInterval(tokenRefreshTimeoutRef.current);
      tokenRefreshTimeoutRef.current = null;
    }

    setState(s => ({ ...s, isConnecting: true, error: null }));

    try {
      // Pass token in URL query parameter
      const wsUrl = new URL(url, window.location.origin);
      wsUrl.searchParams.set('token', token);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setState({
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempt: 0,
          isAuthenticated: true,
        });
        onConnectRef.current?.();

        // Set up token refresh interval for long connections
        tokenRefreshTimeoutRef.current = setInterval(() => {
          refreshToken();
        }, tokenRefreshInterval);
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

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        // Clear token refresh interval
        if (tokenRefreshTimeoutRef.current) {
          clearInterval(tokenRefreshTimeoutRef.current);
          tokenRefreshTimeoutRef.current = null;
        }

        setState(s => ({
          ...s,
          isConnected: false,
          isConnecting: false,
          isAuthenticated: false,
        }));

        onDisconnectRef.current?.();

        // Check for auth failure (custom close code 4001)
        if (event.code === 4001) {
          setState(s => ({ ...s, error: 'Authentication failed' }));
          onAuthErrorRef.current?.();
          return; // Don't retry on auth failure
        }

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
  }, [url, reconnectInterval, maxReconnectAttempts, enabled, isSignedIn, getToken, refreshToken, tokenRefreshInterval]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled && isSignedIn) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (tokenRefreshTimeoutRef.current) {
        clearInterval(tokenRefreshTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, enabled, isSignedIn]); // Reconnect on URL, enabled, or auth change

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

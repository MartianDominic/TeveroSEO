/**
 * WebSocket Hook with Auto-Reconnect and JWT Authentication
 *
 * Manages WebSocket connections with exponential backoff reconnection.
 * Resolves HIGH-STATE-008: WebSocket reconnect logic missing.
 * Resolves CRITICAL-WS-001: Client WebSocket Hook Missing Authentication.
 * Resolves M-24: WebSocket message parsing without validation.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { z, ZodSchema } from 'zod';

/**
 * Base WebSocket message schema for common message types.
 * Consumers can extend this or provide their own schema.
 */
export const baseWsMessageSchema = z.union([
  z.object({ type: z.literal("status"), payload: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("auth_success") }),
  z.object({ type: z.literal("auth_refresh_ack") }),
  z.object({ type: z.literal("ping") }),
  z.object({ type: z.literal("pong") }),
]);

interface UseWebSocketOptions<T = unknown> {
  url: string;
  onMessage: (data: T) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onAuthError?: () => void;
  /** Called when a message fails schema validation */
  onValidationError?: (error: z.ZodError, rawData: unknown) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
  /** Token refresh interval in milliseconds (default: 5 minutes) */
  tokenRefreshInterval?: number;
  /** Optional Zod schema for message validation. If provided, only valid messages are passed to onMessage. */
  messageSchema?: ZodSchema<T>;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempt: number;
  isAuthenticated: boolean;
}

export function useWebSocket<T = unknown>({
  url,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  onAuthError,
  onValidationError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
  enabled = true,
  tokenRefreshInterval = 5 * 60 * 1000, // 5 minutes
  messageSchema,
}: UseWebSocketOptions<T>) {
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

  const onValidationErrorRef = useRef(onValidationError);
  useEffect(() => {
    onValidationErrorRef.current = onValidationError;
  }, [onValidationError]);

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
          const rawData = JSON.parse(event.data) as unknown;

          // If a schema is provided, validate the message
          if (messageSchema) {
            const parsed = messageSchema.safeParse(rawData);
            if (parsed.success) {
              onMessageRef.current(parsed.data);
            } else {
              // Log validation error and optionally notify consumer
              console.warn('[useWebSocket] Invalid message format:', parsed.error.issues);
              onValidationErrorRef.current?.(parsed.error, rawData);
            }
          } else {
            // No schema provided - pass data through (backwards compatible)
            onMessageRef.current(rawData as T);
          }
        } catch {
          // Handle non-JSON messages - only pass through if no schema required
          if (!messageSchema) {
            onMessageRef.current(event.data as T);
          } else {
            console.warn('[useWebSocket] Received non-JSON message when schema validation is enabled');
          }
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

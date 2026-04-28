# WebSocket and Real-Time Features Security Audit

**Date:** 2026-04-28
**Scope:** WebSocket connections, real-time features, Socket.IO implementation
**Status:** FINDINGS IDENTIFIED

---

## Executive Summary

The WebSocket implementation has a solid server-side security foundation (Socket.IO server in open-seo-main) with JWT authentication, workspace authorization, and connection rate limiting. However, there are **CRITICAL** issues with the client-side implementations that bypass authentication entirely, and several **HIGH** severity concerns around message rate limiting and data consistency.

---

## CRITICAL Findings

### CRITICAL-WS-001: Client WebSocket Hook Missing Authentication

**Location:** `/apps/web/src/hooks/use-websocket.ts`
**Severity:** CRITICAL

The generic `useWebSocket` hook creates raw WebSocket connections without any authentication mechanism:

```typescript
// Line 83-84: No auth token passed
const ws = new WebSocket(url);
wsRef.current = ws;
```

**Impact:** Any WebSocket endpoint used with this hook has no authentication. If the hook connects to a protected endpoint, it will fail authentication, but the code doesn't handle this gracefully.

**Recommendation:** Add authentication token parameter and pass via URL query or protocol header:
```typescript
const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
// Or use Socket.IO's auth mechanism
```

---

### CRITICAL-WS-002: Socket.IO Client Missing Authentication

**Location:** `/apps/web/src/lib/websocket/socket-client.ts`
**Severity:** CRITICAL

The Socket.IO client singleton initializes without passing authentication credentials:

```typescript
// Lines 61-69: No auth configuration
socket = io(WS_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  // MISSING: auth: { token: getClerkToken() }
});
```

**Impact:** The server at `socket-server.ts` (lines 154-164) requires JWT authentication and will reject all connections from this client. The client will repeatedly fail and reconnect, wasting resources.

**Recommendation:** Pass Clerk JWT token in the auth option:
```typescript
socket = io(WS_URL, {
  auth: {
    token: await getClerkToken()
  },
  // ... other options
});
```

---

### CRITICAL-WS-003: RealtimeMetrics Using Raw WebSocket Without Auth

**Location:** `/apps/web/src/components/seo/realtime-metrics.tsx`
**Severity:** CRITICAL

The `RealtimeMetrics` component uses native WebSocket without authentication:

```typescript
// Line 102: No authentication
const ws = new WebSocket(`${METRICS_WS_URL}?clientId=${encodeURIComponent(clientId)}`);
```

**Impact:** 
1. If `METRICS_WS_URL` points to an unprotected endpoint, anyone can access metrics data by guessing clientIds
2. If it points to a protected endpoint, connections will fail silently
3. ClientId is passed as query param but not validated against user's workspace membership

**Recommendation:** Either integrate with Socket.IO's authenticated client or add JWT token to WebSocket URL.

---

## HIGH Severity Findings

### HIGH-WS-004: No Per-User Connection Limits

**Location:** `/open-seo-main/src/server/websocket/socket-server.ts`
**Severity:** HIGH

Connection rate limiting is per-IP (line 47-51):
```typescript
const CONNECTION_RATE_LIMIT = {
  window: 60, // seconds
  maxConnections: 10,
  keyPrefix: "ws:ratelimit:connect:",
};
```

**Gap:** No limit on connections per authenticated user. A malicious user could:
1. Open many connections from different IPs
2. Join many workspaces simultaneously
3. Exhaust server resources with authenticated connections

**Recommendation:** Add per-userId connection tracking:
```typescript
const USER_CONNECTION_LIMIT = 5; // Max connections per user
const userConnections = new Map<string, Set<string>>(); // userId -> socketIds
```

---

### HIGH-WS-005: No Message Rate Limiting

**Location:** `/open-seo-main/src/server/websocket/room-manager.ts`
**Severity:** HIGH

The server accepts unlimited messages per connection. While message size is limited (100KB via `maxHttpBufferSize`), there's no rate limiting on:
- `join-workspace` events (could spam workspace joins)
- `leave-workspace` events

**Impact:** A client could flood the server with join/leave requests, causing:
- Redis cache thrashing (membership checks)
- Database query load
- Log noise

**Recommendation:** Add per-socket message rate limiting:
```typescript
const MESSAGE_RATE_LIMIT = { window: 10, maxMessages: 20 }; // 20 msgs per 10 sec
```

---

### HIGH-WS-006: Stale Data After Reconnect

**Location:** `/apps/web/src/lib/websocket/socket-client.ts`
**Severity:** HIGH

When reconnecting, the client:
1. Re-joins the workspace (line 116-117)
2. Does NOT request missed events since disconnect

```typescript
const handleConnect = () => {
  setIsConnected(true);
  sock.emit("join-workspace", workspaceId);
  // MISSING: Request events since lastEventTimestamp
};
```

**Impact:** Users miss events that occurred during brief disconnects, leading to inconsistent UI state.

**Recommendation:** Implement catch-up mechanism:
```typescript
sock.emit("join-workspace", { workspaceId, since: lastEventTimestamp });
// Server should send buffered events since that timestamp
```

---

### HIGH-WS-007: Puppeteer WebSocket Endpoint Exposure

**Location:** `/docker/puppeteer/browser-server.js`
**Severity:** HIGH

The Puppeteer browser server exposes its WebSocket endpoint via HTTP without authentication:

```javascript
// Lines 38-42: No auth check
} else if (req.url === "/ws") {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ wsEndpoint }));
}
```

**Impact:** If this endpoint is exposed beyond the Docker network, attackers could:
1. Discover the WebSocket endpoint
2. Connect directly to Chrome DevTools Protocol
3. Execute arbitrary browser commands

**Recommendation:** 
1. Ensure port 3100 is NOT exposed externally (docker-compose `expose` vs `ports`)
2. Add INTERNAL_API_KEY check to /ws endpoint
3. Bind health server to internal network only

---

## MEDIUM Severity Findings

### MEDIUM-WS-008: No Heartbeat Validation on Client

**Location:** `/apps/web/src/hooks/use-websocket.ts`
**Severity:** MEDIUM

The hook relies on browser's native WebSocket close event, but doesn't validate server heartbeats:

```typescript
// No ping/pong handling
ws.onclose = () => {
  // Only triggers when connection actually closes
};
```

**Impact:** Half-open connections may persist undetected until a send fails.

**Recommendation:** Socket.IO handles this automatically, but for raw WebSocket:
```typescript
const heartbeatInterval = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: 'ping'}));
}, 30000);
```

---

### MEDIUM-WS-009: Workspace Connection Tracking Memory Growth

**Location:** `/open-seo-main/src/server/websocket/room-manager.ts`
**Severity:** MEDIUM

The `workspaceConnections` Map (line 128) is cleaned up on disconnect, but could grow unbounded if disconnect events are missed:

```typescript
const workspaceConnections = new Map<string, Set<string>>();
```

**Positive:** Cleanup on disconnect (lines 194-200, 207-216) properly deletes empty Sets.

**Remaining Risk:** If socket.disconnect event is not fired (network partition), entries persist.

**Recommendation:** Add periodic cleanup job:
```typescript
setInterval(() => {
  for (const [wsId, connections] of workspaceConnections) {
    // Verify each socketId still exists in io.sockets.sockets
  }
}, 60000);
```

---

### MEDIUM-WS-010: Race Between HTTP and WS Updates

**Location:** Architecture-wide
**Severity:** MEDIUM

Activity events are emitted via WebSocket (`emitActivityEvent`), but UI may also poll HTTP endpoints. No coordination exists between:
- HTTP response returning new data
- WebSocket event arriving for same data

**Impact:** UI flickers or shows duplicate updates when both HTTP and WS deliver the same information.

**Recommendation:** Add event versioning or timestamps to deduplicate:
```typescript
interface ActivityEvent {
  id: string;
  version: number; // Or use sortable ID like ULID
  // ...
}
```

---

### MEDIUM-WS-011: Broadcast Storm Potential

**Location:** `/open-seo-main/src/server/pipeline/progress-emitter.ts`
**Severity:** MEDIUM

Pipeline progress is emitted for every plan completion:
```typescript
export function emitPipelineProgress(workspaceId: string, data: PipelineProgressData): void {
  const event: ActivityEvent = { /* ... */ };
  emitActivityEvent(workspaceId, event);
}
```

**Impact:** Long-running pipelines with many plans could flood workspace channels with rapid updates.

**Recommendation:** Implement debouncing/throttling:
```typescript
const throttledEmit = throttle(emitActivityEvent, 1000); // Max 1 per second
```

---

## LOW Severity Findings

### LOW-WS-012: Missing Connection Recovery State

**Location:** `/apps/web/src/lib/websocket/socket-client.ts`
**Severity:** LOW

Server enables `connectionStateRecovery` (socket-server.ts line 128-130), but client doesn't handle recovery data:

```typescript
// Server has:
connectionStateRecovery: {
  maxDisconnectionDuration: 2 * 60 * 1000,
}
// Client doesn't use socket.recovered or socket.io.engine.on('recover')
```

**Recommendation:** Log recovery state for debugging:
```typescript
socket.on("connect", () => {
  if (socket.recovered) {
    console.log("Connection recovered, missed events replayed");
  }
});
```

---

### LOW-WS-013: Reconnection Flood After Token Expiry

**Location:** `/apps/web/src/hooks/use-websocket.ts`
**Severity:** LOW

Reconnection logic (lines 124-138) doesn't distinguish between:
- Network errors (should retry)
- Authentication errors (should NOT retry without token refresh)

```typescript
ws.onclose = () => {
  // Always attempts reconnection regardless of close reason
  if (reconnectAttemptRef.current < maxReconnectAttempts && enabled) {
    // ...reconnect
  }
};
```

**Recommendation:** Check close code and reason:
```typescript
ws.onclose = (event) => {
  if (event.code === 4001) { // Custom auth failure code
    setState(s => ({ ...s, error: 'Authentication failed' }));
    return; // Don't retry
  }
  // ... normal reconnect logic
};
```

---

## Positive Findings

### SECURE: JWT Authentication on Socket.IO Server

**Location:** `/open-seo-main/src/server/websocket/socket-server.ts`

The server correctly:
1. Requires JWT token (lines 154-164)
2. Validates token length to prevent DoS (lines 166-173)
3. Verifies JWT with Clerk JWKS (line 176)
4. Attaches user context to socket data (lines 179-181)

### SECURE: Workspace Authorization

**Location:** `/open-seo-main/src/server/websocket/room-manager.ts`

The room manager correctly:
1. Validates workspaceId format (lines 47-54)
2. Verifies workspace membership via database (lines 65-124)
3. Caches membership results in Redis (line 102)
4. Fails closed on database errors (line 123)

### SECURE: Message Size Limits

**Location:** `/open-seo-main/src/server/websocket/socket-server.ts`

Server limits message size to 100KB (line 127):
```typescript
maxHttpBufferSize: 1e5, // 100KB max message size
```

### SECURE: CORS Configuration

**Location:** `/open-seo-main/src/server/websocket/socket-server.ts`

CORS is configured from environment variable (lines 113-122):
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [
  "http://localhost:3000",
  "http://localhost:3001",
];
```

### SECURE: BoundedSet for Deduplication

**Location:** `/apps/web/src/lib/websocket/socket-client.ts`

The `BoundedSet` class (lines 15-54) prevents unbounded memory growth by evicting oldest entries when at capacity.

---

## Summary by Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 3 | Client-side authentication missing |
| HIGH | 4 | Per-user limits, message rate, stale data, Puppeteer exposure |
| MEDIUM | 4 | Heartbeat, memory growth, race conditions, broadcast storms |
| LOW | 2 | Recovery state, reconnect logic |

---

## Recommended Priority

1. **Immediate (CRITICAL):** Fix client authentication - WS-001, WS-002, WS-003
2. **Short-term (HIGH):** Add per-user connection limits, message rate limiting - WS-004, WS-005
3. **Medium-term:** Implement event catch-up, secure Puppeteer - WS-006, WS-007
4. **Ongoing:** Address MEDIUM/LOW items as part of regular maintenance

---

## Files Examined

- `/apps/web/src/hooks/use-websocket.ts`
- `/apps/web/src/lib/websocket/socket-client.ts`
- `/apps/web/src/lib/websocket/socket-events.ts`
- `/apps/web/src/components/seo/realtime-metrics.tsx`
- `/apps/web/src/components/dashboard/ActivityFeed.tsx`
- `/open-seo-main/src/server/websocket/socket-server.ts`
- `/open-seo-main/src/server/websocket/room-manager.ts`
- `/open-seo-main/src/server/websocket/types.ts`
- `/open-seo-main/src/server/pipeline/progress-emitter.ts`
- `/open-seo-main/src/server.ts`
- `/open-seo-main/src/server/lib/clerk-jwt.ts`
- `/docker/puppeteer/browser-server.js`

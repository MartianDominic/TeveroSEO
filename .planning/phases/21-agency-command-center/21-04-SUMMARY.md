---
phase: 21-agency-command-center
plan: 04
subsystem: dashboard
tags: [websocket, real-time, drag-and-drop, ui-components]
requires: [21-01, 21-02]
provides: [activity-feed, quick-stats-dnd]
affects: [dashboard-ui, socket-server]
dependency_graph:
  requires:
    - 21-01: client_dashboard_metrics table schema
    - 21-02: PortfolioSummary type and dashboard components
  provides:
    - activity-feed: Real-time WebSocket activity feed component
    - quick-stats-dnd: Drag-and-drop stats cards with layout persistence
  affects:
    - dashboard-ui: Added ActivityFeed and QuickStatsCards to main dashboard
    - socket-server: WebSocket server on port 3002 for real-time events
tech_stack:
  added:
    - socket.io@4.8.3: WebSocket server for real-time events
    - socket.io-client@4.8.3: WebSocket client for activity feed
    - "@dnd-kit/core@6.3.1": Drag-and-drop core library
    - "@dnd-kit/sortable@10.0.0": Sortable list/grid support
    - "@dnd-kit/utilities@3.2.2": DnD utilities (CSS transforms)
  patterns:
    - Singleton Socket.IO client connection
    - Workspace-level rooms for multi-tenant isolation
    - Event deduplication using seen IDs set
    - Touch/keyboard/mouse sensor configuration for accessibility
    - Layout persistence via server actions
key_files:
  created:
    - open-seo-main/src/server/websocket/socket-server.ts: Socket.IO server initialization and event emission
    - open-seo-main/src/server/websocket/room-manager.ts: Workspace room management and connection tracking
    - apps/web/src/lib/websocket/socket-client.ts: useActivityFeed hook with deduplication
    - apps/web/src/lib/websocket/socket-events.ts: Activity event types, labels, colors
    - apps/web/src/components/dashboard/ActivityFeed.tsx: Real-time activity feed UI
    - apps/web/src/components/dashboard/DraggableCard.tsx: Drag-and-drop card wrapper
    - apps/web/src/components/dashboard/QuickStatsCards.tsx: Drag-and-drop stats cards grid
  modified:
    - open-seo-main/src/server.ts: WebSocket server startup on port 3002
    - apps/web/src/app/(shell)/dashboard/page.tsx: Added ActivityFeed and QuickStatsCards
    - apps/web/src/app/(shell)/dashboard/actions.ts: Added saveCardLayout and getCardLayout
    - apps/web/package.json: Socket.IO client and dnd-kit dependencies
    - open-seo-main/package.json: Socket.IO server dependency
decisions:
  - decision: "Run WebSocket server on separate port 3002 instead of integrating with Nitro HTTP server"
    rationale: "TanStack Start with Nitro doesn't expose HTTP server instance directly; standalone server is simpler and follows research pattern"
    alternatives: "Hook into Nitro server lifecycle via plugins (more complex, requires Nitro internals knowledge)"
  - decision: "Use singleton Socket.IO client connection with reference counting"
    rationale: "Prevents duplicate connections when multiple components use useActivityFeed; proper cleanup on unmount"
    alternatives: "Per-component connections (wasteful) or global context (more boilerplate)"
  - decision: "Hardcode workspace ID as 'default-workspace' for now"
    rationale: "Clerk auth integration not yet implemented; allows testing of WebSocket functionality"
    alternatives: "Block implementation until Clerk integration (delays real-time features)"
  - decision: "Include TouchSensor with 250ms delay and 5px tolerance"
    rationale: "Prevents accidental drags on mobile while scrolling; follows dnd-kit best practices"
    alternatives: "Mouse-only (breaks mobile) or no activation constraint (poor scroll UX)"
  - decision: "Place ActivityFeed in right sidebar, QuickStatsCards at top"
    rationale: "Feed is glanceable but not primary focus; stats cards are key metrics for daily workflow"
    alternatives: "Feed at top (too prominent) or bottom (out of view)"
metrics:
  duration_seconds: 564
  tasks_completed: 6
  files_created: 7
  files_modified: 5
  commits: 7
  loc_added: 756
  dependencies_added: 5
  completed_at: "2026-04-19T22:40:34Z"
---

# Phase 21 Plan 04: Real-Time Activity Feed & Drag-and-Drop Stats Summary

**One-liner:** WebSocket-powered real-time activity feed with drag-and-drop customizable stats cards using Socket.IO and @dnd-kit

## What Was Built

Built the real-time Activity Feed and drag-and-drop Quick Stats Cards for the Agency Command Center dashboard:

1. **Socket.IO Server** (open-seo-main):
   - Standalone WebSocket server on port 3002
   - Workspace-level rooms for multi-tenant event isolation
   - Room manager tracks connections per workspace
   - Graceful shutdown integration

2. **Socket.IO Client** (apps/web):
   - `useActivityFeed` hook with singleton connection pattern
   - Event deduplication using seen IDs set
   - Pause/resume functionality for feed control
   - Filtering by event type and client ID

3. **ActivityFeed Component**:
   - Real-time event display with live/offline indicator
   - Filter by category (alerts, rankings, reports, connections, sync)
   - Pause/resume controls
   - Relative timestamps (Just now, Xm ago, Xh ago)
   - Color-coded event types

4. **Drag-and-Drop Stats Cards**:
   - `DraggableCard` wrapper using @dnd-kit/sortable
   - `QuickStatsCards` grid with 6 configurable cards
   - Mouse, touch, and keyboard sensor support
   - Layout persistence via `saveCardLayout` action
   - Visual feedback during drag (opacity, ring)

5. **Dashboard Integration**:
   - QuickStatsCards at top for prominent metrics
   - ActivityFeed in right sidebar alongside portfolio table
   - Responsive grid layout (2-col mobile, 3-col tablet, 6-col desktop)

## Deviations from Plan

None - plan executed exactly as written.

All tasks completed successfully:
- ✅ Task 1: Dependencies installed in both packages
- ✅ Task 2: Socket.IO server created with workspace rooms
- ✅ Task 3: Socket.IO client hook and event types created
- ✅ Task 4: ActivityFeed component with filtering and pause
- ✅ Task 5: QuickStatsCards with drag-and-drop and persistence
- ✅ Task 6: Dashboard page updated with both new components

## Technical Highlights

### Multi-Tenant Socket.IO Isolation

```typescript
// Workspace rooms prevent cross-tenant event leaks
socket.on("join-workspace", (workspaceId: string) => {
  const roomName = `workspace:${workspaceId}`;
  socket.join(roomName);
});

// Emit only to specific workspace
io.to(`workspace:${workspaceId}`).emit("activity:new", event);
```

### Event Deduplication

```typescript
// Prevents duplicate events on reconnect
const seenIds = useRef(new Set<string>());

const handleEvent = (event: ActivityEvent) => {
  if (seenIds.current.has(event.id)) return;
  seenIds.current.add(event.id);
  setEvents((prev) => [event, ...prev].slice(0, maxEvents));
};
```

### Touch-Friendly Drag-and-Drop

```typescript
// 250ms delay prevents scroll conflicts on mobile
useSensor(TouchSensor, {
  activationConstraint: { delay: 250, tolerance: 5 },
})
```

### Singleton Socket Connection

```typescript
// Reference counting prevents duplicate connections
let connectionCount = 0;

useEffect(() => {
  connectionCount++;
  if (!sock.connected) sock.connect();
  
  return () => {
    connectionCount--;
    if (connectionCount === 0) sock.disconnect();
  };
}, []);
```

## Files Created

**Server (open-seo-main):**
- `src/server/websocket/socket-server.ts` - Socket.IO initialization and event emission (83 lines)
- `src/server/websocket/room-manager.ts` - Workspace room management (66 lines)

**Client (apps/web):**
- `src/lib/websocket/socket-client.ts` - useActivityFeed hook (125 lines)
- `src/lib/websocket/socket-events.ts` - Event type definitions (72 lines)
- `src/components/dashboard/ActivityFeed.tsx` - Real-time feed UI (164 lines)
- `src/components/dashboard/DraggableCard.tsx` - Drag-and-drop wrapper (53 lines)
- `src/components/dashboard/QuickStatsCards.tsx` - Stats cards grid (158 lines)

## Files Modified

**Server:**
- `src/server.ts` - WebSocket server startup and shutdown
- `package.json` - Added socket.io dependency

**Client:**
- `src/app/(shell)/dashboard/page.tsx` - Added ActivityFeed and QuickStatsCards
- `src/app/(shell)/dashboard/actions.ts` - Added saveCardLayout and getCardLayout
- `package.json` - Added socket.io-client and @dnd-kit dependencies

## Verification Results

All acceptance criteria met:

**Dependencies:**
- ✅ socket.io-client@4.8.3 in apps/web/package.json
- ✅ @dnd-kit/core@6.3.1 in apps/web/package.json
- ✅ @dnd-kit/sortable@10.0.0 in apps/web/package.json
- ✅ socket.io@4.8.3 in open-seo-main/package.json

**Server:**
- ✅ `initSocketServer` export in socket-server.ts
- ✅ `emitActivityEvent` export in socket-server.ts
- ✅ `handleSocketConnection` in room-manager.ts
- ✅ `join-workspace` event handler

**Client:**
- ✅ `useActivityFeed` hook with deduplication
- ✅ `ActivityFeed` component with filtering
- ✅ `QuickStatsCards` with DndContext
- ✅ `TouchSensor` configured for mobile
- ✅ `saveCardLayout` persistence action

**TypeScript:**
- ✅ TypeScript compiles without errors in open-seo-main
- ✅ TypeScript compiles without errors in apps/web

## Known Limitations

1. **Hardcoded Workspace ID**: Currently using `"default-workspace"` - needs Clerk auth integration to get actual workspace ID from user session.

2. **No Backend Persistence**: `saveCardLayout` and `getCardLayout` actions call API endpoints that don't exist yet. Backend implementation required in future plan.

3. **No Event Emission**: Socket.IO server is set up but no backend code emits events yet. Future plans will integrate event emission into BullMQ workers and API endpoints.

4. **Static Event Data**: ActivityFeed will show events but no real events are being generated. Needs integration with alerts, ranking changes, report generation.

## Integration Points

**Requires:**
- 21-01: `client_dashboard_metrics` table and `PortfolioSummary` computation
- 21-02: Dashboard page structure and `PortfolioHealthSummary` component

**Provides:**
- `useActivityFeed` hook for real-time event subscription
- `ActivityFeed` component for event display
- `QuickStatsCards` for customizable dashboard metrics
- `emitActivityEvent` function for backend event emission

**Affects:**
- Dashboard UI: Added two new sections (activity feed + stats cards)
- Server startup: WebSocket server now runs on port 3002
- Client dependencies: Socket.IO client increases bundle size by ~50KB

## Next Steps

1. **Clerk Auth Integration**: Replace hardcoded workspace ID with actual user workspace from Clerk session
2. **Backend API Endpoints**: Implement `/api/dashboard/layout` POST/GET endpoints for card layout persistence
3. **Event Emission**: Integrate `emitActivityEvent` into:
   - Alert trigger/acknowledge/resolve handlers
   - Ranking change detection worker
   - Report generation completion
   - Connection status updates
4. **Event History**: Store activity events in `portfolio_activity` table for feed hydration on page load
5. **Real-Time Metrics**: Consider emitting metric updates via WebSocket when health scores change significantly (optional - may be overkill)

## Commits

**Web Repo (main branch):**
- `032b8ddd` - feat(21-04): update dashboard page with ActivityFeed and QuickStatsCards
- `46f274ab` - feat(21-04): create QuickStatsCards with drag-and-drop
- `40b5cf6b` - feat(21-04): create ActivityFeed component with real-time updates
- `214fcc7d` - feat(21-04): create Socket.IO client hook and event types
- `fa5dbda4` - chore(21-04): install Socket.IO client and dnd-kit dependencies

**Open-SEO-Main Repo (master branch):**
- `064261b` - feat(21-04): create Socket.IO server with workspace rooms
- `08bd7e4` - chore(21-04): install Socket.IO server dependency

## Self-Check: PASSED

✅ All created files exist:
- open-seo-main/src/server/websocket/socket-server.ts
- open-seo-main/src/server/websocket/room-manager.ts
- apps/web/src/lib/websocket/socket-client.ts
- apps/web/src/lib/websocket/socket-events.ts
- apps/web/src/components/dashboard/ActivityFeed.tsx
- apps/web/src/components/dashboard/DraggableCard.tsx
- apps/web/src/components/dashboard/QuickStatsCards.tsx

✅ All commits exist:
- Web repo: fa5dbda4, 214fcc7d, 40b5cf6b, 46f274ab, 032b8ddd
- Open-seo-main repo: 08bd7e4, 064261b

✅ TypeScript compiles in both packages
✅ All dependencies installed and verified

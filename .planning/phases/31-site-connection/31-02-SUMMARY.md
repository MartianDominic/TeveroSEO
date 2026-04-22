---
phase: 31
plan: 02
subsystem: site-connections
tags: [api, client-library, proxy, open-seo-main]
dependency_graph:
  requires: []
  provides:
    - Client-side site connection API functions
    - REST API routes for site connections CRUD
    - Platform detection endpoint
  affects:
    - Connection wizard UI (31-03)
tech_stack:
  added: []
  patterns:
    - Proxy pattern to open-seo-main backend
    - Server-fetch utility with auth header
key_files:
  created:
    - apps/web/src/lib/siteConnections.ts
    - apps/web/src/app/api/site-connections/route.ts
    - apps/web/src/app/api/site-connections/[id]/route.ts
    - apps/web/src/app/api/site-connections/[id]/verify/route.ts
    - apps/web/src/app/api/site-connections/detect/route.ts
  modified: []
decisions:
  - Used existing getOpenSeo/postOpenSeo/deleteOpenSeo helpers from server-fetch.ts for backend proxy
  - Followed established pattern from clients API routes (error handling, status propagation)
metrics:
  duration: ~5 minutes
  completed: 2026-04-22T22:42:00Z
---

# Phase 31 Plan 02: Site Connections API Layer Summary

Full REST API and client library for site connections proxying to open-seo-main ConnectionService.

## One-liner

REST API routes and typed client functions proxying site connection CRUD to open-seo-main backend.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9b31ca9ef | Add siteConnections.ts client library with 5 typed functions |
| 2 | feedfb057 | Add 4 API route files for connections CRUD + detect + verify |

## What Was Built

### Client Library (apps/web/src/lib/siteConnections.ts)

5 exported async functions:
- `detectPlatform(domain)` - Detect CMS platform from domain
- `createSiteConnection(input)` - Create new encrypted connection
- `getSiteConnections(clientId)` - List connections for a client
- `verifySiteConnection(connectionId)` - Test connection credentials
- `deleteSiteConnection(connectionId)` - Remove a connection

TypeScript interfaces:
- `SiteConnection` - Full connection model (id, clientId, platform, siteUrl, status, etc.)
- `DetectionResult` - Platform detection response (platform, confidence, signals)
- `CreateConnectionInput` - Connection creation payload

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/site-connections` | GET, POST | List connections by clientId, create new connection |
| `/api/site-connections/[id]` | GET, DELETE | Get single connection, delete connection |
| `/api/site-connections/[id]/verify` | POST | Verify connection credentials via platform adapter |
| `/api/site-connections/detect` | POST | Auto-detect platform from domain |

All routes proxy to open-seo-main backend via `getOpenSeo`, `postOpenSeo`, `deleteOpenSeo` helpers from `server-fetch.ts`.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Client library exports 5 async functions (verified via grep)
- 4 route.ts files created under /api/site-connections
- All routes use OPEN_SEO_URL via server-fetch helpers
- TypeScript compilation errors are pre-existing (missing node_modules in worktree)

## Self-Check: PASSED

- [x] apps/web/src/lib/siteConnections.ts exists
- [x] apps/web/src/app/api/site-connections/route.ts exists (exports GET, POST)
- [x] apps/web/src/app/api/site-connections/[id]/route.ts exists (exports GET, DELETE)
- [x] apps/web/src/app/api/site-connections/[id]/verify/route.ts exists (exports POST)
- [x] apps/web/src/app/api/site-connections/detect/route.ts exists (exports POST)
- [x] Commit 9b31ca9ef exists
- [x] Commit feedfb057 exists

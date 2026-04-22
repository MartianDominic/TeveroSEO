---
phase: 31-site-connection
plan: 01
subsystem: connections/adapters
tags: [platform-adapters, wix, squarespace, webflow, api-integration]
dependency_graph:
  requires: []
  provides: [WixAdapter, SquarespaceAdapter, WebflowAdapter]
  affects: [ConnectionService]
tech_stack:
  added: []
  patterns: [PlatformAdapter interface, Bearer token auth, REST API integration]
key_files:
  created:
    - open-seo-main/src/server/features/connections/adapters/WixAdapter.ts
    - open-seo-main/src/server/features/connections/adapters/SquarespaceAdapter.ts
    - open-seo-main/src/server/features/connections/adapters/WebflowAdapter.ts
  modified:
    - open-seo-main/src/server/features/connections/adapters/BaseAdapter.ts
    - open-seo-main/src/server/features/connections/adapters/index.ts
    - open-seo-main/src/server/features/connections/services/ConnectionService.ts
decisions:
  - "Squarespace adapter marked read-only (canWritePosts: false) due to API limitations"
  - "All adapters return generic error messages to avoid leaking API details (T-31-01)"
metrics:
  duration_seconds: 173
  completed: "2026-04-22T19:43:00Z"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 31 Plan 01: Platform Adapters Summary

Three new CMS platform adapters (Wix, Squarespace, Webflow) implementing PlatformAdapter interface with verifyConnection() and testWritePermission() methods.

## One-liner

Wix/Squarespace/Webflow adapters using native fetch with Bearer token auth, all wired into ConnectionService.createAdapter() switch.

## What Was Built

### WixAdapter (Task 1)
- Implements PlatformAdapter for Wix Headless API
- Uses Bearer token + wix-site-id header pattern
- Endpoint: `https://www.wixapis.com/site-properties/v4/properties`
- Full capabilities: canReadPosts, canWritePosts, canReadPages, canWritePages, canReadSeo, canWriteSeo

### SquarespaceAdapter (Task 2)
- Implements PlatformAdapter for Squarespace REST API
- Uses Bearer token auth with API key
- Endpoint: `https://api.squarespace.com/1.0/commerce/inventory`
- **Read-only capabilities** due to API limitations: canReadPosts, canReadPages, canReadSeo
- canWritePosts: false (third-party apps have limited write access)

### WebflowAdapter (Task 2)
- Implements PlatformAdapter for Webflow CMS API v2
- Uses Bearer token auth
- Endpoint: `https://api.webflow.com/v2/sites/{siteId}`
- Full capabilities via CMS API

### ConnectionService Integration (Task 3)
- Added imports for WixAdapter, SquarespaceAdapter, WebflowAdapter
- Extended createAdapter() switch statement with 3 new cases
- All 5 platforms now supported: wordpress, shopify, wix, squarespace, webflow

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | eb4cdcc | feat(31-01): add WixAdapter implementing PlatformAdapter |
| 2 | 891c463 | feat(31-01): add SquarespaceAdapter and WebflowAdapter |
| 3 | a9d2114 | feat(31-01): wire Wix, Squarespace, Webflow adapters into ConnectionService |

## Files Changed

### Created
- `open-seo-main/src/server/features/connections/adapters/WixAdapter.ts` (116 lines)
- `open-seo-main/src/server/features/connections/adapters/SquarespaceAdapter.ts` (125 lines)
- `open-seo-main/src/server/features/connections/adapters/WebflowAdapter.ts` (127 lines)

### Modified
- `open-seo-main/src/server/features/connections/adapters/BaseAdapter.ts` - Added WixAdapterConfig, SquarespaceAdapterConfig, WebflowAdapterConfig interfaces
- `open-seo-main/src/server/features/connections/adapters/index.ts` - Added exports for all 3 new adapters and config types
- `open-seo-main/src/server/features/connections/services/ConnectionService.ts` - Added imports and switch cases for wix, squarespace, webflow

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

```
pnpm vitest run src/server/features/connections/adapters

 Test Files  2 passed (2)
      Tests  25 passed (25)
   Duration  274ms
```

All existing adapter tests pass. New adapters follow the same pattern and are verified by:
- grep confirming `class WixAdapter implements PlatformAdapter`
- grep confirming `class SquarespaceAdapter implements PlatformAdapter`
- grep confirming `class WebflowAdapter implements PlatformAdapter`
- 5 total adapter files with PlatformAdapter implementation
- 3 new cases in ConnectionService.createAdapter()

## Security Notes

- All adapters return generic error messages (T-31-01 mitigation)
- Credentials remain encrypted in database; adapters only receive decrypted values via ConnectionService.getConnectionWithAdapter()
- No new network endpoints exposed (adapters are internal to server-side code)

## Self-Check: PASSED

- [x] WixAdapter.ts exists and implements PlatformAdapter
- [x] SquarespaceAdapter.ts exists and implements PlatformAdapter
- [x] WebflowAdapter.ts exists and implements PlatformAdapter
- [x] All 3 config interfaces added to BaseAdapter.ts
- [x] All 3 adapters exported from index.ts
- [x] ConnectionService.createAdapter() handles all 5 platforms
- [x] Commit eb4cdcc exists
- [x] Commit 891c463 exists
- [x] Commit a9d2114 exists

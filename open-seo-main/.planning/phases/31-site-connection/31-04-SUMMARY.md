---
phase: 31-site-connection
plan: 04
subsystem: connections-ui
tags: [ui, wizard, tanstack-router, react-query]
dependency_graph:
  requires: [31-02, 31-03]
  provides: [connection-wizard, connection-crud-api]
  affects: [client-dashboard]
tech_stack:
  added: []
  patterns: [tanstack-server-functions, react-query-mutations, multi-step-wizard]
key_files:
  created:
    - src/serverFunctions/connections.ts
    - src/serverFunctions/connections.test.ts
    - src/client/components/connections/ConnectionWizard.tsx
    - src/client/components/connections/PlatformSelector.tsx
    - src/client/components/connections/WordPressCredentialForm.tsx
    - src/client/components/connections/ShopifyOAuthButton.tsx
    - src/client/components/connections/ConnectionStatus.tsx
    - src/client/components/connections/index.ts
    - src/routes/_app/clients/$clientId/connections/index.tsx
    - src/routes/_app/clients/$clientId/connections/new.tsx
  modified: []
decisions:
  - "Server functions use Zod validation with middleware auth"
  - "Wizard uses 4-step state machine: DETECT -> CREDENTIALS -> VERIFYING -> COMPLETE"
  - "Shopify OAuth is placeholder only - not implemented"
metrics:
  duration: "prior session"
  completed: "2026-04-22"
---

# Phase 31 Plan 04: Connection Wizard UI Summary

Multi-step connection wizard with platform detection, credential forms, and CRUD server functions.

## One-liner

Connection wizard with platform auto-detection, WordPress credential form, and TanStack server functions for CRUD operations.

## What Was Built

### Server Functions (src/serverFunctions/connections.ts)

- `detectPlatformFn` - Detect platform from domain with confidence scoring
- `createConnectionFn` - Create connection with encrypted credentials
- `verifyConnectionFn` - Verify connection and update status
- `getConnectionsFn` - List connections for a client
- `deleteConnectionFn` - Remove a connection
- `getConnectionFn` - Get single connection by ID

All functions use:
- Zod input validation
- `requireAuthenticatedContext` middleware
- Client access verification (T-31-16)
- Never return decrypted credentials (T-31-15)

### UI Components (src/client/components/connections/)

| Component | Purpose |
|-----------|---------|
| ConnectionWizard | 4-step wizard: DETECT -> CREDENTIALS -> VERIFYING -> COMPLETE |
| PlatformSelector | Domain input with auto-detection and manual override |
| WordPressCredentialForm | Username + App Password form with help link |
| ShopifyOAuthButton | Placeholder OAuth button (not implemented) |
| ConnectionStatus | Status badge with last verified timestamp |

### Routes (src/routes/_app/clients/$clientId/connections/)

- `index.tsx` - Connections list with test/delete actions
- `new.tsx` - New connection wizard page

## Commits

| Hash | Message |
|------|---------|
| 0602ee5 | feat(31-04): add connection server functions with Zod validation |
| 1966501 | feat(31-04): add connection wizard UI components |
| c3f40cc | feat(31-04): add connection wizard routes and AlertDialog |
| efa3d8f | fix(31-04): resolve build errors in connection UI |
| af4cd76 | feat(31-04): add connection CRUD API routes |

## Test Results

```
src/serverFunctions/connections.test.ts (21 tests) - PASSED
```

Tests cover:
- Input validation for all server functions
- Domain detection flow
- Connection creation with credential encryption
- Client access verification
- Credentials never in responses

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] Server functions created with Zod validation
- [x] ConnectionWizard component with 4 steps
- [x] Platform detection works and shows confidence
- [x] WordPress credential form submits correctly
- [x] Connection verification runs after credential submit
- [x] Routes render correctly
- [x] Credentials never appear in browser network responses
- [x] All tests pass: 21/21

## Self-Check: PASSED

Files verified:
- FOUND: src/serverFunctions/connections.ts
- FOUND: src/serverFunctions/connections.test.ts
- FOUND: src/client/components/connections/ConnectionWizard.tsx
- FOUND: src/client/components/connections/PlatformSelector.tsx
- FOUND: src/client/components/connections/WordPressCredentialForm.tsx
- FOUND: src/client/components/connections/ShopifyOAuthButton.tsx
- FOUND: src/client/components/connections/ConnectionStatus.tsx
- FOUND: src/routes/_app/clients/$clientId/connections/index.tsx
- FOUND: src/routes/_app/clients/$clientId/connections/new.tsx

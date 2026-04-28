---
phase: 31-site-connection
plan: 03
subsystem: adapters, services
tags: [wordpress, shopify, rest-api, graphql, credential-encryption]
dependency_graph:
  requires: [31-01]
  provides: [platform_adapters, connection_service]
  affects: [client_site_management, content_sync]
tech_stack:
  added: [nanoid]
  patterns: [adapter-pattern, factory-pattern, credential-isolation]
key_files:
  created:
    - src/server/features/connections/adapters/BaseAdapter.ts
    - src/server/features/connections/adapters/WordPressAdapter.ts
    - src/server/features/connections/adapters/WordPressAdapter.test.ts
    - src/server/features/connections/adapters/ShopifyAdapter.ts
    - src/server/features/connections/adapters/ShopifyAdapter.test.ts
    - src/server/features/connections/adapters/index.ts
    - src/server/features/connections/services/ConnectionService.ts
    - src/server/features/connections/services/ConnectionService.test.ts
  modified:
    - src/server/features/connections/index.ts
    - package.json
decisions:
  - "Adapter pattern for platform abstraction with PlatformAdapter interface"
  - "WordPress uses REST API v2 with Application Password (Basic Auth)"
  - "Shopify uses Admin GraphQL API with X-Shopify-Access-Token header"
  - "ConnectionService never returns decrypted credentials to callers"
  - "getConnectionWithAdapter is the only path to decrypted credentials"
metrics:
  duration_minutes: 7
  completed: "2026-04-22T14:13:30Z"
  tasks_completed: 4
  files_changed: 10
---

# Phase 31 Plan 03: Platform Adapters Summary

Platform adapters for WordPress and Shopify with ConnectionService for encrypted credential CRUD operations.

## What Was Built

### 1. PlatformAdapter Interface

`src/server/features/connections/adapters/BaseAdapter.ts`:
- `PlatformAdapter` interface with `verifyConnection()` and `testWritePermission()`
- `CapabilityResult` type with platform-specific capability flags
- `WordPressAdapterConfig` and `ShopifyAdapterConfig` types
- `AdapterFactory` type for dynamic adapter creation

### 2. WordPress Adapter

`src/server/features/connections/adapters/WordPressAdapter.ts` (214 lines):
- REST API v2 integration with Basic Auth (Application Password)
- `verifyConnection()` calls `/users/me` and detects capabilities
- `getPost(postId)` fetches with `?context=edit` for raw content
- `updatePost(postId, data)` sends POST to update posts
- `getPosts(params)` handles pagination with page/per_page/status params
- `testWritePermission()` checks for edit_posts capability

Authentication: `Authorization: Basic {base64(username:appPassword)}`

### 3. Shopify Adapter

`src/server/features/connections/adapters/ShopifyAdapter.ts` (247 lines):
- Admin GraphQL API integration
- `verifyConnection()` queries shop info to validate token
- `getProduct(id)` returns product with SEO fields
- `updateProductSeo(id, seo)` mutation for title/description
- Handles GraphQL errors and userErrors from mutations

Authentication: `X-Shopify-Access-Token: {accessToken}`

### 4. ConnectionService

`src/server/features/connections/services/ConnectionService.ts` (306 lines):
- `createConnection(input)` - encrypts credentials, inserts row
- `getConnection(id)` - returns connection with `hasCredentials` flag (no decrypted credentials)
- `getConnectionsForClient(clientId)` - list client connections
- `getConnectionWithAdapter(id)` - decrypts credentials, returns platform adapter
- `verifyConnection(id)` - calls adapter, updates status/capabilities in DB
- `updateStatus(id, status)` - manual status update
- `deleteConnection(id)` - remove connection

Security properties:
- Credentials encrypted with AES-256-GCM before storage (from 31-01)
- `stripCredentials()` removes encrypted field, adds `hasCredentials` flag
- Only `getConnectionWithAdapter()` decrypts - for server-side API calls only

## Test Coverage

70 tests passing across 5 test files:

| File | Tests | Description |
|------|-------|-------------|
| WordPressAdapter.test.ts | 11 | REST API, auth header, capabilities |
| ShopifyAdapter.test.ts | 14 | GraphQL, token auth, mutations |
| ConnectionService.test.ts | 14 | CRUD, encryption, adapter routing |
| CredentialEncryption.test.ts | 10 | AES-256-GCM round-trip |
| PlatformDetector.test.ts | 21 | Platform detection probes |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 773af91 | feat | Add PlatformAdapter interface and base types |
| 7523268 | feat | Add WordPressAdapter with TDD tests |
| db30aa8 | feat | Add ShopifyAdapter with TDD tests |
| 4052da2 | feat | Add ConnectionService with TDD tests |
| 6d7071b | chore | Update barrel exports and fix TypeScript types |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed WPPostUpdateInput type**
- **Found during:** TypeScript verification
- **Issue:** `updatePost` parameter type was incompatible with string inputs
- **Fix:** Created separate `WPPostUpdateInput` interface with string fields
- **Files modified:** WordPressAdapter.ts
- **Commit:** 6d7071b

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-31-10 | Mitigated | `stripCredentials()` removes `encryptedCredentials` field |
| T-31-11 | Mitigated | HTTPS enforced; credentials in header not URL |
| T-31-12 | Mitigated | `encryptCredential()` called in `createConnection()` |
| T-31-13 | Mitigated | Switch statement with explicit platform cases; throws for unsupported |
| T-31-14 | Accepted | No timeout implemented (MVP scope) |

## Verification

```bash
# All adapter tests
pnpm test src/server/features/connections/adapters/
# 25 passed

# ConnectionService tests
pnpm test src/server/features/connections/services/ConnectionService.test.ts
# 14 passed

# Full connections feature
pnpm test src/server/features/connections/
# 70 passed

# TypeScript
pnpm tsc --noEmit | grep connections
# No errors
```

## Self-Check: PASSED

- [x] src/server/features/connections/adapters/BaseAdapter.ts exists (108 lines)
- [x] src/server/features/connections/adapters/WordPressAdapter.ts exists (214 lines)
- [x] src/server/features/connections/adapters/ShopifyAdapter.ts exists (247 lines)
- [x] src/server/features/connections/services/ConnectionService.ts exists (306 lines)
- [x] Commit 773af91 exists
- [x] Commit 7523268 exists
- [x] Commit db30aa8 exists
- [x] Commit 4052da2 exists
- [x] Commit 6d7071b exists
- [x] All 70 tests passing

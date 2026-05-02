---
phase: 61-platform-integration
plan: 01
subsystem: open-seo-main/db, open-seo-main/server/features
tags:
  - oauth
  - encryption
  - database
  - security
dependency_graph:
  requires: []
  provides:
    - platformConnections table
    - oauthStates table
    - platformDataCache table
    - OAuthProvider interface
    - TokenEncryption service
  affects:
    - open-seo-main/src/db/schema.ts
tech_stack:
  added:
    - drizzle-orm schema extensions
  patterns:
    - AES-256-GCM token encryption (reusing P54 pattern)
    - TDD for schema and encryption tests
key_files:
  created:
    - open-seo-main/src/db/platform-connection-schema.ts
    - open-seo-main/src/db/platform-connection-schema.test.ts
    - open-seo-main/src/db/oauth-state-schema.ts
    - open-seo-main/src/db/oauth-state-schema.test.ts
    - open-seo-main/src/db/platform-data-cache-schema.ts
    - open-seo-main/src/db/platform-data-cache-schema.test.ts
    - open-seo-main/src/server/features/platform-oauth/types.ts
    - open-seo-main/src/server/features/platform-oauth/OAuthProviderBase.ts
    - open-seo-main/src/server/features/platform-oauth/TokenEncryption.ts
    - open-seo-main/src/server/features/platform-oauth/TokenEncryption.test.ts
    - open-seo-main/src/server/features/platform-oauth/index.ts
    - open-seo-main/drizzle/0061_platform_connections.sql
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - Token encryption reuses PAYMENT_ENCRYPTION_KEY from P54 (both require same protection level)
  - OAuth state expiry set to 10 minutes per DESIGN.md
  - prospectId is nullable on platformConnections to allow workspace-level Google connections
metrics:
  duration_seconds: 428
  completed: 2026-05-02T16:39:40Z
  tests_passing: 65
  files_created: 12
  files_modified: 1
---

# Phase 61 Plan 01: Platform OAuth Schema Summary

Database schema and encryption infrastructure for OAuth platform connections with 15+ platforms.

## One-Liner

Created Drizzle schemas for OAuth tokens with AES-256-GCM encryption, CSRF state management, and platform data caching.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Platform connections schema | 35f41e776 | platform-connection-schema.ts, oauth-state-schema.ts, platform-data-cache-schema.ts |
| 2 | OAuthProvider interface and TokenEncryption | fe63a6899 | OAuthProviderBase.ts, TokenEncryption.ts, types.ts |
| 3 | Database migration | 68783ba10 | 0061_platform_connections.sql, schema.ts |

## Implementation Details

### Platform Connections Schema

- **platformConnections table**: 25 columns for OAuth tokens, credentials, sync tracking, and audit
- **15 OAuth platforms**: Google (GSC, GA, GBP), WordPress, Shopify, Wix, Squarespace, Webflow, HubSpot, BigCommerce, Magento, Drupal, Ghost, Bing
- **6 connection statuses**: pending, connecting, active, expired, revoked, error
- **3 credential types**: oauth, app_password, api_key
- **4 sync schedules**: hourly, daily, weekly, manual
- **Indexes**: workspace/prospect composite, status, token expiry

### OAuth State Schema

- **oauthStates table**: CSRF protection with unique state parameter
- **10-minute expiry**: States auto-expire for security
- **Usage tracking**: usedAt timestamp marks consumed states

### Platform Data Cache Schema

- **platformDataCache table**: Caches fetched platform data with expiry
- **Data types**: search_queries, pages, products, traffic, etc.
- **Expiry-based invalidation**: fetchedAt and expiresAt timestamps

### OAuthProvider Interface

- **Abstract interface**: getAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken, revokeToken
- **OAuthProviderBase class**: Helper methods for URL building and token requests
- **Type-safe platforms**: OAuthPlatform union type matching schema

### TokenEncryption Service

- **Reuses P54 encryption**: AES-256-GCM from encryption.ts
- **Token-specific exports**: encryptToken, decryptToken, encryptTokenSafe, decryptTokenSafe
- **Same key**: PAYMENT_ENCRYPTION_KEY (OAuth tokens need equivalent protection)

## Test Coverage

- **49 schema tests**: Column types, defaults, constraints, type exports
- **16 encryption tests**: Roundtrip, tamper detection, null handling, unicode, 4KB tokens
- **Total: 65 tests passing**

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] platformConnections table schema matches DESIGN.md specification
- [x] oauthStates table has unique state column and 10-min expiry field
- [x] TokenEncryption tests pass (encrypt/decrypt roundtrip)
- [x] Migration generated successfully (0061_platform_connections.sql)
- [x] Schema exports added to db/schema.ts

## Self-Check: PASSED

All created files exist and all commits are present in git history.

## Next Steps

- 61-02: Implement Google OAuth provider (GSC, GA, GBP)
- 61-03: Implement Shopify and Wix OAuth providers

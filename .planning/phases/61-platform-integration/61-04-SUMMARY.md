---
phase: 61-platform-integration
plan: 04
subsystem: platform-oauth
tags: [wordpress, app-password, oauth, api, service]
dependency_graph:
  requires: [61-01]
  provides:
    - WordPressAppPasswordProvider
    - WordPressService
    - PlatformConnectionService
    - WordPress API routes
  affects: [settings/connections, prospect-intake]
tech_stack:
  added: []
  patterns: [basic-auth, encrypted-credentials, unified-service]
key_files:
  created:
    - open-seo-main/src/server/features/platform-oauth/providers/WordPressAppPasswordProvider.ts
    - open-seo-main/src/server/features/platform-oauth/providers/WordPressAppPasswordProvider.test.ts
    - open-seo-main/src/server/features/platform-oauth/services/WordPressService.ts
    - open-seo-main/src/server/features/platform-oauth/PlatformConnectionService.ts
    - open-seo-main/src/server/features/platform-oauth/PlatformConnectionService.test.ts
    - apps/web/src/app/api/connections/wordpress/validate/route.ts
    - apps/web/src/app/api/connections/wordpress/connect/route.ts
  modified:
    - open-seo-main/src/server/features/platform-oauth/providers/index.ts
    - open-seo-main/src/server/features/platform-oauth/services/index.ts
decisions:
  - WordPress credentials validated via /wp-json/wp/v2/users/me per D-14
  - Credentials stored as encrypted JSON with credentialType app_password per D-15
  - PlatformConnectionService unifies OAuth and non-OAuth connection management
metrics:
  duration_seconds: 240
  completed: 2026-05-02T16:46:30Z
  tests_passing: 24
  files_created: 7
  files_modified: 2
---

# Phase 61 Plan 04: WordPress App Passwords Summary

WordPress Application Passwords for self-hosted sites (38% market share) and unified PlatformConnectionService.

## One-Liner

WordPress App Password validation via REST API with unified PlatformConnectionService for both OAuth and credential-based connections.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | WordPressAppPasswordProvider (TDD) | 7065fa38c | WordPressAppPasswordProvider.ts, .test.ts |
| 2 | WordPress service and API routes | 4266b5a78 | WordPressService.ts, validate/route.ts, connect/route.ts |
| 3 | PlatformConnectionService (TDD) | f918ca0a2 | PlatformConnectionService.ts, .test.ts |

## Implementation Details

### WordPressAppPasswordProvider (Task 1)

- Validates credentials via `/wp-json/wp/v2/users/me` per D-14
- Basic auth header encoding for Application Passwords
- getSiteInfo() fetches site name/description (no auth required)
- isWordPressSite() checks REST API availability
- Handles 401/403 errors and network failures gracefully
- **13 unit tests passing**

### WordPressService (Task 2)

- Fetches posts, pages, categories, tags from WordPress REST API
- Supports Yoast SEO and RankMath meta fields (seoTitle, seoDescription, focusKeyword)
- getAllData() convenience method for complete data fetch

### API Routes (Task 2)

- **POST /api/connections/wordpress/validate**: Validates credentials, returns user info
- **POST /api/connections/wordpress/connect**: Stores connection with `credentialType: app_password`
- Both routes use Zod validation and Clerk auth

### PlatformConnectionService (Task 3)

- **createOAuthConnection()**: Stores encrypted OAuth tokens
- **createAppPasswordConnection()**: Stores encrypted credential JSON per D-15
- **getConnection()**: Returns connection without decrypted credentials
- **getOAuthTokens()**: Server-side token decryption
- **getAppPasswordCredentials()**: Server-side credential decryption
- **updateStatus()**, **updateTokens()**, **recordSync()**, **deleteConnection()** for lifecycle
- Singleton `platformConnectionService` export
- **11 unit tests passing**

## Test Coverage

- WordPressAppPasswordProvider: 13 tests
- PlatformConnectionService: 11 tests
- **Total: 24 tests passing**

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] WordPressAppPasswordProvider tests pass (13/13)
- [x] PlatformConnectionService tests pass (11/11)
- [x] Credential validation calls /wp-json/wp/v2/users/me
- [x] App password stored as encrypted JSON with credentialType: app_password
- [x] API routes validate input with Zod
- [x] PlatformConnectionService handles both OAuth and app password connections

## Self-Check: PASSED

All created files exist:
- [x] open-seo-main/src/server/features/platform-oauth/providers/WordPressAppPasswordProvider.ts
- [x] open-seo-main/src/server/features/platform-oauth/providers/WordPressAppPasswordProvider.test.ts
- [x] open-seo-main/src/server/features/platform-oauth/services/WordPressService.ts
- [x] open-seo-main/src/server/features/platform-oauth/PlatformConnectionService.ts
- [x] open-seo-main/src/server/features/platform-oauth/PlatformConnectionService.test.ts
- [x] apps/web/src/app/api/connections/wordpress/validate/route.ts
- [x] apps/web/src/app/api/connections/wordpress/connect/route.ts

All commits exist:
- [x] 7065fa38c
- [x] 4266b5a78
- [x] f918ca0a2

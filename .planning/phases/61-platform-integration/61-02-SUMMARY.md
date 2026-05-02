---
phase: 61-platform-integration
plan: 02
subsystem: platform-oauth
tags: [oauth, google, gsc, ga, gbp, api]
dependency_graph:
  requires: []
  provides: [GoogleOAuthProvider, GSC-service, GA-service, GBP-service, google-oauth-routes]
  affects: [settings/connections, prospect-intake]
tech_stack:
  added: []
  patterns: [oauth2-pkce-like, bearer-token-auth, state-csrf-protection]
key_files:
  created:
    - open-seo-main/src/server/features/platform-oauth/providers/GoogleOAuthProvider.ts
    - open-seo-main/src/server/features/platform-oauth/providers/GoogleOAuthProvider.test.ts
    - open-seo-main/src/server/features/platform-oauth/providers/index.ts
    - open-seo-main/src/server/features/platform-oauth/services/GoogleSearchConsoleService.ts
    - open-seo-main/src/server/features/platform-oauth/services/GoogleAnalyticsService.ts
    - open-seo-main/src/server/features/platform-oauth/services/GoogleBusinessProfileService.ts
    - open-seo-main/src/server/features/platform-oauth/services/index.ts
    - apps/web/src/app/api/oauth/google/authorize/route.ts
    - apps/web/src/app/api/oauth/google/callback/route.ts
  modified: []
decisions:
  - "Used TDD approach for GoogleOAuthProvider with 12 unit tests"
  - "OAuth always requests offline access with prompt=consent to ensure refresh tokens"
  - "Data services use direct Google API calls with Bearer token auth"
  - "API routes delegate token storage to backend via /api/oauth/connections"
metrics:
  duration: 6 minutes
  completed: 2026-05-02T16:40:00Z
---

# Phase 61 Plan 02: Google OAuth Provider Summary

Google OAuth 2.0 implementation with unified consent flow for GSC, GA, and GBP services.

## One-liner

Google OAuth provider with TDD tests, data fetching services for GSC/GA/GBP, and Next.js API routes for authorize/callback flow.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ee3f1577e | feat | GoogleOAuthProvider with TDD (12 tests) |
| 5544b3ce5 | feat | Google data fetching services (GSC, GA, GBP) |
| cd9b3df18 | feat | Next.js OAuth API routes for Google |

## What Was Built

### GoogleOAuthProvider (Task 1)

Implements `OAuthProvider` interface with:
- `getAuthorizationUrl()` - Builds Google consent URL with configurable services
- `exchangeCodeForTokens()` - Exchanges auth code for access/refresh tokens
- `refreshAccessToken()` - Refreshes expired access tokens
- `revokeToken()` - Revokes access or refresh tokens

Key design decisions:
- Always uses `access_type=offline` and `prompt=consent` per D-08 to ensure refresh tokens
- Supports selecting specific services (searchConsole, analytics, businessProfile)
- 12 comprehensive unit tests with mocked fetch

### Google Data Services (Task 2)

**GoogleSearchConsoleService:**
- `getSearchQueries()` - Fetches top queries with clicks, impressions, CTR, position
- `getPagePerformance()` - Fetches page-level performance data
- `getIndexStatus()` - Fetches sitemap-based index coverage
- `getAllData()` - Convenience method for complete GSC data

**GoogleAnalyticsService:**
- `getOverview()` - Sessions, users, pageviews, bounce rate, avg session duration
- `getTopPages()` - Top pages by pageviews with avg time
- `getTrafficSources()` - Traffic by source/medium with sessions
- `getAllData()` - Convenience method for complete GA4 data

**GoogleBusinessProfileService:**
- `getReviews()` - Business reviews with ratings and text
- `getInsights()` - Business views, searches, actions
- `getProfile()` - Business profile information
- `getAllData()` - Convenience method for complete GBP data

### Next.js OAuth Routes (Task 3)

**GET /api/oauth/google/authorize:**
- Validates Clerk authentication
- Generates CSRF state token (32-char nanoid)
- Stores state via backend with 10-minute expiry
- Redirects to Google consent screen

**GET /api/oauth/google/callback:**
- Validates state parameter against backend
- Checks expiration and single-use
- Exchanges code for tokens via Google OAuth endpoint
- Stores encrypted tokens via backend API
- Handles errors gracefully with redirect params

## Verification Results

- [x] GoogleOAuthProvider tests pass (12/12)
- [x] Authorization URL includes access_type=offline and prompt=consent
- [x] Callback validates state against database
- [x] Tokens stored via backend API (never logged)
- [x] API routes use Clerk auth

## Deviations from Plan

None - plan executed exactly as written.

## Dependencies for Integration

This plan creates the OAuth provider and services, but requires backend endpoints from plan 61-01:
- `POST /api/oauth/states` - Store state for CSRF validation
- `GET /api/oauth/states/:state` - Retrieve state for validation
- `POST /api/oauth/states/:id/mark-used` - Mark state as used
- `DELETE /api/oauth/states/:id` - Cleanup state after use
- `POST /api/oauth/connections` - Store encrypted tokens

## Self-Check: PASSED

All created files exist:
- [x] open-seo-main/src/server/features/platform-oauth/providers/GoogleOAuthProvider.ts
- [x] open-seo-main/src/server/features/platform-oauth/providers/GoogleOAuthProvider.test.ts
- [x] open-seo-main/src/server/features/platform-oauth/providers/index.ts
- [x] open-seo-main/src/server/features/platform-oauth/services/GoogleSearchConsoleService.ts
- [x] open-seo-main/src/server/features/platform-oauth/services/GoogleAnalyticsService.ts
- [x] open-seo-main/src/server/features/platform-oauth/services/GoogleBusinessProfileService.ts
- [x] open-seo-main/src/server/features/platform-oauth/services/index.ts
- [x] apps/web/src/app/api/oauth/google/authorize/route.ts
- [x] apps/web/src/app/api/oauth/google/callback/route.ts

All commits exist:
- [x] ee3f1577e
- [x] 5544b3ce5
- [x] cd9b3df18

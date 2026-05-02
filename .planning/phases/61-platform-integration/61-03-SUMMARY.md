---
phase: 61-platform-integration
plan: 03
subsystem: platform-oauth
tags: [oauth, shopify, wix, ecommerce, api]
dependency_graph:
  requires: [61-01]
  provides: [ShopifyOAuthProvider, WixOAuthProvider, ShopifyService, WixService, shopify-oauth-routes, wix-oauth-routes]
  affects: [settings/connections, prospect-intake]
tech_stack:
  added: []
  patterns: [shop-specific-oauth, permanent-tokens, graphql-rest-hybrid]
key_files:
  created:
    - open-seo-main/src/server/features/platform-oauth/providers/ShopifyOAuthProvider.ts
    - open-seo-main/src/server/features/platform-oauth/providers/ShopifyOAuthProvider.test.ts
    - open-seo-main/src/server/features/platform-oauth/providers/WixOAuthProvider.ts
    - open-seo-main/src/server/features/platform-oauth/providers/WixOAuthProvider.test.ts
    - open-seo-main/src/server/features/platform-oauth/services/ShopifyService.ts
    - open-seo-main/src/server/features/platform-oauth/services/WixService.ts
    - apps/web/src/app/api/oauth/shopify/authorize/route.ts
    - apps/web/src/app/api/oauth/shopify/callback/route.ts
    - apps/web/src/app/api/oauth/wix/authorize/route.ts
    - apps/web/src/app/api/oauth/wix/callback/route.ts
  modified: []
decisions:
  - Shopify tokens stored with MAX_SAFE_INTEGER expiresIn (permanent)
  - Shop domain validated against .myshopify.com pattern (T-61-07)
  - Wix uses standard OAuth 2.0 with refresh token support
  - ShopifyService uses GraphQL for products, REST for pages/redirects
metrics:
  duration: 4 minutes
  completed: 2026-05-02T16:46:00Z
---

# Phase 61 Plan 03: Shopify and Wix OAuth Summary

Shopify and Wix OAuth providers for e-commerce and website builder platform integrations.

## One-liner

ShopifyOAuthProvider with shop-specific URLs and permanent tokens, WixOAuthProvider with standard OAuth 2.0, plus data services and Next.js API routes.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 03195cd10 | feat | ShopifyOAuthProvider with shop-specific URLs |
| c56d24543 | feat | WixOAuthProvider with standard OAuth 2.0 |
| 2ee8ecac2 | feat | Shopify/Wix services and API routes |

## What Was Built

### ShopifyOAuthProvider (Task 1)

Implements `OAuthProvider` interface with shop-specific behavior:
- `getAuthorizationUrl()` - Builds `https://{shop}/admin/oauth/authorize` URL
- `exchangeCodeForTokens()` - POSTs to shop-specific token endpoint
- Shop domain validation: must match `.myshopify.com` pattern (T-61-07 mitigation)
- Tokens return `expiresIn: Number.MAX_SAFE_INTEGER` (Shopify tokens never expire)
- 12 TDD tests with mocked fetch

### WixOAuthProvider (Task 2)

Standard OAuth 2.0 implementation:
- `getAuthorizationUrl()` - Uses `wix.com/installer/install`
- `exchangeCodeForTokens()` - Calls `wixapis.com/oauth/access`
- `refreshAccessToken()` - Supports token refresh
- Scopes: WIX.SITE.READ, WIX.CONTACTS.READ, WIX.BLOG.READ
- 10 TDD tests with mocked fetch

### Data Services (Task 3)

**ShopifyService:**
- `getProducts()` - GraphQL query for products with SEO metadata
- `getCollections()` - GraphQL query for collections
- `getPages()` - REST API for store pages
- `getRedirects()` - REST API for URL redirects
- `getAllData()` - Convenience method for full SEO data

**WixService:**
- `getSiteInfo()` - Site display name and URL
- `getPages()` - Site pages
- `getBlogPosts()` - Blog posts with slugs
- `getAllData()` - Convenience method for full data

### API Routes (Task 3)

**Shopify:**
- `GET /api/oauth/shopify/authorize?shop=xxx` - Validates shop domain, stores state, redirects
- `GET /api/oauth/shopify/callback` - Validates state, exchanges code, stores permanent token

**Wix:**
- `GET /api/oauth/wix/authorize` - Standard OAuth redirect
- `GET /api/oauth/wix/callback` - Standard OAuth callback

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] ShopifyOAuthProvider handles shop-specific URLs
- [x] Shopify tokens stored without expiry (permanent)
- [x] WixOAuthProvider supports token refresh
- [x] Both platforms have authorize/callback routes
- [x] Data services can fetch products/pages from both platforms
- [x] X-Shopify-Access-Token header used for API calls

## Self-Check: PASSED

All created files exist:
- [x] ShopifyOAuthProvider.ts
- [x] ShopifyOAuthProvider.test.ts
- [x] WixOAuthProvider.ts
- [x] WixOAuthProvider.test.ts
- [x] ShopifyService.ts
- [x] WixService.ts
- [x] shopify/authorize/route.ts
- [x] shopify/callback/route.ts
- [x] wix/authorize/route.ts
- [x] wix/callback/route.ts

All commits verified in git log.

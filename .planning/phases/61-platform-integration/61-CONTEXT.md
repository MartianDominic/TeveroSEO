# Phase 61: Platform Integration Excellence — Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated from DESIGN.md

<domain>
## Phase Boundary

Implement OAuth for top 15 platforms with intelligent fallback, eliminating friction when prospects connect their websites.

**Core Capabilities:**
- OAuth 2.0 for Google (GSC, GA, GBP), Shopify, Wix, Squarespace, Webflow
- WordPress Application Passwords for self-hosted sites
- Encrypted token storage (AES-256-GCM)
- Token refresh worker (15-minute intervals)
- Universal fallback crawler with Playwright for JS-rendered sites
- Platform connection dashboard with sync status

**Key Constraint:** Read-only access only — no write permissions to any platform.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01:** `platform_connections` table with encrypted tokens, status enum, sync tracking
- **D-02:** `oauth_states` table for CSRF protection with 10-minute expiry
- **D-03:** `platform_data_cache` table for synced data with TTL
- **D-04:** Index on (workspace_id, prospect_id) and (status, token_expires_at)

### OAuth Architecture
- **D-05:** OAuthProvider interface with getAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken, revokeToken
- **D-06:** GoogleOAuthProvider handles GSC + GA + GBP with unified scopes
- **D-07:** ShopifyOAuthProvider with shop-specific authorization URLs
- **D-08:** access_type: 'offline' + prompt: 'consent' to always get refresh tokens

### Token Management
- **D-09:** AES-256-GCM encryption matching P54 PAYMENT_ENCRYPTION_KEY pattern
- **D-10:** Token format: iv:authTag:encrypted (hex encoded)
- **D-11:** Refresh worker runs every 15 minutes, targets tokens expiring in 30 minutes
- **D-12:** Failed refresh marks connection as 'error' status

### WordPress Integration
- **D-13:** Application Passwords via Basic auth header
- **D-14:** Validate credentials with /wp-json/wp/v2/users/me endpoint
- **D-15:** Store as credentialType: 'app_password' with encrypted JSON

### Fallback Crawler
- **D-16:** Check robots.txt before crawling
- **D-17:** Sitemap discovery in 5 common locations + robots.txt directive
- **D-18:** SPA detection via root/app div, __NEXT_DATA__, __NUXT__ indicators
- **D-19:** Playwright headless chromium for JS-rendered sites

### UI Components
- **D-20:** PlatformConnectionFlow with recommended/optional sections
- **D-21:** ConnectionStatusDashboard with sync status, last sync time
- **D-22:** Platform cards with Connect/Sync Now/Disconnect actions

### Claude's Discretion
- Loading states for OAuth redirect
- Error handling for failed token exchange
- Connection validation feedback
- Retry logic for failed syncs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Design
- `.planning/phases/61-platform-integration/DESIGN.md` — Full specification with schemas, OAuth flows

### Prior Art
- `open-seo-main/src/db/` — Drizzle schema patterns
- `open-seo-main/src/server/lib/` — Service patterns (stripe/, revolut/)
- `.planning/phases/54-multi-provider-payments/` — Token encryption pattern

### Existing Infrastructure
- `open-seo-main/src/server/workers/` — BullMQ worker patterns
- `open-seo-main/src/server/services/encryption.ts` — AES-256-GCM if exists
- `apps/web/src/components/` — UI component patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- AES-256-GCM encryption from P54 payment settings
- BullMQ worker patterns from existing workers
- Drizzle pgTable + relations pattern
- v6 design system tokens

### Established Patterns
- Service classes with static methods
- Environment variable validation at startup
- Factory pattern for provider selection

### Integration Points
- Prospect detail page → add connections panel
- Workspace settings → platform connections management
- Crawl system → fallback when no OAuth available

</code_context>

<specifics>
## Specific Ideas

- **One-click where possible**: Google OAuth handles multiple services in single consent
- **Clear data access**: Show exactly what data we'll access before connecting
- **Graceful degradation**: Always fall back to crawler if OAuth unavailable
- **Status transparency**: Show last sync time, error messages, connection health

</specifics>

<deferred>
## Deferred Ideas

- Write access to any platform
- Real-time webhooks from platforms
- Historical data beyond 90 days
- Platform-specific optimization recommendations
- Squarespace, Webflow, HubSpot OAuth (Tier 2/3 platforms)
- BigCommerce, Magento, Drupal, Ghost, Bing Webmaster (Tier 3)

</deferred>

---

*Phase: 61-platform-integration*
*Context gathered: 2026-05-02*

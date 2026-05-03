# Phase 66: Platform Unification Excellence — CONTEXT

**Generated:** 2026-05-03
**Source:** DESIGN.md, RESEARCH.md

---

## Goal

Enable ANY website to connect to TeveroSEO in under 2 minutes, regardless of technical skill level. Script-first, OAuth-as-enhancement.

## Core Architecture

### Integration Hierarchy

1. **TeveroPixel Script (PRIMARY)** - Copy-paste one line, works anywhere
2. **OAuth Enhancement (SECONDARY)** - 15+ CMS platforms for historical data + publishing
3. **API Integration (ADVANCED)** - Custom webhooks, headless CMS, enterprise SSO

### TeveroPixel Capabilities

| Feature | Auto | Requires Approval |
|---------|------|-------------------|
| Analytics (pageviews, sessions) | Yes | No |
| Core Web Vitals (LCP, CLS, INP) | Yes | No |
| Scroll depth tracking | Yes | No |
| Meta tag injection | - | Yes |
| Schema JSON-LD injection | - | Yes |
| Internal link injection | - | Yes |

### Script Snippet

```html
<script async src="https://pixel.tevero.io/t.js" data-site="SITE_ID"></script>
```

## Key Technical Decisions

1. **Script-first, OAuth-second** - Inverse of Phase 61's approach
2. **< 5KB gzipped** - Non-blocking async load
3. **MutationObserver for SPA** - Handle React/Vue/Angular navigation
4. **Navigator.sendBeacon** - Reliable analytics even on page leave
5. **Dashboard approval** - DOM mutations require explicit approval

## OAuth Tiers (15 platforms)

| Tier | Platforms | Priority |
|------|-----------|----------|
| Critical | WordPress, Shopify, Wix, GSC, GA4 | P0-P1 |
| E-commerce | WooCommerce, BigCommerce, Magento | P1-P2 |
| Headless | Webflow, Contentful, Sanity, Ghost | P2 |

## Database Schema

```typescript
// site_connections table
interface SiteConnection {
  id: string;
  workspaceId: string;
  siteUrl: string;
  pixelInstalled: boolean;
  pixelFirstSeen: Date | null;
  oauthConnections: OAuthConnection[];
  cmsType: string | null;
}
```

## Dependencies

- **Phase 61:** OAuth foundation (reuse OAuthConnection table)
- **Phase 31/33:** CMS adapters (unified via facade)
- **Phase 39:** Publishers (publishing facade)
- **Phase 64:** Crawling infrastructure (fallback data collection)

## Success Criteria

1. Script snippet < 5KB, loads in < 100ms
2. Non-technical users complete setup in < 2 minutes
3. 14 CMS platforms supported with platform-specific guides
4. Real-time verification detects pixel in < 5 seconds
5. OAuth enhancement available for 15 platforms

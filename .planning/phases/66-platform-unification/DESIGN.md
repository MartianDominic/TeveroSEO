# Phase 66: Platform Unification Excellence — DESIGN

**Version:** 1.0
**Created:** 2026-05-02
**Status:** Ready for Planning

---

## 1. Goal

Enable ANY website to connect to TeveroSEO in under 2 minutes, regardless of technical skill level. Provide the simplest possible integration with progressive enhancement for power users.

**Core Principle:** Script-first, OAuth-as-enhancement.

---

## 2. Problem Statement

### Current State
- Phase 61 implemented OAuth-first approach (requires API credentials)
- Most prospects/clients are non-technical (marketing managers, business owners)
- OAuth setup requires developer involvement for most platforms
- No simple "just paste this" option exists
- Write capabilities scattered across Phase 31/33 (adapters) and Phase 39 (publishers)

### Target State
- One-line script snippet works on ANY website
- Non-technical users can install in 2 minutes
- Technical users get OAuth for enhanced features
- Unified facade bridges all existing systems

---

## 3. Solution Architecture

### Integration Hierarchy (Priority Order)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONNECTION METHODS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LEVEL 1: TeveroPixel Script (PRIMARY - works anywhere) │   │
│  │  • Copy-paste one line                                   │   │
│  │  • No credentials needed                                 │   │
│  │  • Real-time analytics                                   │   │
│  │  • DOM injection for SEO fixes                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LEVEL 2: OAuth (ENHANCEMENT - 15+ CMS platforms)       │   │
│  │  • Historical data (GSC rankings, GA traffic)           │   │
│  │  • Direct publishing (WordPress, Shopify, etc.)         │   │
│  │  • Schema/meta editing via API                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  LEVEL 3: API Integration (ADVANCED - developers only)  │   │
│  │  • Custom webhooks                                       │   │
│  │  • Headless CMS integration                             │   │
│  │  • Enterprise SSO                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. TeveroPixel Script System

### 4.1 Script Snippet

```html
<!-- TeveroSEO Pixel - Add to your website's <head> -->
<script async src="https://pixel.tevero.io/t.js" data-site="SITE_ID"></script>
```

**Size:** < 5KB gzipped
**Load:** Async, non-blocking
**Dependencies:** None

### 4.2 What the Pixel Does

| Capability | Description | Requires Approval? |
|------------|-------------|-------------------|
| **Analytics** | Pageviews, sessions, device, browser, referrer | No |
| **Core Web Vitals** | LCP, CLS, INP via web-vitals library | No |
| **Scroll Depth** | 25%, 50%, 75%, 100% milestones | No |
| **Click Tracking** | Links, buttons, CTAs | No |
| **Meta Injection** | Title, description, canonical (from dashboard) | Yes |
| **Schema Injection** | JSON-LD structured data (from dashboard) | Yes |
| **Internal Links** | Contextual link injection (from dashboard) | Yes |
| **A/B Testing** | Version rotation for titles/content | Yes |

### 4.3 Security Model

```typescript
interface PixelConfig {
  siteId: string;           // Unique per-site identifier
  workspaceId: string;      // Workspace scoping
  allowedOrigins: string[]; // Domain whitelist
  features: {
    analytics: boolean;     // Always on
    cwv: boolean;          // Always on
    metaInjection: boolean; // Requires dashboard approval
    schemaInjection: boolean;
    linkInjection: boolean;
    abTesting: boolean;
  };
  approvedChanges: Change[]; // Only approved changes execute
}
```

### 4.4 Pixel Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT BROWSER                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐     ┌────────────────────────────────┐  │
│  │  t.js (5KB)    │────▶│  Fetch config from API         │  │
│  │  Loader        │     │  https://api.tevero.io/pixel/  │  │
│  └────────────────┘     └────────────────────────────────┘  │
│         │                          │                         │
│         ▼                          ▼                         │
│  ┌────────────────┐     ┌────────────────────────────────┐  │
│  │  Analytics     │     │  DOM Mutations (if approved)   │  │
│  │  Module        │     │  - Meta tags                   │  │
│  │  - pageview    │     │  - Schema JSON-LD              │  │
│  │  - scroll      │     │  - Internal links              │  │
│  │  - clicks      │     │  - Content changes             │  │
│  │  - CWV         │     │  Uses MutationObserver for SPA │  │
│  └────────────────┘     └────────────────────────────────┘  │
│         │                          │                         │
│         ▼                          ▼                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Beacon to https://pixel.tevero.io/collect            │  │
│  │  (Navigator.sendBeacon for reliability)                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. User Journey: World-Class Onboarding

### 5.1 Flow Overview

```
[1] Enter Website URL
        │
        ▼
[2] Auto-Detect CMS ──────────────────┐
        │                              │
        ▼                              ▼
[3] "How would you like to connect?" ──┬── "I'll do it myself (2 min)"
        │                              │
        ├── "Send to my developer"     └── Platform-Specific Guide
        │         │                              │
        │         ▼                              ▼
        │   [Email with instructions]    [Copy snippet + paste]
        │         │                              │
        │         ▼                              ▼
        └────────────────────────────────▶ [4] Verify Installation
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                                    ▼                         ▼
                              [SUCCESS]                 [STUCK?]
                              "You're connected!"       "Need help?"
                                    │                         │
                                    ▼                         ▼
                              [5] Enhance with OAuth    [Developer Handoff]
```

### 5.2 Screen-by-Screen Design

#### Screen 1: Enter URL

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     Let's connect your website                                  │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  https://                                            │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│     Example: mywebsite.com                                      │
│                                                                 │
│                                    [ Continue → ]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 2: CMS Detection (Auto, 2-3 seconds)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     🔍 Checking your website...                                 │
│                                                                 │
│     ████████████░░░░░░░░                                        │
│                                                                 │
│     Found: Shopify                                              │
│     ✓ E-commerce platform detected                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 3: Connection Method Choice

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     How would you like to connect?                              │
│                                                                 │
│     ┌───────────────────────────────────────────────────────┐  │
│     │  🚀 I'll do it myself                                  │  │
│     │     Takes about 2 minutes. We'll guide you step by     │  │
│     │     step with pictures.                                │  │
│     │                                                        │  │
│     │     [ Start Setup → ]                                  │  │
│     └───────────────────────────────────────────────────────┘  │
│                                                                 │
│     ┌───────────────────────────────────────────────────────┐  │
│     │  📧 Send to my tech person                            │  │
│     │     We'll email them simple instructions. Usually      │  │
│     │     done in 30 seconds.                                │  │
│     │                                                        │  │
│     │     [ Send Instructions → ]                            │  │
│     └───────────────────────────────────────────────────────┘  │
│                                                                 │
│     ┌───────────────────────────────────────────────────────┐  │
│     │  🔑 I have developer access (OAuth)                   │  │
│     │     Connect directly via Shopify's app system for     │  │
│     │     extra features like publishing.                   │  │
│     │                                                        │  │
│     │     [ Connect with OAuth → ]                          │  │
│     └───────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 4a: DIY Path - Platform Guide (Shopify Example)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     Add TeveroSEO to your Shopify store                         │
│                                                                 │
│     Step 1 of 3                                                 │
│                                                                 │
│     ┌───────────────────────────────────────────────────────┐  │
│     │  1. Log into your Shopify admin                        │  │
│     │                                                        │  │
│     │  2. Click "Online Store" in the left menu              │  │
│     │                                                        │  │
│     │  3. Click "Themes"                                     │  │
│     │                                                        │  │
│     │  [📷 Screenshot showing where to click]                │  │
│     └───────────────────────────────────────────────────────┘  │
│                                                                 │
│     Stuck? [ Watch Video ] or [ Chat with us ]                  │
│                                                                 │
│     [ ← Back ]                          [ I did this → ]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Step 2:
"Click the three dots (⋯) next to your theme, then 'Edit code'"
[Screenshot]

Step 3:
"Find 'theme.liquid' in the left sidebar. Click it."
"Paste this line right after <head>:"

┌─────────────────────────────────────────────────────────────────┐
│  <script async src="https://pixel.tevero.io/t.js"              │
│    data-site="abc123"></script>                                │
│                                              [ Copy 📋 ]        │
└─────────────────────────────────────────────────────────────────┘

"Click Save. That's it!"
```

#### Screen 4b: Developer Handoff

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     Send instructions to your developer                         │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  Their email address                                 │    │
│     │  developer@company.com                               │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  Optional message                                    │    │
│     │  Hey! Can you add this to our site? Should take      │    │
│     │  30 seconds. Thanks!                                 │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│                                    [ Send Email → ]             │
│                                                                 │
│     Preview of email:                                           │
│     ─────────────────                                           │
│     Subject: Add TeveroSEO to mywebsite.com (30 seconds)        │
│                                                                 │
│     Hi,                                                         │
│                                                                 │
│     [Name] has asked you to add TeveroSEO tracking to           │
│     mywebsite.com. Here's all you need:                         │
│                                                                 │
│     Add this line to the <head> of your site:                   │
│     <script async src="https://pixel.tevero.io/t.js"           │
│       data-site="abc123"></script>                              │
│                                                                 │
│     [ One-Click Install (magic link) ]                          │
│                                                                 │
│     That's it! Questions? Reply to this email.                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Screen 5: Verification (Real-Time)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     Waiting for your website to say hello...                    │
│                                                                 │
│     ◉ ◉ ◉ (pulsing dots)                                        │
│                                                                 │
│     When you've added the code, visit your website              │
│     in a new tab. We'll detect it automatically.                │
│                                                                 │
│     [ Open my website in new tab ↗ ]                            │
│                                                                 │
│     ─────────────────────────────────────────                   │
│                                                                 │
│     Taking longer than expected?                                │
│     • Make sure you saved the file                              │
│     • Try refreshing your website                               │
│     • Clear your browser cache                                  │
│                                                                 │
│     [ Check Manually ] or [ I need help ]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

SUCCESS STATE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     ✅ You're connected!                                        │
│                                                                 │
│     We just detected a visitor from San Francisco, CA           │
│     (That's probably you!)                                      │
│                                                                 │
│     Your first SEO insights will be ready in 24 hours.          │
│     Nothing else to do — go grab a coffee!                      │
│                                                                 │
│     ─────────────────────────────────────────                   │
│                                                                 │
│     Want more features?                                         │
│     Connect your Google Search Console for ranking data →       │
│                                                                 │
│     [ Go to Dashboard ]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Platform-Specific Guides

### 6.1 CMS Installation Matrix

| Platform | Method | Difficulty | Time | Paid Plan Required? |
|----------|--------|------------|------|---------------------|
| WordPress (self-hosted) | Plugin OR theme.php | Easy | 2 min | No |
| WordPress.com | Settings > Advanced | Medium | 3 min | Business ($25/mo) |
| Shopify | Theme code editor | Easy | 2 min | No |
| Wix | Settings > Custom Code | Easy | 2 min | Premium |
| Squarespace | Settings > Code Injection | Easy | 2 min | Business ($23/mo) |
| Webflow | Project Settings > Custom Code | Easy | 2 min | No |
| Weebly | Settings > SEO > Header Code | Easy | 2 min | No |
| GoDaddy | Settings > Site-wide | Medium | 3 min | Varies |
| HubSpot CMS | Settings > Website > Pages | Easy | 2 min | Professional ($400/mo) |
| Ghost | Settings > Code Injection | Easy | 2 min | No |
| BigCommerce | Storefront > Script Manager | Easy | 2 min | No |
| WooCommerce | Same as WordPress | Easy | 2 min | No |
| Magento | Content > Design > Config | Hard | 5 min | Developer recommended |
| Custom HTML | Edit HTML file | Easy | 1 min | N/A |

### 6.2 Universal Workaround: Google Tag Manager

For ANY platform that supports GTM:
1. Create GTM container (if not exists)
2. Add TeveroSEO as Custom HTML tag
3. Trigger: All Pages
4. Publish container

---

## 7. OAuth Enhancement Layer (15 CMS Platforms)

### 7.1 Supported Platforms

| Platform | Auth Type | READ | WRITE | Priority |
|----------|-----------|------|-------|----------|
| **Tier 1: Critical** |
| WordPress | App Password / OAuth 2.0 | Posts, pages, media | Create/edit posts, SEO fields | P0 |
| Shopify | OAuth 2.0 | Products, pages, blog | Create products, edit SEO, redirects | P0 |
| Wix | OAuth 2.0 | Content, blog | Create/edit content | P1 |
| **Tier 2: High Value** |
| Google Search Console | OAuth 2.0 | Rankings, crawl errors | Submit URLs, sitemaps | P0 |
| Google Analytics 4 | OAuth 2.0 | Traffic, conversions | - (read-only) | P1 |
| Google Business Profile | OAuth 2.0 | Reviews, insights | Reply to reviews, post updates | P1 |
| **Tier 3: E-commerce** |
| WooCommerce | OAuth 1.0a | Products, orders | Create/edit products | P1 |
| BigCommerce | OAuth 2.0 | Products, catalog | Create products, SEO fields | P2 |
| Magento | Token | Products, categories | Create/edit products | P2 |
| **Tier 4: Headless CMS** |
| Webflow | OAuth 2.0 | CMS items | Create/edit items | P2 |
| Contentful | OAuth 2.0 | Entries, assets | Create/edit entries | P2 |
| Sanity | Token | Documents | Create/edit documents | P2 |
| Ghost | Admin API | Posts, pages | Create/edit posts | P2 |
| Strapi | JWT | Content types | Full CRUD | P3 |
| HubSpot CMS | OAuth 2.0 | Pages, blog | Create/edit pages | P2 |

### 7.2 OAuth Scopes

```typescript
const OAUTH_SCOPES = {
  wordpress: {
    read: ['read'],
    write: ['edit_posts', 'edit_pages', 'upload_files']
  },
  shopify: {
    read: ['read_products', 'read_content', 'read_themes'],
    write: ['write_products', 'write_content', 'write_themes']
  },
  google_search_console: {
    read: ['webmasters.readonly'],
    write: ['webmasters'] // URL submission
  },
  google_analytics: {
    read: ['analytics.readonly']
    // No write scopes - read-only API
  },
  google_business_profile: {
    read: ['business.manage'], // Also enables write
    write: ['business.manage']
  },
  wix: {
    read: ['WIX.SITE.READ', 'WIX.BLOG.READ'],
    write: ['WIX.BLOG.CREATE-DRAFT', 'WIX.BLOG.PUBLISH-POST']
  }
};
```

---

## 8. Unified Platform Facade

### 8.1 Architecture

```typescript
// PlatformIntegrationFacade - bridges all existing systems
class PlatformIntegrationFacade {
  // CONNECTION STATUS
  async getConnectionStatus(siteId: string): Promise<ConnectionStatus>;
  async getAvailableIntegrations(siteId: string): Promise<Integration[]>;
  
  // READ OPERATIONS (Phase 61 OAuth)
  async getAnalytics(siteId: string, type: 'gsc' | 'ga' | 'gbp'): Promise<Analytics>;
  async getContent(siteId: string, platform: Platform): Promise<Content[]>;
  
  // WRITE OPERATIONS (Phase 31/33 Adapters)
  async updateSeoField(siteId: string, resourceId: string, field: SeoField, value: string): Promise<Result>;
  async createRedirect(siteId: string, from: string, to: string): Promise<Result>;
  
  // PUBLISH OPERATIONS (Phase 39 CMS Publishers)
  async publishContent(siteId: string, content: Content): Promise<Result>;
  async scheduleContent(siteId: string, content: Content, publishAt: Date): Promise<Result>;
  
  // PIXEL OPERATIONS (New in Phase 66)
  async getPixelStatus(siteId: string): Promise<PixelStatus>;
  async getPixelAnalytics(siteId: string, range: DateRange): Promise<PixelAnalytics>;
  async queueDomChange(siteId: string, change: DomChange): Promise<Result>;
  async approveDomChange(changeId: string): Promise<Result>;
}
```

### 8.2 Integration with Existing Systems

```
                    ┌─────────────────────────────────┐
                    │  PlatformIntegrationFacade      │
                    │  (Phase 66 - NEW)               │
                    └───────────────┬─────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Phase 61       │      │  Phase 31/33    │      │  Phase 39       │
│  OAuth Services │      │  Write Adapters │      │  CMS Publishers │
│                 │      │                 │      │                 │
│  • GSC Service  │      │  • WordPress    │      │  • WordPress    │
│  • GA Service   │      │  • Shopify      │      │  • Shopify      │
│  • GBP Service  │      │  • Wix          │      │  • Wix          │
│  • Shopify Svc  │      │  • Webflow      │      │  • Webhook      │
│  • Wix Service  │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 9. Copy & Language (5th-8th Grader Level)

### 9.1 Words to AVOID

| Avoid | Use Instead |
|-------|-------------|
| script | helper, tiny helper |
| code | instructions |
| snippet | piece |
| header / head | top of your website |
| HTML | (skip - just say "paste it") |
| tag | helper, tracker |
| embed | add, put |
| implement | set up, connect |
| deploy | turn on |
| DOM | (never use) |
| pixel | helper, tracker |
| JavaScript | (skip - just say "helper") |

### 9.2 Key Copy Blocks

**Headline Options:**
- "Let's connect your website" ✓
- "Add a tiny helper to your website"
- "Connect in 2 minutes"

**Reassurance:**
- "This is completely safe. It just watches traffic — it can't change anything without your permission."
- "Thousands of businesses use this every day."
- "You can remove it anytime with one click."

**DIY Encouragement:**
- "This takes about 2 minutes."
- "We'll guide you step by step with pictures."
- "No coding required — just copy and paste."

**Developer Handoff:**
- "Send this to your tech person"
- "Usually done in 30 seconds"
- "We'll email them simple instructions"

**Success Message:**
- "You're connected!"
- "We just detected a visitor from [location] — that's probably you!"
- "Your first insights will be ready in 24 hours."

**Error/Stuck Message:**
- "Hmm, we can't see the helper yet."
- "This usually means it needs a few more minutes."
- "Want us to take a look? [Chat with us]"

---

## 10. Database Schema

### 10.1 New Tables

```sql
-- Pixel installations
CREATE TABLE pixel_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  
  -- Installation status
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'detected' | 'verified' | 'error'
  
  -- Detection tracking
  first_ping_at TIMESTAMP,
  last_ping_at TIMESTAMP,
  ping_count INTEGER DEFAULT 0,
  
  -- Config
  features JSONB DEFAULT '{"analytics": true, "cwv": true}',
  allowed_origins TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Approved DOM changes (for SEO modifications via pixel)
CREATE TABLE pixel_dom_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES pixel_installations(id),
  
  -- Change details
  change_type TEXT NOT NULL,
  -- 'meta_title' | 'meta_description' | 'canonical' | 'schema' | 'internal_link' | 'content'
  
  target_selector TEXT,
  target_url TEXT, -- For page-specific changes
  old_value TEXT,
  new_value TEXT,
  
  -- Approval
  status TEXT DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'live' | 'rolled_back'
  
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  -- Deployment
  deployed_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pixel analytics (aggregated)
CREATE TABLE pixel_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES pixel_installations(id),
  date DATE NOT NULL,
  
  -- Metrics
  pageviews INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page NUMERIC(10,2),
  bounce_rate NUMERIC(5,2),
  
  -- Core Web Vitals (aggregates)
  lcp_p75 NUMERIC(10,2),
  cls_p75 NUMERIC(10,4),
  inp_p75 NUMERIC(10,2),
  
  -- Top pages (JSONB for flexibility)
  top_pages JSONB,
  
  UNIQUE(installation_id, date)
);

-- Developer handoff tracking
CREATE TABLE developer_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id),
  
  -- Recipient
  developer_email TEXT NOT NULL,
  developer_name TEXT,
  
  -- Status
  status TEXT DEFAULT 'sent',
  -- 'sent' | 'opened' | 'completed' | 'expired'
  
  -- Magic link
  magic_link_token TEXT UNIQUE,
  magic_link_expires_at TIMESTAMP,
  
  -- Tracking
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Reminders
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP
);
```

---

## 11. API Endpoints

### 11.1 Pixel Endpoints

```typescript
// Generate pixel script for site
GET /api/pixel/:siteId/script
Response: { script: '<script...>', siteId, features }

// Receive pixel pings
POST /api/pixel/collect
Body: { siteId, event, data, timestamp }

// Get pixel status
GET /api/pixel/:siteId/status
Response: { status, firstPing, lastPing, pingCount }

// Queue DOM change
POST /api/pixel/:siteId/changes
Body: { type, selector, url, newValue }

// Approve/reject change
PATCH /api/pixel/changes/:changeId
Body: { action: 'approve' | 'reject' }
```

### 11.2 Connection Wizard Endpoints

```typescript
// Detect CMS from URL
POST /api/connect/detect
Body: { url }
Response: { platform, confidence, features }

// Generate installation guide
GET /api/connect/guide/:platform
Response: { steps: Step[], screenshots: string[] }

// Send developer handoff
POST /api/connect/handoff
Body: { siteId, email, message }
Response: { handoffId, magicLink }

// Verify installation
POST /api/connect/verify
Body: { siteId }
Response: { status, firstPing, location }
```

---

## 12. Success Criteria

### 12.1 User Experience

| Metric | Target |
|--------|--------|
| Time to first connection (DIY) | < 2 minutes |
| Time to first connection (Developer) | < 24 hours |
| Verification detection time | < 10 seconds |
| Onboarding completion rate | > 80% |
| DIY success rate | > 70% |

### 12.2 Technical

| Metric | Target |
|--------|--------|
| Pixel script size | < 5KB gzipped |
| Pixel load time | < 100ms |
| API response time (collect) | < 50ms p99 |
| Platform detection accuracy | > 95% |
| OAuth connection success | > 90% |

### 12.3 Coverage

| Platform | Connection Method |
|----------|-------------------|
| Any website | TeveroPixel ✓ |
| WordPress | Pixel + OAuth |
| Shopify | Pixel + OAuth |
| Wix | Pixel + OAuth |
| Squarespace | Pixel only |
| Webflow | Pixel + OAuth |
| BigCommerce | Pixel + OAuth |
| Custom HTML | Pixel only |
| GTM-enabled | Pixel via GTM |

---

## 13. Wave Structure

### Wave 1: Pixel Foundation (Plans 66-01 to 66-03)

| Plan | Focus | Effort |
|------|-------|--------|
| 66-01 | Database schema + pixel script generation | 6h |
| 66-02 | Pixel collector endpoint + real-time verification | 8h |
| 66-03 | Platform detection + CMS-specific guides | 6h |

### Wave 2: Onboarding UX (Plans 66-04 to 66-06)

| Plan | Focus | Effort |
|------|-------|--------|
| 66-04 | Connection wizard UI (step-by-step) | 10h |
| 66-05 | Developer handoff flow + magic links | 6h |
| 66-06 | Verification UI + success/error states | 6h |

### Wave 3: Enhancement & Analytics (Plans 66-07 to 66-09)

| Plan | Focus | Effort |
|------|-------|--------|
| 66-07 | DOM change approval system | 8h |
| 66-08 | Pixel analytics dashboard | 8h |
| 66-09 | PlatformIntegrationFacade + OAuth enhancement prompts | 10h |

### Wave 4: Polish & i18n (Plans 66-10 to 66-11)

| Plan | Focus | Effort |
|------|-------|--------|
| 66-10 | i18n (EN + LT translations) | 4h |
| 66-11 | E2E tests + documentation | 6h |

**Total: 11 plans, ~78 hours**

---

## 14. Dependencies

### Required Before Phase 66

| Phase | Component | Reason |
|-------|-----------|--------|
| Phase 61 | OAuth services | Reuse for enhancement layer |
| Phase 31/33 | Write adapters | Reuse for SEO field writes |
| Phase 39 | CMS publishers | Reuse for content publishing |

### Phase 66 Enables

| Downstream | Benefit |
|------------|---------|
| All SEO features | Universal site connection |
| Phase 62 (Command Center) | More connected sites |
| Phase 63 (Keyword Intelligence) | Data from connected sites |

---

## 15. Out of Scope

- Custom pixel development for enterprise (Phase 67+)
- White-label pixel branding (deferred)
- Server-side tracking (deferred)
- A/B testing framework (deferred - only DOM injection)
- Mobile app SDKs (deferred)

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pixel blocked by ad blockers | Medium | Medium | Provide GTM fallback |
| AI crawlers don't see DOM changes | High | Medium | Document limitation, recommend SSR |
| Users can't find code injection settings | Medium | High | Platform-specific video guides |
| OAuth rate limits | Low | Medium | Implement backoff, queue writes |

---

*Phase: 66-platform-unification*
*Design version: 1.0*
*Created: 2026-05-02*

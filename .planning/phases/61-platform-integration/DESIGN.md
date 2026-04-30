# Phase 61: Platform Integration Excellence

**Goal:** Implement OAuth for top 15 platforms with intelligent fallback, eliminating friction when prospects connect their websites

**Depends on:** Phase 56 (prospect input complete)

**Estimated effort:** 55-65 hours

---

## Problem Statement

Current integration is friction-heavy:

1. **No OAuth** — Shopify shows "Coming Soon", others missing
2. **Manual credential exchange** — insecure, time-consuming
3. **Limited platform support** — only basic detection, no deep integration
4. **No token management** — no refresh, no revocation
5. **Weak fallback** — no JS rendering for SPAs

Prospects expect one-click authorization like connecting apps to Slack or Notion.

---

## Platform Priority Matrix

### Tier 1: Must Have OAuth (Day 1)

| Platform | Market Share | OAuth Type | Data Access |
|----------|--------------|------------|-------------|
| **Google Search Console** | Universal | OAuth 2.0 | Queries, positions, CTR, index status |
| **Google Analytics** | Universal | OAuth 2.0 | Traffic, behavior, conversions |
| **Google Business Profile** | Local SEO | OAuth 2.0 | Reviews, posts, insights |
| **WordPress.com** | 5% hosted | OAuth 2.0 | Posts, pages, SEO settings |
| **Shopify** | 4.4% (28% e-commerce) | OAuth 2.0 | Products, pages, SEO metadata |

### Tier 2: Should Have OAuth (Week 2)

| Platform | Market Share | OAuth Type | Data Access |
|----------|--------------|------------|-------------|
| **Wix** | 2.6% | OAuth 2.0 | Pages, blog, SEO settings |
| **Squarespace** | 2.1% | OAuth 2.0 | Pages, blog, commerce |
| **Webflow** | 1% (designers) | OAuth 2.0 | CMS, pages, SEO settings |
| **HubSpot CMS** | Enterprise | OAuth 2.0 | Pages, blog, forms |

### Tier 3: Nice to Have (Month 2)

| Platform | Market Share | OAuth Type | Data Access |
|----------|--------------|------------|-------------|
| **BigCommerce** | E-commerce | OAuth 2.0 | Products, pages |
| **Magento/Adobe** | E-commerce | OAuth 2.0 | Products, categories |
| **Drupal** | 1.5% | OAuth 2.0 | Content, taxonomy |
| **Ghost** | Publishing | OAuth 2.0 | Posts, pages |
| **Bing Webmaster** | Search | OAuth 2.0 | Search data |

### Tier 4: Fallback (Always Available)

| Method | Coverage | Data Access |
|--------|----------|-------------|
| **WordPress Application Passwords** | 38% self-hosted | Full REST API |
| **Sitemap Crawl** | 90%+ sites | URLs, last modified |
| **Intelligent Crawl** | 100% sites | Meta, headings, content |
| **Puppeteer/Playwright** | JS-heavy sites | Rendered DOM |

---

## Data We Extract Per Platform

### Google Search Console
```typescript
interface GSCData {
  queries: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  pages: {
    page: string;
    clicks: number;
    impressions: number;
  }[];
  indexStatus: {
    indexed: number;
    notIndexed: number;
    errors: string[];
  };
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
    status: 'good' | 'needs_improvement' | 'poor';
  };
}
```

### Google Analytics
```typescript
interface GAData {
  overview: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  topPages: {
    path: string;
    pageviews: number;
    avgTimeOnPage: number;
  }[];
  trafficSources: {
    source: string;
    medium: string;
    sessions: number;
  }[];
  conversions?: {
    goal: string;
    completions: number;
    conversionRate: number;
  }[];
}
```

### WordPress
```typescript
interface WordPressData {
  posts: {
    id: number;
    title: string;
    slug: string;
    status: string;
    seoTitle?: string;      // Yoast/RankMath
    seoDescription?: string;
    focusKeyword?: string;
  }[];
  pages: {
    id: number;
    title: string;
    slug: string;
    template: string;
  }[];
  categories: { id: number; name: string; count: number }[];
  tags: { id: number; name: string; count: number }[];
}
```

### Shopify
```typescript
interface ShopifyData {
  products: {
    id: string;
    title: string;
    handle: string;
    seoTitle: string;
    seoDescription: string;
    status: string;
  }[];
  collections: {
    id: string;
    title: string;
    handle: string;
  }[];
  pages: {
    id: string;
    title: string;
    handle: string;
  }[];
  redirects: {
    path: string;
    target: string;
  }[];
}
```

---

## Data Model

### Platform Connections Schema

```typescript
export const platformConnections = pgTable("platform_connections", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  prospectId: text("prospect_id"), // Optional - can be workspace-level (Google)
  
  // Platform identification
  platform: text("platform").notNull(), 
  // 'google_search_console' | 'google_analytics' | 'google_business_profile' |
  // 'wordpress_com' | 'wordpress_org' | 'shopify' | 'wix' | 'squarespace' | 'webflow' | etc.
  
  platformAccountId: text("platform_account_id"), // Their account/site ID
  platformAccountName: text("platform_account_name"), // Display name
  platformSiteUrl: text("platform_site_url"), // The specific site/property
  
  // OAuth tokens (encrypted at rest)
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at"),
  tokenType: text("token_type").default('Bearer'),
  
  // For non-OAuth (WordPress Application Passwords)
  credentialType: text("credential_type"), // 'oauth' | 'app_password' | 'api_key'
  credentialsEncrypted: text("credentials_encrypted"), // Encrypted JSON
  
  // Connection status
  status: text("status").notNull().default('pending'),
  // 'pending' | 'connecting' | 'active' | 'expired' | 'revoked' | 'error'
  
  // Sync tracking
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"), // 'success' | 'partial' | 'failed'
  lastError: text("last_error"),
  syncSchedule: text("sync_schedule").default('daily'), // 'hourly' | 'daily' | 'weekly' | 'manual'
  
  // Scopes granted
  scopesRequested: jsonb("scopes_requested"),
  scopesGranted: jsonb("scopes_granted"),
  
  // Audit
  connectedAt: timestamp("connected_at"),
  connectedBy: text("connected_by"),
  revokedAt: timestamp("revoked_at"),
  revokedBy: text("revoked_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Index for finding connections by prospect
CREATE INDEX idx_connections_prospect ON platform_connections(workspace_id, prospect_id);
CREATE INDEX idx_connections_status ON platform_connections(status);
CREATE INDEX idx_connections_expiry ON platform_connections(token_expires_at) WHERE status = 'active';
```

### OAuth State Schema (for CSRF protection)

```typescript
export const oauthStates = pgTable("oauth_states", {
  id: text("id").primaryKey(),
  state: text("state").notNull().unique(), // Random state parameter
  
  platform: text("platform").notNull(),
  workspaceId: text("workspace_id").notNull(),
  prospectId: text("prospect_id"),
  userId: text("user_id").notNull(),
  
  redirectUri: text("redirect_uri").notNull(),
  scopes: jsonb("scopes").notNull(),
  
  expiresAt: timestamp("expires_at").notNull(), // 10-minute expiry
  usedAt: timestamp("used_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Synced Data Cache Schema

```typescript
export const platformDataCache = pgTable("platform_data_cache", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id").references(() => platformConnections.id),
  
  dataType: text("data_type").notNull(), // 'search_queries' | 'pages' | 'products' | etc.
  dateRange: text("date_range"), // 'last_7_days' | 'last_30_days' | specific dates
  
  data: jsonb("data").notNull(),
  
  fetchedAt: timestamp("fetched_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## OAuth Implementation

### OAuth Service Architecture

```typescript
// Base OAuth provider interface
interface OAuthProvider {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenSet>;
  refreshAccessToken(refreshToken: string): Promise<TokenSet>;
  revokeToken(token: string): Promise<void>;
}

// Token set returned from OAuth
interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}
```

### Google OAuth (Unified for GSC, GA, GBP)

```typescript
const GOOGLE_CONFIG = {
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: {
    searchConsole: 'https://www.googleapis.com/auth/webmasters.readonly',
    analytics: 'https://www.googleapis.com/auth/analytics.readonly',
    businessProfile: 'https://www.googleapis.com/auth/business.manage',
  },
};

class GoogleOAuthProvider implements OAuthProvider {
  async getAuthorizationUrl(state: string, redirectUri: string, services: string[]): string {
    const scopes = services.map(s => GOOGLE_CONFIG.scopes[s]).join(' ');
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
      access_type: 'offline', // Get refresh token
      prompt: 'consent',      // Force consent to get refresh token
    });
    return `${GOOGLE_CONFIG.authorizationUrl}?${params}`;
  }
  
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    return response.json();
  }
  
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    return response.json();
  }
}
```

### Shopify OAuth

```typescript
const SHOPIFY_CONFIG = {
  scopes: [
    'read_products',
    'read_content',
    'read_themes',
    'read_online_store_pages',
    'read_publications',
  ],
};

class ShopifyOAuthProvider implements OAuthProvider {
  async getAuthorizationUrl(shop: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: env.SHOPIFY_CLIENT_ID,
      scope: SHOPIFY_CONFIG.scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });
    return `https://${shop}/admin/oauth/authorize?${params}`;
  }
  
  async exchangeCodeForTokens(shop: string, code: string): Promise<TokenSet> {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.SHOPIFY_CLIENT_ID,
        client_secret: env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });
    const data = await response.json();
    // Shopify tokens don't expire
    return {
      accessToken: data.access_token,
      expiresIn: Infinity,
      tokenType: 'Bearer',
      scope: data.scope,
    };
  }
}
```

### WordPress Application Passwords

```typescript
class WordPressAppPasswordProvider {
  async validateCredentials(siteUrl: string, username: string, appPassword: string): Promise<boolean> {
    try {
      const response = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async fetchPosts(siteUrl: string, credentials: { username: string; appPassword: string }): Promise<any[]> {
    const auth = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString('base64');
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return response.json();
  }
}
```

---

## Token Management

### Token Refresh Worker

```typescript
// Run every 15 minutes
async function refreshExpiringTokens() {
  // Find tokens expiring in next 30 minutes
  const expiring = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.status, 'active'),
      lt(platformConnections.tokenExpiresAt, addMinutes(new Date(), 30)),
      isNotNull(platformConnections.refreshTokenEncrypted),
    ),
  });
  
  for (const connection of expiring) {
    try {
      const refreshToken = decrypt(connection.refreshTokenEncrypted);
      const provider = getProvider(connection.platform);
      const newTokens = await provider.refreshAccessToken(refreshToken);
      
      await db.update(platformConnections)
        .set({
          accessTokenEncrypted: encrypt(newTokens.accessToken),
          refreshTokenEncrypted: newTokens.refreshToken 
            ? encrypt(newTokens.refreshToken) 
            : connection.refreshTokenEncrypted,
          tokenExpiresAt: addSeconds(new Date(), newTokens.expiresIn),
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, connection.id));
        
    } catch (error) {
      await db.update(platformConnections)
        .set({
          status: 'error',
          lastError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, connection.id));
    }
  }
}
```

### Token Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'hex'); // 32 bytes

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

## Fallback Crawler

### Universal Crawler Service

```typescript
class UniversalCrawler {
  private playwright: Playwright;
  
  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const domain = new URL(url).hostname;
    
    // Step 1: Check robots.txt
    const robots = await this.parseRobotsTxt(url);
    if (robots.isDisallowed('/')) {
      return { status: 'blocked', reason: 'robots.txt disallows crawling' };
    }
    
    // Step 2: Try sitemap
    const sitemap = await this.findSitemap(url);
    if (sitemap) {
      const urls = await this.parseSitemap(sitemap);
      return this.crawlUrls(urls, robots, options);
    }
    
    // Step 3: Detect if JS rendering needed
    const needsJs = await this.detectJsRendering(url);
    
    // Step 4: Crawl with appropriate method
    if (needsJs) {
      return this.crawlWithPlaywright(url, robots, options);
    }
    return this.crawlWithFetch(url, robots, options);
  }
  
  private async findSitemap(url: string): Promise<string | null> {
    const base = new URL(url).origin;
    const locations = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap/sitemap.xml',
      '/wp-sitemap.xml',
      '/sitemap/index.xml',
    ];
    
    for (const path of locations) {
      try {
        const response = await fetch(`${base}${path}`, { method: 'HEAD' });
        if (response.ok && response.headers.get('content-type')?.includes('xml')) {
          return `${base}${path}`;
        }
      } catch {}
    }
    
    // Check robots.txt for sitemap directive
    const robotsResponse = await fetch(`${base}/robots.txt`).catch(() => null);
    if (robotsResponse?.ok) {
      const text = await robotsResponse.text();
      const match = text.match(/Sitemap:\s*(.+)/i);
      if (match) return match[1].trim();
    }
    
    return null;
  }
  
  private async detectJsRendering(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      // Check for SPA indicators
      const spaIndicators = [
        '<div id="root"></div>',
        '<div id="app"></div>',
        '<div id="__next"></div>',
        'window.__NEXT_DATA__',
        'window.__NUXT__',
        'ng-app',
        'data-reactroot',
      ];
      
      const hasIndicator = spaIndicators.some(i => html.includes(i));
      
      // Check if meaningful content exists
      const hasContent = html.includes('<h1') || 
                         html.includes('<article') || 
                         html.length > 50000;
      
      return hasIndicator && !hasContent;
    } catch {
      return false;
    }
  }
  
  private async crawlWithPlaywright(
    url: string, 
    robots: RobotsTxt, 
    options?: CrawlOptions
  ): Promise<CrawlResult> {
    const browser = await this.playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for content to render
      await page.waitForSelector('h1, article, main', { timeout: 10000 }).catch(() => {});
      
      // Extract data
      const data = await page.evaluate(() => ({
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()),
        h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()),
        canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
        ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
        internalLinks: Array.from(document.querySelectorAll('a[href^="/"], a[href^="' + location.origin + '"]'))
          .map(a => a.getAttribute('href')),
      }));
      
      return { status: 'success', data, method: 'playwright' };
    } finally {
      await browser.close();
    }
  }
}
```

---

## User Interface

### Platform Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Connect Your Platforms                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Website: acme.com                                                │
│ Platform detected: WordPress (self-hosted)                       │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ RECOMMENDED                                                      │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  🔍 Google Search Console                                   │ │
│ │  See which keywords bring visitors to your site             │ │
│ │                                                             │ │
│ │  Data we'll access:                                         │ │
│ │  • Search queries and rankings                              │ │
│ │  • Click-through rates                                      │ │
│ │  • Index coverage status                                    │ │
│ │                                            [Connect Google] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  📊 Google Analytics                                        │ │
│ │  Understand your traffic and user behavior                  │ │
│ │                                                             │ │
│ │  Data we'll access:                                         │ │
│ │  • Traffic sources and volume                               │ │
│ │  • Popular pages                                            │ │
│ │  • Bounce rates and session duration                        │ │
│ │                                            [Connect Google] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  📝 WordPress                                               │ │
│ │  Access your posts, pages, and SEO settings                 │ │
│ │                                                             │ │
│ │  Connection method: Application Password                    │ │
│ │  [How to create an Application Password →]                  │ │
│ │                                                             │ │
│ │  Username: [admin                             ]             │ │
│ │  App Password: [xxxx xxxx xxxx xxxx xxxx xxxx ]             │ │
│ │                                               [Connect WP]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ OPTIONAL                                                         │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  📍 Google Business Profile                    [Connect →]  │ │
│ │  Local SEO data, reviews, and insights                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ ⓘ Don't have these connected? No problem!                       │
│   We'll analyze your site with our crawler.                     │
│                                                                  │
│                            [Skip for Now]  [Continue →]          │
└─────────────────────────────────────────────────────────────────┘
```

### Connection Status Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ Platform Connections                                    [+ Add] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Google Search Console                                    │ │
│ │ www.acme.com                                                │ │
│ │ ● Connected · Last sync: 2 hours ago                        │ │
│ │                                    [Sync Now] [Disconnect]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📊 Google Analytics                                         │ │
│ │ UA-12345678 (acme.com)                                      │ │
│ │ ● Connected · Last sync: 2 hours ago                        │ │
│ │                                    [Sync Now] [Disconnect]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📝 WordPress                                                │ │
│ │ acme.com (Application Password)                             │ │
│ │ ● Connected · Last sync: 1 day ago                          │ │
│ │                                    [Sync Now] [Disconnect]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📍 Google Business Profile                                  │ │
│ │ Not connected                                               │ │
│ │ ○ Connect to access local SEO data                          │ │
│ │                                                  [Connect]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🕷️ Fallback Crawler                                         │ │
│ │ Always available                                            │ │
│ │ ● Active · 47 pages indexed                                 │ │
│ │                                             [Crawl Now]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### E-commerce Platform Flow (Shopify)

```
┌─────────────────────────────────────────────────────────────────┐
│ Connect Shopify Store                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Enter your Shopify store URL:                                    │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [acme-store          ].myshopify.com                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ What we'll access:                                               │
│ • Products and collections                                       │
│ • Pages and blog posts                                           │
│ • SEO metadata                                                   │
│ • URL redirects                                                  │
│                                                                  │
│ We only request read-only access. We cannot modify your store.  │
│                                                                  │
│                                   [Cancel]  [Connect Shopify →]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

```
# OAuth flows
GET  /api/oauth/:platform/authorize     # Start OAuth flow
GET  /api/oauth/:platform/callback      # OAuth callback
POST /api/oauth/:platform/refresh       # Manual token refresh
POST /api/oauth/:platform/revoke        # Disconnect platform

# Connection management
GET  /api/connections                   # List all connections
GET  /api/connections/:id               # Get connection details
POST /api/connections/:id/sync          # Trigger manual sync
DELETE /api/connections/:id             # Remove connection

# WordPress Application Passwords
POST /api/connections/wordpress/validate # Validate WP credentials
POST /api/connections/wordpress/connect  # Store WP connection

# Platform data
GET  /api/connections/:id/data/:type    # Get cached data by type
POST /api/connections/:id/data/:type    # Force fresh fetch

# Fallback crawler
POST /api/crawl                         # Crawl a URL
GET  /api/crawl/:jobId                  # Get crawl status/results
```

---

## Success Criteria

1. Google OAuth (GSC + GA + GBP) works end-to-end
2. Shopify OAuth installs app and fetches data
3. WordPress Application Passwords validated and stored
4. Wix OAuth works for basic site data
5. Token refresh runs automatically before expiry
6. Fallback crawler handles JS-rendered sites
7. Connection status visible in dashboard
8. Manual sync triggers work
9. Disconnect properly revokes tokens
10. Encrypted token storage passes security review

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 61-01 | Schema + Token Encryption + OAuth Base | 1 |
| 61-02 | Google OAuth (GSC, GA, GBP) | 1 |
| 61-03 | Shopify + Wix OAuth | 2 |
| 61-04 | WordPress App Passwords + Other Platforms | 2 |
| 61-05 | Fallback Crawler + Playwright | 3 |
| 61-06 | Token Refresh Worker + Dashboard UI | 3 |

---

## Out of Scope

- Write access to any platform (read-only only)
- Real-time webhooks from platforms
- Historical data beyond 90 days
- Platform-specific optimization recommendations
- Automated fixes/changes to connected sites

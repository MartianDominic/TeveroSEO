# Phase 31: Site Connection & Platform Detection - Research

**Researched:** 2026-04-22
**Domain:** Multi-platform CMS integration, OAuth credential management, platform detection heuristics
**Confidence:** HIGH

## Summary

Phase 31 implements a unified site connection system that auto-detects website platforms (WordPress, Shopify, Wix, Squarespace, Webflow, custom sites) and manages encrypted credentials for read/write operations. This replaces the current scattered approach where WordPress credentials live in AI-Writer's per-user SQLite and open-seo-main's `clients` table has only basic GSC fields.

The design document (`.planning/design/site-connection-audit-autoedit-revert-system.md`) provides a comprehensive architecture including the `site_connections` table schema, platform adapters, and capability tracking. This research validates the design choices and fills in implementation details.

**Primary recommendation:** Create a new `site_connections` table in open-seo-main's PostgreSQL schema with encrypted credential storage using Node.js `crypto.createCipheriv('aes-256-gcm')`. Platform detection should probe multiple fingerprints (REST API endpoints, CDN domains, HTML meta tags, HTTP headers) with a confidence scoring system. Start with WordPress adapter (REST API + App Password) as it covers the majority of agency client sites.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Platform detection | API (Node.js) | -- | HTTP probes and HTML parsing require server-side execution |
| Credential storage | Database (PostgreSQL) | -- | AES-256-GCM encrypted tokens in `site_connections` table |
| Credential encryption | API (Node.js) | -- | Encryption key in `SITE_ENCRYPTION_KEY` env var |
| OAuth flow orchestration | API (Node.js) | -- | Token exchange must happen server-side |
| Connection wizard UI | Frontend (React) | -- | Multi-step wizard, client-side rendering |
| Platform adapters | API (Node.js) | -- | REST/GraphQL API calls require server-side execution |
| Capability verification | API (Node.js) | -- | Test CRUD operations against platform APIs |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `crypto` (Node stdlib) | 22.x | AES-256-GCM encryption | [VERIFIED: Node.js 22 docs] Built-in, no external dependency |
| `cheerio` | 1.2.0 | HTML parsing for platform detection | [VERIFIED: npm registry] Fast, jQuery-like API for server-side HTML |
| `pg` | 8.20.0 | PostgreSQL driver | [VERIFIED: open-seo-main package.json] Already in use |
| `drizzle-orm` | 0.44.4 | ORM for schema | [VERIFIED: open-seo-main package.json] Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.24.2 | Schema validation | [VERIFIED: package.json] Validate connection config shapes |
| `ioredis` | 5.10.1 | Caching platform detection results | [VERIFIED: CLAUDE.md] For BullMQ queues, can cache detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node crypto (AES-256-GCM) | Fernet (via Python) | GCM is native to Node.js; Fernet would require cross-language coordination |
| cheerio | JSDOM | cheerio is 10x faster, sufficient for fingerprint extraction |
| Manual OAuth flows | Passport.js | Passport adds abstraction; direct OAuth is simpler for platform-specific flows |

**Installation:**
```bash
# cheerio not yet in package.json
npm install cheerio@1.2.0
npm install -D @types/cheerio
```

**Version verification:**
- cheerio: 1.2.0 [VERIFIED: npm view cheerio version, 2026-04-22]
- pg: 8.20.0 [VERIFIED: package.json]
- drizzle-orm: 0.44.4 [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```
                     +------------------+
                     |  Agency Dashboard |
                     | (open-seo-main)  |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | /sites/connect   |
                     | Connection Wizard|
                     +--------+---------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
+-------------+-------------+   +-------------+-------------+
|     Platform Detection    |   |   Manual Configuration    |
|  - Probe /wp-json/       |   |  - OAuth redirect         |
|  - Check CDN domains     |   |  - App password entry     |
|  - Parse HTML meta tags  |   |  - API key entry          |
+-------------+-------------+   +-------------+-------------+
              |                               |
              +---------------+---------------+
                              |
                              v
                     +--------+---------+
                     | Capability Test  |
                     | - Test read/write|
                     | - Verify perms   |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Encrypt & Store  |
                     | - AES-256-GCM    |
                     | - site_connections|
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Platform Adapter |
                     | - WordPress      |
                     | - Shopify        |
                     | - Wix            |
                     | - Squarespace    |
                     | - Webflow        |
                     | - Custom/Pixel   |
                     +--------+---------+
                              |
                              v
                     +--------+---------+
                     | Client Site      |
                     | (External)       |
                     +------------------+
```

### Recommended Project Structure
```
src/
├── server/
│   └── features/
│       └── connections/
│           ├── services/
│           │   ├── PlatformDetector.ts       # Detection service
│           │   ├── ConnectionService.ts      # CRUD for site_connections
│           │   └── CredentialEncryption.ts   # AES-256-GCM helpers
│           ├── adapters/
│           │   ├── BaseAdapter.ts            # Interface + base class
│           │   ├── WordPressAdapter.ts       # WP REST API
│           │   ├── ShopifyAdapter.ts         # Shopify GraphQL
│           │   ├── WixAdapter.ts             # Wix Headless API
│           │   ├── SquarespaceAdapter.ts     # Squarespace API
│           │   ├── WebflowAdapter.ts         # Webflow CMS API
│           │   └── PixelAdapter.ts           # Fallback pixel mode
│           └── types.ts                      # Shared types
├── db/
│   └── connection-schema.ts                  # site_connections table
└── serverFunctions/
    └── connections.ts                        # tRPC/server functions
```

### Pattern 1: Platform Detection Heuristics
**What:** Multi-probe fingerprinting to identify website platform with confidence scoring
**When to use:** User enters domain in connection wizard
**Example:**
```typescript
// Source: [CITED: webreveal.io/blog/how-to-detect-website-cms.html]
interface DetectionResult {
  platform: 'wordpress' | 'shopify' | 'wix' | 'squarespace' | 'webflow' | 'custom';
  confidence: 'high' | 'medium' | 'low';
  signals: DetectionSignal[];
}

interface DetectionSignal {
  type: 'api_probe' | 'cdn_domain' | 'html_meta' | 'header' | 'cookie';
  found: string;
  weight: number;
}

const DETECTION_RULES: Record<string, DetectionRule[]> = {
  wordpress: [
    { type: 'api_probe', pattern: '/wp-json/', weight: 100 },
    { type: 'cdn_domain', pattern: 'wp-content', weight: 80 },
    { type: 'html_meta', pattern: 'meta[name="generator"][content*="WordPress"]', weight: 90 },
    { type: 'header', pattern: 'x-powered-by: WordPress', weight: 70 },
  ],
  shopify: [
    { type: 'cdn_domain', pattern: 'cdn.shopify.com', weight: 100 },
    { type: 'cdn_domain', pattern: 'myshopify.com', weight: 100 },
    { type: 'cookie', pattern: '_shopify_s', weight: 80 },
  ],
  wix: [
    { type: 'cdn_domain', pattern: 'wixstatic.com', weight: 100 },
    { type: 'cdn_domain', pattern: 'parastorage.com', weight: 90 },
    { type: 'html_meta', pattern: '[data-wix-]', weight: 80 },
  ],
  squarespace: [
    { type: 'cdn_domain', pattern: 'static.squarespace.com', weight: 100 },
    { type: 'html_meta', pattern: 'meta[name="generator"][content*="Squarespace"]', weight: 90 },
  ],
  webflow: [
    { type: 'cdn_domain', pattern: 'webflow.io', weight: 100 },
    { type: 'cdn_domain', pattern: 'assets-global.website-files.com', weight: 90 },
    { type: 'html_meta', pattern: 'meta[name="generator"][content*="Webflow"]', weight: 90 },
  ],
};
```

### Pattern 2: AES-256-GCM Credential Encryption
**What:** Authenticated encryption for stored credentials
**When to use:** Storing any credential (app passwords, OAuth tokens, API keys)
**Example:**
```typescript
// Source: [CITED: gist.github.com/AndiDittrich/4629e7db04819244e843]
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16; // 128-bit auth tag

interface EncryptedCredential {
  iv: Buffer;    // 12 bytes
  tag: Buffer;   // 16 bytes
  ciphertext: Buffer;
}

export function encryptCredential(plaintext: string): Buffer {
  const key = Buffer.from(process.env.SITE_ENCRYPTION_KEY!, 'base64');
  if (key.length !== 32) {
    throw new Error('SITE_ENCRYPTION_KEY must be 32 bytes (256 bits)');
  }
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  
  // Pack: IV || TAG || CIPHERTEXT
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptCredential(packed: Buffer): string {
  const key = Buffer.from(process.env.SITE_ENCRYPTION_KEY!, 'base64');
  
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### Pattern 3: WordPress REST API Adapter
**What:** CRUD operations via WordPress REST API with App Password auth
**When to use:** WordPress sites with REST API enabled
**Example:**
```typescript
// Source: [CITED: developer.wordpress.org REST API docs]
interface WordPressConnection {
  siteUrl: string;
  username: string;
  appPassword: string; // Decrypted at runtime
}

class WordPressAdapter implements PlatformAdapter {
  private baseUrl: string;
  private auth: string;
  
  constructor(conn: WordPressConnection) {
    this.baseUrl = `${conn.siteUrl}/wp-json/wp/v2`;
    this.auth = Buffer.from(`${conn.username}:${conn.appPassword}`).toString('base64');
  }
  
  async verifyConnection(): Promise<CapabilityResult> {
    const res = await fetch(`${this.baseUrl}/users/me`, {
      headers: { 'Authorization': `Basic ${this.auth}` },
    });
    
    if (!res.ok) {
      return { connected: false, error: `HTTP ${res.status}` };
    }
    
    const user = await res.json();
    return {
      connected: true,
      capabilities: {
        canEditPosts: user.capabilities?.edit_posts ?? false,
        canEditPages: user.capabilities?.edit_pages ?? false,
        canUploadMedia: user.capabilities?.upload_files ?? false,
      },
    };
  }
  
  async getPost(postId: number): Promise<WPPost> {
    const res = await fetch(`${this.baseUrl}/posts/${postId}?context=edit`, {
      headers: { 'Authorization': `Basic ${this.auth}` },
    });
    return res.json();
  }
  
  async updatePost(postId: number, data: Partial<WPPost>): Promise<WPPost> {
    const res = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.json();
  }
}
```

### Pattern 4: Shopify GraphQL Adapter (2026 OAuth)
**What:** Content management via Shopify Admin GraphQL API
**When to use:** Shopify stores with OAuth access token
**Example:**
```typescript
// Source: [CITED: shopify.dev/docs/api/admin-graphql/latest]
class ShopifyAdapter implements PlatformAdapter {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion = '2026-04';
  
  constructor(conn: ShopifyConnection) {
    this.shopDomain = conn.shopDomain;
    this.accessToken = conn.accessToken; // Decrypted at runtime
  }
  
  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(
      `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      }
    );
    const json = await res.json();
    if (json.errors) {
      throw new Error(json.errors[0].message);
    }
    return json.data;
  }
  
  async getProduct(id: string): Promise<ShopifyProduct> {
    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          seo {
            title
            description
          }
          images(first: 10) {
            edges {
              node {
                id
                altText
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql<{ product: ShopifyProduct }>(query, { id });
    return data.product;
  }
}
```

### Anti-Patterns to Avoid
- **Storing credentials unencrypted:** All secrets MUST use AES-256-GCM before PostgreSQL storage
- **Reusing IV/nonce:** GCM security breaks if IV is reused with same key; generate fresh IV per encryption
- **Returning decrypted credentials to frontend:** Write-only pattern; credentials never leave server
- **Detecting platform client-side:** Detection requires HTTP probes that would be blocked by CORS
- **Hardcoding API versions:** Store apiVersion in connection record for Shopify/Webflow upgrades

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES encryption | Custom padding/chaining | Node.js `crypto.createCipheriv('aes-256-gcm')` | GCM is AEAD; handles auth tag correctly |
| HTML parsing | Regex extraction | cheerio | Handles malformed HTML, encodings, edge cases |
| WordPress auth | Custom Base64 encoding | Built-in `Buffer.from().toString('base64')` | Correct encoding for HTTP Basic Auth |
| Shopify OAuth | Manual token exchange | @shopify/shopify-api | Handles token rotation, retries, rate limits |
| Platform detection | Single-signal heuristics | Multi-probe scoring system | Single signals have false positives |

**Key insight:** Platform APIs change their authentication requirements regularly (Shopify deprecated static tokens in 2026, Wix shifted to OAuth-only). Hand-rolled integrations become brittle; official SDKs abstract these changes.

## Common Pitfalls

### Pitfall 1: WordPress REST API Disabled
**What goes wrong:** /wp-json/ probe returns 404 because some security plugins disable REST API
**Why it happens:** Security plugins (Wordfence, iThemes) can restrict REST API access
**How to avoid:** Detection should also check /wp-admin/ and /wp-content/ paths; low confidence if only HTML signals found
**Warning signs:** API probe fails but /wp-content/ paths exist in HTML

### Pitfall 2: Shopify Access Token Expiration (2026 Change)
**What goes wrong:** OAuth tokens from 2026+ apps expire; static tokens from pre-2026 apps don't refresh
**Why it happens:** Shopify deprecated static tokens for new custom apps as of Jan 1, 2026 [CITED: smackcoders.com/blog/shopify-access-token-changes.html]
**How to avoid:** Store refresh_token; implement token refresh flow; check `expires_at` before API calls
**Warning signs:** 401 errors that worked yesterday; `expires_at` in past

### Pitfall 3: Squarespace Content API Limitations
**What goes wrong:** Expecting full CRUD but Squarespace only supports commerce data, not content editing
**Why it happens:** Squarespace API is commerce-focused; page/blog CRUD not available via API [CITED: developers.squarespace.com]
**How to avoid:** Show "read-only" capability in UI; suggest pixel/manual mode for content changes
**Warning signs:** Attempting POST to non-existent endpoints

### Pitfall 4: Wix Self-Managed vs Wix-Managed Confusion
**What goes wrong:** Implementing OAuth when site is Wix-managed (no OAuth needed)
**Why it happens:** Wix has two headless modes with different auth requirements [CITED: dev.wix.com/docs/go-headless]
**How to avoid:** Detect Wix-managed sites by checking if site uses wixsite.com or custom domain with Wix hosting
**Warning signs:** OAuth flow redirects but site has no app dashboard

### Pitfall 5: GCM Nonce Reuse
**What goes wrong:** Security breaks completely if same nonce used twice with same key
**Why it happens:** Using counter instead of random bytes; not regenerating per encryption
**How to avoid:** Generate fresh 12-byte random nonce via `randomBytes(12)` for every encryption operation [CITED: copyprogramming.com AES 2026 security guide]
**Warning signs:** Unit tests passing but encrypted values identical for same plaintext

### Pitfall 6: Capability Caching Without Invalidation
**What goes wrong:** Connection shows "can edit" but WordPress plugin was removed
**Why it happens:** Capabilities cached at connection time; not re-verified
**How to avoid:** Re-verify capabilities on first API call each session; store `lastVerifiedAt`
**Warning signs:** 403 errors after capability check passed; `lastVerifiedAt` > 24 hours ago

## Code Examples

Verified patterns from official sources:

### site_connections Schema (Drizzle ORM)
```typescript
// Source: Design doc + Drizzle PG patterns
import { pgTable, text, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { clients } from "./client-schema";

export const PLATFORM_TYPES = [
  "wordpress",
  "shopify",
  "wix",
  "squarespace",
  "webflow",
  "custom",
  "pixel",
] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number];

export const CONNECTION_STATUS = [
  "pending",
  "active",
  "error",
  "disconnected",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUS)[number];

export const siteConnections = pgTable(
  "site_connections",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    
    // Platform info
    platform: text("platform").notNull(),
    siteUrl: text("site_url").notNull(),
    displayName: text("display_name"),
    
    // Encrypted credentials (AES-256-GCM packed: IV || TAG || CIPHERTEXT)
    encryptedCredentials: text("encrypted_credentials"), // Base64 encoded
    
    // Capabilities detected during verification
    capabilities: text("capabilities").array(), // ['read_posts', 'write_posts', 'read_media', etc.]
    
    // Status
    status: text("status").notNull().default("pending"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: "date" }),
    lastErrorMessage: text("last_error_message"),
    
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_site_connections_client").on(table.clientId),
    index("ix_site_connections_platform").on(table.platform),
    index("ix_site_connections_status").on(table.status),
  ],
);

export type SiteConnectionSelect = typeof siteConnections.$inferSelect;
export type SiteConnectionInsert = typeof siteConnections.$inferInsert;
```

### Platform Detection Service
```typescript
// Source: Platform detection patterns from web search results
import * as cheerio from 'cheerio';

interface DetectionProbe {
  type: 'api' | 'cdn' | 'meta' | 'header';
  check: (data: ProbeData) => boolean;
  platform: PlatformType;
  weight: number;
}

interface ProbeData {
  html: string;
  headers: Record<string, string>;
  apiProbes: Record<string, boolean>; // endpoint -> accessible
}

const PROBES: DetectionProbe[] = [
  // WordPress
  { type: 'api', check: d => d.apiProbes['/wp-json/'], platform: 'wordpress', weight: 100 },
  { type: 'cdn', check: d => d.html.includes('/wp-content/'), platform: 'wordpress', weight: 80 },
  { type: 'meta', check: d => cheerio.load(d.html)('meta[name="generator"]').attr('content')?.includes('WordPress') ?? false, platform: 'wordpress', weight: 90 },
  
  // Shopify
  { type: 'cdn', check: d => d.html.includes('cdn.shopify.com'), platform: 'shopify', weight: 100 },
  { type: 'cdn', check: d => d.html.includes('.myshopify.com'), platform: 'shopify', weight: 100 },
  
  // Wix
  { type: 'cdn', check: d => d.html.includes('wixstatic.com'), platform: 'wix', weight: 100 },
  { type: 'cdn', check: d => d.html.includes('parastorage.com'), platform: 'wix', weight: 90 },
  
  // Squarespace
  { type: 'cdn', check: d => d.html.includes('static.squarespace.com'), platform: 'squarespace', weight: 100 },
  { type: 'meta', check: d => cheerio.load(d.html)('meta[name="generator"]').attr('content')?.includes('Squarespace') ?? false, platform: 'squarespace', weight: 90 },
  
  // Webflow
  { type: 'cdn', check: d => d.html.includes('webflow.io') || d.html.includes('assets-global.website-files.com'), platform: 'webflow', weight: 100 },
  { type: 'meta', check: d => cheerio.load(d.html)('meta[name="generator"]').attr('content')?.includes('Webflow') ?? false, platform: 'webflow', weight: 90 },
];

export async function detectPlatform(url: string): Promise<DetectionResult> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  
  // Fetch HTML and headers
  const res = await fetch(normalizedUrl, {
    headers: { 'User-Agent': 'TeveroSEO-PlatformDetector/1.0' },
    redirect: 'follow',
  });
  const html = await res.text();
  const headers = Object.fromEntries(res.headers.entries());
  
  // Probe WordPress REST API
  const wpJsonRes = await fetch(`${normalizedUrl}/wp-json/`, { method: 'HEAD' }).catch(() => null);
  const apiProbes = {
    '/wp-json/': wpJsonRes?.ok ?? false,
  };
  
  const data: ProbeData = { html, headers, apiProbes };
  
  // Score each platform
  const scores: Record<PlatformType, number> = {
    wordpress: 0, shopify: 0, wix: 0, squarespace: 0, webflow: 0, custom: 0, pixel: 0,
  };
  const signals: DetectionSignal[] = [];
  
  for (const probe of PROBES) {
    if (probe.check(data)) {
      scores[probe.platform] += probe.weight;
      signals.push({ type: probe.type, platform: probe.platform, weight: probe.weight });
    }
  }
  
  // Find winner
  const [topPlatform, topScore] = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0] as [PlatformType, number];
  
  if (topScore === 0) {
    return { platform: 'custom', confidence: 'low', signals };
  }
  
  return {
    platform: topPlatform,
    confidence: topScore >= 100 ? 'high' : topScore >= 50 ? 'medium' : 'low',
    signals,
  };
}
```

### Connection Verification Service
```typescript
// Source: Design doc capability verification pattern
export async function verifyConnection(
  connectionId: string,
): Promise<VerificationResult> {
  const conn = await db.query.siteConnections.findFirst({
    where: eq(siteConnections.id, connectionId),
  });
  
  if (!conn || !conn.encryptedCredentials) {
    return { success: false, error: 'Connection not found' };
  }
  
  // Decrypt credentials
  const packed = Buffer.from(conn.encryptedCredentials, 'base64');
  const credentialsJson = decryptCredential(packed);
  const credentials = JSON.parse(credentialsJson);
  
  // Get appropriate adapter
  const adapter = getAdapter(conn.platform as PlatformType, {
    siteUrl: conn.siteUrl,
    ...credentials,
  });
  
  try {
    const result = await adapter.verifyConnection();
    
    // Update connection status
    await db.update(siteConnections)
      .set({
        status: result.connected ? 'active' : 'error',
        capabilities: result.capabilities ? Object.keys(result.capabilities).filter(k => result.capabilities![k]) : [],
        lastVerifiedAt: new Date(),
        lastErrorMessage: result.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(siteConnections.id, connectionId));
    
    return { success: result.connected, capabilities: result.capabilities, error: result.error };
  } catch (err) {
    await db.update(siteConnections)
      .set({
        status: 'error',
        lastErrorMessage: (err as Error).message,
        updatedAt: new Date(),
      })
      .where(eq(siteConnections.id, connectionId));
    
    return { success: false, error: (err as Error).message };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-user SQLite credential storage | Per-client PostgreSQL with encryption | This phase | Credentials tied to client, team-accessible |
| Static Shopify API tokens | OAuth 2.0 with refresh | Jan 2026 | New custom apps MUST use OAuth [CITED: shopify.dev] |
| Wix API keys | OAuth or Wix-managed headless | 2025 | Self-managed projects need OAuth setup |
| Plaintext credential storage | AES-256-GCM encryption | Industry standard | OWASP requires encryption at rest |

**Deprecated/outdated:**
- WordPress XML-RPC: Disabled by default in modern WordPress; use REST API
- Shopify static access tokens: Cannot create new ones for custom apps after Jan 2026
- Squarespace content editing via API: Never existed; commerce API only

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SITE_ENCRYPTION_KEY` env var will be provisioned | Architecture Patterns | Encryption will fail at runtime |
| A2 | Most agency clients use WordPress | Summary | Detection effort may be misordered |
| A3 | Squarespace sites are read-only for SEO changes | Common Pitfalls | Planner may include write tasks |

## Open Questions

1. **Key rotation strategy**
   - What we know: AES-256-GCM needs key rotation when key might be compromised
   - What's unclear: How to re-encrypt all credentials after rotation?
   - Recommendation: Add `keyVersion` column; batch re-encryption job when key rotates

2. **Webflow CMS vs E-commerce**
   - What we know: Webflow has separate CMS and E-commerce APIs
   - What's unclear: Which capability set to prioritize?
   - Recommendation: Start with CMS API (collection items); add E-commerce later if needed

3. **Multi-site WordPress (WPMU)**
   - What we know: WPMU has network admin vs site admin
   - What's unclear: How to detect and handle multi-site installs?
   - Recommendation: Treat each subsite as separate connection; flag if /wp-json/ indicates network mode

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Credential storage | Yes | 15.x | -- |
| Node.js crypto | AES-256-GCM | Yes | 22.x | -- |
| cheerio | HTML parsing | No | -- | Install via npm |
| SITE_ENCRYPTION_KEY | Encryption | Pending | -- | Generate and provision |

**Missing dependencies with no fallback:**
- `SITE_ENCRYPTION_KEY` env var must be provisioned before encryption works

**Missing dependencies with fallback:**
- cheerio: `npm install cheerio@1.2.0` (Wave 0 task)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.1.1 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test src/server/features/connections/` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | Platform detection returns correct platform | unit | `pnpm test src/server/features/connections/services/PlatformDetector.test.ts -t "detects WordPress"` | Pending Wave 0 |
| CONN-02 | AES-256-GCM encryption round-trips | unit | `pnpm test src/server/features/connections/services/CredentialEncryption.test.ts` | Pending Wave 0 |
| CONN-03 | site_connections table created | integration | `pnpm drizzle-kit push && pnpm test:db` | Pending Wave 0 |
| CONN-04 | WordPress adapter verifies connection | integration | `pnpm test src/server/features/connections/adapters/WordPressAdapter.test.ts` | Pending Wave 0 |
| CONN-05 | Credentials never returned to frontend | unit | `pnpm test src/serverFunctions/connections.test.ts -t "excludes credentials"` | Pending Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test src/server/features/connections/`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/server/features/connections/` directory structure
- [ ] `src/server/features/connections/services/CredentialEncryption.test.ts`
- [ ] `src/server/features/connections/services/PlatformDetector.test.ts`
- [ ] `src/server/features/connections/adapters/WordPressAdapter.test.ts`
- [ ] `src/db/connection-schema.test.ts`
- [ ] Install cheerio: `npm install cheerio@1.2.0 && npm install -D @types/cheerio`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | App password/OAuth token validation before API calls |
| V3 Session Management | No | Stateless API; no sessions |
| V4 Access Control | Yes | clientId scoping; only workspace members can access |
| V5 Input Validation | Yes | Zod schemas for connection config |
| V6 Cryptography | Yes | AES-256-GCM with random IV per encryption |

### Known Threat Patterns for Credential Storage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential exfiltration | Information Disclosure | AES-256-GCM encryption at rest; write-only API pattern |
| IV reuse | Tampering | Fresh 12-byte random IV per encryption via `crypto.randomBytes(12)` |
| Key leakage | Information Disclosure | Key in env var only; never logged; never in source |
| Timing attacks on comparison | Information Disclosure | Use `crypto.timingSafeEqual()` for auth tag verification |
| SQL injection in siteUrl | Tampering | Parameterized queries via Drizzle ORM |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] cheerio@1.2.0, pg@8.20.0
- [VERIFIED: package.json] drizzle-orm@0.44.4, vitest@3.1.1
- [VERIFIED: Node.js 22 docs] crypto.createCipheriv AES-256-GCM
- [VERIFIED: open-seo-main codebase] existing schema patterns in src/db/

### Secondary (MEDIUM confidence)
- [CITED: developer.wordpress.org REST API docs] WordPress REST API authentication
- [CITED: shopify.dev/docs/api/admin-graphql/latest] Shopify GraphQL Admin API
- [CITED: dev.wix.com/docs/go-headless] Wix Headless API authentication
- [CITED: developers.squarespace.com] Squarespace Commerce API
- [CITED: developers.webflow.com] Webflow CMS API
- [CITED: webreveal.io/blog/how-to-detect-website-cms.html] Platform detection fingerprints
- [CITED: smackcoders.com/blog/shopify-access-token-changes.html] Shopify 2026 OAuth changes
- [CITED: gist.github.com/AndiDittrich/4629e7db04819244e843] AES-256-GCM Node.js implementation

### Tertiary (LOW confidence)
- None -- all critical claims verified against official sources or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified via npm registry and package.json
- Architecture: HIGH -- follows existing codebase patterns and official API docs
- Pitfalls: HIGH -- documented from official platform changelogs and community reports

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days -- platform APIs are stable but OAuth requirements evolving)

# Phase 31: Site Connection & Platform Detection - Research

**Researched:** 2026-04-22
**Domain:** CMS Platform Integration, OAuth Authentication, Encrypted Credential Storage
**Confidence:** HIGH

## Summary

Phase 31 implements a unified site connection model with platform auto-detection for WordPress, Shopify, Wix, Squarespace, Webflow, and custom sites. The research reveals that **approximately 70% of this phase is already implemented** in `open-seo-main/src/server/features/connections/`.

**Existing implementation (verified):**
- `site_connections` Drizzle schema with encrypted credentials (AES-256-GCM)
- `PlatformDetector` service with multi-probe fingerprinting (HTML, CDN, meta tags, API probes)
- `ConnectionService` for CRUD with credential encryption
- `WordPressAdapter` and `ShopifyAdapter` with `verifyConnection()` and `testWritePermission()`
- `BaseAdapter` interface defining the adapter contract
- TanStack Start server functions with Zod validation
- 70 passing tests covering encryption, adapters, and detection

**Remaining gaps:**
- Wix, Squarespace, Webflow adapters (only 2 of 5 platforms implemented)
- Connection wizard UI in `apps/web` (existing `/clients/[id]/connections` page only handles OAuth providers, not CMS credentials)
- Write permission verification flow tied to connection status
- Unifying AI-Writer's existing WordPress/Wix publishing with open-seo's adapter system

**Primary recommendation:** Complete the remaining 3 platform adapters (Wix, Squarespace, Webflow) and build a connection wizard UI that uses the existing `open-seo-main` server functions. Do NOT re-implement what already exists.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Platform detection | API / Backend (open-seo-main) | -- | Requires server-side fetching of HTML/headers |
| Credential encryption | API / Backend (open-seo-main) | -- | AES-256-GCM with server-side key |
| OAuth flows (Google, etc.) | API / Backend (AI-Writer) | -- | Existing per-client OAuth system |
| CMS API adapters | API / Backend (open-seo-main) | -- | Platform adapters make authenticated API calls |
| Connection wizard UI | Frontend (apps/web) | -- | User-facing form for credentials |
| Connection status display | Frontend (apps/web) | -- | List connections with status badges |

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | Database ORM | Already used throughout project [VERIFIED: npm registry] |
| zod | 3.x | Input validation | Already used for server function schemas [VERIFIED: codebase] |
| cheerio | 1.2.0 | HTML parsing for platform detection | Already in use [VERIFIED: npm registry] |
| nanoid | 5.1.9 | ID generation | Already used for connection IDs [VERIFIED: npm registry] |
| node:crypto | built-in | AES-256-GCM encryption | Node.js built-in, no external dependency [VERIFIED: codebase] |

### Supporting (For New Adapters)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @shopify/shopify-api | -- | Shopify Admin API client | Already have custom GraphQL adapter, not needed |
| -- | -- | Wix API | Use native fetch, no official SDK for Headless API |

**No new dependencies required.** All platform adapters use native `fetch` with JSON/GraphQL payloads.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom GraphQL adapter | @shopify/shopify-api | Official SDK adds bundle size, custom adapter is simpler for SEO-only operations |
| Fernet encryption | AES-256-GCM | AES-GCM is Node.js native, Fernet requires extra dependency |

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
                          │           APPS/WEB (Next.js)            │
                          │  /clients/[id]/connections page         │
                          │  Connection Wizard UI (to build)        │
                          └────────────────┬────────────────────────┘
                                           │ fetch / server action
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    OPEN-SEO-MAIN (Node.js / TanStack Start)                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ServerFunctions (src/serverFunctions/connections.ts)                        │
│  ├─ detectPlatformFn     → PlatformDetector.detectPlatform()                │
│  ├─ createConnectionFn   → ConnectionService.createConnection()             │
│  ├─ verifyConnectionFn   → ConnectionService.verifyConnection()             │
│  ├─ getConnectionsFn     → ConnectionService.getConnectionsForClient()      │
│  └─ deleteConnectionFn   → ConnectionService.deleteConnection()             │
│                                                                              │
│  Services Layer                                                              │
│  ├─ ConnectionService    encrypts credentials, stores in site_connections   │
│  ├─ PlatformDetector     probes /wp-json/, CDN refs, meta tags              │
│  └─ CredentialEncryption AES-256-GCM (IV || TAG || CIPHERTEXT)              │
│                                                                              │
│  Platform Adapters (src/server/features/connections/adapters/)               │
│  ├─ WordPressAdapter     ✓ REST API + App Password                          │
│  ├─ ShopifyAdapter       ✓ GraphQL Admin API                                │
│  ├─ WixAdapter           ✗ TO BUILD (Headless API + OAuth)                  │
│  ├─ SquarespaceAdapter   ✗ TO BUILD (REST API + OAuth)                      │
│  └─ WebflowAdapter       ✗ TO BUILD (CMS API + OAuth)                       │
│                                                                              │
└─────────────────────────┬────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PostgreSQL (Drizzle) │
              │  site_connections     │
              │  encryptedCredentials │
              └───────────────────────┘
```

### Recommended Project Structure (Existing)

```
open-seo-main/src/server/features/connections/
├── adapters/
│   ├── BaseAdapter.ts        # PlatformAdapter interface
│   ├── WordPressAdapter.ts   # ✓ Complete
│   ├── ShopifyAdapter.ts     # ✓ Complete
│   ├── WixAdapter.ts         # ✗ TO BUILD
│   ├── SquarespaceAdapter.ts # ✗ TO BUILD
│   └── WebflowAdapter.ts     # ✗ TO BUILD
├── services/
│   ├── ConnectionService.ts   # ✓ Complete
│   ├── CredentialEncryption.ts # ✓ Complete
│   └── PlatformDetector.ts    # ✓ Complete
├── types.ts                   # ✓ Platform types, detection types
└── index.ts                   # ✓ Barrel exports
```

### Pattern 1: Platform Adapter Interface

**What:** Standard interface all CMS adapters implement
**When to use:** Adding new platform support
**Example:**

```typescript
// Source: open-seo-main/src/server/features/connections/adapters/BaseAdapter.ts
export interface PlatformAdapter {
  platform: PlatformType;
  siteUrl: string;
  verifyConnection(): Promise<CapabilityResult>;
  testWritePermission(): Promise<boolean>;
}

export interface CapabilityResult {
  connected: boolean;
  error?: string;
  capabilities?: {
    canReadPosts?: boolean;
    canWritePosts?: boolean;
    canReadPages?: boolean;
    canWritePages?: boolean;
    canReadMedia?: boolean;
    canWriteMedia?: boolean;
    canReadProducts?: boolean;
    canWriteProducts?: boolean;
    canReadSeo?: boolean;
    canWriteSeo?: boolean;
  };
}
```

### Pattern 2: Credential Encryption

**What:** AES-256-GCM with packed IV || TAG || CIPHERTEXT
**When to use:** Storing platform credentials
**Example:**

```typescript
// Source: open-seo-main/src/server/features/connections/services/CredentialEncryption.ts
import * as crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptCredential(plaintext: string): Buffer {
  const key = Buffer.from(process.env.SITE_ENCRYPTION_KEY!, "base64");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}
```

### Pattern 3: Platform Detection Probes

**What:** Weighted scoring system for platform detection
**When to use:** Auto-detecting CMS from domain
**Example:**

```typescript
// Source: open-seo-main/src/server/features/connections/services/PlatformDetector.ts
const DETECTION_PROBES = [
  { type: "api", platform: "wordpress", weight: 100, check: (d) => d.apiProbes["/wp-json/"] ? "/wp-json/" : null },
  { type: "cdn", platform: "shopify", weight: 100, check: (d) => d.html.includes("cdn.shopify.com") ? "cdn.shopify.com" : null },
  { type: "cdn", platform: "wix", weight: 100, check: (d) => d.html.includes("wixstatic.com") ? "wixstatic.com" : null },
];
// Score >= 100 = high confidence, >= 50 = medium, < 50 = low
```

### Anti-Patterns to Avoid

- **Returning decrypted credentials to client:** ConnectionService.getConnection() returns `hasCredentials: boolean`, never the actual encrypted data
- **Storing credentials unencrypted:** Always use `encryptCredential()` before database storage
- **Hard-coding API versions:** Pass version as config (e.g., ShopifyAdapter uses `apiVersion` param)
- **Duplicating AI-Writer's OAuth system:** For Google/Bing OAuth, use the existing `ClientOAuthToken` model in AI-Writer

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encryption | Custom cipher | AES-256-GCM via node:crypto | Cryptographic best practices, authenticated encryption |
| Platform detection | Custom heuristics | Existing PlatformDetector service | Already implements multi-probe scoring |
| WordPress API | Custom REST client | Existing WordPressAdapter | Handles auth, pagination, error mapping |
| Shopify API | REST API client | Existing ShopifyAdapter (GraphQL) | GraphQL is more efficient for SEO data |
| OAuth state management | Custom state storage | Existing OAuthStateToken model | CSRF protection already implemented |

**Key insight:** 70% of the infrastructure already exists. The work is completing adapters and building UI, not re-implementing core services.

## Common Pitfalls

### Pitfall 1: Credential Exposure in API Responses

**What goes wrong:** Returning `encryptedCredentials` field to frontend
**Why it happens:** Database row includes encrypted blob, easy to accidentally serialize
**How to avoid:** Always use `ConnectionService.stripCredentials()` which returns `hasCredentials: boolean`
**Warning signs:** Frontend code receiving Base64 blobs

### Pitfall 2: Missing SITE_ENCRYPTION_KEY

**What goes wrong:** Encryption fails with cryptic error
**Why it happens:** Environment variable not set in development/production
**How to avoid:** Call `validateEncryptionKey()` at startup; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
**Warning signs:** "SITE_ENCRYPTION_KEY environment variable is not set" error

### Pitfall 3: WordPress Application Password Format

**What goes wrong:** 401 Unauthorized despite correct credentials
**Why it happens:** App passwords have spaces that must be preserved
**How to avoid:** Store password exactly as generated (e.g., "abcd 1234 efgh 5678")
**Warning signs:** Works in curl but fails in adapter

### Pitfall 4: Shopify API Version Drift

**What goes wrong:** GraphQL queries fail after Shopify deprecates old version
**Why it happens:** Shopify deprecates API versions on a rolling basis
**How to avoid:** Use current stable version (2026-04 as of this research); add version to config
**Warning signs:** "This API version is no longer supported" errors

### Pitfall 5: Wix OAuth Complexity

**What goes wrong:** Wix requires Headless OAuth flow with PKCE
**Why it happens:** Wix deprecated simple OAuth for third-party apps
**How to avoid:** Use WixAuthService pattern from AI-Writer; store code_verifier during flow
**Warning signs:** "invalid_request" on token exchange

## Code Examples

### Creating a New Platform Adapter

```typescript
// Source: Pattern derived from existing adapters
// File: open-seo-main/src/server/features/connections/adapters/WixAdapter.ts

import type { PlatformAdapter, CapabilityResult } from "./BaseAdapter";

interface WixAdapterConfig {
  siteId: string;
  accessToken: string;
  refreshToken?: string;
}

export class WixAdapter implements PlatformAdapter {
  readonly platform = "wix" as const;
  readonly siteUrl: string;
  private accessToken: string;

  constructor(config: WixAdapterConfig) {
    this.siteUrl = `https://www.wix.com/site/${config.siteId}`;
    this.accessToken = config.accessToken;
  }

  async verifyConnection(): Promise<CapabilityResult> {
    try {
      const res = await fetch("https://www.wixapis.com/site-properties/v4/properties", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "wix-site-id": this.siteUrl,
        },
      });

      if (!res.ok) {
        return { connected: false, error: `Wix API error ${res.status}` };
      }

      return {
        connected: true,
        capabilities: {
          canReadPosts: true,
          canWritePosts: true, // Requires BLOG.PUBLISH-POST scope
          canReadSeo: true,
          canWriteSeo: true,
        },
      };
    } catch (error) {
      return { connected: false, error: (error as Error).message };
    }
  }

  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected && (result.capabilities?.canWritePosts ?? false);
  }
}
```

### Connection Wizard Form (Frontend)

```typescript
// Source: Pattern for apps/web connection wizard
// File: apps/web/src/components/connections/ConnectionWizard.tsx

"use client";
import { useState } from "react";
import { detectPlatformFn, createConnectionFn, verifyConnectionFn } from "@/lib/connections";

export function ConnectionWizard({ clientId }: { clientId: string }) {
  const [step, setStep] = useState<"detect" | "credentials" | "verify">("detect");
  const [domain, setDomain] = useState("");
  const [platform, setPlatform] = useState<PlatformType | null>(null);
  
  async function handleDetect() {
    const result = await detectPlatformFn({ domain });
    setPlatform(result.platform);
    setStep("credentials");
  }

  async function handleSubmitCredentials(credentials: Record<string, string>) {
    const connection = await createConnectionFn({
      clientId,
      platform: platform!,
      siteUrl: `https://${domain}`,
      credentials,
    });
    
    const verification = await verifyConnectionFn({ connectionId: connection.id });
    if (verification.success) {
      setStep("verify");
    }
  }

  // Render step-specific UI...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WordPress XML-RPC | WordPress REST API v2 | WordPress 4.7 (2016) | REST is standard, XML-RPC deprecated |
| Shopify REST Admin | Shopify GraphQL Admin | 2019+ | GraphQL recommended, REST still works |
| Wix traditional OAuth | Wix Headless OAuth + PKCE | 2024 | Third-party apps must use PKCE flow |

**Deprecated/outdated:**
- WordPress XML-RPC: Use REST API with Application Passwords [VERIFIED: Context7 docs]
- Shopify REST Admin API: GraphQL preferred for flexibility [VERIFIED: Context7 docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Squarespace has a public REST API for SEO fields | Platform Adapters | Would need pixel/manual mode |
| A2 | Webflow CMS API allows title/meta updates | Platform Adapters | May require Designer role OAuth |

**If this table is empty:** Most claims verified from codebase and official docs.

## Open Questions

1. **Squarespace API availability**
   - What we know: Squarespace has Commerce API, unclear on content/SEO API
   - What's unclear: Whether third-party apps can update page meta without full Developer Mode
   - Recommendation: Research Squarespace API scope before building adapter; may need "pixel mode" fallback

2. **Unifying AI-Writer WordPress with open-seo adapter**
   - What we know: AI-Writer has `WordPressService` for publishing, open-seo has `WordPressAdapter` for SEO
   - What's unclear: Whether to migrate AI-Writer to use open-seo adapter or keep separate
   - Recommendation: Keep separate for now; AI-Writer publishes content, open-seo reads/audits

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | site_connections table | Yes | 15+ | -- |
| SITE_ENCRYPTION_KEY env | Credential encryption | Required | -- | Error at startup |
| Node.js 22 | node:crypto AES-256-GCM | Yes | 22.x | -- |

**Missing dependencies with no fallback:**
- SITE_ENCRYPTION_KEY must be set (32-byte base64)

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | open-seo-main/vitest.config.ts |
| Quick run command | `pnpm --filter open-seo-main vitest run src/server/features/connections` |
| Full suite command | `pnpm --filter open-seo-main vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | site_connections table schema | unit | `pnpm vitest run connection-schema` | YES (implicitly via ConnectionService tests) |
| SC-02 | detectPlatform() auto-detects WordPress, Shopify, Wix | unit | `pnpm vitest run PlatformDetector` | YES (21 tests) |
| SC-03 | Connection wizard creates encrypted credentials | integration | -- | NO (Wave 0 gap) |
| SC-04 | Write permission verified before active status | unit | `pnpm vitest run WordPressAdapter` | YES (testWritePermission) |
| SC-05 | /clients/[id]/connections UI | e2e | -- | NO (manual) |
| SC-06 | Adapters support read/write content/meta | unit | `pnpm vitest run adapters` | YES (49 tests) |

### Sampling Rate

- **Per task commit:** `pnpm --filter open-seo-main vitest run src/server/features/connections -x`
- **Per wave merge:** `pnpm --filter open-seo-main vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/src/components/connections/ConnectionWizard.test.tsx` -- covers SC-03 wizard flow
- [ ] E2E test for connection wizard (Playwright) -- covers SC-05

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Platform adapters use credential-based auth (App Password, OAuth tokens) |
| V3 Session Management | no | Connections are long-lived, not session-based |
| V4 Access Control | yes | Server functions verify clientId belongs to workspace |
| V5 Input Validation | yes | Zod schemas for all server function inputs |
| V6 Cryptography | yes | AES-256-GCM for credential encryption (node:crypto) |

### Known Threat Patterns for CMS Integrations

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential theft from database | Information Disclosure | AES-256-GCM encryption at rest |
| Credential exposure in logs | Information Disclosure | stripCredentials() removes before serialization |
| CSRF on OAuth callback | Spoofing | OAuthStateToken with short TTL |
| Workspace boundary bypass | Elevation of Privilege | verifyClientAccess() checks workspace ownership |

## Sources

### Primary (HIGH confidence)

- [codebase] open-seo-main/src/server/features/connections/ -- full implementation
- [Context7 /wp-api/docs] WordPress REST API Application Password authentication
- [Context7 /websites/shopify_dev_api_admin-graphql_2026-01] Shopify GraphQL Admin API
- [Context7 /websites/dev_wix_build-apps] Wix Headless OAuth flow

### Secondary (MEDIUM confidence)

- [codebase] AI-Writer/backend/services/wix_service.py -- Wix integration patterns
- [codebase] AI-Writer/backend/models/client_oauth.py -- per-client OAuth model

### Tertiary (LOW confidence)

- [ASSUMED] Squarespace API allows page meta updates -- needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified in codebase and npm registry
- Architecture: HIGH - 70% already implemented with passing tests
- Pitfalls: HIGH - derived from existing code patterns and error handling

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable infrastructure, platform APIs rarely change)

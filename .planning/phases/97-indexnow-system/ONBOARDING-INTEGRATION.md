# Phase 97: IndexNow Onboarding Integration

> **Zero Extra Steps - IndexNow as Part of CMS Connection Flow**
>
> Created: 2026-05-08
> Status: Design Complete
> Extends: SPEC.md, EXECUTION-PLAN.md, VIBE-CODED-PLATFORM-INTEGRATION.md

---

## Executive Summary

This document specifies how IndexNow integrates into the **existing** CMS connection onboarding flow. The goal is **zero extra steps** for users — IndexNow setup happens automatically during platform connection.

**Key Principle:** When a user connects their WordPress, Shopify, or other CMS, IndexNow is configured automatically. No separate setup wizard. No manual key deployment for supported platforms.

---

## 1. Integration Architecture

### 1.1 Current Connection Flow (Before IndexNow)

```
USER ONBOARDING
═══════════════

┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Client     │────►│  Select Platform │────►│  OAuth Connect   │
│   Dashboard  │     │  (WordPress,     │     │  (Authenticate   │
│              │     │   Shopify, etc.) │     │   with CMS)      │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Connection      │
                                              │  Stored in DB    │
                                              │                  │
                                              │  site_connections│
                                              └──────────────────┘
```

### 1.2 New Connection Flow (With IndexNow)

```
USER ONBOARDING (ENHANCED)
══════════════════════════

┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Client     │────►│  Select Platform │────►│  OAuth Connect   │
│   Dashboard  │     │  (WordPress,     │     │  (Authenticate   │
│              │     │   Shopify, etc.) │     │   with CMS)      │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Platform        │
                                              │  Adapter         │
                                              │  Initialization  │
                                              └────────┬─────────┘
                                                       │
                     ┌─────────────────────────────────┼─────────────────────────────────┐
                     │                                 │                                 │
                     ▼                                 ▼                                 ▼
            ┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
            │ WordPress        │           │ Shopify          │           │ Other Platform   │
            │                  │           │                  │           │                  │
            │ 1. Detect SEO    │           │ 1. Check Files   │           │ 1. Cloudflare    │
            │    Plugin        │           │    API access    │           │    Detection     │
            │ 2. If Rank Math/ │           │ 2. Create key    │           │ 2. If CF: Enable │
            │    SEOPress:     │           │    file via      │           │    Crawler Hints │
            │    AUTO-HANDLED  │           │    fileCreate    │           │    dashboard     │
            │ 3. Else: Deploy  │           │ 3. Create URL    │           │ 3. Else: Manual  │
            │    key via REST  │           │    redirect      │           │    Instructions  │
            └────────┬─────────┘           └────────┬─────────┘           └────────┬─────────┘
                     │                              │                              │
                     └──────────────────────────────┴──────────────────────────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  AUTO-VERIFY     │
                                           │  Key Deployment  │
                                           │                  │
                                           │  GET /{key}.txt  │
                                           │  Check response  │
                                           └────────┬─────────┘
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              │                                           │
                              ▼                                           ▼
                     ┌──────────────────┐                       ┌──────────────────┐
                     │  SUCCESS         │                       │  NEEDS MANUAL    │
                     │                  │                       │                  │
                     │  Status: ACTIVE  │                       │  Show platform-  │
                     │  IndexNow ready  │                       │  specific steps  │
                     │  to submit URLs  │                       │  in success      │
                     │                  │                       │  screen sidebar  │
                     └──────────────────┘                       └──────────────────┘
                                                                         │
                                                                         ▼
                                                                ┌──────────────────┐
                                                                │  FALLBACK MODE   │
                                                                │                  │
                                                                │  Use TeveroSEO   │
                                                                │  owned key until │
                                                                │  client verifies │
                                                                └──────────────────┘
```

---

## 2. IndexNowCapableAdapter Interface

### 2.1 Adapter Interface Definition

Extend the existing `PlatformAdapter` interface with IndexNow capabilities:

```typescript
// open-seo-main/src/server/features/connections/adapters/types.ts

import { IndexNowConfig, IndexNowDeployResult } from "@/db/indexnow-schema";

export interface IndexNowCapabilities {
  /**
   * Automation feasibility score (1-5)
   * 5 = Full automation via API
   * 4 = Guided automation (user installs plugin, we configure)
   * 3 = Semi-automated (webhook-based, requires manual trigger)
   * 2 = Workaround only (Cloudflare bypass, redirects)
   * 1 = Not viable (manual instructions only)
   */
  automationScore: 1 | 2 | 3 | 4 | 5;
  
  /** Can we auto-deploy the key file without user action? */
  canAutoDeploy: boolean;
  
  /** Does the platform have native IndexNow support? */
  hasNativeSupport: boolean;
  
  /** Native plugin/app that handles IndexNow (if any) */
  nativePlugin?: string;
  
  /** Requires OAuth scope for IndexNow operations */
  requiredScopes?: string[];
}

export interface IndexNowCapableAdapter extends PlatformAdapter {
  /**
   * Get IndexNow capabilities for this platform
   */
  getIndexNowCapabilities(): IndexNowCapabilities;
  
  /**
   * Check if IndexNow is already configured (plugin installed, native support active)
   * @returns Plugin/app name if detected, null if not configured
   */
  detectExistingIndexNow(
    connectionId: string
  ): Promise<{ configured: boolean; plugin?: string; method?: string }>;
  
  /**
   * Deploy IndexNow key file to the platform
   * @param apiKey The IndexNow API key to deploy
   * @returns Deployment result with verification URL
   */
  deployIndexNowKey(
    connectionId: string,
    apiKey: string
  ): Promise<IndexNowDeployResult>;
  
  /**
   * Verify that the key file is accessible at the expected URL
   * @param domain The domain to verify
   * @param apiKey The expected key content
   */
  verifyIndexNowKey(
    domain: string,
    apiKey: string
  ): Promise<{ verified: boolean; error?: string }>;
  
  /**
   * Get the current IndexNow status for this connection
   */
  getIndexNowStatus(
    connectionId: string
  ): Promise<{
    status: "active" | "pending" | "not_configured" | "native_handled";
    verificationUrl?: string;
    lastVerified?: Date;
    plugin?: string;
  }>;
}

export interface IndexNowDeployResult {
  success: boolean;
  method: "api_deploy" | "plugin_native" | "redirect_created" | "manual_required";
  verificationUrl: string;
  manualInstructions?: string[];
  error?: string;
  pluginDetected?: string;
}
```

### 2.2 BaseAdapter Extension

```typescript
// open-seo-main/src/server/features/connections/adapters/BaseAdapter.ts

export abstract class BaseAdapter implements PlatformAdapter {
  // ... existing methods ...
  
  /**
   * Default IndexNow implementation for platforms without special support
   */
  getIndexNowCapabilities(): IndexNowCapabilities {
    return {
      automationScore: 1,
      canAutoDeploy: false,
      hasNativeSupport: false,
    };
  }
  
  async detectExistingIndexNow(connectionId: string): Promise<{
    configured: boolean;
    plugin?: string;
    method?: string;
  }> {
    return { configured: false };
  }
  
  async deployIndexNowKey(
    connectionId: string,
    apiKey: string
  ): Promise<IndexNowDeployResult> {
    // Default: manual instructions required
    const domain = await this.getDomainForConnection(connectionId);
    return {
      success: false,
      method: "manual_required",
      verificationUrl: `https://${domain}/${apiKey}.txt`,
      manualInstructions: this.getGenericManualInstructions(apiKey, domain),
    };
  }
  
  async verifyIndexNowKey(
    domain: string,
    apiKey: string
  ): Promise<{ verified: boolean; error?: string }> {
    try {
      const url = `https://${domain}/${apiKey}.txt`;
      const response = await fetch(url, {
        headers: { "User-Agent": "TeveroSEO-IndexNow-Verifier/1.0" },
      });
      
      if (!response.ok) {
        return { verified: false, error: `HTTP ${response.status}` };
      }
      
      const content = await response.text();
      const verified = content.trim() === apiKey;
      
      return {
        verified,
        error: verified ? undefined : "Content mismatch",
      };
    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : "Fetch failed",
      };
    }
  }
  
  protected getGenericManualInstructions(apiKey: string, domain: string): string[] {
    return [
      `1. Create a text file named: ${apiKey}.txt`,
      `2. File content should be exactly: ${apiKey}`,
      `3. Upload this file to your website root directory`,
      `4. The file must be accessible at: https://${domain}/${apiKey}.txt`,
      `5. Click "Verify" to confirm deployment`,
    ];
  }
}
```

---

## 3. Platform-Specific Adapter Implementations

### 3.1 WordPress Adapter

```typescript
// open-seo-main/src/server/features/connections/adapters/WordPressAdapter.ts

export class WordPressAdapter extends BaseAdapter implements IndexNowCapableAdapter {
  
  // SEO plugins with native IndexNow support
  private static readonly INDEXNOW_PLUGINS = {
    "rankmath": { namespace: "rankmath/v1", autoSubmit: true },
    "seopress": { namespace: "seopress/v1", autoSubmit: true },
    "yoast": { namespace: "yoast/v1", autoSubmit: true, premium: false },
    "aioseo": { namespace: "aioseo/v1", autoSubmit: true },
    "indexnow-ms": { namespace: "indexnow/v1", autoSubmit: true },
  };
  
  getIndexNowCapabilities(): IndexNowCapabilities {
    return {
      automationScore: 5,
      canAutoDeploy: true,
      hasNativeSupport: true,
      nativePlugin: "Rank Math, SEOPress, Yoast, AIOSEO, or Microsoft IndexNow",
      requiredScopes: ["read", "write"], // Application Password
    };
  }
  
  async detectExistingIndexNow(connectionId: string): Promise<{
    configured: boolean;
    plugin?: string;
    method?: string;
  }> {
    const connection = await this.getConnection(connectionId);
    const baseUrl = connection.siteUrl;
    
    // Check for known SEO plugin REST API namespaces
    for (const [pluginId, config] of Object.entries(WordPressAdapter.INDEXNOW_PLUGINS)) {
      try {
        const response = await this.wpFetch(
          connectionId,
          `/wp-json/${config.namespace}/indexnow/status`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.enabled) {
            return {
              configured: true,
              plugin: pluginId,
              method: "native_plugin",
            };
          }
        }
      } catch {
        // Plugin not installed or endpoint doesn't exist
      }
    }
    
    // Check plugin list via REST API
    try {
      const plugins = await this.wpFetch(connectionId, "/wp-json/wp/v2/plugins");
      if (plugins.ok) {
        const pluginList = await plugins.json();
        
        for (const plugin of pluginList) {
          const slug = plugin.plugin?.toLowerCase() || "";
          
          if (slug.includes("rank-math") || slug.includes("rankmath")) {
            return { configured: true, plugin: "rankmath", method: "native_plugin" };
          }
          if (slug.includes("seopress")) {
            return { configured: true, plugin: "seopress", method: "native_plugin" };
          }
          if (slug.includes("indexnow")) {
            return { configured: true, plugin: "indexnow-ms", method: "native_plugin" };
          }
        }
      }
    } catch {
      // Plugin list not accessible
    }
    
    return { configured: false };
  }
  
  async deployIndexNowKey(
    connectionId: string,
    apiKey: string
  ): Promise<IndexNowDeployResult> {
    const connection = await this.getConnection(connectionId);
    const domain = new URL(connection.siteUrl).hostname;
    const verificationUrl = `https://${domain}/${apiKey}.txt`;
    
    // Step 1: Check if SEO plugin handles IndexNow natively
    const existingConfig = await this.detectExistingIndexNow(connectionId);
    if (existingConfig.configured && existingConfig.plugin) {
      return {
        success: true,
        method: "plugin_native",
        verificationUrl,
        pluginDetected: existingConfig.plugin,
      };
    }
    
    // Step 2: Try to store key in wp_options and deploy endpoint
    try {
      // Store key in wp_options
      await this.wpFetch(connectionId, "/wp-json/wp/v2/settings", {
        method: "POST",
        body: JSON.stringify({
          tevero_indexnow_key: apiKey,
        }),
      });
      
      // Check if our endpoint code is installed (mu-plugin or theme function)
      const endpointCheck = await fetch(verificationUrl);
      if (endpointCheck.ok) {
        const content = await endpointCheck.text();
        if (content.trim() === apiKey) {
          return {
            success: true,
            method: "api_deploy",
            verificationUrl,
          };
        }
      }
      
      // Key stored but endpoint not serving - provide PHP snippet
      return {
        success: false,
        method: "manual_required",
        verificationUrl,
        manualInstructions: this.getWordPressInstructions(apiKey, domain),
      };
    } catch (error) {
      return {
        success: false,
        method: "manual_required",
        verificationUrl,
        manualInstructions: this.getWordPressInstructions(apiKey, domain),
        error: error instanceof Error ? error.message : "API error",
      };
    }
  }
  
  private getWordPressInstructions(apiKey: string, domain: string): string[] {
    return [
      "Option A: Install a free SEO plugin with IndexNow support",
      "  - Rank Math SEO (recommended) - IndexNow enabled by default",
      "  - SEOPress - Enable IndexNow in settings",
      "  - Microsoft IndexNow plugin - Official implementation",
      "",
      "Option B: Add code to your theme's functions.php:",
      "```php",
      "add_action('init', function() {",
      `    $key = '${apiKey}';`,
      "    if ($_SERVER['REQUEST_URI'] === '/' . $key . '.txt') {",
      "        header('Content-Type: text/plain');",
      "        echo $key;",
      "        exit;",
      "    }",
      "}, 1);",
      "```",
      "",
      `Verify at: https://${domain}/${apiKey}.txt`,
    ];
  }
  
  private async wpFetch(
    connectionId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const connection = await this.getConnection(connectionId);
    const credentials = await this.decryptCredentials(connection.credentialsEncrypted);
    
    const url = `${connection.siteUrl}${endpoint}`;
    const authHeader = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });
  }
}
```

### 3.2 Shopify Adapter

```typescript
// open-seo-main/src/server/features/connections/adapters/ShopifyAdapter.ts

export class ShopifyAdapter extends BaseAdapter implements IndexNowCapableAdapter {
  
  getIndexNowCapabilities(): IndexNowCapabilities {
    return {
      automationScore: 3,
      canAutoDeploy: true, // Via Files API + Redirect
      hasNativeSupport: false,
      requiredScopes: ["write_files", "write_content"],
    };
  }
  
  async deployIndexNowKey(
    connectionId: string,
    apiKey: string
  ): Promise<IndexNowDeployResult> {
    const connection = await this.getConnection(connectionId);
    const domain = connection.shopDomain;
    const verificationUrl = `https://${domain}/${apiKey}.txt`;
    
    try {
      // Step 1: Create key file via Files API
      const fileResult = await this.createKeyFile(connectionId, apiKey);
      if (!fileResult.success) {
        throw new Error(fileResult.error);
      }
      
      // Step 2: Create URL redirect to serve the file
      const redirectResult = await this.createKeyRedirect(
        connectionId,
        apiKey,
        fileResult.fileUrl!
      );
      
      if (redirectResult.success) {
        return {
          success: true,
          method: "redirect_created",
          verificationUrl,
        };
      }
      
      // Redirect failed but file uploaded - partial success
      return {
        success: false,
        method: "manual_required",
        verificationUrl,
        manualInstructions: this.getShopifyInstructions(apiKey, domain),
        error: redirectResult.error,
      };
    } catch (error) {
      return {
        success: false,
        method: "manual_required",
        verificationUrl,
        manualInstructions: this.getShopifyInstructions(apiKey, domain),
        error: error instanceof Error ? error.message : "Deployment failed",
      };
    }
  }
  
  private async createKeyFile(
    connectionId: string,
    apiKey: string
  ): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
    const connection = await this.getConnection(connectionId);
    
    const mutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            ... on GenericFile {
              url
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    // Create a data URL for the key file content
    const fileContent = Buffer.from(apiKey).toString("base64");
    
    const response = await this.shopifyGraphQL(connectionId, mutation, {
      files: [{
        alt: "IndexNow verification key",
        contentType: "TEXT_PLAIN",
        originalSource: `data:text/plain;base64,${fileContent}`,
      }],
    });
    
    if (response.data?.fileCreate?.userErrors?.length > 0) {
      return {
        success: false,
        error: response.data.fileCreate.userErrors[0].message,
      };
    }
    
    return {
      success: true,
      fileUrl: response.data?.fileCreate?.files?.[0]?.url,
    };
  }
  
  private async createKeyRedirect(
    connectionId: string,
    apiKey: string,
    targetUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    const mutation = `
      mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
        urlRedirectCreate(urlRedirect: $urlRedirect) {
          urlRedirect {
            id
            path
            target
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const response = await this.shopifyGraphQL(connectionId, mutation, {
      urlRedirect: {
        path: `/${apiKey}.txt`,
        target: targetUrl,
      },
    });
    
    if (response.data?.urlRedirectCreate?.userErrors?.length > 0) {
      return {
        success: false,
        error: response.data.urlRedirectCreate.userErrors[0].message,
      };
    }
    
    return { success: true };
  }
  
  private getShopifyInstructions(apiKey: string, domain: string): string[] {
    return [
      "Option A: Install TinyIMG app (free IndexNow support)",
      "  1. Go to Shopify App Store",
      "  2. Install 'TinyIMG SEO, Image Optimizer'",
      "  3. Enable IndexNow in app settings",
      "",
      "Option B: Manual file + redirect setup",
      "  1. Go to Settings > Files",
      "  2. Upload a text file named: indexnow-key.txt",
      `  3. File content: ${apiKey}`,
      "  4. Copy the file URL (e.g., cdn.shopify.com/...)",
      "  5. Go to Online Store > Navigation > URL Redirects",
      `  6. Create redirect: /${apiKey}.txt → [file URL]`,
      "",
      `Verify at: https://${domain}/${apiKey}.txt`,
    ];
  }
}
```

### 3.3 Wix Adapter

```typescript
// open-seo-main/src/server/features/connections/adapters/WixAdapter.ts

export class WixAdapter extends BaseAdapter implements IndexNowCapableAdapter {
  
  getIndexNowCapabilities(): IndexNowCapabilities {
    return {
      automationScore: 4,
      canAutoDeploy: false, // Wix handles natively on Premium
      hasNativeSupport: true,
      nativePlugin: "Wix built-in (Premium plans only)",
    };
  }
  
  async detectExistingIndexNow(connectionId: string): Promise<{
    configured: boolean;
    plugin?: string;
    method?: string;
  }> {
    // Wix Premium plans have IndexNow enabled by default
    const connection = await this.getConnection(connectionId);
    
    // Check plan via Wix API
    try {
      const siteInfo = await this.wixFetch(connectionId, "/site-properties/v4/properties");
      if (siteInfo.premium) {
        return {
          configured: true,
          plugin: "wix-native",
          method: "platform_native",
        };
      }
    } catch {
      // API access failed
    }
    
    return { configured: false };
  }
  
  async deployIndexNowKey(
    connectionId: string,
    apiKey: string
  ): Promise<IndexNowDeployResult> {
    const connection = await this.getConnection(connectionId);
    const domain = connection.siteDomain;
    const verificationUrl = `https://${domain}/${apiKey}.txt`;
    
    const existing = await this.detectExistingIndexNow(connectionId);
    
    if (existing.configured) {
      return {
        success: true,
        method: "plugin_native",
        verificationUrl,
        pluginDetected: "Wix Native IndexNow",
      };
    }
    
    // Non-premium plan - suggest upgrade or Cloudflare bypass
    return {
      success: false,
      method: "manual_required",
      verificationUrl,
      manualInstructions: [
        "Wix has native IndexNow support on Premium plans.",
        "",
        "Option A: Upgrade to Wix Premium",
        "  - IndexNow is automatically enabled",
        "  - No configuration needed",
        "",
        "Option B: Use Cloudflare (if custom domain)",
        "  1. Route your domain through Cloudflare",
        "  2. Enable Crawler Hints in Cloudflare dashboard",
        "  3. Cache > Configuration > Crawler Hints: ON",
      ],
    };
  }
}
```

---

## 4. Top 15 CMS Automation Matrix

| # | Platform | Market % | Auto Score | Auto-Deploy | Native Support | Best Strategy |
|---|----------|----------|------------|-------------|----------------|---------------|
| 1 | **WordPress** | 43% | **5/5** | ✅ REST API | ✅ Plugins | Detect SEO plugin → auto-handled |
| 2 | **Shopify** | 6% | **3/5** | ✅ Files+Redirect | ❌ Apps only | GraphQL fileCreate + urlRedirect |
| 3 | **Wix** | 3.5% | **4/5** | ❌ Platform | ✅ Premium | Verify Premium, else Cloudflare |
| 4 | **Squarespace** | 3% | **2/5** | ❌ | ❌ | Cloudflare Crawler Hints |
| 5 | **Joomla** | 2.5% | **4/5** | ✅ REST API | ✅ Extensions | Detect Aimy/4SEO → configure |
| 6 | **Drupal** | 1.5% | **5/5** | ✅ JSON:API | ✅ Modules | Detect Index Now module |
| 7 | **Webflow** | 1% | **2/5** | ❌ CDN | ❌ | Cloudflare Crawler Hints |
| 8 | **Magento** | 1% | **5/5** | ✅ REST API | ✅ Extensions | Detect Webkul extension |
| 9 | **PrestaShop** | 1% | **4/5** | ✅ Web Services | ✅ Modules | Detect Op'art/WebKul |
| 10 | **BigCommerce** | 0.5% | **3/5** | ❌ Webhooks | ❌ Apps only | Register webhooks + submit |
| 11 | **Weebly** | 0.5% | **1/5** | ❌ | ❌ | Cloudflare only |
| 12 | **Ghost** | 0.3% | **3/5** | ❌ Webhooks | ❌ | Webhook + Lambda |
| 13 | **Blogger** | 0.3% | **1/5** | ❌ | ❌ | Cloudflare only (Google-owned) |
| 14 | **HubSpot** | 0.3% | **2/5** | ❌ | ❌ | Content API + redirect |
| 15 | **Headless CMS** | Growing | **4/5** | ✅ Webhooks | ❌ | Deploy hook integration |

### Tier Classification

**Tier 1 - Full Automation (Score 4-5):**
WordPress, Drupal, Magento, Wix Premium, Joomla, PrestaShop, Headless

**Tier 2 - Partial Automation (Score 3):**
Shopify, BigCommerce, Ghost

**Tier 3 - Cloudflare Bypass (Score 1-2):**
Squarespace, Webflow, Weebly, Blogger, HubSpot

---

## 5. Database Schema Changes

### 5.1 Link Connections to IndexNow Config

```typescript
// open-seo-main/src/db/indexnow-schema.ts

import { pgTable, text, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { siteConnections } from "./platform-connection-schema";

export const indexnowConfig = pgTable("indexnow_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  
  // Link to site_connections table
  connectionId: uuid("connection_id").references(() => siteConnections.id),
  
  // API Key (encrypted)
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  
  // Key source tracking
  keySource: text("key_source", { enum: ["client_key", "tevero_fallback", "plugin_native", "manual_pending"] })
    .notNull()
    .default("manual_pending"),
  
  // Detected plugin (for WordPress, Drupal, etc.)
  detectedPlugin: text("detected_plugin"),
  
  // Per-domain verification status
  verificationStatus: jsonb("verification_status").$type<Record<string, {
    status: "verified" | "pending" | "failed" | "native_handled";
    verifiedAt?: string;
    lastError?: string;
  }>>().default({}),
  
  // Platform-specific metadata
  platformMetadata: jsonb("platform_metadata").$type<{
    platform: string;
    automationScore: number;
    deploymentMethod?: string;
    shopifyFileId?: string;
    shopifyRedirectId?: string;
  }>(),
  
  // Settings
  enabled: boolean("enabled").default(true),
  teveroFallbackEnabled: boolean("tevero_fallback_enabled").default(true),
  
  // Statistics
  submissionsToday: integer("submissions_today").default(0),
  submissionsTotal: integer("submissions_total").default(0),
  lastSubmittedAt: timestamp("last_submitted_at", { withTimezone: true }),
  lastError: text("last_error"),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Index for fast lookups by connection
export const indexnowConfigConnectionIdx = index("indexnow_config_connection_idx")
  .on(indexnowConfig.connectionId);
```

### 5.2 Migration SQL

```sql
-- Migration: Add IndexNow fields to support connection integration

ALTER TABLE indexnow_config
ADD COLUMN connection_id UUID REFERENCES site_connections(id),
ADD COLUMN key_source TEXT DEFAULT 'manual_pending',
ADD COLUMN detected_plugin TEXT,
ADD COLUMN platform_metadata JSONB DEFAULT '{}',
ADD COLUMN tevero_fallback_enabled BOOLEAN DEFAULT true;

-- Add constraint for key_source enum
ALTER TABLE indexnow_config
ADD CONSTRAINT indexnow_config_key_source_check
CHECK (key_source IN ('client_key', 'tevero_fallback', 'plugin_native', 'manual_pending'));

-- Create index for connection lookups
CREATE INDEX indexnow_config_connection_idx ON indexnow_config(connection_id);

-- Backfill existing configs with connection links (run manually)
-- UPDATE indexnow_config ic
-- SET connection_id = (
--   SELECT sc.id FROM site_connections sc
--   WHERE sc.client_id = ic.client_id
--   AND sc.site_url LIKE '%' || (ic.verification_status::jsonb->0->>'domain') || '%'
--   LIMIT 1
-- );
```

---

## 6. Onboarding Service Integration

### 6.1 Connection Onboarding Hook

```typescript
// open-seo-main/src/server/features/connections/services/ConnectionOnboardingService.ts

import { IndexNowService } from "@/server/features/indexing/IndexNowService";
import { getAdapterForPlatform } from "../adapters";

export class ConnectionOnboardingService {
  private indexNowService = new IndexNowService();
  
  /**
   * Called after a platform connection is successfully established
   */
  async onConnectionEstablished(
    clientId: string,
    connectionId: string,
    platform: string
  ): Promise<{
    indexNowConfigured: boolean;
    indexNowStatus: string;
    manualStepsRequired?: string[];
  }> {
    const adapter = getAdapterForPlatform(platform);
    
    // Check if adapter supports IndexNow
    if (!this.isIndexNowCapable(adapter)) {
      return {
        indexNowConfigured: false,
        indexNowStatus: "Platform does not support IndexNow automation",
      };
    }
    
    const indexNowAdapter = adapter as IndexNowCapableAdapter;
    const capabilities = indexNowAdapter.getIndexNowCapabilities();
    
    // Step 1: Check for existing IndexNow configuration
    const existing = await indexNowAdapter.detectExistingIndexNow(connectionId);
    if (existing.configured) {
      // Native plugin handles everything
      await this.indexNowService.createConfigForConnection({
        clientId,
        connectionId,
        keySource: "plugin_native",
        detectedPlugin: existing.plugin,
        status: "native_handled",
      });
      
      return {
        indexNowConfigured: true,
        indexNowStatus: `IndexNow handled by ${existing.plugin}`,
      };
    }
    
    // Step 2: Generate API key
    const apiKey = this.indexNowService.generateApiKey();
    
    // Step 3: Attempt auto-deployment
    const deployResult = await indexNowAdapter.deployIndexNowKey(connectionId, apiKey);
    
    // Step 4: Store config
    await this.indexNowService.createConfigForConnection({
      clientId,
      connectionId,
      apiKey,
      keySource: deployResult.success ? "client_key" : "manual_pending",
      platformMetadata: {
        platform,
        automationScore: capabilities.automationScore,
        deploymentMethod: deployResult.method,
      },
    });
    
    // Step 5: If deployed, attempt verification
    if (deployResult.success) {
      const connection = await this.getConnection(connectionId);
      const domain = new URL(connection.siteUrl).hostname;
      
      // Wait briefly for deployment to propagate
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const verification = await indexNowAdapter.verifyIndexNowKey(domain, apiKey);
      
      if (verification.verified) {
        await this.indexNowService.markDomainVerified(clientId, domain);
        
        return {
          indexNowConfigured: true,
          indexNowStatus: "IndexNow configured and verified",
        };
      }
    }
    
    // Auto-deployment failed or not supported - return manual steps
    return {
      indexNowConfigured: false,
      indexNowStatus: deployResult.pluginDetected
        ? `Install ${deployResult.pluginDetected} plugin for automatic IndexNow`
        : "Manual setup required",
      manualStepsRequired: deployResult.manualInstructions,
    };
  }
  
  private isIndexNowCapable(adapter: PlatformAdapter): adapter is IndexNowCapableAdapter {
    return "getIndexNowCapabilities" in adapter;
  }
}
```

### 6.2 Updated Connection Success Screen

The connection success screen should show IndexNow status inline:

```typescript
// apps/web/src/features/connections/components/ConnectionSuccessScreen.tsx

interface ConnectionSuccessProps {
  connection: SiteConnection;
  indexNowStatus: {
    configured: boolean;
    status: string;
    manualSteps?: string[];
  };
}

export function ConnectionSuccessScreen({ connection, indexNowStatus }: ConnectionSuccessProps) {
  return (
    <div className="space-y-6">
      {/* Main success message */}
      <Alert variant="success">
        <CheckCircle className="h-5 w-5" />
        <AlertTitle>Connected to {connection.platform}</AlertTitle>
        <AlertDescription>
          {connection.siteUrl} is now connected to TeveroSEO
        </AlertDescription>
      </Alert>
      
      {/* IndexNow status - inline, not separate wizard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Instant Search Engine Indexing
          </CardTitle>
          <CardDescription>
            IndexNow notifies Bing, Yandex, and other search engines when content changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {indexNowStatus.configured ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{indexNowStatus.status}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span>{indexNowStatus.status}</span>
              </div>
              
              {indexNowStatus.manualSteps && (
                <Collapsible>
                  <CollapsibleTrigger className="text-sm text-muted-foreground">
                    Setup instructions (optional)
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <InstructionViewer
                      instructions={indexNowStatus.manualSteps}
                      verificationUrl={`https://${connection.domain}/${connection.indexNowKey}.txt`}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Fallback option */}
              <div className="text-sm text-muted-foreground">
                <span>Or enable </span>
                <Button variant="link" className="p-0 h-auto">
                  TeveroSEO fallback mode
                </Button>
                <span> to use our shared IndexNow key (submissions still work)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Continue button */}
      <Button className="w-full" onClick={onContinue}>
        Continue to Dashboard
      </Button>
    </div>
  );
}
```

---

## 7. Cloudflare Detection Integration

For platforms without native support, detect Cloudflare and offer Crawler Hints:

```typescript
// open-seo-main/src/server/features/indexing/cloudflare/CloudflareDetector.ts

export async function detectCloudflareAndOffer(
  domain: string
): Promise<{
  usesCloudflare: boolean;
  crawlerHintsAvailable: boolean;
  dashboardUrl?: string;
  instructions?: string[];
}> {
  try {
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "manual",
    });
    
    const cfRay = response.headers.get("cf-ray");
    const server = response.headers.get("server");
    
    if (cfRay || server?.toLowerCase().includes("cloudflare")) {
      return {
        usesCloudflare: true,
        crawlerHintsAvailable: true,
        dashboardUrl: `https://dash.cloudflare.com/?to=/:account/${domain}/caching/configuration`,
        instructions: [
          "Great news! Your site uses Cloudflare.",
          "",
          "Enable Crawler Hints for automatic IndexNow:",
          "1. Go to Cloudflare Dashboard",
          "2. Select your site",
          "3. Navigate to: Caching > Configuration",
          "4. Toggle ON: Crawler Hints",
          "",
          "That's it! Cloudflare will automatically notify IndexNow on content changes.",
        ],
      };
    }
    
    return {
      usesCloudflare: false,
      crawlerHintsAvailable: false,
    };
  } catch {
    return {
      usesCloudflare: false,
      crawlerHintsAvailable: false,
    };
  }
}
```

---

## 8. Migration Service for Existing Connections

```typescript
// open-seo-main/src/server/features/indexing/services/IndexNowMigrationService.ts

export class IndexNowMigrationService {
  /**
   * Backfill IndexNow configs for existing connections
   */
  async migrateExistingConnections(): Promise<{
    total: number;
    configured: number;
    nativeDetected: number;
    manualRequired: number;
  }> {
    const connections = await db.query.siteConnections.findMany({
      where: isNull(indexnowConfig.connectionId),
    });
    
    let configured = 0;
    let nativeDetected = 0;
    let manualRequired = 0;
    
    for (const connection of connections) {
      const adapter = getAdapterForPlatform(connection.platform);
      
      if (!this.isIndexNowCapable(adapter)) {
        manualRequired++;
        continue;
      }
      
      const indexNowAdapter = adapter as IndexNowCapableAdapter;
      
      // Check for native support
      const existing = await indexNowAdapter.detectExistingIndexNow(connection.id);
      
      if (existing.configured) {
        await this.indexNowService.createConfigForConnection({
          clientId: connection.clientId,
          connectionId: connection.id,
          keySource: "plugin_native",
          detectedPlugin: existing.plugin,
          status: "native_handled",
        });
        nativeDetected++;
        configured++;
      } else {
        // Create pending config - will be set up on next visit
        const apiKey = this.indexNowService.generateApiKey();
        await this.indexNowService.createConfigForConnection({
          clientId: connection.clientId,
          connectionId: connection.id,
          apiKey,
          keySource: "manual_pending",
        });
        manualRequired++;
      }
    }
    
    return {
      total: connections.length,
      configured,
      nativeDetected,
      manualRequired,
    };
  }
}
```

---

## 9. Implementation Checklist

### Phase 1: Core Integration (Days 1-2)
- [ ] Add `connection_id` to indexnow_config schema
- [ ] Create IndexNowCapableAdapter interface
- [ ] Implement BaseAdapter IndexNow methods
- [ ] Run migration for schema changes

### Phase 2: Platform Adapters (Days 3-5)
- [ ] WordPress adapter with SEO plugin detection
- [ ] Shopify adapter with Files API + Redirect
- [ ] Wix adapter with Premium detection
- [ ] Cloudflare detection for fallback platforms

### Phase 3: Onboarding Integration (Days 6-7)
- [ ] ConnectionOnboardingService.onConnectionEstablished()
- [ ] Update connection success screen with IndexNow status
- [ ] Add manual instruction display for unsupported platforms
- [ ] Enable TeveroSEO fallback mode option

### Phase 4: Migration & Testing (Days 8-9)
- [ ] IndexNowMigrationService for existing connections
- [ ] Run migration on staging
- [ ] E2E test of full onboarding flow
- [ ] Verify IndexNow submissions work

---

## 10. Success Criteria

1. **Zero Extra Steps**: User connects WordPress → IndexNow auto-configured (if SEO plugin detected)
2. **Graceful Degradation**: Platforms without automation show inline instructions + fallback option
3. **Native Detection**: WordPress SEO plugins detected in 90%+ of cases
4. **Shopify Automation**: Files API + Redirect works for 80%+ of Shopify stores
5. **Cloudflare Bypass**: Offered automatically for Squarespace, Webflow, etc.
6. **Fallback Mode**: TeveroSEO key works when client key not verified

---

## References

- [SPEC.md](./SPEC.md) - Core IndexNow system specification
- [EXECUTION-PLAN.md](./EXECUTION-PLAN.md) - 9-day implementation timeline
- [VIBE-CODED-PLATFORM-INTEGRATION.md](./VIBE-CODED-PLATFORM-INTEGRATION.md) - Vercel/Netlify integration
- [INDEXNOW-CMS-INTEGRATION-MATRIX.md](../../research/INDEXNOW-CMS-INTEGRATION-MATRIX.md) - Full platform analysis
- [Existing adapters](../../../../open-seo-main/src/server/features/connections/adapters/) - Platform adapter patterns

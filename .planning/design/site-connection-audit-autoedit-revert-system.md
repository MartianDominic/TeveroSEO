# Site Connection, Audit, Auto-Edit, and Revert System

**Design Date:** 2026-04-22  
**Status:** Design Complete  
**Scope:** End-to-end system for agency SEO platform

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENCY DASHBOARD (Next.js)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Site Connection │  Audit Dashboard  │  Auto-Edit Panel  │  Revert Center   │
│      Wizard      │                   │                   │                   │
└────────┬─────────┴─────────┬─────────┴─────────┬─────────┴─────────┬────────┘
         │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BFF API LAYER (Next.js API Routes)                   │
│  /api/connections  │  /api/audits  │  /api/edits  │  /api/reverts           │
└────────┬───────────┴───────┬───────┴───────┬─────┴───────┬──────────────────┘
         │                   │               │             │
         ▼                   ▼               ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OPEN-SEO BACKEND (Node.js/Express)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Connection  │  │    Audit     │  │   Edit       │  │   Revert     │    │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         ▼                 ▼                 ▼                 ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PLATFORM ADAPTERS                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │WordPress │ │ Shopify  │ │  Wix     │ │Squarespace│ │  Custom  │  │   │
│  │  │ Adapter  │ │ Adapter  │ │ Adapter  │ │  Adapter │ │ Adapter  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└────────┬─────────────────────┬─────────────────────┬───────────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  PostgreSQL  │      │    Redis     │      │   BullMQ     │
│  (Drizzle)   │      │   (Cache)    │      │   (Queues)   │
└──────────────┘      └──────────────┘      └──────────────┘
```

---

## 2. Site Connection Methods

### 2.1 Platform Detection & Connection Matrix

| Platform | Detection Method | Connection Type | Required Permissions |
|----------|------------------|-----------------|---------------------|
| WordPress | `/wp-json/` probe | REST API + App Password | `edit_posts`, `edit_pages`, `upload_files` |
| WordPress (WPEngine) | X-Powered-By header | REST API + JWT | Same as WordPress |
| Shopify | `cdn.shopify.com` in HTML | Admin API (OAuth) | `write_content`, `read_themes`, `write_themes` |
| Wix | `wix.com` in HTML | Wix Headless API | Site Content Manager access |
| Squarespace | `squarespace.com` in HTML | Squarespace API | Content editing permissions |
| Webflow | `webflow.io` or SDK | Webflow CMS API | Designer or Editor role |
| Custom/Unknown | Manual config | Pixel injection | DOM access via JS |

### 2.2 Connection Flow

```
┌───────────────┐
│  Enter Domain │
└───────┬───────┘
        │
        ▼
┌───────────────────┐
│ Platform Detection │
│ - Probe /wp-json/ │
│ - Check CDN refs  │
│ - Analyze headers │
└───────┬───────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  Platform Detected?                    │
└───────┬───────────────────────────────────────┬───────┘
        │ Yes                                   │ No
        ▼                                       ▼
┌───────────────────┐                  ┌───────────────────┐
│ Platform-Specific │                  │   Pixel/Script    │
│ OAuth/API Setup   │                  │   Injection Mode  │
└───────┬───────────┘                  └───────┬───────────┘
        │                                      │
        ▼                                      ▼
┌───────────────────┐                  ┌───────────────────┐
│ Store Credentials │                  │ Generate Snippet  │
│ (encrypted)       │                  │ Client Installs   │
└───────┬───────────┘                  └───────┬───────────┘
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Verify Access   │
                  │ Test CRUD Ops   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Connection      │
                  │ Established     │
                  └─────────────────┘
```

### 2.3 WordPress Connection (Most Common)

```typescript
interface WordPressConnection {
  type: 'wordpress';
  siteUrl: string;
  authMethod: 'app_password' | 'jwt' | 'oauth';
  credentials: {
    username?: string;
    appPassword?: string;  // Encrypted at rest
    jwtToken?: string;
    oauthTokens?: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    };
  };
  capabilities: {
    canEditPosts: boolean;
    canEditPages: boolean;
    canEditMedia: boolean;
    canEditTheme: boolean;
    pluginInstalled: boolean;  // Our SEO plugin for advanced features
  };
  lastVerified: Date;
}
```

### 2.4 Shopify Connection (E-commerce)

```typescript
interface ShopifyConnection {
  type: 'shopify';
  shopDomain: string;
  accessToken: string;  // From OAuth flow
  scopes: string[];
  webhookSecret: string;
  capabilities: {
    canEditProducts: boolean;
    canEditPages: boolean;
    canEditCollections: boolean;
    canEditMetafields: boolean;
    canEditTheme: boolean;
  };
}
```

### 2.5 Pixel/Script Mode (Fallback)

For platforms without APIs or custom sites:

```typescript
interface PixelConnection {
  type: 'pixel';
  siteUrl: string;
  pixelId: string;  // Unique identifier
  pixelScript: string;  // JS to inject
  installMethod: 'gtm' | 'manual' | 'plugin';
  capabilities: {
    canReadDOM: boolean;
    canSuggestChanges: boolean;  // Shows suggestions, user applies manually
    canAutoEdit: false;  // Never auto-edit without API access
  };
  lastSeen: Date;  // Last time pixel phoned home
}
```

---

## 3. Audit Pipeline

### 3.1 Data Collection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT ORCHESTRATOR                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Crawl                Phase 2: Analyze             Phase 3: AI     │
│  ──────────────                ────────────────             ─────────────   │
│  DataForSEO raw_html           Rule-based checks            Claude/Gemini   │
│  Page-by-page crawl            Pattern matching             Semantic review │
│  JS rendering handled          Scoring algorithms           Recommendations │
│                                                                              │
└────────┬───────────────────────────┬───────────────────────────┬────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Page Analysis  │         │  SEO Findings   │         │  AI Insights    │
│  - Meta tags    │         │  - Issues       │         │  - Summary      │
│  - Headings     │         │  - Severity     │         │  - Priorities   │
│  - Content      │         │  - Category     │         │  - Quick wins   │
│  - Links        │         │  - Fix recipes  │         │  - Strategy     │
│  - Images       │         │                 │         │                 │
│  - Schema       │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### 3.2 What We Scrape/Fetch

| Data Type | Source | Storage |
|-----------|--------|---------|
| Raw HTML | DataForSEO raw_html | Temporary (24h cache) |
| Page metadata | Cheerio parsing | `audit_pages` table |
| Lighthouse scores | PageSpeed API | `audit_lighthouse_results` |
| Schema.org data | JSON-LD extraction | `audit_pages.structured_data` |
| Internal link graph | Crawl analysis | `audit_links` table |
| Image inventory | Cheerio parsing | `audit_images` table |
| Core Web Vitals | CrUX API or PSI | `audit_lighthouse_results` |

### 3.3 Analysis Structure

#### Rule-Based Checks (Deterministic)

```typescript
const RULE_BASED_CHECKS = {
  // Meta Tags
  'meta.title.missing': { severity: 'critical', category: 'meta_tags' },
  'meta.title.too_short': { severity: 'warning', category: 'meta_tags' },
  'meta.title.too_long': { severity: 'warning', category: 'meta_tags' },
  'meta.title.duplicate': { severity: 'error', category: 'meta_tags' },
  'meta.description.missing': { severity: 'error', category: 'meta_tags' },
  'meta.description.too_short': { severity: 'warning', category: 'meta_tags' },
  'meta.description.too_long': { severity: 'warning', category: 'meta_tags' },
  'meta.description.duplicate': { severity: 'error', category: 'meta_tags' },
  
  // Headings
  'headings.h1.missing': { severity: 'critical', category: 'headings' },
  'headings.h1.multiple': { severity: 'warning', category: 'headings' },
  'headings.h1.too_long': { severity: 'info', category: 'headings' },
  'headings.hierarchy.broken': { severity: 'warning', category: 'headings' },
  
  // Images
  'images.alt.missing': { severity: 'error', category: 'images' },
  'images.alt.too_long': { severity: 'info', category: 'images' },
  'images.size.too_large': { severity: 'warning', category: 'images' },
  'images.format.not_webp': { severity: 'info', category: 'images' },
  
  // URLs
  'urls.too_long': { severity: 'info', category: 'urls' },
  'urls.uppercase': { severity: 'warning', category: 'urls' },
  'urls.special_chars': { severity: 'warning', category: 'urls' },
  'urls.multiple_slashes': { severity: 'error', category: 'urls' },
  
  // Links
  'links.internal.broken': { severity: 'critical', category: 'links' },
  'links.external.broken': { severity: 'warning', category: 'links' },
  'links.nofollow.internal': { severity: 'warning', category: 'links' },
  'links.orphan_pages': { severity: 'error', category: 'links' },
  
  // Schema
  'schema.missing': { severity: 'warning', category: 'schema' },
  'schema.invalid': { severity: 'error', category: 'schema' },
  'schema.incomplete': { severity: 'info', category: 'schema' },
  
  // Performance
  'performance.lcp.poor': { severity: 'error', category: 'performance' },
  'performance.cls.poor': { severity: 'error', category: 'performance' },
  'performance.inp.poor': { severity: 'error', category: 'performance' },
  
  // Content
  'content.thin': { severity: 'warning', category: 'content' },
  'content.duplicate': { severity: 'error', category: 'content' },
  'content.keyword_stuffing': { severity: 'warning', category: 'content' },
};
```

#### AI Analysis (Semantic/Contextual)

Use AI for:
- Content quality assessment
- Keyword opportunity identification
- Competitor gap analysis
- Strategic recommendations
- Executive summaries

Do NOT use AI for:
- Missing tag detection (rule-based is faster/cheaper)
- Broken link checks (deterministic)
- Schema validation (can be rule-based)
- Image size checks (deterministic)

### 3.4 Audit Findings JSON Schema

```typescript
interface AuditFinding {
  id: string;                    // UUID
  auditId: string;               // FK to audits table
  pageId: string | null;         // FK to audit_pages (null for site-wide)
  
  // Classification
  checkId: string;               // e.g., 'meta.title.missing'
  category: AuditCategory;       // 'meta_tags' | 'headings' | 'images' | etc.
  severity: 'critical' | 'error' | 'warning' | 'info';
  
  // Details
  element: string | null;        // CSS selector or XPath
  currentValue: string | null;   // What it currently is
  expectedValue: string | null;  // What it should be
  suggestedFix: string | null;   // AI or rule-based suggestion
  
  // Auto-edit capability
  autoEditable: boolean;         // Can we fix this automatically?
  editRecipe: EditRecipe | null; // How to fix (if auto-editable)
  
  // Status
  status: 'open' | 'fixed' | 'ignored' | 'wont_fix';
  fixedAt: Date | null;
  fixedByChangeId: string | null; // FK to site_changes
  
  createdAt: Date;
}

type AuditCategory = 
  | 'meta_tags'
  | 'headings'
  | 'content'
  | 'images'
  | 'links'
  | 'urls'
  | 'schema'
  | 'performance'
  | 'accessibility'
  | 'mobile'
  | 'security';

interface EditRecipe {
  type: 'meta' | 'heading' | 'image' | 'content' | 'link' | 'schema';
  action: 'add' | 'update' | 'remove';
  target: {
    selector?: string;       // CSS selector
    xpath?: string;          // XPath
    field?: string;          // API field name (e.g., 'meta_description')
  };
  value: string;             // New value to set
  platform: {
    wordpress?: WordPressEditInstructions;
    shopify?: ShopifyEditInstructions;
    generic?: GenericEditInstructions;
  };
}
```

---

## 4. Auto-Edit System

### 4.1 Edit Workflow

```
┌─────────────────┐
│  Audit Finding  │
│  (auto-editable)│
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Generate Preview   │
│  - Before/After     │
│  - Visual diff      │
│  - Impact estimate  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐     ┌─────────────────────┐
│  User Approval?     │────▶│  Batch Selection    │
│  (single or batch)  │     │  (group by category)│
└────────┬────────────┘     └──────────┬──────────┘
         │                             │
         ▼                             ▼
┌─────────────────────────────────────────────────────┐
│                  EDIT EXECUTION                      │
├─────────────────────────────────────────────────────┤
│  1. Create change record (BEFORE state)             │
│  2. Execute via platform adapter                    │
│  3. Verify change applied                           │
│  4. Update change record (AFTER state, verified)    │
│  5. Mark finding as 'fixed'                         │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Change Committed   │
│  Revertable anytime │
└─────────────────────┘
```

### 4.2 Platform-Specific Edit Adapters

#### WordPress Adapter

```typescript
interface WordPressEditAdapter {
  // Meta fields
  updatePostMeta(postId: number, meta: {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonical?: string;
  }): Promise<ChangeResult>;
  
  // Content
  updatePostContent(postId: number, content: string): Promise<ChangeResult>;
  updatePostTitle(postId: number, title: string): Promise<ChangeResult>;
  
  // Images
  updateImageAlt(attachmentId: number, alt: string): Promise<ChangeResult>;
  
  // Schema (requires Yoast or custom field)
  updateSchemaMarkup(postId: number, schema: object): Promise<ChangeResult>;
  
  // Bulk operations
  bulkUpdateMeta(updates: PostMetaUpdate[]): Promise<ChangeResult[]>;
}

interface ChangeResult {
  success: boolean;
  changeId: string;
  beforeState: object;
  afterState: object;
  verifiedAt: Date | null;
  error?: string;
}
```

#### Shopify Adapter

```typescript
interface ShopifyEditAdapter {
  // Products
  updateProductSEO(productId: string, meta: {
    title?: string;
    description?: string;
    handle?: string;  // URL slug
  }): Promise<ChangeResult>;
  
  updateProductImageAlt(imageId: string, alt: string): Promise<ChangeResult>;
  
  // Pages
  updatePageSEO(pageId: string, meta: {
    title?: string;
    description?: string;
    handle?: string;
  }): Promise<ChangeResult>;
  
  // Collections
  updateCollectionSEO(collectionId: string, meta: {
    title?: string;
    description?: string;
    handle?: string;
  }): Promise<ChangeResult>;
  
  // Metafields (for schema, etc.)
  updateMetafield(ownerId: string, namespace: string, key: string, value: string): Promise<ChangeResult>;
}
```

### 4.3 Change Tracking Schema

```typescript
interface SiteChange {
  id: string;                    // UUID
  clientId: string;              // FK to clients
  connectionId: string;          // FK to site_connections
  
  // What changed
  changeType: ChangeType;
  category: AuditCategory;
  resourceType: 'post' | 'page' | 'product' | 'collection' | 'image' | 'setting';
  resourceId: string;            // Platform-specific ID
  resourceUrl: string;           // Full URL of the resource
  
  // Change details
  field: string;                 // e.g., 'meta_description', 'h1', 'alt_text'
  beforeValue: string | null;
  afterValue: string | null;
  beforeSnapshot: object | null; // Full object state before
  afterSnapshot: object | null;  // Full object state after
  
  // Provenance
  triggeredBy: 'audit' | 'manual' | 'scheduled' | 'ai_suggestion';
  auditId: string | null;        // FK to audits (if from audit)
  findingId: string | null;      // FK to audit_findings (if from finding)
  userId: string | null;         // Who approved (null if auto-approved)
  
  // Status
  status: 'pending' | 'applied' | 'verified' | 'reverted' | 'failed';
  appliedAt: Date | null;
  verifiedAt: Date | null;
  revertedAt: Date | null;
  revertedByChangeId: string | null;  // FK to the revert change
  
  // Grouping for batch operations
  batchId: string | null;        // Group related changes
  batchSequence: number | null;  // Order within batch
  
  createdAt: Date;
  updatedAt: Date;
}

type ChangeType = 
  | 'meta_title'
  | 'meta_description'
  | 'og_tags'
  | 'canonical'
  | 'h1'
  | 'headings'
  | 'image_alt'
  | 'image_filename'
  | 'url_slug'
  | 'internal_link'
  | 'external_link'
  | 'schema_markup'
  | 'content_body'
  | 'robots_meta';
```

---

## 5. Granular Revert System

### 5.1 Revert Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REVERT CENTER UI                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TIMELINE VIEW                                                       │   │
│  │  ─────────────                                                       │   │
│  │  [Today] ─── [Yesterday] ─── [Apr 20] ─── [Apr 19] ─── [Apr 18]    │   │
│  │      │           │              │            │            │          │   │
│  │      ▼           ▼              ▼            ▼            ▼          │   │
│  │   12 changes   8 changes    23 changes   5 changes   15 changes     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CATEGORY FILTERS                                                    │   │
│  │  ────────────────                                                    │   │
│  │  [x] Meta Tags (34)    [x] Headings (12)    [x] Images (45)         │   │
│  │  [x] URLs (8)          [x] Schema (5)       [ ] Content (0)          │   │
│  │  [x] Links (15)        [ ] Performance      [ ] All                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CHANGE LIST (filtered)                                              │   │
│  │  ─────────────────────                                               │   │
│  │                                                                       │   │
│  │  ☑ /products/barrel-sauna                                            │   │
│  │    ├─ ☑ Meta Title: "Buy Barrel Saunas" → "Premium Barrel Saunas"   │   │
│  │    ├─ ☑ Meta Desc: (empty) → "Discover our handcrafted..."          │   │
│  │    └─ ☐ H1: "Saunas" → "Barrel Saunas for Home & Garden"            │   │
│  │                                                                       │   │
│  │  ☐ /about                                                            │   │
│  │    └─ ☐ Meta Title: "About" → "About Helsinki Saunas | Est. 2005"   │   │
│  │                                                                       │   │
│  │  ☑ /products/harvia-heaters (3 changes)                              │   │
│  │  ☑ /contact (2 changes)                                              │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ACTIONS                                                             │   │
│  │  ───────                                                             │   │
│  │  [Revert Selected (7)]  [Revert All in Category]  [Revert to Date]  │   │
│  │                                                                       │   │
│  │  ⚠️  Preview Changes Before Reverting                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Revert Granularity Levels

```typescript
type RevertScope = 
  | { type: 'single'; changeId: string }                    // One specific change
  | { type: 'field'; resourceId: string; field: string }    // One field on one page
  | { type: 'resource'; resourceId: string }                // All changes to one page
  | { type: 'category'; category: AuditCategory }           // All changes in category
  | { type: 'batch'; batchId: string }                      // All changes in a batch
  | { type: 'date_range'; from: Date; to: Date }            // All changes in time range
  | { type: 'audit'; auditId: string }                      // All changes from one audit
  | { type: 'full'; }                                       // Everything (dangerous)
```

### 5.3 Revert Execution Flow

```
┌─────────────────┐
│  Revert Request │
│  (scope defined)│
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Resolve Changes    │
│  - Query by scope   │
│  - Filter active    │
│  - Sort by deps     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Dependency Check   │
│  - Later changes?   │
│  - Cascade needed?  │
└────────┬────────────┘
         │
         ├──────────────────────────────────┐
         │ Has Dependencies                 │ No Dependencies
         ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│  Show Cascade       │            │  Generate Preview   │
│  Warning            │            │  - Current state    │
│  - What else reverts│            │  - Will become      │
└────────┬────────────┘            └────────┬────────────┘
         │                                  │
         └──────────────────┬───────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  User Confirms  │
                   └────────┬────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  REVERT EXECUTION                        │
├─────────────────────────────────────────────────────────┤
│  For each change (in reverse chronological order):       │
│  1. Read current value from site                        │
│  2. Apply beforeValue from change record                │
│  3. Verify change applied                               │
│  4. Create revert change record                         │
│  5. Mark original change as 'reverted'                  │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Revert Complete    │
│  Show summary       │
└─────────────────────┘
```

### 5.4 Version History & Diff View

```typescript
interface ChangeHistory {
  resourceId: string;
  resourceUrl: string;
  resourceType: string;
  
  // Timeline of all values for a specific field
  fieldHistory: {
    field: string;
    versions: FieldVersion[];
  }[];
  
  // Aggregated view
  totalChanges: number;
  firstChangeAt: Date;
  lastChangeAt: Date;
  currentlyReverted: number;
}

interface FieldVersion {
  version: number;
  value: string | null;
  changedAt: Date;
  changedBy: string | null;  // User or 'system'
  changeId: string;
  isReverted: boolean;
  revertedAt: Date | null;
}

// Diff generation
interface DiffView {
  field: string;
  before: string | null;
  after: string | null;
  diffType: 'added' | 'removed' | 'modified';
  htmlDiff: string;  // Visual diff with highlighting
}
```

---

## 6. Safety & Rollback Mechanisms

### 6.1 Pre-Change Safety

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRE-CHANGE SAFETY CHECKLIST                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. BACKUP VERIFICATION                                                      │
│     ├─ Full page snapshot stored ✓                                          │
│     ├─ All current field values captured ✓                                  │
│     └─ Snapshot verified readable ✓                                         │
│                                                                              │
│  2. STAGING PREVIEW (if enabled)                                            │
│     ├─ Change applied to staging environment                                │
│     ├─ Visual regression test passed                                        │
│     └─ No console errors detected                                           │
│                                                                              │
│  3. IMPACT ASSESSMENT                                                        │
│     ├─ Affected URLs: 1                                                     │
│     ├─ Estimated traffic: 1,234 sessions/month                              │
│     └─ Risk level: LOW                                                      │
│                                                                              │
│  4. RATE LIMITING                                                           │
│     ├─ Changes today: 15/100 (workspace limit)                              │
│     ├─ Changes this hour: 3/20 (rate limit)                                 │
│     └─ Concurrent edits: 1/5                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Automatic Backup Strategy

```typescript
interface ChangeBackup {
  id: string;
  clientId: string;
  
  // What's backed up
  scope: 'page' | 'site' | 'category';
  resourceIds: string[];
  
  // Backup data
  snapshotData: {
    pages: PageSnapshot[];
    settings: SettingSnapshot[];
  };
  
  // Metadata
  createdAt: Date;
  createdBeforeChangeId: string | null;
  sizeBytes: number;
  
  // Retention
  expiresAt: Date;  // Auto-delete after 90 days
  isPinned: boolean;  // Never auto-delete
}

interface PageSnapshot {
  resourceId: string;
  resourceUrl: string;
  resourceType: string;
  
  // All SEO-relevant fields at snapshot time
  fields: {
    meta_title: string | null;
    meta_description: string | null;
    og_title: string | null;
    og_description: string | null;
    og_image: string | null;
    canonical: string | null;
    h1: string | null;
    headings: string[];
    content_hash: string;  // Not full content, just hash for change detection
    schema_markup: object | null;
    images: { src: string; alt: string | null }[];
  };
  
  capturedAt: Date;
}
```

### 6.3 Automatic Rollback Triggers

```typescript
interface RollbackTrigger {
  id: string;
  clientId: string;
  
  // Trigger conditions
  triggerType: 'traffic_drop' | 'ranking_drop' | 'error_spike' | 'manual';
  
  // Thresholds
  config: TrafficDropConfig | RankingDropConfig | ErrorSpikeConfig;
  
  // What to roll back
  rollbackScope: RevertScope;
  
  // Status
  isEnabled: boolean;
  lastTriggeredAt: Date | null;
  lastCheckAt: Date;
}

interface TrafficDropConfig {
  type: 'traffic_drop';
  metric: 'sessions' | 'pageviews' | 'users';
  threshold: number;  // Percentage drop (e.g., 20 = 20% drop)
  comparisonPeriod: 'previous_day' | 'previous_week' | 'previous_month';
  minimumBaseline: number;  // Don't trigger if baseline < this
  cooldownHours: number;  // Don't trigger again within this period
}

interface RankingDropConfig {
  type: 'ranking_drop';
  keywords: string[] | 'all_tracked';
  positionDrop: number;  // e.g., 5 = dropped 5+ positions
  minimumKeywords: number;  // Trigger if N+ keywords dropped
  cooldownHours: number;
}

interface ErrorSpikeConfig {
  type: 'error_spike';
  errorTypes: ('4xx' | '5xx' | 'console_error')[];
  threshold: number;  // Errors per hour
  cooldownHours: number;
}
```

### 6.4 Rollback Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTOMATIC ROLLBACK FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ GSC/GA4 Data │──┐                                                        │
│  └──────────────┘  │                                                        │
│                    │   ┌─────────────────┐                                  │
│  ┌──────────────┐  ├──▶│ Trigger Monitor │                                  │
│  │ Rank Tracker │──┤   │ (runs hourly)   │                                  │
│  └──────────────┘  │   └────────┬────────┘                                  │
│                    │            │                                            │
│  ┌──────────────┐  │            ▼                                            │
│  │ Error Logs   │──┘   ┌─────────────────┐                                  │
│  └──────────────┘      │ Threshold Check │                                  │
│                        └────────┬────────┘                                  │
│                                 │                                            │
│                    ┌────────────┴────────────┐                              │
│                    │                         │                              │
│                    ▼                         ▼                              │
│           ┌─────────────┐           ┌─────────────┐                         │
│           │ No Trigger  │           │  Triggered! │                         │
│           └─────────────┘           └──────┬──────┘                         │
│                                            │                                 │
│                                            ▼                                 │
│                                   ┌─────────────────┐                       │
│                                   │ Identify Recent │                       │
│                                   │ Changes (24-72h)│                       │
│                                   └────────┬────────┘                       │
│                                            │                                 │
│                                            ▼                                 │
│                                   ┌─────────────────┐                       │
│                                   │ Notify Team     │                       │
│                                   │ (Slack/Email)   │                       │
│                                   └────────┬────────┘                       │
│                                            │                                 │
│                         ┌──────────────────┴──────────────────┐             │
│                         │                                     │             │
│                         ▼                                     ▼             │
│                ┌─────────────────┐                   ┌─────────────────┐    │
│                │ Auto-Rollback   │                   │ Manual Review   │    │
│                │ (if configured) │                   │ Required        │    │
│                └────────┬────────┘                   └─────────────────┘    │
│                         │                                                    │
│                         ▼                                                    │
│                ┌─────────────────┐                                          │
│                │ Execute Revert  │                                          │
│                │ (staged rollback)│                                          │
│                └────────┬────────┘                                          │
│                         │                                                    │
│                         ▼                                                    │
│                ┌─────────────────┐                                          │
│                │ Monitor Recovery│                                          │
│                └─────────────────┘                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Models

### 7.1 Complete Schema (Drizzle ORM)

```typescript
// site-connections-schema.ts
import { pgTable, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";

export const siteConnections = pgTable("site_connections", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  
  // Platform info
  platform: text("platform").notNull(),  // 'wordpress' | 'shopify' | 'wix' | 'custom' | 'pixel'
  siteUrl: text("site_url").notNull(),
  
  // Credentials (encrypted)
  credentials: jsonb("credentials").$type<EncryptedCredentials>(),
  
  // Capabilities
  capabilities: jsonb("capabilities").$type<ConnectionCapabilities>(),
  
  // Status
  status: text("status").notNull().default("pending"),  // 'pending' | 'active' | 'error' | 'disconnected'
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ix_site_connections_client").on(table.clientId),
  index("ix_site_connections_platform").on(table.platform),
]);

// site-changes-schema.ts
export const siteChanges = pgTable("site_changes", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  connectionId: text("connection_id").notNull().references(() => siteConnections.id),
  
  // Classification
  changeType: text("change_type").notNull(),
  category: text("category").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  resourceUrl: text("resource_url").notNull(),
  
  // Change details
  field: text("field").notNull(),
  beforeValue: text("before_value"),
  afterValue: text("after_value"),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot"),
  
  // Provenance
  triggeredBy: text("triggered_by").notNull(),
  auditId: text("audit_id").references(() => audits.id),
  findingId: text("finding_id"),
  userId: text("user_id"),
  
  // Status
  status: text("status").notNull().default("pending"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
  revertedByChangeId: text("reverted_by_change_id"),
  
  // Batch grouping
  batchId: text("batch_id"),
  batchSequence: integer("batch_sequence"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ix_site_changes_client").on(table.clientId),
  index("ix_site_changes_category").on(table.category),
  index("ix_site_changes_status").on(table.status),
  index("ix_site_changes_resource").on(table.resourceId),
  index("ix_site_changes_batch").on(table.batchId),
  index("ix_site_changes_created").on(table.createdAt),
]);

// audit-findings-schema.ts
export const auditFindings = pgTable("audit_findings", {
  id: text("id").primaryKey(),
  auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => auditPages.id),
  
  // Classification
  checkId: text("check_id").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  
  // Details
  element: text("element"),
  currentValue: text("current_value"),
  expectedValue: text("expected_value"),
  suggestedFix: text("suggested_fix"),
  
  // Auto-edit
  autoEditable: boolean("auto_editable").notNull().default(false),
  editRecipe: jsonb("edit_recipe").$type<EditRecipe>(),
  
  // Status
  status: text("status").notNull().default("open"),
  fixedAt: timestamp("fixed_at", { withTimezone: true }),
  fixedByChangeId: text("fixed_by_change_id").references(() => siteChanges.id),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ix_audit_findings_audit").on(table.auditId),
  index("ix_audit_findings_category").on(table.category),
  index("ix_audit_findings_severity").on(table.severity),
  index("ix_audit_findings_status").on(table.status),
]);

// change-backups-schema.ts
export const changeBackups = pgTable("change_backups", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  
  // Scope
  scope: text("scope").notNull(),
  resourceIds: jsonb("resource_ids").$type<string[]>(),
  
  // Backup data
  snapshotData: jsonb("snapshot_data").$type<BackupSnapshot>(),
  
  // Metadata
  createdBeforeChangeId: text("created_before_change_id").references(() => siteChanges.id),
  sizeBytes: integer("size_bytes"),
  
  // Retention
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isPinned: boolean("is_pinned").notNull().default(false),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ix_change_backups_client").on(table.clientId),
  index("ix_change_backups_expires").on(table.expiresAt),
]);

// rollback-triggers-schema.ts
export const rollbackTriggers = pgTable("rollback_triggers", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  
  // Trigger config
  triggerType: text("trigger_type").notNull(),
  config: jsonb("config").$type<TriggerConfig>(),
  
  // Rollback scope
  rollbackScope: jsonb("rollback_scope").$type<RevertScope>(),
  
  // Status
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ix_rollback_triggers_client").on(table.clientId),
  index("ix_rollback_triggers_type").on(table.triggerType),
]);
```

---

## 8. UI/UX Flow for Revert Interface

### 8.1 Main Revert Center

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Revert Center                                            [← Back to Audit] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─── SUMMARY CARDS ────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │    Total     │  │   Applied    │  │   Reverted   │  │  Pending │ │   │
│  │  │   Changes    │  │   Changes    │  │   Changes    │  │  Changes │ │   │
│  │  │     156      │  │     142      │  │      8       │  │     6    │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── FILTER BAR ───────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Time: [All Time ▼]  Category: [All ▼]  Status: [Applied ▼]          │   │
│  │                                                                       │   │
│  │  Search: [🔍 Search by URL or field...                            ]   │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── CHANGE TIMELINE ──────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  ── Apr 22, 2026 (Today) ─────────────────────────────────────────── │   │
│  │                                                                       │   │
│  │  ☐ 14:32  /products/barrel-sauna          Meta Title    [View Diff]  │   │
│  │           "Buy Barrel Saunas" → "Premium Barrel Saunas | Helsinki"   │   │
│  │           Applied by: Auto-Edit (Audit #A-2026-0422)                 │   │
│  │                                                                       │   │
│  │  ☐ 14:32  /products/barrel-sauna          Meta Desc     [View Diff]  │   │
│  │           (empty) → "Discover our handcrafted Finnish barrel saunas" │   │
│  │           Applied by: Auto-Edit (Audit #A-2026-0422)                 │   │
│  │                                                                       │   │
│  │  ☐ 14:31  /products/harvia-heaters        Image Alt     [View Diff]  │   │
│  │           (empty) → "Harvia Electric Sauna Heater 9kW"               │   │
│  │           Applied by: Auto-Edit (Audit #A-2026-0422)                 │   │
│  │                                                                       │   │
│  │  ── Apr 21, 2026 ────────────────────────────────────────────────── │   │
│  │                                                                       │   │
│  │  ☐ 09:15  /about                          H1            [View Diff]  │   │
│  │           "About" → "About Helsinki Saunas - Finnish Craftsmen"      │   │
│  │           Applied by: Manual Edit (John D.)                          │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── BULK ACTIONS ─────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Selected: 0 changes                                                  │   │
│  │                                                                       │   │
│  │  [Select All Visible]  [Select by Category...]  [Select by Date...]  │   │
│  │                                                                       │   │
│  │  ─────────────────────────────────────────────────────────────────── │   │
│  │                                                                       │   │
│  │  [🔙 Revert Selected]   [📋 Export History]   [⚙️ Configure Triggers] │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Diff View Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Change Details                                                    [✕ Close]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  URL: https://helsinkisaunas.com/products/barrel-sauna                      │
│  Field: Meta Title                                                          │
│  Changed: Apr 22, 2026 at 14:32                                             │
│  By: Auto-Edit (Audit #A-2026-0422)                                         │
│                                                                              │
│  ┌─── VISUAL DIFF ──────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Before:                                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Buy Barrel Saunas                                              │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  After:                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Premium Barrel Saunas | Helsinki Saunas                        │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  Inline Diff:                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  [-Buy-]{+Premium+} Barrel Saunas {+| Helsinki Saunas+}         │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── VERSION HISTORY ──────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  v3 (current): "Premium Barrel Saunas | Helsinki Saunas"             │   │
│  │       ↑ Apr 22, 2026 - Auto-Edit                                     │   │
│  │                                                                       │   │
│  │  v2: "Buy Barrel Saunas"                                             │   │
│  │       ↑ Apr 15, 2026 - Manual Edit (John D.)                         │   │
│  │                                                                       │   │
│  │  v1 (original): "Barrel Saunas"                                      │   │
│  │       ↑ Jan 10, 2025 - Site created                                  │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── ACTIONS ──────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  [🔙 Revert to v2]  [🔙 Revert to v1]  [📋 Copy Current Value]       │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Batch Revert Confirmation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Confirm Revert                                                    [✕ Close]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ⚠️  You are about to revert 7 changes                                      │
│                                                                              │
│  ┌─── CHANGES TO REVERT ────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Meta Tags (3)                                                        │   │
│  │  ├─ /products/barrel-sauna → Meta Title                              │   │
│  │  ├─ /products/barrel-sauna → Meta Description                        │   │
│  │  └─ /products/harvia-heaters → Meta Title                            │   │
│  │                                                                       │   │
│  │  Images (4)                                                           │   │
│  │  ├─ /products/barrel-sauna → Image Alt (3 images)                    │   │
│  │  └─ /products/harvia-heaters → Image Alt (1 image)                   │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── DEPENDENCY WARNING ───────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  ℹ️  No dependent changes found. Safe to proceed.                    │   │
│  │                                                                       │   │
│  │  OR                                                                   │   │
│  │                                                                       │   │
│  │  ⚠️  2 later changes depend on these changes:                        │   │
│  │  - /products/barrel-sauna → Schema Markup (uses new title)           │   │
│  │  - /products/barrel-sauna → OG Tags (uses new description)           │   │
│  │                                                                       │   │
│  │  ☐ Also revert dependent changes                                     │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─── CONFIRMATION ─────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Type "REVERT" to confirm: [                    ]                     │   │
│  │                                                                       │   │
│  │  [Cancel]                              [🔙 Revert 7 Changes]          │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Database schema for connections, changes, findings
- Platform detection service
- WordPress adapter (most common platform)

### Phase 2: Audit Integration (Week 3-4)
- Audit findings schema with auto-edit recipes
- Rule-based checks generating findings
- Finding → Change workflow

### Phase 3: Auto-Edit Core (Week 5-6)
- Change execution engine
- Before/after snapshot capture
- Verification loop

### Phase 4: Revert System (Week 7-8)
- Revert execution engine
- Dependency resolution
- Version history queries

### Phase 5: UI (Week 9-10)
- Revert Center dashboard
- Diff viewer component
- Batch selection interface

### Phase 6: Safety (Week 11-12)
- Rollback triggers
- Monitoring integration
- Automatic backup cleanup

---

## 10. API Endpoints Summary

```
# Connections
POST   /api/connections              Create connection wizard
GET    /api/connections              List client connections
GET    /api/connections/:id          Get connection details
POST   /api/connections/:id/verify   Verify connection still works
DELETE /api/connections/:id          Disconnect site

# Audits (existing, enhanced)
POST   /api/audits                   Start audit with auto-edit options
GET    /api/audits/:id/findings      Get findings with edit recipes

# Changes
GET    /api/changes                  List changes (filtered)
GET    /api/changes/:id              Get change details
GET    /api/changes/:id/diff         Get visual diff
POST   /api/changes/preview          Preview changes before applying
POST   /api/changes/apply            Apply selected changes
GET    /api/changes/history/:resourceId  Get version history for resource

# Reverts
POST   /api/reverts/preview          Preview what would be reverted
POST   /api/reverts/execute          Execute revert
GET    /api/reverts/:id/status       Get revert operation status

# Triggers
GET    /api/triggers                 List rollback triggers
POST   /api/triggers                 Create trigger
PUT    /api/triggers/:id             Update trigger
DELETE /api/triggers/:id             Delete trigger
POST   /api/triggers/:id/test        Test trigger (dry run)
```

---

## 11. Security Considerations

1. **Credential Encryption**: All platform credentials encrypted at rest using AES-256
2. **Scope Limiting**: Request only minimum required permissions from platforms
3. **Audit Trail**: Every change logged with user attribution
4. **Rate Limiting**: Per-client and per-workspace change limits
5. **Verification**: All changes verified after application
6. **Rollback Access**: Only workspace admins can configure automatic rollbacks
7. **Backup Retention**: 90-day default, configurable per workspace
8. **Two-Factor for Destructive**: Require confirmation for bulk reverts

---

*Design complete: 2026-04-22*

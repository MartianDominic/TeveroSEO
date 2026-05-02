# Phase 66: Platform Unification — Research

**Researched:** 2026-05-02
**Agents Used:** 3 Opus subagents

---

## Research 1: Pixel/Script Integration Pattern (OtterSEO Approach)

### How It Works

The "pixel hack" used by tools like OTTO SEO (Search Atlas) and Alli AI is a client-side JavaScript overlay system. A small snippet (typically under 5KB) is added to the site's `<head>`. When the page loads, the script fetches optimization instructions from the vendor's server and manipulates the DOM in real-time - injecting/modifying meta tags, schema markup, titles, internal links, and content without touching the CMS backend.

**Key mechanism:** The script creates an encrypted overlay layer. Changes deploy through this overlay, meaning no FTP access, database modifications, or CMS credentials are required.

### Data Collection Capabilities
- Pageviews and session data
- Device/browser fingerprints
- Scroll depth and time on page
- Core Web Vitals (LCP, CLS, INP) via web-vitals library
- Click events and user interactions
- UTM parameters and referrer data
- JavaScript capabilities detection

### Action Capabilities
- **Meta tag injection:** Title tags, descriptions, canonical URLs
- **Schema markup:** JSON-LD structured data added to pages
- **Internal linking:** Dynamically inserted contextual links
- **Content modifications:** Text changes via visual editor
- **A/B testing:** Version rotation without source code changes
- **AI crawler serving:** Pre-rendered HTML for GPTBot/ClaudeBot

### Implementation Approach
```javascript
// Typical structure (simplified)
(function() {
  var config = { siteId: 'YOUR_SITE_ID', endpoint: 'https://api.vendor.com' };
  var script = document.createElement('script');
  script.src = config.endpoint + '/pixel.js?id=' + config.siteId;
  script.async = true;
  document.head.appendChild(script);
  
  // Once loaded, fetches optimization rules and applies DOM mutations
  // Uses MutationObserver to handle SPA navigation
})();
```

### Security Model
- Site ID validation ensures only authorized changes
- HTTPS-only communication
- Dashboard approval required before changes go live
- Full rollback capability with before/after tracking
- No access to server-side code or databases

### Comparison: OAuth vs Pixel

| Feature | OAuth (GSC/GA) | Pixel Script |
|---------|----------------|--------------|
| Setup complexity | API credentials, scopes | Copy-paste snippet |
| Data access | Historical analytics, Search Console queries | Real-time user behavior only |
| Action capability | Read-only (view data) | Write (modify DOM) |
| CMS independence | Requires API integration | Works on any platform |
| Persistence | Data retained after removal | Changes vanish on removal |
| AI crawler visibility | N/A | JavaScript invisible to AI crawlers |

**Critical limitation:** Client-side JS is invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot). This approach optimizes for Google but can hurt AI search discovery.

---

## Research 2: CMS Platform OAuth Matrix (Focus: Content Management Systems)

### Tier 1: Core CMS Platforms (SEO-Critical)

| Platform | Auth Type | READ Capabilities | WRITE Capabilities | SEO Relevance |
|----------|-----------|-------------------|--------------------| --------------|
| **WordPress REST API** | OAuth 2.0 / JWT / App Passwords | Posts, pages, media, users, taxonomies, custom fields | Create/update posts, pages, media, SEO metadata (via plugins) | **Critical** |
| **Shopify Admin API** | OAuth 2.0 | Products, collections, orders, customers, metafields, SEO metadata | Create/update products, collections, SEO fields (meta title/description), redirects | **Critical** |
| **Wix Headless** | OAuth 2.0 / API Key | Content, products, bookings, orders, members, blog posts | Create/update content, products, site data, blog posts | **High** |
| **Webflow API** | OAuth 2.0 / Site Token | CMS collections, items, site settings, published content | Create/update CMS items, collections, SEO fields | **High** |
| **Squarespace** | OAuth 2.0 / API Key | Products, orders, inventory, pages (limited) | Create/update products, inventory, orders (NO page content API) | **Medium** |

### Tier 2: E-commerce CMS

| Platform | Auth Type | READ Capabilities | WRITE Capabilities | SEO Relevance |
|----------|-----------|-------------------|--------------------| --------------|
| **WooCommerce REST API** | OAuth 1.0a / Basic Auth | Products, orders, customers, categories, tags | Create/update products, orders, product SEO data | **High** |
| **BigCommerce API** | OAuth 2.0 | Products, catalog, orders, customers, brands with SEO fields | Create/update products, brands with SEO metadata, redirects | **High** |
| **Magento/Adobe Commerce** | OAuth 1.0a / Token | Products, categories, customers, orders | Full CRUD on products, categories, CMS pages | **High** |
| **PrestaShop** | Webservice API Key | Products, categories, orders, customers | Create/update products, categories, CMS content | **Medium** |

### Tier 3: Headless CMS

| Platform | Auth Type | READ Capabilities | WRITE Capabilities | SEO Relevance |
|----------|-----------|-------------------|--------------------| --------------|
| **Contentful** | OAuth 2.0 / API Key | Entries, assets, content types, spaces, environments | Create/update/delete entries, assets, content types | **High** |
| **Sanity** | Token-based / API Key | Documents via GROQ, assets, datasets | Create/update/delete documents, assets, webhooks | **High** |
| **Strapi** | JWT / API Token | Content types, entries, media | Full CRUD on all content types | **High** |
| **Ghost** | Admin API Key | Posts, pages, tags, authors, members | Create/update posts, pages, tags, inject code | **High** |
| **Directus** | API Token / OAuth | Collections, items, files, users | Full CRUD on all collections | **Medium** |

### Tier 4: Website Builders

| Platform | Auth Type | READ Capabilities | WRITE Capabilities | SEO Relevance |
|----------|-----------|-------------------|--------------------| --------------|
| **HubSpot CMS** | OAuth 2.0 / API Key | Blog posts, pages, HubDB, forms, contacts, analytics | Create/update posts, pages, templates, URL mappings | **High** |
| **Drupal** | OAuth 2.0 / JWT | Nodes, taxonomy, users, media via JSON:API | Create/update nodes, taxonomy, media | **Medium** |
| **Joomla** | API Token | Articles, categories, users, media | Create/update articles, categories | **Medium** |
| **Weebly** | OAuth 2.0 | Pages, blog posts, products (limited) | Limited write access | **Low** |
| **GoDaddy Websites** | API Key | Limited | Very limited | **Low** |

### Tier 5: Enterprise CMS

| Platform | Auth Type | READ Capabilities | WRITE Capabilities | SEO Relevance |
|----------|-----------|-------------------|--------------------| --------------|
| **Adobe Experience Manager** | OAuth 2.0 / JWT | Content fragments, assets, pages via GraphQL/REST | Create/update content fragments, assets (author service) | **High** |
| **Sitecore** | OAuth / API Key | Items, media, layouts | Create/update items via Item Service | **Medium** |
| **Kentico** | REST API Key | Content items, assets, taxonomy | Create/update content items | **Medium** |

### Summary: CMS Platform Counts

| Category | Count | High SEO Write Value |
|----------|-------|---------------------|
| Core CMS | 5 | 4 (WordPress, Shopify, Wix, Webflow) |
| E-commerce | 4 | 3 (WooCommerce, BigCommerce, Magento) |
| Headless CMS | 5 | 4 (Contentful, Sanity, Strapi, Ghost) |
| Website Builders | 5 | 2 (HubSpot, Drupal) |
| Enterprise | 3 | 1 (AEM) |
| **Total** | **22** | **14** |

---

## Research 3: Phase 63-65 vs Phase 66 Overlap Analysis

### Overlap Matrix

| Phase | 63 (Keywords) | 64 (Crawling) | 65 (GraphRAG) | 66 (Platform) |
|-------|---------------|---------------|---------------|---------------|
| 63    | -             | LOW           | MEDIUM        | **NONE**      |
| 64    | LOW           | -             | MEDIUM        | **LOW**       |
| 65    | MEDIUM        | MEDIUM        | -             | **NONE**      |
| 66    | **NONE**      | **LOW**       | **NONE**      | -             |

### Analysis

**Phase 63 (Keyword Intelligence):**
- Focus: LLM-based keyword classification using Grok 4.1 cascade
- No dependency on platform integration
- Standalone AI/ML phase

**Phase 64 (Crawling Infrastructure):**
- Focus: Cost optimization via singleflight, delta crawling, queue lanes
- Phase 66 may USE crawling as fallback, but doesn't IMPLEMENT crawling
- Low overlap - consumer relationship, not producer

**Phase 65 (GraphRAG Foundation):**
- Focus: Knowledge graphs + embeddings for intelligent retrieval
- No relationship to platform integration
- Completely independent

**Phase 66 (Platform Unification):**
- Focus: Unified site connection (script + OAuth + fallback)
- Does NOT duplicate 63-65
- Different domain entirely

### Verdict

**Phases 63-65 remain SEPARATE from Phase 66.**

Reasons:
1. Different functional domains (AI classification, infrastructure, knowledge graphs vs platform connection)
2. No code overlap
3. Independent deployment
4. Different expertise required

**Phase 66 should be created as a NEW phase** that:
1. Unifies the scattered integration code (Phase 31/33 adapters + Phase 39 publishers + Phase 61 OAuth)
2. Adds the pixel/script approach as PRIMARY integration method
3. Provides simple UX for non-technical users

---

## Key Insight for Phase 66 Design

**The user wants SCRIPT-FIRST, not OAuth-first:**

| Priority | Method | Use Case |
|----------|--------|----------|
| **Primary** | TeveroPixel script | Works on ANY site, no credentials needed |
| **Secondary** | OAuth (for CMS that support it) | Enhanced data + write capabilities |
| **Tertiary** | Developer handoff | Complex setups, custom integrations |

This is the INVERSE of Phase 61's approach (which was OAuth-first, crawler-fallback).

---

*Research completed: 2026-05-02*

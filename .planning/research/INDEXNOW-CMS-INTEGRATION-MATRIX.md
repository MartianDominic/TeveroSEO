# IndexNow CMS Integration Matrix - Top 15 Platforms

> Research completed: May 2026
> Purpose: Document IndexNow integration capabilities for TeveroSEO automated deployment

## Executive Summary

This document provides a comprehensive analysis of IndexNow integration capabilities across the top 15 CMS platforms by market share. Key findings:

- **Native IndexNow Support**: WordPress (plugins), Wix (built-in), Shopify (apps), Joomla (extensions), Drupal (modules), PrestaShop (modules), Magento (extensions), BigCommerce (apps)
- **Workaround Required**: Squarespace, Webflow, Weebly, Ghost, Blogger, HubSpot
- **CDN Bypass Available**: Cloudflare Crawler Hints provides platform-agnostic IndexNow for ANY site using Cloudflare

---

## IndexNow Protocol Overview

**What is IndexNow?**
- Push-based protocol allowing websites to instantly notify search engines about content changes
- Supported by: **Bing, Yandex, Naver, Seznam, Yep** (Google does NOT support IndexNow)
- Submit to one engine, notification distributed to ALL participants within 10 seconds
- Supports batch submissions up to 10,000 URLs per request

**Implementation Requirements:**
1. Generate API key (8-128 hexadecimal characters)
2. Host verification file at domain root: `https://domain.com/{api-key}.txt`
3. Submit URLs via GET (single) or POST (batch) requests

---

## Comprehensive Platform Matrix

### Automation Feasibility Scoring (1-5)

| Score | Definition |
|-------|------------|
| **5** | Full automation via API/OAuth - no user intervention |
| **4** | Guided automation - user installs plugin, we configure |
| **3** | Semi-automated - manual steps required |
| **2** | Workaround only - complex setup, fragile |
| **1** | Not viable - no practical automation path |

---

## Platform-by-Platform Analysis

### 1. WordPress (43% Market Share)

**Detection Methods:**
- Meta tag: `<meta name="generator" content="WordPress X.X">`
- REST API Link header: `/wp-json/` endpoint
- Admin path: `/wp-admin/`
- Cookies: `wordpress_*`, `wp-settings-*`
- File patterns: `/wp-content/`, `/wp-includes/`

**IndexNow Support:** Native via plugins

**Plugins Available:**
| Plugin | Features | Cost |
|--------|----------|------|
| **Microsoft IndexNow** (Official) | Auto-generate key, auto-submit on publish/update/delete | Free |
| **AIOSEO** | One-click IndexNow + full SEO suite | Free/Pro |
| **Rank Math SEO** | Native IndexNow + schema markup | Free/Pro |
| **CrawlWP** | IndexNow + Google Indexing API + monitoring | $59/yr |
| **SEOPress** | Lightweight IndexNow support | Free/Pro |
| **Yoast SEO** | IndexNow support | Free/Pro |

**Automation Level:** Full API (5/5)

**API Capabilities:**
- REST API: Full CRUD on content, media, plugins
- File upload: Yes, via `/wp/v2/media` endpoint
- Plugin management: Yes, via `/wp/v2/plugins`
- OAuth: Full OAuth 2.0 support (via WordPress.com API or plugins)
- Application Passwords: Built-in since v5.6

**OAuth Availability:** Yes
- WordPress.com: Full OAuth 2.0 with scopes
- Self-hosted: Application Passwords (recommended) or OAuth plugins

**TeveroSEO Implementation:**
```
Strategy: "Plugin Install + Auto-Configure"
1. Detect WordPress via generator tag or REST API
2. Check if IndexNow plugin exists
3. If not: Prompt user to install Microsoft IndexNow plugin
4. If OAuth connected: Auto-install via REST API
5. Retrieve API key from plugin settings
6. Submit URLs directly to IndexNow (no plugin needed for submission)
```

**Automation Score: 5/5** - Full programmatic control

---

### 2. Shopify (6% Market Share)

**Detection Methods:**
- HTTP headers: `X-ShopId`, `X-Shopify-Stage`
- Cookies: `_shopify_y`, `_shopify_s`
- DNS CNAME: `shops.myshopify.com`
- JavaScript globals: `Shopify` object
- Endpoints: `/products.json`, `cdn.shopify.com`
- API calls: `graphql.json`, `myshopify.com`

**IndexNow Support:** Via apps (no native)

**Key Limitation:** Shopify blocks direct file uploads to root directory

**Apps Available:**
| App | Features | Cost |
|-----|----------|------|
| **IndexNow: for Google Search** | Auto-submit products, collections, pages | $1-5/mo |
| **TinyIMG** | One-click IndexNow + image optimization | Free/Paid |
| **IndexNow & ChatGPT Product Feeds** | IndexNow + AI feeds | Varies |

**Workaround for Manual Implementation:**
1. Store key file in external hosting (S3)
2. Create 301 redirect in Shopify to external file
3. Use webhooks to trigger submissions

**Automation Level:** Partial (3/5)

**API Capabilities:**
- REST Admin API: Full store management
- GraphQL Admin API: Advanced queries
- Asset API: Theme file management (requires `write_themes` scope)
- File Create: Via `fileCreate` mutation (images, videos, 3D models)
- Webhooks: Product/collection/page CRUD events

**OAuth Availability:** Yes (required for public apps)
- OAuth 2.0 for public apps
- Access tokens for custom apps
- Scopes: `write_themes` (exemption may be required)

**TeveroSEO Implementation:**
```
Strategy: "Webhook + External Submission"
1. Detect Shopify via X-ShopId header
2. If OAuth connected: Register webhooks for content changes
3. On webhook trigger: Extract URL and submit to IndexNow
4. Alternative: Guide user to install TinyIMG app
5. CDN bypass: Use Cloudflare Crawler Hints if available
```

**Automation Score: 3/5** - App install required, no direct key file hosting

---

### 3. Wix (3.5% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Wix.com Website Builder">`
- Hostnames: `*.wixsite.com`, `*.wix.com`
- JavaScript: Wix SDK globals
- HTTP headers: Wix-specific response patterns

**IndexNow Support:** Native (Premium plans only)

**How It Works:**
- Wix automatically detects page changes
- Submits URLs to IndexNow on behalf of users
- No configuration required (zero-touch)
- Available only on Premium plans

**Automation Level:** Full API for Premium (4/5)

**API Capabilities:**
- OAuth 2.0: Full support for apps
- Embedded Script API: Inject custom script tags
- Site Management: Limited to app functionality
- Custom code: Via Velo (Wix's development platform)

**OAuth Availability:** Yes
- OAuth 2.0 for third-party apps
- App scopes for specific permissions
- Embedded Script API for code injection

**TeveroSEO Implementation:**
```
Strategy: "Detection + Verification Only"
1. Detect Wix via hostname/generator
2. Verify Premium plan (IndexNow auto-enabled)
3. No action needed - Wix handles IndexNow automatically
4. For Free plans: Recommend upgrade or use Cloudflare
5. Monitor: Check Bing Webmaster Tools for submission status
```

**Automation Score: 4/5** - Native support but Premium-only

---

### 4. Squarespace (3% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Squarespace">`
- Hostnames: `*.squarespace.com`
- Script patterns: Squarespace-specific JS
- Admin path: `/config/` (authenticated)

**IndexNow Support:** Not native (workaround required)

**Key Limitation:** No root directory file uploads allowed

**Workaround Solutions:**
1. **Link Manager Redirect**: Upload key file elsewhere, use Squarespace redirect
2. **Third-party tools**: PageIndexer, IndexPlease
3. **Cloudflare Crawler Hints**: Best option if using Cloudflare

**Automation Level:** Guided manual (2/5)

**API Capabilities:**
- Commerce API: Orders, products, inventory, transactions
- Forms API: Zapier integration
- OAuth 2.0: For registered extensions
- API Keys: For direct integrations
- **Limitation**: No scope for user/member data, commerce-only

**OAuth Availability:** Yes (commerce-scoped only)
- OAuth 2.0 for Extensions
- API keys for simple integrations
- Limited to commerce endpoints

**TeveroSEO Implementation:**
```
Strategy: "External Tool + Cloudflare Bypass"
1. Detect Squarespace via generator
2. Check if Cloudflare is in front (via headers)
3. If Cloudflare: Enable Crawler Hints (one-click IndexNow)
4. If not: 
   a. Guide user to set up redirect workaround
   b. Or recommend IndexPlease/PageIndexer
5. Submit URLs via external service
```

**Automation Score: 2/5** - Requires workarounds

---

### 5. Joomla (2.5% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Joomla! - Open Source...">`
- Admin path: `/administrator/`
- File patterns: `/components/`, `/modules/`, `/plugins/`
- Headers: Joomla-specific session cookies

**IndexNow Support:** Via extensions

**Extensions Available:**
| Extension | Joomla Version | Features |
|-----------|----------------|----------|
| **Aimy IndexNow** | 3, 4, 5, 6 | Auto-submit on save |
| **Sitemap Generator with IndexNow** | 6 | Sitemap + IndexNow |
| **WT IndexNow** | 4, 5, 6 | Manual + auto submission |
| **4SEO** | 3, 4, 5, 6 | Full SEO suite + IndexNow |
| **JSitemap Pro** | All | Google Indexing API + IndexNow |
| **Content - Indexing API** | All | Google + IndexNow combined |

**Automation Level:** Full API (4/5)

**API Capabilities:**
- REST API: Native in Joomla 4+ (Web Services)
- Bearer Token authentication (HMAC-based)
- Basic Authentication available
- OAuth: Via extensions (miniOrange OAuth Server)
- File management: Limited without extensions

**OAuth Availability:** Via extension
- Native: Bearer token (API Token)
- Extension: miniOrange OAuth Server

**TeveroSEO Implementation:**
```
Strategy: "Extension Detection + API Submission"
1. Detect Joomla via generator tag
2. Check for installed IndexNow extension
3. If API access: Submit URLs directly
4. If no extension: Guide user to install Aimy IndexNow
5. Alternative: Direct IndexNow API submission (if key accessible)
```

**Automation Score: 4/5** - Good extension ecosystem

---

### 6. Drupal (1.5% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Drupal X">`
- Headers: `X-Drupal-Cache`, `X-Generator: Drupal`
- Paths: `/node/`, `/admin/`, `/sites/default/`
- File patterns: `/modules/`, `/themes/`

**IndexNow Support:** Via modules

**Modules Available:**
| Module | Drupal Version | Features |
|--------|----------------|----------|
| **Index Now** | 10, 11 | Auto-submit on CRUD | 794 sites |
| **Index Now Commerce** | 10, 11 | Commerce products |
| **Simple XML Sitemap** | 10, 11 | Sitemap + IndexNow (submodule) |

**Automation Level:** Full API (5/5)

**API Capabilities:**
- REST API: Comprehensive (core)
- JSON:API: Modern API standard (core)
- File uploads: Supported
- OAuth 2.0: Via Simple OAuth module
- External IdP: Keycloak, Okta, Azure AD integration

**OAuth Availability:** Yes
- Simple OAuth module (recommended)
- JSON:API + OAuth integration
- External Identity Provider support

**TeveroSEO Implementation:**
```
Strategy: "Module Detection + Direct API"
1. Detect Drupal via generator/headers
2. Check for Index Now module
3. If OAuth configured: Use JSON:API for content monitoring
4. Submit URLs via:
   - Drupal service: \Drupal::service('index_now.indexnow')->sendRequest($url)
   - Or direct IndexNow API
5. API key can be set in settings.php
```

**Automation Score: 5/5** - Excellent API and module support

---

### 7. Webflow (1% Market Share)

**Detection Methods:**
- Meta generator: `<meta generator="Webflow">`
- Scripts: `webflow.js`
- Hostnames: `*.webflow.io`
- Headers: Webflow-specific CDN patterns

**IndexNow Support:** Not native (workaround required)

**Key Limitation:** 
- CDN-hosted, no root-level file access
- No native IndexNow integration
- Feature request has only 76 votes (low priority)

**Workaround Solutions:**
1. **S3 + Redirect**: Host key file in S3, create 301 redirect
2. **Cloudflare Crawler Hints**: Best option
3. **Third-party tools**: Sight AI (purpose-built for Webflow)
4. **Python script**: Manual sitemap parsing + submission

**Automation Level:** Guided manual (2/5)

**API Capabilities:**
- CMS API: Full CRUD on collections and items
- OAuth 2.0: For multi-account apps
- Site API Tokens: For single-site integrations
- File uploads: Images via URL (max 4MB)
- **New in 2026**: Webflow Cloud (Next.js/Astro deployment)

**OAuth Availability:** Yes
- OAuth 2.0 for Webflow Apps
- Site API tokens for direct access

**TeveroSEO Implementation:**
```
Strategy: "Cloudflare Bypass or External Tool"
1. Detect Webflow via generator/hostname
2. Check for Cloudflare (via headers)
3. If Cloudflare: Enable Crawler Hints
4. If not: 
   a. Use CMS API to monitor content changes
   b. Submit to IndexNow via external service
   c. Or recommend Sight AI tool
5. Webhook alternative: CMS webhooks on publish
```

**Automation Score: 2/5** - No native support, workarounds needed

---

### 8. Adobe Commerce/Magento (1% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Magento"`
- Paths: `/checkout/`, `/customer/`, `/catalog/`
- Cookies: `PHPSESSID`, `mage-*`
- Headers: X-Magento-* headers

**IndexNow Support:** Via extensions

**Extensions Available:**
| Extension | Features |
|-----------|----------|
| **Webkul IndexNow Integration** | Auto/manual submission, CLI support, mass actions |

**Automation Level:** Full API (5/5)

**API Capabilities:**
- REST API: Comprehensive (products, orders, customers, etc.)
- GraphQL API: Modern queries
- SOAP API: Legacy support
- OAuth 1.0a: Full integration support
- Token authentication: Admin/customer tokens
- Async/Bulk REST: Via RabbitMQ (10,000+ items)

**OAuth Availability:** Yes
- OAuth 1.0a (industry standard)
- Token-based authentication
- Adobe IMS (Cloud Service)

**TeveroSEO Implementation:**
```
Strategy: "Extension + API Integration"
1. Detect Magento via generator/headers
2. Check for IndexNow extension
3. If OAuth configured:
   - Monitor product/category/CMS changes
   - Auto-submit URLs on change
4. CLI commands available for bulk submission
5. Extension handles auto-submission on deletion
```

**Automation Score: 5/5** - Powerful API, extension available

---

### 9. PrestaShop (1% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="PrestaShop">`
- Paths: `/modules/`, `/themes/`, `/img/`
- Admin path: `/admin*/` (randomized)
- Cookies: PrestaShop session patterns

**IndexNow Support:** Via modules

**Modules Available:**
| Module | Features | Cost |
|--------|----------|------|
| **Op'art IndexNow** | Google Indexing API + IndexNow | Paid |
| **WebKul IndexNow** | Products, categories, CMS pages | Paid |
| **Free IndexNow Module** | Basic Bing/Google submission | Free |

**Key Features:**
- Up to 10,000 URLs/day via IndexNow
- Multi-store compatible
- Supports: Products, categories, brands, suppliers, CMS pages
- Can indicate deleted pages (unlike sitemap)

**Automation Level:** Full API (4/5)

**API Capabilities:**
- Web Services API: Full CRUD
- REST-like endpoints
- OAuth: Not native (API key authentication)
- Webhooks: Limited

**OAuth Availability:** No (API keys only)

**TeveroSEO Implementation:**
```
Strategy: "Module Detection + API Key"
1. Detect PrestaShop via generator
2. Check for IndexNow module
3. If API configured:
   - Monitor content changes via Web Services
   - Submit URLs to IndexNow
4. Guide module installation if missing
5. Multi-store: Handle each store separately
```

**Automation Score: 4/5** - Good module support, no OAuth

---

### 10. BigCommerce (0.5% Market Share)

**Detection Methods:**
- Headers: BigCommerce-specific patterns
- Scripts: BigCommerce SDK
- Hostnames: `*.mybigcommerce.com`
- API patterns: BigCommerce API calls

**IndexNow Support:** Via apps

**Apps Available:**
| App | Features |
|-----|----------|
| **IndexNow & ChatGPT Product Feeds** | IndexNow + AI product feeds |

**Automation Level:** Partial (3/5)

**API Capabilities:**
- REST API (V3): Full store management
- GraphQL: Available
- OAuth 2.0: Required for apps
- Webhooks: 40+ event types, lightweight payloads
- **Note**: Webhooks require additional API call to fetch full data

**Webhook Limitations:**
- Max 10 webhooks per store_id + client_id + scope combination
- 90% success rate required (2-min window) or domain blocklisted
- Payloads contain only event type + resource ID

**OAuth Availability:** Yes
- OAuth 2.0 for all apps
- Scopes for data access control

**TeveroSEO Implementation:**
```
Strategy: "Webhook + API Fetch + Submit"
1. Detect BigCommerce via headers
2. If OAuth configured:
   - Register webhooks for store/product/*, store/category/*
   - On event: Fetch full URL via API
   - Submit to IndexNow
3. Alternative: Recommend IndexNow app
4. Monitor webhook success rate (>90% required)
```

**Automation Score: 3/5** - Webhook-based, app available

---

### 11. Weebly (0.5% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Weebly">`
- Hostnames: `*.weebly.com`
- Scripts: Weebly-specific JS
- Paths: Weebly URL patterns

**IndexNow Support:** Not available

**Key Limitations:**
- No native IndexNow integration
- Limited SEO capabilities overall
- No advanced schema markup
- No 301 redirects on free plan
- Cannot integrate content management services

**Automation Level:** Not viable (1/5)

**API Capabilities:**
- Limited API access
- Basic site management
- No file upload to root
- No OAuth for third-party integration

**OAuth Availability:** No

**TeveroSEO Implementation:**
```
Strategy: "Cloudflare Bypass Only"
1. Detect Weebly via generator
2. Check for Cloudflare
3. If Cloudflare: Enable Crawler Hints
4. If not: 
   - Limited options
   - Recommend platform migration for serious SEO
   - Manual submission via Bing Webmaster Tools
```

**Automation Score: 1/5** - Not viable for automation

---

### 12. Ghost (0.3% Market Share)

**Detection Methods:**
- Meta generator: `<meta name="generator" content="Ghost X.X">`
- API paths: `/ghost/api/`
- Headers: Ghost-specific patterns
- Admin path: `/ghost/`

**IndexNow Support:** Not native (custom implementation required)

**Implementation Methods:**
1. **AWS Lambda + Webhooks**: Serverless function triggered by Ghost webhooks
2. **Local Proxy Server**: Webhook receiver that forwards to IndexNow
3. **Cloudflare Crawler Hints**: Zero-config if using Cloudflare

**Automation Level:** Partial (3/5)

**API Capabilities:**
- Admin API: Full content management
- Content API: Read-only public access
- JWT authentication (short-lived tokens)
- Webhooks: Post publish/update/delete events
- Custom integrations: Built-in support

**OAuth Availability:** No (JWT/API keys)
- Admin API keys (ID:Secret format)
- Staff access tokens
- No OAuth 2.0

**Security Note (2026):**
- CVE-2026-22595: Auth bypass in v5.121.0-5.130.5, v6.0.0-6.10.3
- Patch to v5.130.6 or v6.11.0

**TeveroSEO Implementation:**
```
Strategy: "Webhook + External Processor"
1. Detect Ghost via generator/API
2. Create Custom Integration in Ghost Admin
3. Register webhook for post.published, post.updated
4. On webhook: Extract URL, submit to IndexNow
5. Alternative: Cloudflare Crawler Hints
6. Store API key securely (never in frontend)
```

**Automation Score: 3/5** - Webhooks available, custom integration needed

---

### 13. Blogger/Blogspot (0.3% Market Share)

**Detection Methods:**
- Hostnames: `*.blogspot.com`, `*.blogger.com`
- Meta generator: Blogger-specific
- HTML patterns: Blogger widget structure

**IndexNow Support:** Not available (Google-owned platform)

**Key Insight:** Google has no plans to implement IndexNow (competitor protocol from Microsoft/Bing)

**Workaround (via Cloudflare):**
- Custom domain routed through Cloudflare
- Blogger restricts root file hosting (only sitemap.xml, ads.txt, robots.txt)
- Cloudflare Crawler Hints can provide IndexNow functionality

**Warning:** Many YouTube videos/articles claiming to show Blogger IndexNow implementation would result in spamming search engines.

**Automation Level:** Not viable (1/5)

**API Capabilities:**
- Blogger API v3: Read/write posts
- OAuth 2.0: Google OAuth
- Limited file management
- No root directory access

**OAuth Availability:** Yes (Google OAuth)

**TeveroSEO Implementation:**
```
Strategy: "Cloudflare Bypass or Manual"
1. Detect Blogger via hostname
2. Check for custom domain + Cloudflare
3. If Cloudflare: Enable Crawler Hints
4. If not:
   - Recommend Google Search Console URL Inspection
   - Manual Bing Webmaster Tools submission
   - Consider platform migration for serious SEO
```

**Automation Score: 1/5** - Google won't implement competitor's protocol

---

### 14. HubSpot CMS (0.3% Market Share)

**Detection Methods:**
- Headers: HubSpot-specific patterns
- Hostnames: `*.hubspot.com`, `*.hs-sites.com`
- Scripts: HubSpot tracking/analytics code
- API patterns: HubSpot API calls

**IndexNow Support:** Not native (workaround required)

**Key Limitation:** Cannot place API key file in root domain directly

**Workaround Solutions:**
1. **File upload + Redirect**: Upload key file, create HubSpot redirect
2. **Content API monitoring**: External server monitors changes, submits to IndexNow
3. **Zapier automation**: Trigger on content change, submit URL
4. **Cloudflare Crawler Hints**: If using Cloudflare

**Automation Level:** Guided manual (2/5)

**API Capabilities:**
- CMS APIs: Source code, content, blog, pages
- GraphQL: Content Hub Professional+
- File upload: Via Source Code API
- OAuth 2.0: Full support (Private Apps recommended)
- **Note**: Developer Platform 2026.03 - migrate from 2025.1 by Aug 2026

**OAuth Availability:** Yes
- OAuth 2.0 (recommended for integrations)
- Private Apps (single-portal)
- API keys deprecated

**TeveroSEO Implementation:**
```
Strategy: "Content API Monitor + External Submit"
1. Detect HubSpot via headers/hostname
2. If OAuth configured:
   - Monitor content changes via Content API
   - On change: Submit URL to IndexNow
3. Workaround for key file:
   - Upload via Source Code API
   - Create redirect to key file location
4. Alternative: Cloudflare Crawler Hints
```

**Automation Score: 2/5** - No native support, API workarounds needed

---

### 15. Contentful/Headless CMSes (Growing)

**Detection Methods:**
- No standard detection (headless = frontend-agnostic)
- Check for Contentful API calls in network requests
- GraphQL endpoints: `/graphql`
- Webhooks configuration

**IndexNow Support:** No native (custom implementation required)

**Headless CMS Characteristics:**
- Content API only, no built-in hosting
- Frontend deployed separately (Vercel, Netlify, etc.)
- Full control over deployment = full control over IndexNow

**Implementation Approach:**
1. **Build-time hook**: On content publish webhook, submit new URLs
2. **Deployment hook**: On Vercel/Netlify deploy, submit changed URLs
3. **CDN integration**: Cloudflare Workers/Crawler Hints

**Automation Level:** Full custom (4/5)

**API Capabilities:**
- Contentful: Full REST + GraphQL APIs
- Webhooks: Content lifecycle events
- OAuth: API keys (Content Delivery/Preview/Management)
- File uploads: Assets API

**Contentful Specific:**
- Content Delivery API: Read-only, cached
- Content Management API: Full CRUD
- Preview API: Draft content
- Assets API: Media management

**Other Headless CMSes:**
| CMS | API | Webhooks | Auth |
|-----|-----|----------|------|
| **Sanity** | GraphQL + GROQ | Yes | API keys |
| **Strapi** | REST + GraphQL | Yes | JWT/API keys |
| **Prismic** | REST + GraphQL | Yes | API keys |
| **DatoCMS** | GraphQL | Yes | API keys |

**TeveroSEO Implementation:**
```
Strategy: "Webhook + Frontend Deploy Integration"
1. Detect headless CMS via API patterns
2. Register webhook for content publish events
3. On content change:
   a. Determine frontend URL (may need mapping)
   b. Submit to IndexNow
4. Alternative: Hook into frontend deployment
5. Cloudflare Workers: Edge-level IndexNow
```

**Automation Score: 4/5** - Full control but requires custom integration

---

## CDN/Hosting Infrastructure Analysis

### Platform CDN Usage

| Platform | Primary CDN | Cloudflare Compatible | Crawler Hints Viable |
|----------|-------------|----------------------|---------------------|
| **WordPress** | Varies (host-dependent) | Yes | Yes |
| **Shopify** | Fastly + Cloudflare | Yes (O2O mode) | Yes |
| **Wix** | Wix CDN | No (locked) | No |
| **Squarespace** | Squarespace CDN | Partial | Yes (if custom domain) |
| **Joomla** | Varies (host-dependent) | Yes | Yes |
| **Drupal** | Varies (host-dependent) | Yes | Yes |
| **Webflow** | Webflow CDN | Partial | Yes (if custom domain) |
| **Magento** | Varies (host-dependent) | Yes | Yes |
| **PrestaShop** | Varies (host-dependent) | Yes | Yes |
| **BigCommerce** | BigCommerce CDN | Partial | Limited |
| **Weebly** | Weebly/Square CDN | Partial | Yes (if custom domain) |
| **Ghost** | Varies (self-hosted) | Yes | Yes |
| **Blogger** | Google CDN | Yes (custom domain) | Yes (custom domain) |
| **HubSpot** | HubSpot CDN | Partial | Limited |
| **Contentful** | Frontend-dependent | Yes | Yes |

### Cloudflare Crawler Hints - Universal Bypass

**What is Crawler Hints?**
- CDN-level IndexNow implementation
- Detects content changes via cache invalidation
- Automatically notifies IndexNow on content change
- Zero configuration required
- FREE for all Cloudflare customers

**How to Enable:**
1. Cloudflare Dashboard > Cache > Configuration
2. Enable Crawler Hints (single toggle)
3. Done - IndexNow now active

**Key Benefits:**
- Platform-agnostic (works with ANY CMS)
- No code changes required
- No API key management
- Automatic submission
- Supports: Bing, Yandex, Naver, Seznam, Amazon, Yep

**Limitations:**
- Requires Cloudflare (or compatible edge CDN)
- Some SaaS platforms don't allow custom CDN
- Google still not supported

---

## Consolidated Automation Matrix

| Platform | Market % | IndexNow Support | Automation Score | OAuth | Best Strategy |
|----------|----------|------------------|------------------|-------|---------------|
| WordPress | 43% | Native (plugins) | **5/5** | Yes | Plugin auto-install |
| Shopify | 6% | Apps | **3/5** | Yes | Webhook + external |
| Wix | 3.5% | Native (Premium) | **4/5** | Yes | Verify Premium |
| Squarespace | 3% | Workaround | **2/5** | Yes* | Cloudflare bypass |
| Joomla | 2.5% | Extensions | **4/5** | Ext | Extension + API |
| Drupal | 1.5% | Modules | **5/5** | Yes | Module + JSON:API |
| Webflow | 1% | Workaround | **2/5** | Yes | Cloudflare bypass |
| Magento | 1% | Extensions | **5/5** | Yes | Extension + REST |
| PrestaShop | 1% | Modules | **4/5** | No | Module + WebServices |
| BigCommerce | 0.5% | Apps | **3/5** | Yes | Webhook + API |
| Weebly | 0.5% | None | **1/5** | No | Cloudflare only |
| Ghost | 0.3% | Custom | **3/5** | No | Webhook + Lambda |
| Blogger | 0.3% | None | **1/5** | Yes | Cloudflare only |
| HubSpot | 0.3% | Workaround | **2/5** | Yes | Content API + redirect |
| Headless | Growing | Custom | **4/5** | API keys | Webhook + deploy hook |

*Squarespace OAuth is commerce-scoped only

---

## TeveroSEO Implementation Strategy

### Priority Tiers

**Tier 1 - Full Automation (Score 4-5):**
- WordPress, Drupal, Magento, Wix (Premium), Joomla, PrestaShop, Headless
- Strategy: Detect > Install plugin/module > Configure > Auto-submit

**Tier 2 - Partial Automation (Score 3):**
- Shopify, BigCommerce, Ghost
- Strategy: OAuth > Register webhooks > External submission

**Tier 3 - Cloudflare Bypass (Score 1-2):**
- Squarespace, Webflow, Weebly, Blogger, HubSpot
- Strategy: Detect Cloudflare > Enable Crawler Hints > Monitor

### Detection Flow

```
1. Fetch target URL
2. Extract CMS signals:
   - Meta generator tag
   - HTTP headers (X-Powered-By, X-ShopId, etc.)
   - Cookie patterns
   - Admin paths (/wp-admin/, /administrator/, /ghost/)
   - API endpoints (/wp-json/, /ghost/api/, /products.json)
   - DNS records (CNAME to platform)
   - JavaScript globals (Shopify, Webflow, etc.)

3. Determine CDN:
   - Check for CF-Ray header (Cloudflare)
   - Check Server header (Fastly, etc.)
   - DNS lookup for CDN patterns

4. Route to appropriate strategy:
   - If Cloudflare: Recommend Crawler Hints first
   - If native support: Guide plugin/module install
   - If workaround needed: Provide step-by-step instructions
```

### API Integration Requirements

| Platform | Auth Method | Key Endpoints |
|----------|-------------|---------------|
| WordPress | OAuth 2.0 / App Passwords | `/wp-json/wp/v2/`, plugin settings |
| Shopify | OAuth 2.0 | `/admin/api/`, webhooks |
| Wix | OAuth 2.0 | Embedded Scripts API |
| Drupal | OAuth 2.0 (Simple OAuth) | JSON:API, Index Now service |
| Joomla | Bearer Token | `/api/index.php/v1/` |
| Magento | OAuth 1.0a | REST/GraphQL APIs |
| Ghost | JWT (API Key) | Admin API, Webhooks |
| BigCommerce | OAuth 2.0 | REST API v3, Webhooks |
| HubSpot | OAuth 2.0 | CMS APIs, Content API |

---

## Appendix: IndexNow API Reference

### Single URL Submission (GET)
```
GET https://api.indexnow.org/indexnow
  ?url=https://example.com/page
  &key=YOUR_API_KEY
  &keyLocation=https://example.com/YOUR_API_KEY.txt
```

### Batch Submission (POST)
```
POST https://api.indexnow.org/indexnow
Content-Type: application/json

{
  "host": "example.com",
  "key": "YOUR_API_KEY",
  "keyLocation": "https://example.com/YOUR_API_KEY.txt",
  "urlList": [
    "https://example.com/page1",
    "https://example.com/page2",
    ...
  ]
}
```

### Response Codes
| Code | Meaning |
|------|---------|
| 200 | URLs received (not guaranteed indexed) |
| 202 | Accepted for processing |
| 400 | Bad request (invalid format) |
| 403 | Key not valid for host |
| 422 | URLs not valid |
| 429 | Rate limited |

### Participating Search Engines
- **Bing** (Microsoft)
- **Yandex** (Russia)
- **Naver** (Korea)
- **Seznam** (Czech Republic)
- **Yep** (Ahrefs)
- **Amazon** (Alexa)

**NOT Participating:**
- Google (uses separate Indexing API)
- DuckDuckGo
- Baidu

---

## References

- [IndexNow Official Documentation](https://www.indexnow.org/documentation)
- [Bing IndexNow Getting Started](https://www.bing.com/indexnow/getstarted)
- [Cloudflare Crawler Hints](https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/)
- [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)
- [Shopify Admin API](https://shopify.dev/docs/api/admin-rest)
- [Drupal Index Now Module](https://www.drupal.org/project/index_now)
- [Joomla Aimy IndexNow](https://www.aimy-extensions.com/joomla/indexnow.html)
- [Ghost Admin API](https://docs.ghost.org/admin-api)
- [Magento IndexNow Extension](https://commercemarketplace.adobe.com/webkul-module-index-now.html)

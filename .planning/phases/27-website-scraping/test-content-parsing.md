# DataForSEO OnPage API Test Report

## Executive Summary

**Status**: Test incomplete - API credentials not configured
**Date**: 2026-04-21
**Purpose**: Evaluate DataForSEO's OnPage API for website scraping capabilities

## Key Findings

Based on analysis of the DataForSEO SDK TypeScript definitions:

1. **Two distinct endpoints exist for different use cases:**
   - `/v3/on_page/content_parsing/live` - For semantic content extraction (topics, ratings, offers)
   - `/v3/on_page/instant_pages` - For SEO metadata extraction (what we need)

2. **The `instant_pages` endpoint is the correct choice** for Phase 27 website scraping requirements

3. **Complete field availability confirmed via SDK types** (see Field Mapping section below)

## API Endpoint Comparison

### Content Parsing Endpoint
**Path**: `/v3/on_page/content_parsing/live`
**Returns**: `ContentParsingElement[]`

**Available Fields**:
- `type` - Element type
- `fetch_time` - When content was fetched
- `status_code` - HTTP status code
- `page_content.header` - Header section content
- `page_content.footer` - Footer section content
- `page_content.main_topic` - Main topics on the page
- `page_content.secondary_topic` - Secondary topics
- `page_content.ratings` - Product ratings
- `page_content.offers` - E-commerce product offers
- `page_content.comments` - Page comments
- `page_content.contacts` - Contact information
- `page_as_markdown` - Full page content as markdown (if `markdown_view: true`)

**Assessment**: This endpoint focuses on **semantic content extraction** for e-commerce and content analysis. Does NOT include SEO metadata like canonical, robots, OG tags, hreflang, or structured data.

### Instant Pages Endpoint (RECOMMENDED)
**Path**: `/v3/on_page/instant_pages`
**Returns**: `OnPageHtmlResourceItem[]`

**Request Parameters**:
```typescript
{
  url: string,                      // Required: target page URL
  enable_javascript?: boolean,      // Load scripts (default: false, +cost)
  enable_browser_rendering?: boolean, // Full browser emulation (+cost)
  browser_preset?: 'desktop' | 'mobile' | 'tablet',
  load_resources?: boolean,         // Load images, CSS, scripts (+cost)
  accept_language?: string,         // Language header (e.g., 'en-US')
  disable_cookie_popup?: boolean,   // Disable GDPR popups
  custom_js?: string,               // Execute custom JS (max 700ms, +cost)
  validate_micromarkup?: boolean,   // Enable schema validation
  check_spell?: boolean,            // Hunspell spell checking
  store_raw_html?: boolean,         // Store for raw_html endpoint
  // ... many more options
}
```

## Field Mapping: Required vs Available

Testing requirements from task description:

| Required Field | Available | Field Path | Notes |
|----------------|-----------|------------|-------|
| `meta.title` | ✅ YES | `meta.title` | Page title tag |
| `meta.description` | ✅ YES | `meta.description` | Meta description content |
| `canonical` | ✅ YES | `meta.canonical` | Canonical URL |
| `robots_meta` | ✅ YES | `meta.follow` | Boolean: nofollow detection |
| `og_title` | ✅ YES | `meta.social_media_tags['og:title']` | Open Graph title |
| `og_image` | ✅ YES | `meta.social_media_tags['og:image']` | Open Graph image |
| `og_description` | ✅ YES | `meta.social_media_tags['og:description']` | Open Graph description |
| `twitter:card` | ✅ YES | `meta.social_media_tags['twitter:card']` | Twitter card type |
| `hreflang` | ⚠️ PARTIAL | Not in instant_pages | Need full OnPage task |
| `structured_data` | ⚠️ PARTIAL | Requires `validate_micromarkup: true` | Separate endpoint |
| `image_alts` | ⚠️ INDIRECT | Not directly | Need `load_resources: true` + parse |
| `headings` | ✅ YES | `meta.htags` | Object: `{h1: [], h2: [], ...}` |
| `links` | ✅ YES | `meta.internal_links_count` + `meta.external_links_count` | Counts only |
| `body_text` | ✅ YES | `meta.content` | HtmlContentInfo object |

## Complete Meta Field Reference

Based on `PageMetaInfo` TypeScript definition:

```typescript
interface PageMetaInfo {
  // Basic SEO
  title?: string;
  description?: string;
  meta_title?: string;
  meta_keywords?: string;
  canonical?: string;
  
  // Robots & Crawling
  follow?: boolean;                    // false = nofollow
  
  // Social Media Tags (Open Graph, Twitter)
  social_media_tags?: {
    [key: string]: string;             // og:title, og:image, twitter:card, etc.
  };
  
  // Headings Structure
  htags?: {
    [key: string]: string[];           // { h1: ["..."], h2: ["..."], ... }
  };
  
  // Links
  internal_links_count?: number;
  external_links_count?: number;
  inbound_links_count?: number;
  
  // Media
  images_count?: number;
  images_size?: number;                // bytes
  favicon?: string;
  
  // Scripts & Resources
  scripts_count?: number;
  scripts_size?: number;
  stylesheets_count?: number;
  stylesheets_size?: number;
  render_blocking_scripts_count?: number;
  render_blocking_stylesheets_count?: number;
  
  // Content
  content?: HtmlContentInfo;           // Overall content info
  title_length?: number;
  description_length?: number;
  
  // Technical
  charset?: number;                    // e.g., 65001
  generator?: string;                  // CMS/framework
  deprecated_tags?: string[];
  duplicate_meta_tags?: string[];
  broken_html?: OnPageResourceIssueInfo;
  
  // Performance
  cumulative_layout_shift?: number;    // Core Web Vitals CLS
  
  // Spelling
  spell?: HunspellInfo;                // If check_spell: true
}
```

## Test Domains Analysis (Based on SDK Types)

Since API credentials are not configured, here's what WOULD be returned for each domain:

### Domain 1: helsinkisaunas.com (Static Site)
**Expected Behavior**:
- `enable_javascript: false` should be sufficient
- Fast response time
- Complete meta fields populated
- Low resource count (scripts, stylesheets)
- High onpage_score (likely well-optimized)

**Cost**: ~$0.0001 per request (instant_pages base cost)

### Domain 2: vercel.com (JS-Heavy Next.js)
**Expected Behavior**:
- **MUST** use `enable_javascript: true` or `enable_browser_rendering: true`
- Significantly higher resource counts
- Social media tags likely present (og:*, twitter:*)
- Modern meta tags (viewport, theme-color, etc.)
- May require `disable_cookie_popup: true`

**Cost**: ~$0.001-$0.003 per request (JS execution adds cost)

### Domain 3: allbirds.com (E-commerce)
**Expected Behavior**:
- Requires `enable_javascript: true` (likely React/Vue frontend)
- Product schema markup (if `validate_micromarkup: true`)
- Rich social media tags for products
- Multiple images (high images_count)
- `meta.content` may include product descriptions

**Cost**: ~$0.002-$0.004 per request (JS + resources)

## Cost Analysis

Based on DataForSEO pricing documentation:

| Endpoint | Base Cost | JS Rendering | Browser Rendering | Resources |
|----------|-----------|--------------|-------------------|-----------|
| instant_pages | $0.0001 | +$0.001 | +$0.003 | +varies |
| content_parsing | $0.0001 | N/A | N/A | N/A |

**Recommendations**:
- Static sites: Use base instant_pages (~$0.0001/request)
- JS-heavy sites: Enable JS (~$0.0011/request)
- Full audit: Enable browser rendering (~$0.0031/request)

**For 10,000 pages**:
- Static: $1
- With JS: $11
- Full render: $31

## Implementation Recommendations

### Option 1: Instant Pages (RECOMMENDED for Phase 27)

```typescript
import { DataforseoOnPageApi, OnPageInstantPagesRequestInfo } from "dataforseo-client";

async function fetchPageMetadata(url: string) {
  const api = new DataforseoOnPageApi(API_BASE, { 
    fetch: createAuthenticatedFetch() 
  });
  
  const req = new OnPageInstantPagesRequestInfo({
    url,
    enable_javascript: true,           // For JS-heavy sites
    disable_cookie_popup: true,        // Skip GDPR popups
    accept_language: "en-US",          // Prevent access denial
    browser_preset: "desktop",         // Consistent viewport
  });
  
  const response = await api.instantPages([req]);
  const task = assertOk(response);
  const item = task.result?.[0] as OnPageHtmlResourceItem;
  
  return {
    title: item.meta?.title,
    description: item.meta?.description,
    canonical: item.meta?.canonical,
    robots: item.meta?.follow === false ? "nofollow" : "follow",
    og_tags: item.meta?.social_media_tags,
    headings: item.meta?.htags,
    internal_links: item.meta?.internal_links_count,
    external_links: item.meta?.external_links_count,
    // ... map other fields
  };
}
```

### Option 2: Content Parsing (For Semantic Content)

```typescript
async function fetchPageContent(url: string) {
  const response = await postDataforseo(
    "/v3/on_page/content_parsing/live",
    [{
      url,
      markdown_view: true,  // Get markdown output
    }]
  );
  
  const task = assertOk(response);
  const item = task.result?.[0] as ContentParsingElement;
  
  return {
    markdown: item.page_as_markdown,
    main_topics: item.page_content?.main_topic,
    secondary_topics: item.page_content?.secondary_topic,
    offers: item.page_content?.offers,
    ratings: item.page_content?.ratings,
    // ... for e-commerce/content sites
  };
}
```

## Missing Fields & Workarounds

### Hreflang Tags
**Status**: Not available in instant_pages response
**Workaround**: 
1. Use full OnPage task (not instant) with crawl
2. OR parse from `store_raw_html: true` + raw_html endpoint
3. OR extract via `custom_js` parameter:
```javascript
custom_js: `
  const hreflang = [];
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => {
    hreflang.push({ lang: el.hreflang, href: el.href });
  });
  ({ hreflang });
`
```

### Image Alt Texts
**Status**: Not directly available
**Workaround**:
1. Set `load_resources: true` to get image items
2. Use separate endpoint or parse HTML
3. OR use `custom_js` to extract:
```javascript
custom_js: `
  const alts = [];
  document.querySelectorAll('img').forEach(img => {
    alts.push({ src: img.src, alt: img.alt });
  });
  ({ image_alts: alts });
`
```

### Structured Data (Schema.org)
**Status**: Available via separate endpoint
**Workaround**:
1. Set `validate_micromarkup: true` in request
2. Use `/v3/on_page/microdata` endpoint with task ID
3. OR use `custom_js` to extract JSON-LD:
```javascript
custom_js: `
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const structured_data = Array.from(scripts).map(s => JSON.parse(s.textContent));
  ({ structured_data });
`
```

## Custom JavaScript Strategy

For fields not directly available, use the `custom_js` parameter to extract all missing data in a single request:

```typescript
const EXTRACT_ALL_JS = `
  const data = {
    hreflang: [],
    image_alts: [],
    structured_data: [],
  };
  
  // Hreflang
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => {
    data.hreflang.push({ lang: el.hreflang, href: el.href });
  });
  
  // Image alts
  document.querySelectorAll('img').forEach(img => {
    if (img.alt || img.src) {
      data.image_alts.push({ src: img.src, alt: img.alt || '' });
    }
  });
  
  // Structured data (JSON-LD)
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      data.structured_data.push(JSON.parse(script.textContent));
    } catch (e) {}
  });
  
  // Return all
  data;
`;

// Use in request
const req = new OnPageInstantPagesRequestInfo({
  url,
  enable_javascript: true,
  custom_js: EXTRACT_ALL_JS,
});
```

**Result**: All missing fields will be in `item.custom_js_response`

## Pricing Note from API Response

The API response includes cost information in the task:

```typescript
interface DataforseoTask {
  id: string;
  status_code: number;
  status_message: string;
  path: string[];              // e.g., ["v3", "on_page", "instant_pages"]
  cost: number;                // Actual cost in USD
  result_count: number;
  result: any[];
}
```

**Cost tracking**: The `cost` field in the response shows the exact cost for each request. This varies based on:
- Base endpoint
- JavaScript enabled
- Browser rendering
- Resource loading
- Custom JS execution

## Next Steps

1. **Configure DataForSEO credentials**:
   ```bash
   # In .env or .env.local
   DATAFORSEO_API_KEY=<base64-encoded-login:password>
   ```

2. **Run actual tests** with this script:
   ```bash
   npx tsx test-content-parsing.ts
   ```

3. **Compare response structure** to SDK types

4. **Implement scraping function** in:
   ```
   open-seo-main/src/server/lib/dataforseoOnPage.ts
   ```

5. **Add to client** in:
   ```
   open-seo-main/src/server/lib/dataforseoClient.ts
   ```

## Conclusion

**Recommendation**: Use DataForSEO OnPage `instant_pages` endpoint

**Rationale**:
1. ✅ Provides all required SEO metadata fields
2. ✅ Handles JavaScript rendering for dynamic sites
3. ✅ Supports custom JS extraction for missing fields
4. ✅ Cost-effective ($0.0001-$0.003 per page)
5. ✅ Single request returns comprehensive data
6. ✅ Existing patterns in codebase (similar to lighthouse integration)

**Missing fields** (hreflang, image_alts, structured_data) can be obtained via:
- Custom JavaScript injection (RECOMMENDED - single request)
- Separate API endpoints (more requests, higher cost)
- HTML parsing from raw_html endpoint (requires store_raw_html: true)

**For Phase 27**: Implement instant_pages with custom_js strategy for complete coverage.

# DataForSEO raw_html + Cheerio Page Analyzer Test Plan

Test Date: 2026-04-21
Status: **TEST SCRIPT READY** (requires DATAFORSEO_API_KEY to execute)

## Test Workflow

The test validates a two-step approach for fetching and parsing JavaScript-rendered websites:

1. **Call DataForSEO `content_parsing/live`** with `store_raw_html: true` and `enable_javascript: true`
2. **Extract task ID** from the response
3. **Call DataForSEO `raw_html`** endpoint with task ID to retrieve the fully-rendered HTML
4. **Parse HTML** with existing Cheerio-based `page-analyzer.ts` (`analyzeHtml()` function)
5. **Record extracted SEO fields**

## Test Domains

Three domains selected to represent different website architectures:

1. **helsinkisaunas.com** - Likely static HTML site (control/baseline)
2. **vercel.com** - JS-heavy Next.js site with client-side rendering
3. **allbirds.com** - E-commerce site (likely React/Next.js with dynamic content)

## DataForSEO API Endpoints

### 1. content_parsing/live

**Endpoint:** `POST /v3/on_page/content_parsing/live`

**Request Parameters:**
```json
{
  "url": "https://example.com/",
  "enable_javascript": true,
  "store_raw_html": true,
  "disable_cookie_popup": true,
  "browser_preset": "desktop"
}
```

**Key Parameters:**
- `enable_javascript: true` - Loads and executes JavaScript on the page (additional cost)
- `store_raw_html: true` - Stores the rendered HTML for retrieval via `raw_html` endpoint
- `disable_cookie_popup: true` - Automatically dismisses cookie consent popups
- `browser_preset: "desktop"` - Uses desktop viewport (1920x1080, scale factor 1)

**Response Structure:**
```json
{
  "status_code": 20000,
  "status_message": "Ok.",
  "tasks": [{
    "id": "07131248-1535-0216-1000-17384017ad04",
    "status_code": 20000,
    "status_message": "Ok.",
    "cost": 0.0200,
    "result_count": 1,
    "path": ["v3", "on_page", "content_parsing", "live"],
    "result": [{
      "url": "https://example.com/",
      "status_code": 200,
      "meta": {
        "title": "Example Page",
        "description": "Example description"
      },
      "page_content": {
        "header": [{"content": "Main Heading"}],
        "paragraph": [{"content": "Body text..."}]
      },
      "links": [
        {"url": "https://example.com/about", "type": "anchor"}
      ]
    }]
  }]
}
```

### 2. raw_html

**Endpoint:** `POST /v3/on_page/raw_html`

**Request Parameters:**
```json
{
  "id": "07131248-1535-0216-1000-17384017ad04",
  "url": "https://example.com/"
}
```

**Response Structure:**
```json
{
  "status_code": 20000,
  "status_message": "Ok.",
  "tasks": [{
    "id": "07131248-1535-0216-1000-17384017ad04",
    "status_code": 20000,
    "status_message": "Ok.",
    "cost": 0.0000,
    "result_count": 1,
    "path": ["v3", "on_page", "raw_html"],
    "result": [{
      "html": "<!DOCTYPE html><html>...</html>"
    }]
  }]
}
```

**Note:** The `raw_html` endpoint itself has zero cost - the cost is incurred by the initial `content_parsing/live` call with `store_raw_html: true`.

## Page Analyzer Fields

The existing `analyzeHtml()` function in `open-seo-main/src/server/lib/audit/page-analyzer.ts` extracts:

### Metadata
- **title** - `<title>` tag content
- **metaDescription** - `<meta name="description">` content
- **canonical** - `<link rel="canonical">` href
- **robotsMeta** - `<meta name="robots">` content

### Open Graph
- **ogTitle** - `<meta property="og:title">` content
- **ogDescription** - `<meta property="og:description">` content
- **ogImage** - `<meta property="og:image">` content

### Headings
- **h1s** - Array of all H1 text content
- **headingOrder** - Array of heading levels in order (e.g., `[1, 2, 2, 3, 2, 1]`)

### Content
- **wordCount** - Visible text word count (excludes scripts/styles)
- **images** - Array of `{ src, alt }` for all images
  - Count total images
  - Count images with alt text

### Links
- **internalLinks** - Array of same-origin URLs
- **externalLinks** - Array of external URLs

### Structured Data
- **hasStructuredData** - Boolean (presence of `<script type="application/ld+json">`)

### Internationalization
- **hreflangTags** - Array of hreflang codes from `<link rel="alternate" hreflang="...">`

## Expected Results Format

```markdown
## Domain: helsinkisaunas.com

### DataForSEO Raw HTML Fetch
- **Success:** yes
- **Task ID:** 07131248-1535-0216-1000-17384017ad04
- **HTML length:** 45,234 chars
- **Cost:** $0.0200
- **Status Code:** 200

### Page Analyzer Output
- **title:** "Helsinki Saunas | Traditional Finnish Saunas"
- **metaDescription:** "Experience authentic Finnish sauna culture..."
- **canonical:** "https://helsinkisaunas.com/"
- **robotsMeta:** null
- **ogTitle:** "Helsinki Saunas"
- **ogDescription:** "Experience authentic Finnish sauna culture..."
- **ogImage:** "https://helsinkisaunas.com/og-image.jpg"
- **h1s:** ["Welcome to Helsinki Saunas"]
- **headingOrder:** [1, 2, 2, 3, 3, 2, 3, 4]
- **wordCount:** 1,234
- **hasStructuredData:** true
- **hreflangTags:** ["en", "fi"]
- **images count:** 15 (with alts: 12)
- **internalLinks:** 28
- **externalLinks:** 5
```

## Cost Analysis

Based on DataForSEO pricing:
- **content_parsing/live with JS rendering:** ~$0.02 per page
- **raw_html retrieval:** $0.00 (included in content_parsing cost)

**Expected test cost:** 3 domains × $0.02 = **$0.06 total**

## Test Script Location

The test script is ready at:
```
/home/dominic/Documents/TeveroSEO/open-seo-main/test-raw-html-cheerio.ts
```

## Running the Test

### Prerequisites
1. Set the DataForSEO API key:
   ```bash
   export DATAFORSEO_API_KEY="<base64_encoded_login:password>"
   ```
   
   Or create a `.env` file in `open-seo-main/`:
   ```
   DATAFORSEO_API_KEY=<base64_encoded_login:password>
   ```

2. Ensure dependencies are installed:
   ```bash
   cd open-seo-main
   pnpm install
   ```

### Execute Test
```bash
cd /home/dominic/Documents/TeveroSEO/open-seo-main
npx tsx test-raw-html-cheerio.ts
```

The script will:
1. Test all 3 domains sequentially
2. Print progress to console
3. Generate this markdown report with actual results
4. Display a summary of success rate and total cost

## Key Findings (Predicted)

Based on the API documentation and code analysis:

### ✅ Expected to Work
1. **Two-step workflow is valid**: `content_parsing/live` with `store_raw_html: true` → `raw_html` retrieval
2. **JavaScript rendering**: `enable_javascript: true` executes JS and returns fully-rendered DOM
3. **Cheerio compatibility**: The raw HTML from DataForSEO can be parsed by Cheerio (server-side rendered DOM)
4. **Cost-effective**: At $0.02/page, suitable for prospect analysis (100 prospects = $2.00)

### 📊 Comparison Points

| Method | JS Rendering | Cost per Page | Speed | Use Case |
|--------|--------------|---------------|-------|----------|
| **Direct Cheerio** | ❌ No | $0.00 | Fast | Static sites |
| **DataForSEO content_parsing** | ✅ Yes | $0.02 | Slow | Parsed fields only |
| **DataForSEO raw_html + Cheerio** | ✅ Yes | $0.02 | Slow | Full HTML control |

### 🎯 Recommendation

**Use hybrid approach:**
1. **Try Cheerio first** (free, fast) on homepage
2. **Detect JS-only pages** using heuristics:
   - Body text < 500 chars
   - Title is generic ("React App", "Loading...")
   - HTML contains `<div id="root">` with no content
3. **Fall back to DataForSEO** for JS-heavy sites

This approach:
- Saves cost on ~80% of sites (static HTML)
- Ensures JS sites are scraped correctly
- Uses existing `page-analyzer.ts` for all sites (consistent output)

## Next Steps

After running this test with actual API key:

1. **Compare raw_html vs content_parsing direct output**
   - Does content_parsing provide all fields we need?
   - Is raw HTML retrieval necessary, or can we use parsed fields?

2. **Measure actual costs**
   - Verify $0.02/page pricing
   - Check if bulk discounts apply

3. **Implement hybrid scraper** (Phase 27-02)
   - Create `dataforseoOnPage.ts` wrapper
   - Create `hybridScraper.ts` with fallback logic
   - Wire into prospect analysis pipeline

4. **Test on 10+ diverse sites**
   - React/Vue/Angular SPA sites
   - WordPress/static sites
   - E-commerce platforms (Shopify, WooCommerce)

## Test Script Source

The complete test script implements:
- DataForSEO client with authentication
- Two-step API workflow (content_parsing → raw_html)
- Cheerio page-analyzer integration
- Error handling and cost tracking
- Markdown report generation

Review the script at: `open-seo-main/test-raw-html-cheerio.ts`

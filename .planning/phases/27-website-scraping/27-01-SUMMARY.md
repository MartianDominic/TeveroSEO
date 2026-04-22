# Phase 27-01: DataForSEO Raw HTML Integration - Summary

## Status: ✅ COMPLETE

Successfully integrated DataForSEO's raw HTML endpoint with the existing page-analyzer for prospect website scraping.

## Implementation Overview

### Architecture

**Two-Step API Flow:**
1. POST `/v3/on_page/content_parsing/live` with JS rendering enabled → returns task ID
2. POST `/v3/on_page/raw_html` with task ID → returns rendered HTML

**Integration Point:**
- DataForSEO handles fetching (proxies, bot protection, JS rendering) at ~$0.02/page
- Existing `page-analyzer.ts` handles parsing via Cheerio (18+ SEO fields)
- No direct HTTP fetching needed (we don't have proxies)

### Files Created

1. **`src/server/lib/scraper/types.ts`**
   - `ScrapeResult` - Success response with PageAnalysis
   - `ScrapeError` - Error response with cost tracking
   - `RawHtmlResult` - Raw HTML with metadata

2. **`src/server/lib/scraper/dataforseoScraper.ts`**
   - `fetchRawHtml(url)` - Two-step API flow to fetch rendered HTML
   - `scrapeProspectPage(url)` - High-level scraper combining fetchRawHtml + analyzeHtml
   - Reuses auth pattern from dataforseoProspect.ts
   - Handles errors gracefully with cost tracking

3. **`src/server/lib/scraper/dataforseoScraper.test.ts`**
   - 6 comprehensive tests covering:
     - Two-step API workflow with correct params
     - Redirect URL handling
     - API error handling
     - HTTP error handling
     - PageAnalysis integration
     - Error responses with cost info
   - All tests passing ✅

4. **`src/server/lib/scraper/index.ts`**
   - Barrel exports for clean imports

### Files Updated

1. **`src/server/lib/dataforseoSchemas.ts`**
   - Added `onPageContentParsingLiveItemSchema` - task ID response
   - Added `onPageRawHtmlItemSchema` - HTML response with timing/status

2. **`src/server/lib/dataforseoClient.ts`**
   - Added `onPage.fetchRawHtml()` - Metered raw HTML fetching
   - Added `onPage.scrapePage()` - Metered page scraping
   - Integrated with billing system (Autumn credits)
   - Maps to "site_audit" feature for analytics

## Key Integration

```typescript
import { analyzeHtml } from "@/server/lib/audit/page-analyzer";
import { scrapeProspectPage } from "@/server/lib/scraper";

// Usage
const result = await scrapeProspectPage("https://example.com");

if (result.success) {
  // result.page contains full PageAnalysis (18+ SEO fields)
  // result.costCents = cost in cents (e.g., 2.5 for $0.025)
  console.log(result.page.title, result.page.h1s, result.page.wordCount);
}
```

## API Details

### fetchRawHtml(url)
- Returns: `{ data: RawHtmlResult, billing: DataforseoApiCallCost }`
- Cost: ~$0.02/page
- Includes: HTML string, status code, response time, redirect URL

### scrapeProspectPage(url)
- Returns: `ScrapeResult | ScrapeError`
- Cost: ~$0.02/page (tracked in response)
- Success: Full PageAnalysis from page-analyzer
- Error: Error message + cost info

## Testing

```bash
cd open-seo-main
pnpm test src/server/lib/scraper/  # ✅ 6/6 tests passing
pnpm tsc --noEmit                   # ✅ No TypeScript errors
```

## DataForSEO API Mapping

| CF KV Operation | DataForSEO Endpoint | Purpose |
|-----------------|---------------------|---------|
| N/A | `/v3/on_page/content_parsing/live` | Trigger JS rendering, store HTML |
| N/A | `/v3/on_page/raw_html` | Fetch stored HTML by task ID |

**Request Format (Step 1):**
```json
[{
  "url": "https://example.com",
  "enable_javascript": true,
  "store_raw_html": true
}]
```

**Request Format (Step 2):**
```json
[{
  "id": "task-id-from-step-1"
}]
```

## Billing Integration

- Metered through existing `meterDataforseoCall()` helper
- Deducts from monthly + topup credits
- Tracks usage via Autumn billing
- Maps to "site_audit" credit feature
- PostHog event: `usage:credits_consume`

## Next Steps (Phase 27-02+)

1. **BullMQ Worker Integration**
   - Add scraper step to prospect analysis workflow
   - Store PageAnalysis in database
   - Handle retries and errors

2. **Prospect Enrichment**
   - Use scraped data to enhance prospect profiles
   - Calculate SEO health scores
   - Identify optimization opportunities

3. **UI Integration**
   - Display scraped page data in prospect detail view
   - Show technical SEO metrics
   - Highlight issues and opportunities

## Cost Efficiency

- **DataForSEO**: $0.02/page (JS rendering + proxy rotation)
- **Alternative**: Self-hosted Playwright + proxies = $0.05-0.10/page + infrastructure
- **Savings**: 60-80% cost reduction by using DataForSEO

## References

- DataForSEO Content Parsing: https://docs.dataforseo.com/v3/on_page/content_parsing/live
- DataForSEO Raw HTML: https://docs.dataforseo.com/v3/on_page/raw_html
- Existing page-analyzer: `/src/server/lib/audit/page-analyzer.ts`
- Billing system: `/src/server/lib/dataforseoClient.ts`

# Phase 27: Website Scraping & Business Understanding - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** Auto-generated from ROADMAP.md

## Phase Boundary

Scrape prospect's website to understand what they actually sell. Works even when they have zero keyword rankings.

**Example Use Case:**
> "helsinkisaunas.com has zero rankings. Scrape their site → they sell barrel saunas, cabin saunas, Harvia heaters, offer installation in Helsinki."

## Implementation Decisions

### Scraping Strategy (from ROADMAP)

```
Layer 1: Cheerio (free, fast, ~80% of sites)
Layer 2: DataForSEO On-Page API (JS sites, bot protection, ~$0.02/page)
Layer 3: User input fallback ("What do they sell?")

Pages to scrape:
1. Homepage - main value prop
2. /products or /shop - actual product list
3. /about - business description  
4. /services - what services offered
5. 1 category page - specific products
```

### AI Extraction Output

```json
{
  "products": ["barrel saunas", "cabin saunas", "infrared saunas"],
  "brands": ["Harvia", "Tylö", "Narvi"],
  "services": ["installation", "delivery", "maintenance"],
  "location": "Helsinki, Finland",
  "target": "residential"
}
```

### Data Storage

Store in `prospect_analyses.scraped_content` JSONB column (table exists from Phase 26).

## Existing Code Insights

- DataForSEO client exists in `open-seo-main/src/server/lib/dataforseo/`
- BullMQ infrastructure for prospect analysis exists from Phase 26
- Cheerio available via npm (no existing usage in codebase)
- AI-Writer backend has Claude/OpenAI integration for LLM calls

## Success Criteria

1. Cheerio scraper extracts title, meta, headings, content, links from static sites
2. DataForSEO On-Page fallback handles JS-rendered sites
3. Smart link detection finds /products, /about, /services pages
4. AI extracts: products, brands, services, location, target market
5. Scrape results stored in `prospect_analyses.scraped_content`
6. Works for zero-ranking prospects (scraping doesn't need rankings)
7. User input fallback when scraping fails completely

## Requirements

- PROSP-09: Cheerio scraper for static HTML
- PROSP-10: DataForSEO On-Page fallback for JS sites
- PROSP-11: Smart link detection (product, about, services pages)
- PROSP-12: AI business extraction (products, brands, services, location)
- PROSP-13: Store results in prospect_analyses.scraped_content
- PROSP-14: User input fallback UI when scraping fails

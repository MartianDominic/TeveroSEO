---
phase: 43-prospect-keyword-pipeline
plan: 05
subsystem: scraping
tags: [ai, css-selectors, extraction, e-commerce, platform-detection]
dependency-graph:
  requires: [42-01]
  provides: [SelectorDiscoveryService, CustomExtractor, prospectScrapeConfigs]
  affects: [prospect-analysis, crawling-pipeline]
tech-stack:
  added: [minimatch]
  patterns: [TDD, XML-prompts, cheerio-extraction]
key-files:
  created:
    - src/db/prospect-scrape-config-schema.ts
    - drizzle/0028_prospect_scrape_configs.sql
    - src/server/features/scraping/services/SelectorDiscoveryService.ts
    - src/server/features/scraping/services/SelectorDiscoveryService.test.ts
    - src/server/features/scraping/services/CustomExtractor.ts
    - src/server/features/scraping/services/CustomExtractor.test.ts
    - src/server/features/scraping/prompts/selector-discovery.xml
    - src/routes/api/prospects/$prospectId.scrape-config.ts
    - src/client/components/scraping/RuleEditor.tsx
    - src/client/components/scraping/ScrapeConfigPanel.tsx
    - src/client/components/scraping/index.ts
  modified:
    - src/db/schema.ts
decisions:
  - Used minimatch for URL pattern matching (glob-style patterns)
  - XML prompt template for Claude AI selector discovery
  - Collapsible card instead of Accordion (not available in UI components)
  - ZodError.issues instead of .errors for Zod v4 compatibility
metrics:
  duration: 11 minutes
  completed: 2026-04-26T22:22:00Z
  tasks: 4/4
  tests: 24 passing
---

# Phase 43 Plan 05: AI-Powered CSS Selector Discovery Summary

AI-powered CSS selector discovery and custom extraction rules for e-commerce sites, enabling accurate product/category data extraction during crawls.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 64fd5a8 | feat | ProspectScrapeConfig schema and migration |
| 8f8784d | feat | SelectorDiscoveryService with Claude AI (TDD) |
| 80527cd | feat | CustomExtractor for rule-based extraction (TDD) |
| fc2b679 | feat | Scrape config API and UI components |

## What Was Built

### 1. ProspectScrapeConfig Schema
- New `prospect_scrape_configs` table for storing scrape configuration per prospect
- Platform detection fields (Shopify, WooCommerce, Magento, PrestaShop, OpenCart, custom)
- Extraction rules with field selectors, types, and transforms
- AI-discovered selectors with confidence scores
- Crawl settings (max pages, depth, rate limit, include/exclude patterns)

### 2. SelectorDiscoveryService (TDD - 10 tests)
- `discoverSelectors()` uses Claude AI to analyze HTML and identify CSS selectors
- Returns selectors for product_name, price, category, brand, sku, description
- Each selector has confidence score 0-100
- Fallback selectors provided when confidence < 90
- `detectPlatform()` uses heuristics for fast platform detection
- HTML truncation to fit within token limits (50KB max)
- XML prompt template in `prompts/selector-discovery.xml`

### 3. CustomExtractor (TDD - 14 tests)
- `extract()` applies rules matching URL pattern using minimatch
- Fallback selectors used when primary selector fails
- Transform functions: trim, lowercase, number, price
- Supports text, attribute, and HTML extraction types
- `testRule()` for validating rules before saving
- `extractWithRules()` convenience function

### 4. Scrape Config API
- `GET /api/prospects/:id/scrape-config` - Fetch configuration
- `PUT /api/prospects/:id/scrape-config` - Update configuration
- `POST /api/prospects/:id/scrape-config` with actions:
  - `action=discover` - AI selector discovery
  - `action=test` - Test extraction rule

### 5. UI Components
- `RuleEditor` - Edit extraction rules with field configuration
- `ScrapeConfigPanel` - Full scrape configuration UI with:
  - Platform detection display
  - AI selector discovery button
  - Rule management
  - Test extraction functionality
  - Crawl settings (collapsible)

## Test Coverage

```
src/server/features/scraping/services/SelectorDiscoveryService.test.ts (10 tests)
src/server/features/scraping/services/CustomExtractor.test.ts (14 tests)

Total: 24 tests passing
```

## Success Criteria Checklist

- [x] ProspectScrapeConfig schema created with extraction rules
- [x] SelectorDiscoveryService calls Claude and parses response
- [x] Platform detection identifies Shopify/WooCommerce/Magento
- [x] CustomExtractor applies rules with pattern matching
- [x] Fallback selectors used when primary fails
- [x] Transform functions work (trim, number, price)
- [x] Rule testing shows extracted values
- [x] UI displays AI-discovered selectors with confidence
- [x] TypeScript compilation passes with no errors in new files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod v4 API change**
- **Found during:** Task 4
- **Issue:** `ZodError.errors` property doesn't exist in Zod v4
- **Fix:** Changed to `ZodError.issues` which is the correct property
- **Files modified:** src/routes/api/prospects/$prospectId.scrape-config.ts

**2. [Rule 3 - Blocking] Missing Accordion component**
- **Found during:** Task 4
- **Issue:** `@/client/components/ui/accordion` module not available
- **Fix:** Created inline collapsible Card component instead
- **Files modified:** src/client/components/scraping/ScrapeConfigPanel.tsx

**3. [Rule 2 - Critical] Request body type safety**
- **Found during:** Task 4
- **Issue:** TypeScript error "body is of type unknown"
- **Fix:** Added explicit type assertion `as { action?: string }`
- **Files modified:** src/routes/api/prospects/$prospectId.scrape-config.ts

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| src/db/prospect-scrape-config-schema.ts | Schema definition | 110 |
| drizzle/0028_prospect_scrape_configs.sql | Migration | 32 |
| src/server/features/scraping/services/SelectorDiscoveryService.ts | AI selector discovery | 155 |
| src/server/features/scraping/services/SelectorDiscoveryService.test.ts | Tests | 315 |
| src/server/features/scraping/services/CustomExtractor.ts | Rule-based extraction | 150 |
| src/server/features/scraping/services/CustomExtractor.test.ts | Tests | 320 |
| src/server/features/scraping/prompts/selector-discovery.xml | Claude prompt | 75 |
| src/routes/api/prospects/$prospectId.scrape-config.ts | API route | 277 |
| src/client/components/scraping/RuleEditor.tsx | Rule editor UI | 350 |
| src/client/components/scraping/ScrapeConfigPanel.tsx | Config panel UI | 550 |
| src/client/components/scraping/index.ts | Exports | 6 |

## Self-Check: PASSED

- [x] All created files exist
- [x] All commits exist in git log
- [x] All tests pass (24/24)
- [x] TypeScript compilation passes for new files

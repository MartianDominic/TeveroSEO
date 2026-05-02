---
phase: 61-platform-integration
plan: 05
subsystem: platform-oauth
tags: [crawler, playwright, robots, sitemap, spa-detection]
dependency_graph:
  requires:
    - fast-xml-parser
    - playwright (optional, for JS rendering)
  provides:
    - UniversalCrawler
    - RobotsTxtParser
    - SitemapParser
    - SPADetector
  affects:
    - Prospect crawling without OAuth
    - Fallback data collection
tech_stack:
  added:
    - Playwright chromium (headless browser)
  patterns:
    - fetch-first with Playwright fallback
    - TDD with vitest
key_files:
  created:
    - open-seo-main/src/server/features/platform-oauth/crawler/RobotsTxtParser.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/RobotsTxtParser.test.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/SitemapParser.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/SitemapParser.test.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/SPADetector.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/SPADetector.test.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/UniversalCrawler.ts
    - open-seo-main/src/server/features/platform-oauth/crawler/index.ts
    - apps/web/src/app/api/crawl/route.ts
    - apps/web/src/app/api/crawl/[jobId]/route.ts
decisions:
  - "Regex extraction for static pages, page.evaluate for Playwright"
  - "Dynamic import() for Playwright to avoid loading unless needed"
  - "Sitemap parsing limit of 5 child sitemaps to prevent DoS"
  - "API routes proxy to open-seo-main rather than direct import"
metrics:
  duration: 9m
  completed: 2026-05-02T16:59:00Z
  tasks: 3/3
  tests: 42
  files: 10
---

# Phase 61 Plan 05: Universal Fallback Crawler Summary

Universal crawler with fetch-first, Playwright-fallback for JS-rendered sites when OAuth is unavailable.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | RobotsTxtParser and SitemapParser | 38966554d | RobotsTxtParser.ts, SitemapParser.ts |
| 2 | SPADetector for JS framework identification | 246454271 | SPADetector.ts |
| 3 | UniversalCrawler with Playwright fallback | 44ab6f133 | UniversalCrawler.ts, index.ts, API routes |

## Implementation Details

### RobotsTxtParser (D-16)

- Parses User-agent, Disallow, Allow, Crawl-delay, Sitemap directives
- `isAllowed(robots, path, userAgent)` checks crawling permission
- Allow rules take precedence over Disallow for same path
- Matches specific user agent first, falls back to wildcard (`*`)

### SitemapParser (D-17)

- Checks 5 common locations: `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap/sitemap.xml`, `/wp-sitemap.xml`, `/sitemap/index.xml`
- Falls back to robots.txt `Sitemap:` directive
- Handles sitemap index files with recursive parsing
- Limits child sitemap parsing to 5 to prevent DoS (T-61-13)

### SPADetector (D-18)

- Detects React, Next.js, Vue, Nuxt, Angular frameworks
- Indicators: `__NEXT_DATA__`, `__NUXT__`, `div#root`, `div#app`, `ng-app`, `data-reactroot`
- `needsJsRendering(html)` returns true only when SPA detected AND no meaningful content
- Content detection via h1, article, main, substantial paragraphs

### UniversalCrawler (D-19)

- `crawl(url)` orchestrates the full flow:
  1. Check robots.txt (D-16)
  2. Discover sitemap (D-17)
  3. Detect SPA (D-18)
  4. Use appropriate method (fetch or Playwright)
- `crawlWithFetch()` for static pages with regex extraction
- `crawlWithPlaywright()` for JS-heavy sites with `page.evaluate`
- Dynamic import for Playwright to avoid loading unless needed
- Browser instance reuse for efficiency

### API Routes

- `POST /api/crawl` - Crawl URL and return page data (proxies to open-seo-main)
- `GET /api/crawl/[jobId]` - Get async job status (placeholder for future)
- Rate limit: 10 crawls per minute per user (SSRF protection)

## Test Coverage

| Module | Tests |
|--------|-------|
| RobotsTxtParser | 14 |
| SitemapParser | 11 |
| SPADetector | 17 |
| **Total** | **42** |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

- [x] RobotsTxtParser tests pass
- [x] SitemapParser tests pass
- [x] SPADetector tests pass
- [x] UniversalCrawler respects robots.txt
- [x] Playwright renders JS-heavy pages
- [x] API routes accept URL and return results

## Success Criteria Met

- [x] Crawler respects robots.txt before crawling
- [x] Sitemap discovery checks 5+ locations
- [x] SPA detection identifies major frameworks (React, Next, Vue, Nuxt, Angular)
- [x] Playwright renders JS when needed
- [x] Crawl results include full SEO metadata (title, description, h1, h2, canonical, og:title, og:description, internal links)
- [x] API routes for crawl jobs

## Self-Check: PASSED

All files exist:
- FOUND: open-seo-main/src/server/features/platform-oauth/crawler/RobotsTxtParser.ts
- FOUND: open-seo-main/src/server/features/platform-oauth/crawler/SitemapParser.ts
- FOUND: open-seo-main/src/server/features/platform-oauth/crawler/SPADetector.ts
- FOUND: open-seo-main/src/server/features/platform-oauth/crawler/UniversalCrawler.ts
- FOUND: open-seo-main/src/server/features/platform-oauth/crawler/index.ts
- FOUND: apps/web/src/app/api/crawl/route.ts
- FOUND: apps/web/src/app/api/crawl/[jobId]/route.ts

All commits exist:
- FOUND: 38966554d
- FOUND: 246454271
- FOUND: 44ab6f133

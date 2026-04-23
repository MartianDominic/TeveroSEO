---
phase: 35-internal-linking
plan: 01
subsystem: linking
tags: [schema, extraction, graph, orphan-detection]
dependency_graph:
  requires: []
  provides: [linkGraph, pageLinks, orphanPages, extractDetailedLinks, buildLinkGraph]
  affects: [audit-workflow, link-opportunities]
tech_stack:
  added: []
  patterns: [TDD, cheerio-html-parsing, drizzle-schema]
key_files:
  created:
    - open-seo-main/src/db/link-schema.ts
    - open-seo-main/src/db/link-schema.test.ts
    - open-seo-main/drizzle/0023_link_graph_tables.sql
    - open-seo-main/src/server/lib/linking/types.ts
    - open-seo-main/src/server/lib/linking/link-extractor.ts
    - open-seo-main/src/server/lib/linking/link-extractor.test.ts
    - open-seo-main/src/server/lib/linking/graph-builder.ts
    - open-seo-main/src/server/lib/linking/graph-builder.test.ts
    - open-seo-main/src/server/lib/linking/index.ts
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - Link position classification uses tag name + class pattern matching (nav/header/footer/sidebar/body)
  - Anchor context captures ~50 chars before and after link text
  - DoS protection: 1000 links/page, 50000 links/audit per threat model T-35-04
  - Homepage excluded from orphan detection (root URL expected to have no inbound)
  - URL normalization strips trailing slashes for consistent matching
metrics:
  duration_seconds: 608
  completed_at: "2026-04-23T11:54:00Z"
  tasks_completed: 3
  tests_passing: 67
---

# Phase 35 Plan 01: Link Graph Schema + Extraction Summary

Link graph schema and extraction infrastructure for internal linking analysis with 67 passing TDD tests.

## One-Liner

Three-table Drizzle schema (linkGraph/pageLinks/orphanPages) with cheerio-based link extraction, position classification, and orphan page detection.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| cff50d4 | feat | Create link graph schema with TDD tests |
| 0b4a035 | feat | Create link extractor with position classification |
| 13c8d03 | feat | Create graph builder with page metrics and orphan detection |

## Key Artifacts

### Schema (link-schema.ts)

Three tables created:

1. **linkGraph** - Stores every internal link relationship
   - Source/target URLs and page IDs
   - Anchor text (original + lowercase)
   - Position classification (body/nav/header/footer/sidebar)
   - Paragraph index with isFirstParagraph/isSecondParagraph flags
   - Link attributes (doFollow, noOpener, hasTitle)
   - Link type classification (contextual/nav/footer/sidebar/image)
   - Unique constraint on audit+source+target+anchor

2. **pageLinks** - Aggregated metrics per page
   - Inbound counts by position, type, first paragraph
   - Outbound counts (internal/external)
   - Anchor distribution (JSONB percentages)
   - Top anchors list (JSONB)
   - Scoring columns (clickDepth, linkScore, opportunityScore)

3. **orphanPages** - Pages with zero inbound links
   - Discovery source tracking (sitemap/gsc/manual)
   - Traffic metrics (searchVolume, monthlyTraffic)
   - Fix status tracking

### Link Extractor (link-extractor.ts)

- `extractDetailedLinks(options)` - Main extraction function
  - Uses cheerio for HTML parsing
  - Filters external and invalid links (javascript:/mailto:/tel:/#)
  - Resolves relative URLs
  - Detects nofollow/noopener attributes
  - Extracts surrounding context (~50 chars)

- `classifyLinkPosition(html, selector)` - Position classification
  - Checks ancestors for nav/header/footer/sidebar patterns
  - Uses tag names and class name patterns

- `getParagraphIndex(html, selector)` - Paragraph numbering
  - Counts paragraphs within main content container

### Graph Builder (graph-builder.ts)

- `buildLinkGraph(params)` - Main entry point
  - Processes all audit pages
  - Extracts links and builds URL-to-page mapping
  - Returns link entries, page metrics, and orphan pages

- `computePageLinkMetrics(params)` - Aggregate metrics
  - Calculates anchor distribution percentages
  - Limits top anchors to 10

- `detectOrphanPages(params)` - Orphan detection
  - Identifies pages with zero inbound links
  - Excludes homepage from orphan detection

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| link-schema.test.ts | 26 | Tables, columns, constants, types |
| link-extractor.test.ts | 28 | Extraction, filtering, position, context |
| graph-builder.test.ts | 13 | Entry creation, metrics, orphan detection |
| **Total** | **67** | All passing |

## Threat Model Compliance

| Threat ID | Mitigation |
|-----------|------------|
| T-35-01 | URL normalization before storage |
| T-35-04 | MAX_LINKS_PER_PAGE=1000, MAX_LINKS_PER_AUDIT=50000 |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] link-schema.ts exists with all three tables
- [x] Migration 0023_link_graph_tables.sql created
- [x] link-extractor.ts exports all required functions
- [x] graph-builder.ts exports all required functions
- [x] index.ts barrel exports complete
- [x] All commits verified: cff50d4, 0b4a035, 13c8d03

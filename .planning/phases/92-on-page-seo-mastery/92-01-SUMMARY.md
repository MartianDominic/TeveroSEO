---
phase: 92-on-page-seo-mastery
plan: 01
subsystem: on-page-mastery
tags: [database, classification, llm, caching]
dependency_graph:
  requires: []
  provides: [onpage-mastery-schema, VerticalClassifier]
  affects: [future-tier5-checks, quality-gates]
tech_stack:
  added: [cheerio]
  patterns: [circuit-breaker, heuristic-first, zod-validation]
key_files:
  created:
    - open-seo-main/src/db/onpage-mastery-schema.ts
    - open-seo-main/src/server/features/onpage-mastery/types.ts
    - open-seo-main/src/server/features/onpage-mastery/services/VerticalClassifier.ts
    - open-seo-main/src/server/features/onpage-mastery/services/VerticalClassifier.test.ts
    - open-seo-main/src/server/features/onpage-mastery/services/index.ts
    - open-seo-main/src/server/features/onpage-mastery/index.ts
  modified:
    - open-seo-main/src/db/index.ts
decisions:
  - "Schema.org types get highest confidence (0.95) for vertical classification"
  - "URL patterns get medium confidence (0.90)"
  - "YMYL keyword detection gets lower confidence (0.70) as fallback"
  - "Path patterns collapse year/month/day to wildcards but preserve named slugs"
  - "90-day cache TTL for vertical classifications"
metrics:
  duration: 7m 30s
  completed_date: 2026-05-06
  tasks_completed: 2
  tasks_total: 2
  tests_added: 26
  tests_passing: 26
---

# Phase 92 Plan 01: Database Schema + VerticalClassifier Summary

Database schema for on-page mastery (8 tables) and heuristic-first VerticalClassifier service with LLM fallback.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Database schema for on-page mastery | b6b537f4f | onpage-mastery-schema.ts, db/index.ts |
| 2 | Types and VerticalClassifier service | 970767176 | types.ts, VerticalClassifier.ts, tests, index files |

## Key Deliverables

### Database Schema (8 tables)

1. **clientSeoSettings** - Per-client Tier 5 configuration (tier5Enabled, verticalOverride, qualityGateTier)
2. **verticalClassifications** - 90-day cache for vertical classification by domain + path pattern
3. **pageQualityScores** - Tier 5 quality metrics (redditTestScore, infoGainScore, proveItScore, etc.)
4. **semanticChunks** - 500-token chunks with 768-dim embeddings
5. **seoRuleWeights** - Custom rule weights per client
6. **chunkRecommendations** - Split/merge/expand suggestions for chunks
7. **topicClusters** - Topical authority clusters with pillar pages
8. **topicAuthorityScores** - Per-cluster authority metrics (coverage, depth, linkDensity, backlink)

### VerticalClassifier Service

Heuristic-first classification that skips LLM for 90%+ of pages:

1. **Schema.org detection** (confidence 0.95) - Parses JSON-LD for types like MedicalOrganization, LegalService, Product
2. **URL pattern detection** (confidence 0.90) - Matches /products/, /pricing, /doctors/, etc.
3. **YMYL keyword detection** (confidence 0.70) - Scans body text for healthcare/legal/financial keywords
4. **LLM fallback** - Grok 4.1 Fast with Zod validation for uncertain cases

Features:
- Circuit breaker (3 failures, 60s timeout)
- Zod schema validation on LLM responses
- 90-day caching by domain + path pattern
- YMYL detection for healthcare, legal, financial verticals
- Path pattern extraction (converts /product/123 to /product/*)

## Test Coverage

26 tests covering:
- Constructor with API key configuration
- Schema.org detection (MedicalOrganization, LegalService, Product)
- URL pattern detection (/products, /pricing, /doctors, /attorneys)
- YMYL keyword detection (investment, retirement, 401k)
- LLM classification with response validation
- Circuit breaker behavior
- Path pattern extraction
- YMYL vertical identification

## Requirements Addressed

- **OPM-01**: Vertical classification returns one of 12 verticals with confidence score
- **OPM-02**: YMYL detection correctly flags healthcare/legal/financial content
- **OPM-03**: 90%+ of pages classified via heuristics without LLM call

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] open-seo-main/src/db/onpage-mastery-schema.ts exists with 8 tables
- [x] open-seo-main/src/server/features/onpage-mastery/types.ts exists with VERTICALS, YMYL_VERTICALS, SCHEMA_TO_VERTICAL
- [x] open-seo-main/src/server/features/onpage-mastery/services/VerticalClassifier.ts exists with classifyHeuristic, classifyLLM
- [x] Commits b6b537f4f and 970767176 exist in git log
- [x] All 26 tests passing

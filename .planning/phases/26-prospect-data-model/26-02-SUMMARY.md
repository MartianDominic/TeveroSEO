---
phase: 26
plan: 02
subsystem: prospects
tags: [dataforseo, api, prospect-analysis, billing]
dependency_graph:
  requires:
    - 26-01 (prospect schema)
  provides:
    - DataForSEO keywordsForSite API wrapper
    - DataForSEO competitorsDomain API wrapper
    - Metered client prospect methods
  affects:
    - prospect analysis worker (future)
    - prospect analysis UI (future)
tech_stack:
  added:
    - dataforseoProspect.ts API wrappers
    - keywordsForSiteItemSchema Zod schema
    - competitorsDomainItemSchema Zod schema
  patterns:
    - DataForSEO authenticated fetch pattern
    - Billing metering via meterDataforseoCall
    - Zod schema validation for API responses
key_files:
  created:
    - open-seo-main/src/server/lib/dataforseoProspect.ts
    - open-seo-main/src/server/lib/dataforseoProspect.test.ts
    - open-seo-main/src/server/lib/dataforseoProspectSchemas.test.ts
  modified:
    - open-seo-main/src/server/lib/dataforseoSchemas.ts
    - open-seo-main/src/server/lib/dataforseoClient.ts
decisions:
  - keywordsForSite returns all keywords a domain ranks for with SERP positions
  - competitorsDomain returns competing domains based on keyword overlap
  - Both endpoints map to domain_overview credit feature for billing
  - exclude_top_domains enabled for competitorsDomain to filter generic sites
metrics:
  duration: 265s
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 2
  completed_at: "2026-04-20T21:33:39Z"
---

# Phase 26 Plan 02: DataForSEO Prospect API Integration Summary

DataForSEO API wrappers for prospect analysis with billing metering and response validation

## What Was Built

Integrated DataForSEO Labs API endpoints for one-time prospect analysis, enabling the platform to analyze what keywords a prospect domain ranks for and identify their competitors.

### Zod Schemas (dataforseoSchemas.ts)

**keywordsForSiteItemSchema:**
- Validates keyword, location_code, language_code
- keyword_info: search_volume, cpc, competition, monthly_searches
- impressions_info: ad position metrics, daily impressions, clicks, costs
- serp_info: SERP type and check timestamps
- ranked_serp_element: ranking position, URL, title, rank changes

**competitorsDomainItemSchema:**
- Validates domain (required), se_type, avg_position, sum_position, intersections
- full_domain_metrics.organic: position distribution (pos_1, pos_2_3, etc.), etv, count

### API Wrapper Functions (dataforseoProspect.ts)

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `fetchKeywordsForSiteRaw` | `/v3/dataforseo_labs/google/keywords_for_site/live` | All keywords domain ranks for |
| `fetchCompetitorsDomainRaw` | `/v3/dataforseo_labs/google/competitors_domain/live` | Competing domains by keyword overlap |

Both functions:
- Use authenticated fetch with Basic auth (DATAFORSEO_API_KEY env var)
- Parse responses through Zod schemas (silently skip invalid items)
- Return `{ data, billing }` structure with cost tracking
- Support location_code, language_code, and limit parameters

### Metered Client Integration (dataforseoClient.ts)

Added `prospect` namespace to createDataforseoClient:

```typescript
client.prospect.keywordsForSite({ target, locationCode, languageCode, limit })
client.prospect.competitorsDomain({ target, locationCode, languageCode, limit })
```

Updated `mapDataforseoPathToCreditFeature` to map:
- `keywords_for_site` -> `domain_overview`
- `competitors_domain` -> `domain_overview`

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `d94ddda` | feat | Add Zod schemas for keywordsForSite and competitorsDomain |
| `c392c2e` | feat | Create DataForSEO prospect API wrapper functions |
| `30c9e78` | feat | Add prospect methods to DataForSEO metered client |
| `f20c468` | test | Add unit tests for DataForSEO prospect functions |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

All threat mitigations from the plan were implemented:

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-26-06 | API key not logged | Key in env var, Basic auth header only |
| T-26-07 | Response validation | Zod schemas validate all responses |
| T-26-08 | Billing metering | meterDataforseoCall checks balance pre-call |
| T-26-09 | HTTPS transport | API_BASE uses https://api.dataforseo.com |

## Success Criteria Verification

- [x] Zod schemas added for keywordsForSite and competitorsDomain responses
- [x] fetchKeywordsForSiteRaw returns keywords domain ranks for
- [x] fetchCompetitorsDomainRaw returns competitor domains
- [x] Both functions return billing metadata
- [x] Metered client extended with prospect.keywordsForSite and prospect.competitorsDomain
- [x] Credit feature mapping handles new endpoints
- [x] Unit tests pass (12 tests total)
- [x] TypeScript compiles without errors

## Self-Check: PASSED

**Files verified:**
- FOUND: open-seo-main/src/server/lib/dataforseoProspect.ts
- FOUND: open-seo-main/src/server/lib/dataforseoProspect.test.ts
- FOUND: open-seo-main/src/server/lib/dataforseoProspectSchemas.test.ts

**Commits verified:**
- FOUND: d94ddda
- FOUND: c392c2e
- FOUND: 30c9e78
- FOUND: f20c468

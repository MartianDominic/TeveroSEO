---
phase: 43-prospect-keyword-pipeline
plan: 02
subsystem: keyword-research
tags: [quick-check, competitor-spy, no-workspace, share-links]
dependency-graph:
  requires:
    - 43-01 (KeywordEnrichmentService, KeywordInputService)
  provides:
    - QuickCheckService (no-workspace keyword validation)
    - CompetitorSpyService (competitor keyword extraction)
    - POST /api/keywords/quick-check
    - POST /api/keywords/competitor-spy
    - /prospects/keywords/quick-check UI
    - /prospects/keywords/competitor-spy UI
  affects:
    - apps/web prospects section
    - open-seo-main API routes
tech-stack:
  added:
    - dataforseo-organic.ts (ranked_keywords API wrapper)
  patterns:
    - TDD (RED-GREEN for services)
    - Server actions pattern for Next.js UI
    - Redis caching with TTL
key-files:
  created:
    - open-seo-main/src/server/features/keywords/services/QuickCheckService.ts
    - open-seo-main/src/server/features/keywords/services/QuickCheckService.test.ts
    - open-seo-main/src/server/features/keywords/services/CompetitorSpyService.ts
    - open-seo-main/src/server/features/keywords/services/CompetitorSpyService.test.ts
    - open-seo-main/src/server/lib/dataforseo-organic.ts
    - open-seo-main/src/routes/api/keywords/quick-check.ts
    - open-seo-main/src/routes/api/keywords/competitor-spy.ts
    - apps/web/src/app/(shell)/prospects/keywords/quick-check/page.tsx
    - apps/web/src/app/(shell)/prospects/keywords/quick-check/actions.ts
    - apps/web/src/app/(shell)/prospects/keywords/competitor-spy/page.tsx
    - apps/web/src/app/(shell)/prospects/keywords/competitor-spy/actions.ts
  modified:
    - open-seo-main/src/server/features/keywords/services/index.ts
decisions:
  - QuickCheckService uses same kw-metrics cache prefix as KeywordEnrichmentService for consistency
  - Share links use nanoid(16) for cryptographically random tokens
  - Competitor Spy caches for 24h (shorter than keywords 7d) since domain rankings change faster
  - CTR model uses industry-standard percentages (pos 1 = 28%, pos 2 = 15%, etc.)
metrics:
  duration: 8 minutes
  completed: 2026-04-26T22:05:00Z
  tasks: 4/4
  files-created: 11
  files-modified: 1
  test-coverage: 20 tests (11 QuickCheckService + 9 CompetitorSpyService)
---

# Phase 43 Plan 02: Quick Check & Competitor Spy Summary

Quick Check and Competitor Spy modes for no-workspace keyword validation and competitive intelligence with Redis caching and share links.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8fd4c48d7 | feat | QuickCheckService with validation, caching, share links |
| bcaf0990e | feat | CompetitorSpyService with domain extraction, traffic estimation |
| d01455f46 | feat | Quick Check API endpoint and UI |
| e9d6c25ec | feat | Competitor Spy API endpoint and UI |
| 470c3b415 | chore | Export new services from barrel |

## What Was Built

### QuickCheckService
- Accepts 1-20 keywords, validates input
- Returns volume, difficulty, CPC, competition metrics
- Caches results in Redis for 7 days (`kw-metrics:` prefix)
- Generates shareable links with 30-day TTL (`quick-check:` prefix)
- Retrieves shared results by token for unauthenticated access

### CompetitorSpyService
- Extracts top 100 keywords for any domain
- Uses DataForSEO `ranked_keywords` endpoint (new `dataforseo-organic.ts`)
- Normalizes domain input (strips protocol, paths, www)
- Estimates traffic share based on position/volume CTR model
- Caches results for 24 hours (`competitor-spy:` prefix)
- Compare multiple competitors side-by-side

### API Endpoints
- `POST /api/keywords/quick-check` - Zod validation, optional share link generation
- `POST /api/keywords/competitor-spy` - Domain validation, configurable limit

### UI Pages
- `/prospects/keywords/quick-check` - Textarea input, results table, CSV export, share link with copy button
- `/prospects/keywords/competitor-spy` - Domain input, position badges, traffic estimates, external URL links

## Test Coverage

| Service | Tests | Status |
|---------|-------|--------|
| QuickCheckService | 11 | PASS |
| CompetitorSpyService | 9 | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| Location | Stub | Resolution |
|----------|------|------------|
| quick-check/page.tsx | "Create Prospect" button | Future plan will wire to prospect creation flow |
| competitor-spy/page.tsx | "Create Gap Analysis" button | Future plan will wire to gap analysis flow |

## Self-Check: PASSED

Verified all commits exist:
- 8fd4c48d7: QuickCheckService
- bcaf0990e: CompetitorSpyService  
- d01455f46: Quick Check API and UI
- e9d6c25ec: Competitor Spy API and UI
- 470c3b415: Barrel export update

Verified all files created exist:
- QuickCheckService.ts: FOUND
- QuickCheckService.test.ts: FOUND
- CompetitorSpyService.ts: FOUND
- CompetitorSpyService.test.ts: FOUND
- dataforseo-organic.ts: FOUND
- quick-check.ts (API): FOUND
- competitor-spy.ts (API): FOUND
- quick-check/page.tsx: FOUND
- quick-check/actions.ts: FOUND
- competitor-spy/page.tsx: FOUND
- competitor-spy/actions.ts: FOUND

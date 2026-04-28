---
phase: 32-seo-checks
plan: 04
subsystem: audit-checks
tags: [seo, api-checks, cwv, backlinks, nlp, architecture]
dependency_graph:
  requires: [32-01-registry]
  provides: [tier3-checks, tier4-checks]
  affects: [audit-runner, scoring]
tech_stack:
  added: []
  patterns: [api-credential-skip-pattern, graceful-degradation]
key_files:
  created:
    - src/server/lib/audit/checks/tier3/cwv.ts
    - src/server/lib/audit/checks/tier3/entity-nlp.ts
    - src/server/lib/audit/checks/tier3/backlinks.ts
    - src/server/lib/audit/checks/tier3/engagement.ts
    - src/server/lib/audit/checks/tier3/index.ts
    - src/server/lib/audit/checks/tier4/architecture.ts
    - src/server/lib/audit/checks/tier4/differentiation.ts
    - src/server/lib/audit/checks/tier4/index.ts
  modified: []
decisions:
  - All Tier 3/4 checks return skipped status when API credentials missing
  - Heuristic fallbacks for entity/NLP checks when API unavailable
  - SimHash replaced with simple hash for ES target compatibility
metrics:
  duration: 8
  completed: 2026-04-22
---

# Phase 32 Plan 04: Tier 3+4 API/Crawl Checks Summary

Implemented 20 async SEO checks requiring external APIs or crawl data.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tier 3 API checks (13 checks) | 529952f | cwv.ts, entity-nlp.ts, backlinks.ts, engagement.ts |
| 2 | Tier 4 crawl checks (7 checks) | 529952f | architecture.ts, differentiation.ts |
| 3 | Index files | 529952f | tier3/index.ts, tier4/index.ts |

## Implementation Details

### Tier 3 Checks (API-Required)

**Core Web Vitals (T3-01 to T3-03)**
- T3-01: LCP <= 2.5s (CrUX API)
- T3-02: INP <= 200ms (CrUX API)
- T3-03: CLS <= 0.1 (CrUX API)
- Requires: GOOGLE_CWV_API_KEY

**Entity/NLP Analysis (T3-04 to T3-07)**
- T3-04: Entity coverage >= 60%
- T3-05: Central entity in every section
- T3-06: No term > 2x competitor max
- T3-07: Semantic gap identification
- Requires: GOOGLE_NLP_API_KEY or OPENAI_API_KEY
- Includes heuristic fallbacks when API unavailable

**Backlink Analysis (T3-08 to T3-10)**
- T3-08: Link velocity 5-10/month
- T3-09: Anchor text ratio natural
- T3-10: Outbound link DR 50+
- Requires: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD

**Engagement Proxies (T3-11 to T3-13)**
- T3-11: CTR vs position expectation
- T3-12: Scroll depth >= 60%
- T3-13: Bounce rate vs benchmark
- Requires: GSC_OAUTH_CONFIGURED, GA4_OAUTH_CONFIGURED

### Tier 4 Checks (Crawl-Required)

**Site Architecture (T4-01 to T4-05)**
- T4-01: Click depth <= 3
- T4-02: No orphan pages
- T4-03: Pillar links to all spokes
- T4-04: Spokes link back to pillar
- T4-05: 15-25 spokes per cluster
- Requires: ctx.siteContext with linkGraph/clickDepths

**Content Differentiation (T4-06 to T4-07)**
- T4-06: 30-40% unique content (fingerprinting)
- T4-07: No scaled content patterns (template detection)
- Requires: ctx.siteContext

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ES Target Compatibility**
- **Found during:** Task 1-2
- **Issue:** BigInt literals and Map/Set iteration not compatible with ES target
- **Fix:** Replaced BigInt simHash with simple numeric hash, used Array.from() and forEach()
- **Files modified:** differentiation.ts, entity-nlp.ts, backlinks.ts, architecture.ts

## Key Design Decisions

1. **Graceful Degradation:** All API checks return `skipped: true` with clear reason when credentials missing
2. **Heuristic Fallbacks:** Entity/NLP checks use pattern matching when no API key
3. **Async Support:** All checks return Promises for API compatibility
4. **Fingerprinting:** Simple hash used instead of SimHash for ES compatibility

## Self-Check: PASSED

- [x] cwv.ts exists (3 checks)
- [x] entity-nlp.ts exists (4 checks)
- [x] backlinks.ts exists (3 checks)
- [x] engagement.ts exists (3 checks)
- [x] architecture.ts exists (5 checks)
- [x] differentiation.ts exists (2 checks)
- [x] tier3/index.ts exists
- [x] tier4/index.ts exists
- [x] Commit 529952f found

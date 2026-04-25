# Phase 41: Production Hardening

## Overview

This phase addresses all stub implementations, dead code, and mock data identified in the comprehensive 10-agent architecture audit (2026-04-25). The goal is to make the system production-ready for client use.

## Source Documents

- `MOCK-ENDPOINTS-AUDIT.md` - Initial mock discovery (41 items flagged)
- `SYSTEM-ARCHITECTURE-AUDIT.md` - Deep analysis (reduced to ~10 real issues)

## Key Findings from Architecture Audit

### TRUE Issues (Must Fix)

| Issue | File | Impact |
|-------|------|--------|
| Pattern detection uses fake data | `apps/web/src/actions/analytics/detect-patterns.ts:30-94` | Dashboard shows meaningless analytics |
| Autonomous pipeline stub | `AI-Writer/backend/services/intelligence/autonomous_pipeline.py` | v5.0 flagship feature non-functional |
| InMemoryFindingsRepository in prod | `apps/web/src/lib/audit/repositories/FindingsRepository.ts:110-162` | Could lose audit data |
| Wix categories hardcoded | `AI-Writer/backend/services/wix_service.py:289-312` | Can't assign categories |
| CMS connection test stub | `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx:494-497` | Users can't verify connections |
| SEO dashboard returns zeros on error | `apps/web/src/actions/dashboard/get-seo-metrics.ts:78-95` | Hides failures |

### FALSE ALARMS (Already Implemented)

| "Issue" | Reality |
|---------|---------|
| Research utilities mock (Tavily/Serper) | Real implementations exist in `services/research/tavily_service.py` and `exa_service.py` |
| Social amplification stubs | Aspirational v6.0 feature, not in roadmap |

### Dead Code to Remove

| File | Reason |
|------|--------|
| `AI-Writer/backend/services/component_logic/research_utilities.py` | Unused wrapper, real services elsewhere |
| `AI-Writer/ToBeMigrated/ai_web_researcher/google_serp_search.py` | DataForSEO replaces Serper |
| `AI-Writer/ToBeMigrated/ai_web_researcher/firecrawl_web_crawler.py` | DataForSEO OnPage replaces this |

## Integration Architecture (Reference)

```
apps/web (Next.js) → getFastApi() → AI-Writer (port 8000)
                  → getOpenSeo() → open-seo-main (port 3001)

AI-Writer OWNS: clients, articles, OAuth, CMS publishing
open-seo OWNS: audits, briefs, voice profiles, keywords, linking

Cross-system: HTTP APIs, shared client_id, same Redis instance
```

## Phase Structure

| Plan | Focus | Wave |
|------|-------|------|
| 41-01 | Dead code removal + factory fixes | 1 |
| 41-02 | Pattern detection with real GSC data | 2 |
| 41-03 | Autonomous pipeline wiring | 2 |
| 41-04 | CMS integration polish | 3 |

## Success Criteria

1. `grep -r "generateMockTrafficData\|generateMockRankingData" apps/web/` returns zero matches
2. `grep -r "_simulate_research" AI-Writer/backend/` returns zero matches
3. Autonomous pipeline can detect opportunities and trigger article generation
4. Wix publishing shows real categories from API
5. CMS connection test button works for WordPress/Shopify/Wix
6. Dashboard errors throw instead of returning zeros

## Dependencies

- Phase 40 complete (Gap Closure)
- GSC OAuth tokens working
- DataForSEO credentials valid
- Wix OAuth credentials valid

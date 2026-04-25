# TeveroSEO System Architecture Audit

**Date:** 2026-04-25
**Auditors:** 10 Opus Subagents (Deep Architecture Analysis)

---

## Executive Summary

The system IS unified at the infrastructure level (~65% integrated), but several flagged "mocks" are actually:
1. **Dead code** with real implementations elsewhere
2. **Future features** not in current roadmap
3. **Intentional stubs** for features not yet prioritized

**Key Finding:** The MOCK-ENDPOINTS-AUDIT.md overstated several issues. Real implementations exist for Tavily and Exa/Metaphor. Social features are aspirational, not blockers.

---

## Question 1: What are Tavily, Serper, Metaphor, and Firecrawl?

### Service Purposes

| Service | What It Does | Already Implemented? |
|---------|--------------|---------------------|
| **Tavily** | AI-powered web research with summarization | YES - `services/research/tavily_service.py` |
| **Serper** | Google SERP API (organic results, PAA) | NO - **Redundant with DataForSEO** |
| **Exa/Metaphor** | Neural/semantic search for finding similar websites | YES - `services/research/exa_service.py` |
| **Firecrawl** | Web scraping and site crawling | NO - **Redundant with DataForSEO OnPage** |

### The Real Situation

**The `research_utilities.py` file is DEAD CODE.**

Real implementations exist in separate service files:
```
AI-Writer/backend/services/research/
├── tavily_service.py      ← REAL IMPLEMENTATION (uses TAVILY_API_KEY)
├── exa_service.py         ← REAL IMPLEMENTATION (uses EXA_API_KEY)
└── [no serper/firecrawl]  ← Correctly not implemented (redundant)
```

**Who uses them:**
- `tavily_service.py` → Called by `deep_crawl_service.py` for site intelligence
- `exa_service.py` → Called by `step3_research_service.py` for competitor discovery during onboarding

### Recommendation

| Service | Action | Reason |
|---------|--------|--------|
| Tavily | KEEP | Unique AI summarization capability |
| Exa/Metaphor | KEEP | Unique neural/semantic search for competitors |
| Serper | REMOVE from research_utilities.py | DataForSEO already provides SERP data |
| Firecrawl | REMOVE from research_utilities.py | DataForSEO OnPage + existing crawlers cover this |

**Fix:** Delete or deprecate `research_utilities.py` entirely - it's unused wrapper code.

---

## Question 2: What are LinkedIn and Twitter Features For?

### Intended Purpose

The `SocialAmplificationAgent` is designed to:
1. Monitor social trends (hashtags, conversations)
2. Adapt blog content into social posts (LinkedIn threads, tweets)
3. Optimize for engagement (hooks, timing, hashtags)
4. Distribute to platforms

### Current State: **STUBS ONLY - NOT IN ROADMAP**

```python
# All these return hardcoded data:
_social_monitor_tool()     → {"trends": ["AI in marketing"], "source": "stub"}
_content_adapter_tool()    → {"adapted_content": "Social post"}
_engagement_optimizer_tool() → {"engagement_score": 8.5}
_distribution_manager_tool() → {"plan": [], "source": "stub"}
```

### Is This a Priority?

**NO.** Checking the roadmap:
- v5.0 is "Autonomous SEO Pipeline" - focuses on audits, linking, briefs, voice
- Social distribution is NOT in any defined phase (1-40)
- LinkedIn requires Partner Program approval (complex)
- Twitter/X API costs $100/month minimum

### Recommendation

**DEFER to v6.0+**

The agent framework still provides value - it proposes daily tasks like "Create LinkedIn Thread" that users can do manually. The actual posting automation is low priority vs core SEO features.

**Update MOCK-ENDPOINTS-AUDIT.md:** Move social amplification from HIGH to DEFERRED.

---

## Question 3: How Are AI-Writer and open-seo-main Connected?

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/web (Next.js 15)                        │
│                    Port 3002 - Unified UI                       │
│                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────────────┐   │
│  │ getFastApi()        │     │ getOpenSeo()                │   │
│  │ → AI-Writer         │     │ → open-seo-main             │   │
│  └──────────┬──────────┘     └──────────────┬──────────────┘   │
└─────────────┼────────────────────────────────┼─────────────────┘
              │                                │
              ▼                                ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│    AI-Writer (FastAPI)  │    │    open-seo-main (TanStack)      │
│    Port 8000            │    │    Port 3001                     │
│                         │    │                                  │
│  OWNS:                  │◄───┤  READS: alwrity.clients          │
│  • Clients table        │    │  (via ALWRITY_DATABASE_URL)      │
│  • Articles             │    │                                  │
│  • CMS Publishing       │    │  OWNS:                           │
│  • OAuth (GSC/GA4)      │────►  • SEO Audits (107 checks)       │
│  • Voice Templates      │    │  • Internal Linking              │
│                         │    │  • Content Briefs                │
│  CALLS open-seo for:    │    │  • Voice Profiles (40+ fields)   │
│  • Quality gate check   │    │  • Keywords/Rankings             │
│  • Voice profile fetch  │    │                                  │
│  • Link graph update    │    │  CALLS AI-Writer for:            │
│                         │    │  • Create article from brief     │
│                         │    │  • Get article status            │
└───────────┬─────────────┘    └─────────────┬────────────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│  PostgreSQL: alwrity    │    │  PostgreSQL: open_seo            │
│  Redis: APScheduler     │    │  Redis: BullMQ queues            │
└─────────────────────────┘    └──────────────────────────────────┘
```

### Data Ownership Matrix

| Data | Owner | Other System Access |
|------|-------|---------------------|
| Client master record | AI-Writer (`alwrity.clients`) | open-seo reads directly |
| OAuth tokens (GSC/GA4) | AI-Writer | open-seo calls internal API |
| Voice profiles (40+ fields) | open-seo | AI-Writer fetches via API |
| SEO audits | open-seo | AI-Writer doesn't access |
| Content briefs | open-seo | AI-Writer receives via API |
| Articles | AI-Writer | open-seo stores `articleId` reference |
| Link graph | open-seo | AI-Writer updates after publish |
| Keywords/Rankings | open-seo | AI-Writer doesn't access |

### Cross-System API Calls

**AI-Writer → open-seo:**
```
POST /api/seo/content/validate     → Quality gate check
GET  /api/seo/voice/{clientId}     → Fetch voice profile
POST /api/seo/links/graph/update   → Update link graph after publish
GET  /api/seo/links/suggestions    → Get internal link suggestions
```

**open-seo → AI-Writer:**
```
POST /api/articles                 → Create article from brief
GET  /api/articles/{id}           → Get article status
PATCH /api/articles/{id}          → Trigger generation
GET  /internal/tokens/{clientId}  → Fetch OAuth tokens
```

### Job/Queue Systems

| System | Framework | Purpose |
|--------|-----------|---------|
| AI-Writer | APScheduler | Auto-publish (15min), daily generation (1:00 UTC) |
| open-seo | BullMQ | Audits, analytics sync, rankings, webhooks |

**No shared queue** - all coordination is HTTP-based.

---

## Question 4: What Actually Needs to Change?

### TRUE Issues (Must Fix)

| Issue | File | Why It Matters |
|-------|------|----------------|
| SERP H2/word count returns zeros | `SerpAnalyzer.ts:35-57` | Content briefs are incomplete |
| Pattern detection uses fake data | `detect-patterns.ts:30-94` | Dashboard shows meaningless analytics |
| Autonomous pipeline stub | `autonomous_pipeline.py:45-89` | v5.0 flagship feature broken |
| InMemoryFindingsRepository in prod | `FindingsRepository.ts:110-162` | Could lose audit data |

### FALSE ALARMS (Already Implemented Elsewhere)

| "Issue" | Reality |
|---------|---------|
| Research utilities mock | Real Tavily/Exa services exist in `services/research/` |
| Voice profile fallback | Intentional graceful degradation |
| Strategy data fallback | Defensive coding, not a bug |

### NOT PRIORITIES (Defer)

| Feature | Reason to Defer |
|---------|-----------------|
| Social amplification (LinkedIn/Twitter) | Not in roadmap, requires complex OAuth |
| Semantic gap analysis | Nice-to-have, txtai dependency |
| Originality verification | Not core workflow |

### Actual Duplications to Fix

| Feature | AI-Writer | open-seo | Action |
|---------|-----------|----------|--------|
| URL validation | `url_validator.py` (591 LOC) | `url-policy.ts` (221 LOC) | Add DNS check to AI-Writer |
| GSC/GA4 snapshots | `gsc_snapshots` table | `gsc_snapshots` table | Intentional duplication, keep |
| Voice templates | Simple `voice_templates` | Industry `voice_templates` | Different purposes, keep |

---

## 30-Day Fix Plan

### Week 1: Core Data Quality
1. Implement `SerpAnalyzer.extractCommonH2s()` using DataForSEO OnPage
2. Implement `SerpAnalyzer.calculateWordCountStats()`
3. Delete dead code: `research_utilities.py`
4. Verify Tavily/Exa services work with production credentials

### Week 2: Analytics Truth
5. Replace mock pattern detection with real GSC aggregates
6. Add endpoints: `/api/workspaces/{id}/traffic-data`, `/api/workspaces/{id}/ranking-data`
7. Fix InMemoryFindingsRepository factory (one-line change)

### Week 3: Autonomous Pipeline
8. Wire `autonomous_pipeline.py` to existing services:
   - GSC service for opportunity detection
   - Article generation for content
   - Quality gate for validation
   - CMS publishers for distribution

### Week 4: Polish
9. Implement Wix categories API (simple)
10. Add CMS connection test
11. Fix error handling (throw, don't return zeros)
12. Update MOCK-ENDPOINTS-AUDIT.md with corrections

---

## Appendix: Credentials Needed

| Service | Env Var | Status |
|---------|---------|--------|
| Tavily | `TAVILY_API_KEY` | **CHECK** - verify in production |
| Exa | `EXA_API_KEY` | **CHECK** - verify in production |
| DataForSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Already working |
| Serper | Not needed | Redundant with DataForSEO |
| Firecrawl | Not needed | Redundant |
| LinkedIn | Not needed | Deferred |
| Twitter | Not needed | Deferred |

---

## Key Takeaways

1. **The systems ARE unified** - shared client_id, cross-system APIs, common frontend
2. **research_utilities.py is dead code** - real Tavily/Exa implementations exist
3. **Social features are aspirational** - not in scope, move to v6.0
4. **True gaps are smaller than reported** - ~10 real issues vs 41 flagged
5. **Focus on SERP analysis + pattern detection** - these affect content quality

---

*Generated by 10 Opus architecture analysis agents on 2026-04-25*

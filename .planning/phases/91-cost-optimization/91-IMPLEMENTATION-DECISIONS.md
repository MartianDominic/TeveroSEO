# Phase 91: Implementation Decisions

**Purpose:** Single document to decide what to implement. Mark each item, then execute.

**Your marks:**
- `[x]` = Implement
- `[-]` = Skip
- `[?]` = Discuss first

---

## Category A: Scheduled Job Elimination (Biggest Savings)

These are the **real wastes** — scheduled jobs running when no one is looking.

### A1. Eliminate Daily Ranking Scheduler
**File:** `open-seo-main/src/server/queues/rankingQueue.ts`
**Current:** Daily 03:00 UTC cron checks ALL tracked keywords via DataForSEO SERP
**Problem:** $0.006/keyword × 1000 keywords = $180/month for data no one checks daily
**Change:** Remove scheduler, keep `triggerRankingCheck()` for manual refresh button
**Savings:** $100-300/month
**Effort:** Easy (delete cron config, add UI button)
**Status:** [x]

---

### A2. Make Dashboard Metrics On-Demand
**File:** `open-seo-main/src/server/workers/dashboard-metrics-worker.ts`
**Current:** Runs every 5 minutes (288 times/day) pre-computing metrics
**Problem:** No one looks at dashboards 288 times/day
**Change:** Compute when user opens dashboard, cache 5 minutes
**Savings:** 288 useless job runs/day eliminated
**Effort:** Medium (refactor to on-demand pattern)
**Status:** [?]

---

### A3. Chain Alert Detection After Metrics
**File:** `open-seo-main/src/server/queues/alertDetectionQueue.ts`
**Current:** Runs every 5 minutes independently
**Problem:** Alerts depend on metrics — no point running before metrics update
**Change:** Trigger from metrics completion, not cron
**Savings:** 288 useless job runs/day eliminated
**Effort:** Easy (add job spawn at end of metrics processor)
**Status:** [x]

---

### A4. Chain Portfolio Aggregates After Metrics
**File:** `open-seo-main/src/server/queues/portfolioAggregatesQueue.ts`
**Current:** Runs every 5 minutes independently
**Problem:** Aggregates depend on metrics — no point running before metrics update
**Change:** Trigger from metrics completion (after alerts)
**Savings:** 288 useless job runs/day eliminated
**Effort:** Easy (add job spawn at end of alert processor)
**Status:** [x]

---

## Category B: TTL Extensions (Easy Wins)

These are simple config changes that reduce redundant API calls.

### B1. Extend Classification TTL from 7 to 90 days
**File:** `open-seo-main/src/server/features/keywords/services/ClassificationSingleflight.ts`
**Current:** `resultTTL: 604800` (7 days)
**Problem:** Classification is deterministic — same input = same output forever
**Change:** `resultTTL: 7776000` (90 days)
**Savings:** 90%+ reduction in re-classification LLM costs
**Effort:** Easy (change constant)
**Status:** [?]

---

### B2. Extend Backlinks TTL from 6h to 24h
**File:** `open-seo-main/src/server/features/backlinks/services/backlinksServiceData.ts`
**Current:** `BACKLINKS_OVERVIEW_TTL_SECONDS = 6 * 60 * 60`
**Problem:** Backlinks change weekly/monthly, not hourly
**Change:** `BACKLINKS_OVERVIEW_TTL_SECONDS = 24 * 60 * 60`
**Savings:** 75% fewer backlinks API calls
**Effort:** Easy (change constant)
**Status:** [x]

---

### B3. Extend Domain Overview TTL from 12h to 7 days
**File:** `open-seo-main/src/server/features/domain/services/DomainService.ts`
**Current:** `DOMAIN_OVERVIEW_TTL_SECONDS = 12 * 60 * 60`
**Problem:** Domain metrics change weekly/monthly, not hourly
**Change:** `DOMAIN_OVERVIEW_TTL_SECONDS = 7 * 24 * 60 * 60`
**Savings:** 85% fewer domain API calls
**Effort:** Easy (change constant)
**Status:** [x]

---

### B4. Extend Keyword Research TTL from 24h to 7 days
**File:** `open-seo-main/src/server/features/keywords/services/research/research.ts`
**Current:** `CACHE_TTL.researchResult: 86400` (24h)
**Problem:** Keyword research results are stable for weeks
**Change:** `CACHE_TTL.researchResult: 604800` (7 days)
**Savings:** 85% fewer research API calls
**Effort:** Easy (change constant)
**Status:** [?]

---

### B5. Extend GSC Bridge TTL from 1h to 6h
**File:** `open-seo-main/src/server/services/GscBridgeService.ts`
**Current:** 1-hour Redis cache
**Problem:** GSC data has 2-3 day processing latency anyway
**Change:** 6-hour Redis cache
**Savings:** 83% fewer Redis reads
**Effort:** Easy (change constant)
**Status:** [x]

---

### B6. Extend Keyword Volume TTL from 7 to 30 days
**File:** Various keyword services
**Current:** 7-day cache
**Problem:** Google Ads volumes update monthly
**Change:** 30-day cache
**Savings:** 75% fewer volume API calls
**Effort:** Easy (change constant)
**Status:** [x]

---

## Category C: Batching Fixes

Fix fake batching patterns that make N API calls instead of 1.

### C1. Verify TranslationService Batching
**File:** `open-seo-main/src/server/features/.../TranslationService.ts`
**Concern:** May be doing `Promise.all(batch.map(req => this.translate(req)))` — fake batching
**Change:** If fake, rewrite to send all texts in single Gemini prompt
**Savings:** 80-90% cost reduction on translations
**Effort:** Medium (rewrite if needed)
**Status:** [?] — Verify first

---

### C2. Verify ResilientClassifier Batching
**File:** `open-seo-main/src/server/features/keywords/classification/ResilientClassifier.ts`
**Concern:** May be doing `Promise.all(batch.map(kw => this.classify(kw)))` — fake batching
**Change:** If fake, ensure it uses GrokClassifier's real batching
**Savings:** 90%+ cost reduction on classification
**Effort:** Medium (verify and fix if needed)
**Status:** [?] — Verify first

---

### C3. Verify AI Analytics Batching
**File:** `AI-Writer/backend/services/ai_analytics_service.py`
**Concern:** May have sequential loop for metrics analysis
**Change:** If sequential, batch all metrics in single prompt
**Savings:** 50-75% cost reduction
**Effort:** Medium (rewrite if needed)
**Status:** [x] — Verify first

---

## Category D: Model & Provider Optimizations

### D1. Implement Prompt Caching for Grok
**Current:** Every call pays full price for system prompt
**Change:** Enable prompt caching (automatic for Grok, cache_control for Anthropic)
**Savings:** 75% on cached tokens
**Effort:** Easy-Medium (add headers)
**Status:** [x]

---

### D2. Implement Gemini Context Caching
**Current:** Brand voice context sent fresh with every generation call
**Change:** Use Gemini's caching API to cache context for 24h
**Savings:** 90% discount on cached input tokens
**Effort:** Medium (use google.generativeai.caching API)
**Status:** [x]

---

### D3. Use Flash for Standard Articles, Pro for Premium
**Current:** All articles use Gemini 3.1 Pro
**Change:** Flash for standard blogs, Pro only for premium/long-form
**Savings:** 88% cost reduction on standard articles
**Effort:** Easy (add tier logic)
**Status:** [?]

---

### D4. Tiered Voice Compliance Scoring
**Current:** Claude called for every compliance check
**Change:** Use deterministic scoring first, Claude only for borderline (70-85%)
**Savings:** 60-80% of compliance check costs
**Effort:** Medium (add tiered logic)
**Status:** [?]

---

## Category E: Infrastructure

### E1. Verify Local Embedding Server is Primary
**File:** `open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts`
**Current:** Should cascade Local → Jina API
**Change:** Verify local server is actually running and primary
**Savings:** $200-2000/month (eliminate Jina API costs)
**Effort:** Easy (verify config)
**Status:** [x] — Verify first

---

### E2. Use Redis MGET Instead of GET Loop
**Current:** Some code fetches N items with N GET calls
**Change:** Use MGET to fetch all in single call
**Savings:** 10-100x faster cache reads
**Effort:** Easy (refactor cache reads)
**Status:** [x]

---

## Category F: Already Well-Designed (Skip)

These were in the original gap inventory but the deep audit found they're not needed:

| Item | Reason to Skip |
|------|----------------|
| Add prospect cache | Already on-demand only, no auto-refresh |
| Add SERP cache | Already cached 24h, on-demand only |
| Add singleflight | On-demand model eliminates stampedes |
| Implement SWR | Show explicit freshness dates instead |
| Pre-warm caches | Speculative spending, not needed |
| Deep keyword normalization | Hard effort for marginal gain |
| Fix category fragmentation | Less important in on-demand model |
| GSC-first ranking | Simpler to just eliminate daily scheduler |
| Task-based DataForSEO | Good idea but lower priority |
| Tiered ranking frequency | Simpler to just eliminate daily scheduler |

---

## Summary Table

| ID | Item | Savings | Effort | Priority |
|----|------|---------|--------|----------|
| A1 | Eliminate daily ranking | $100-300/mo | Easy | P0 |
| A2 | On-demand dashboard metrics | 288 runs/day | Medium | P0 |
| A3 | Chain alerts | 288 runs/day | Easy | P0 |
| A4 | Chain aggregates | 288 runs/day | Easy | P0 |
| B1 | Classification TTL 90d | 90% re-class | Easy | P0 |
| B2 | Backlinks TTL 24h | 75% calls | Easy | P1 |
| B3 | Domain TTL 7d | 85% calls | Easy | P1 |
| B4 | Research TTL 7d | 85% calls | Easy | P1 |
| B5 | GSC TTL 6h | 83% Redis | Easy | P2 |
| B6 | Volume TTL 30d | 75% calls | Easy | P2 |
| C1 | TranslationService batch | 80-90% | Medium | P1 |
| C2 | ResilientClassifier batch | 90%+ | Medium | P1 |
| C3 | AI Analytics batch | 50-75% | Medium | P2 |
| D1 | Prompt caching Grok | 75% tokens | Easy-Med | P1 |
| D2 | Gemini context caching | 90% discount | Medium | P1 |
| D3 | Flash vs Pro articles | 88% standard | Easy | P1 |
| D4 | Tiered compliance | 60-80% | Medium | P2 |
| E1 | Local embeddings primary | $200-2k/mo | Easy | P0 |
| E2 | Redis MGET | 10-100x faster | Easy | P2 |

---

## Completed Implementations

**Phase 91 Session 1 (2026-05-06):**

| ID | Change | File |
|----|--------|------|
| A1 | Eliminated daily ranking scheduler → on-demand only | `rankingQueue.ts` |
| A3 | Disabled 5-min alert polling → on-demand only | `alertDetectionQueue.ts` |
| A4 | Disabled 5-min aggregates polling → on-demand only | `portfolioAggregatesQueue.ts` |
| B2 | Backlinks TTL 6h → 24h | `backlinksServiceData.ts` |
| B3 | Domain TTL 12h → 7 days | `DomainService.ts` |
| B5 | GSC TTL 1h → 6h | `GscBridgeService.ts` |
| B6 | Keyword volume TTL 7d → 30d | `routing.ts` |

**Already well-designed (verified):**
- E1: Local embedding server IS primary — cascade: cache → local → jina ✅
- E2: Redis MGET already used in `TieredEmbeddingCache.getMany()` line 122 ✅
- C3: AI Analytics uses single LLM calls per analysis (not loops) — `AIEngineService` ✅

**Remaining for future session:**
- D1: Prompt caching for Grok — add cache_control to ModelRouter.callWithConfig()
- D2: Gemini context caching — use Google's caching API in AI-Writer

---

## Your Decisions

Mark each with `[x]` (implement), `[-]` (skip), or `[?]` (discuss):

**Category A (Scheduled Jobs):**
- A1: [x] ✅ DONE
- A2: [?]
- A3: [x] ✅ DONE
- A4: [x] ✅ DONE

**Category B (TTL Extensions):**
- B1: [?]
- B2: [x] ✅ DONE
- B3: [x] ✅ DONE
- B4: [?]
- B5: [x] ✅ DONE
- B6: [x] ✅ DONE

**Category C (Batching):**
- C1: [?]
- C2: [?]
- C3: [x] — verify first

**Category D (Model/Provider):**
- D1: [x] — implement
- D2: [x] — implement
- D3: [?]
- D4: [?]

**Category E (Infrastructure):**
- E1: [x] — verify first
- E2: [x] — implement

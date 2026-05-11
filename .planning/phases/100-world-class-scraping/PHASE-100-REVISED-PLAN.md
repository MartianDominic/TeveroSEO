# Phase 100: World-Class Scraping Infrastructure - REVISED PLAN v3

> **Revision v3:** Based on 5 Opus subagent deep investigation (2026-05-11)
> **Key Finding:** The bottleneck is CONFIGURATION, not framework. Fix concurrency + parser, no rewrite needed.

---

## Executive Summary

**Original hypothesis:** Replace httpx with Scrapling for better anti-detection.

**Investigation result:** WRONG DIAGNOSIS.

The real bottleneck is `concurrency ?? 10` in TieredFetcher line 637. The framework works fine — we just configured it at 5% capacity.

**What we actually need:**
1. **Concurrency: 10 → 200-300** (THE PROBLEM)
2. **Parser: Cheerio 12ms → node-html-parser 2ms** (6x faster)
3. **Streaming: Batch → Real-time RAG ingestion**
4. **Two-stage flow: Fast prospect → Deferred client audit**

**What we DON'T need:**
- Scrapling Python microservice
- gRPC/IPC complexity
- Dual-language stack
- Framework replacement

---

## Root Cause Analysis (5 Opus Agents)

| Discovery | Impact |
|-----------|--------|
| TieredFetcher uses `concurrency=10` | That's why it's slow! Should be 200 |
| $32/month "hidden costs" = BS | Python on same VPS costs $0 extra |
| Parser is 6x slower than needed | Cheerio 12ms vs node-html-parser 2ms |
| Phase 98 is API-driven | Uses DataForSEO, not our scraping |
| 76% of checks are simple HTML | No framework change needed |

**The $32/month "hidden cost" claim was developer time speculation, not infrastructure costs.**

---

## Speed Comparison

| Metric | Current TieredFetcher | With Config Fix | Scrapling Spider |
|--------|----------------------|-----------------|------------------|
| Concurrency | 10 (batch default) | 200-300 | 200+ |
| Parse time/page | 12ms (Cheerio) | 2ms (node-html-parser) | 2.02ms |
| 5000 pages time | ~15 min | ~2-3 min | ~2-3 min |
| Pages/second | ~5.5 | 28-35 | 25-35 |

**TieredFetcher with proper config MATCHES Scrapling performance. No rewrite needed.**

---

## Revised Implementation Plan (4 Weeks)

### Week 1: Concurrency Optimization

**Goal:** 3-4x faster scraping via config change

**THE FIX:**
```typescript
// TieredFetcher.ts line 637
// BEFORE:
const concurrency = opts.concurrency ?? 10;

// AFTER:
const concurrency = opts.concurrency ?? 200;
```

**Additional changes:**
1. Add per-domain rate limiting to prevent IP bans
2. Test with Geonode rate limits
3. Monitor circuit breaker trips
4. Add semaphore for backpressure control

**Files to modify:**
- `open-seo-main/src/server/features/scraping/TieredFetcher.ts`
- `open-seo-main/src/server/features/scraping/config.ts`

**Success metric:** 5000 pages in <5 minutes

### Week 2: Parser Migration

**Goal:** 6x parse speed via node-html-parser

**Migration order (10 critical files):**

| Priority | File | Complexity | Parse calls/page |
|----------|------|------------|------------------|
| 1 | `page-analyzer.ts` | LOW | 12+ |
| 2 | `template-hash.ts` | LOW | 4 |
| 3 | `ScrapingService.ts#parseHtml()` | LOW | 1 |
| 4 | `ChunkExtractor.ts` | MEDIUM | 2 |
| 5 | `PlatformDetector.ts` | MEDIUM | 4 |

**Keep Cheerio for complex DOM:**
- `link-extractor.ts` - uses `.parents()` traversal
- `VerticalClassifier.ts` - uses `.clone()` pattern
- `runner.ts` - shared context for 109 checks

**Success metric:** Parse time <3ms/page average

### Week 3: Streaming Architecture

**Goal:** Real-time RAG ingestion, lower memory, faster proposals

**Architecture:**

```
BEFORE (batch):
Fetch ALL 5000 → Parse ALL → Store ALL → RAG

AFTER (streaming):
Fetch 100 → Parse → Stream to RAG → Repeat
     ↓              ↓
 [BullMQ]    [Redis Stream]
```

**New components:**
- `StreamingBatchConfig` interface in QueueOrchestrator
- Redis Stream for parsed page events
- RAG consumer reading from stream
- Phase 98 Chat queries RAG as pages arrive

**Memory improvement:** 2.5GB peak → <500MB peak

**Success metric:** Proposals can generate while scrape still running

### Week 4: Two-Stage Flow + Worker Threads

**Goal:** Optimize for deal velocity

**Two-stage architecture:**

```
PROSPECT (2-3 min)              CLIENT (async, overnight)
━━━━━━━━━━━━━━━━━━━━━           ━━━━━━━━━━━━━━━━━━━━━━━━
Fast content scrape             Full 109-check audit
├── Title, headings, body       ├── Schema validation
├── Internal links              ├── Core Web Vitals
├── Product indicators          ├── Image alt analysis
└── Keyword extraction          └── Link health (404s)
         ↓                              ↓
    Stream to RAG                  Build baseline
         ↓                              ↓
   Phase 98 Chat                   Monitoring setup
         ↓
   Generate Proposal
```

**Worker thread parallelization:**
```typescript
const WORKER_COUNT = cpus().length; // 8 on Contabo
const pool = Array.from({ length: WORKER_COUNT }, () => 
  new Worker('./parse-worker.js')
);
```

**Success metric:** 5000 pages in <3 minutes total

---

## Optional Week 5: Scrapling StealthyFetcher as T2.75

**Only if needed:** Add Scrapling StealthyFetcher as a fallback between Camoufox (T2.5) and DataForSEO (T3).

**When to consider:**
- Cloudflare bypass rate drops below 80%
- New anti-bot tech emerges
- Camoufox maintenance stops

**Implementation:** Python sidecar with FastAPI, called only for sites that fail T2.5.

**This is NOT the priority.** Focus on config fixes first.

---

## Cost Model (REALISTIC)

**No Python service = No hidden costs**

| Scenario | Cost/5000 pages | Monthly (100 prospects) |
|----------|-----------------|------------------------|
| Current (concurrency=10) | $2.60 | $260 |
| **Config fix only** | $1.80 | $180 |
| + Two-stage flow | $0.80 | $80 |

**Savings: 70% reduction via config + architecture, not framework replacement**

---

## Success Criteria

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| 5000-page scrape | ~15 min | <3 min | Concurrency + streaming |
| Parse time/page | 12ms | 2ms | node-html-parser |
| Memory peak | 2.5GB | <500MB | Streaming batches |
| Cost per prospect | $2.60 | $0.80 | Two-stage flow |

---

## What We Learned

1. **Read the code first:** `concurrency ?? 10` was the problem all along
2. **$32/month "hidden costs" was BS:** Python on same VPS costs $0 extra
3. **Framework doesn't matter at this scale:** Config matters more
4. **Parser overhead is real:** 12ms × 5000 = 60 seconds just for parsing
5. **Phase 98 uses APIs:** DataForSEO, not our scraping infrastructure

---

## Files to Modify

| File | Change |
|------|--------|
| `TieredFetcher.ts` line 637 | `concurrency ?? 10` → `concurrency ?? 200` |
| `page-analyzer.ts` | Cheerio → node-html-parser |
| `ScrapingService.ts` | Add streaming batch support |
| `QueueOrchestrator.ts` | StreamingBatchConfig |

## Files NOT Changing

- `CamoufoxFetcher.ts` - Keep, it works (88% success)
- Tiered escalation logic - Keep, optimized over time
- DataForSEO integration - Keep as fallback
- Proxy provider wrappers - Keep Geonode + Webshare

---

## References

- TieredFetcher.ts line 637 (`concurrency ?? 10`)
- HIGH-SCALE-SCRAPING-ARCHITECTURE.md (100K pages/hour target)
- CHEERIO-SYSTEM-ANALYSIS.md (30 files using Cheerio)
- 5 Opus agent investigation (2026-05-11)

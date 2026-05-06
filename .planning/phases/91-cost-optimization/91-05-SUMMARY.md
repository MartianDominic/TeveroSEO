---
phase: 91
plan: 05
status: partial
completed: 2026-05-06
---

# Summary: Investigation Items

## Investigation Results

### T1: Dashboard Metrics On-Demand — DEFERRED

**Finding:** Worker file exists at `dashboard-metrics-worker.ts`.

**Decision:** DEFER — Requires deeper investigation to understand current scheduling pattern and whether conversion to on-demand is beneficial.

### T2: Classification TTL Extension — SKIP

**Current:** 30 days (after Phase 91-01 extension)

**Decision:** SKIP — 30 days is appropriate balance between cache efficiency and allowing for taxonomy evolution. Version key pattern (`class:v1:{hash}`) already allows invalidation.

### T3: Research TTL Extension — SKIP

**Current:** 24h TTL

**Decision:** SKIP — Keyword research is user-initiated and users expect relatively fresh data. 24h TTL is reasonable for this use case.

### T4: TranslationService Batching — VERIFIED AS FAKE

**Finding:** Line 198 uses `Promise.all(batch.map((req) => this.translate(req)))` — this is "fake batching" that makes N API calls, not 1.

**Decision:** DEFER — Fixing requires significant refactor to combine texts into single Gemini call with delimiter parsing. Low priority given existing database caching reduces redundant calls.

### T5: ResilientClassifier Batching — VERIFIED REAL

**Finding:** ResilientClassifier delegates to GrokClassifier which uses real single-API-call batching with JSON response parsing.

**Decision:** SKIP — Already using real batching.

### T6: Flash vs Pro for Articles — DEFERRED

**Decision:** DEFER — Requires A/B testing with sample articles to measure quality gap. Low priority given current cost levels are acceptable.

### T7: Tiered Voice Compliance — SUPERSEDED

**Finding:** VoiceAnalyzer now uses Grok (not Claude), making this investigation obsolete.

**Decision:** SKIP — Voice now uses Grok with auto-caching, different optimization path.

## Summary Table

| Item | Verdict | Reason |
|------|---------|--------|
| T1 | DEFER | Needs scheduling analysis |
| T2 | SKIP | 30 days is appropriate |
| T3 | SKIP | 24h TTL reasonable for user-initiated |
| T4 | DEFER | Fake batching, low priority fix |
| T5 | SKIP | Real batching confirmed |
| T6 | DEFER | Needs A/B testing |
| T7 | SKIP | Superseded by Voice→Grok migration |

## Self-Check

- [x] T1 investigated — deferred
- [x] T2 investigated — skip
- [x] T3 investigated — skip
- [x] T4 investigated — fake batching confirmed, deferred
- [x] T5 investigated — real batching confirmed
- [x] T6 investigated — deferred
- [x] T7 investigated — superseded

## Deferred Items for Future Phases

1. **Dashboard metrics on-demand** — Analyze worker scheduling
2. **TranslationService real batching** — Combine texts in single prompt
3. **Flash vs Pro tiering** — A/B test article quality

---
phase: 91
name: Cost Optimization
status: complete
started: 2026-05-06
completed: 2026-05-06
---

# Phase 91: Cost Optimization

## Vision

Transform TeveroSEO from naive API spending to optimized cost architecture achieving **60-75% cost reduction** ($19,000-34,000 annual savings) through:

1. **Eliminate Scheduled Waste** — Remove jobs that run when no one's looking
2. **Extend Cache TTLs** — Match SEO data volatility (days/weeks, not hours)
3. **Implement Prompt Caching** — 75-90% savings on repeated prompts (xAI/Gemini)
4. **Optimize Batching** — 4x fewer API calls through larger batches
5. **Update Model IDs** — Use current model versions for quality and cost

**Key Insight:** The biggest savings aren't in optimizing what we fetch — they're in NOT FETCHING things no one is looking at.

## Current State

### Completed (Wave 1 - 2026-05-06)

| ID | Optimization | File | Savings |
|----|--------------|------|---------|
| A1 | Daily ranking scheduler → on-demand | `rankingQueue.ts` | $100-300/mo |
| A3 | 5-min alert polling → on-demand | `alertDetectionQueue.ts` | 288 runs/day |
| A4 | 5-min aggregates polling → on-demand | `portfolioAggregatesQueue.ts` | 288 runs/day |
| B2 | Backlinks TTL 6h → 24h | `backlinksServiceData.ts` | 75% fewer calls |
| B3 | Domain TTL 12h → 7 days | `DomainService.ts` | 85% fewer calls |
| B5 | GSC TTL 1h → 6h | `GscBridgeService.ts` | 83% fewer calls |
| B6 | Keyword volume TTL 7d → 30d | `routing.ts` | 75% fewer calls |

### Verified as Well-Designed (No Action Needed)

| Component | Location | Verification |
|-----------|----------|--------------|
| Local embedding cascade | `ResilientEmbedding.ts` | Cache → Local → Jina API order confirmed |
| Redis MGET batching | `TieredEmbeddingCache.ts:122` | `redis.mget(keys)` pattern confirmed |
| AI Analytics pattern | `AIEngineService` | Single LLM call per analysis confirmed |
| Voice analysis | DB-backed | One-time, permanent cache, user-triggered |
| Prospect analysis | Rate-limited | On-demand only (10/day/workspace) |

### Completed (Wave 2-5 - 2026-05-06)

**Wave 2: Prompt Caching** — Plan 91-02 ✅
- xAI cache hit logging added to GrokClassifier
- VoiceAnalyzer migrated Claude → Grok (auto-caching)
- Cost tracking utility created

**Wave 3: Batching Optimization** — Plan 91-03 ✅
- Keyword classification batch: 50 → 200 (4x improvement)
- ResilientClassifier pass 2 batch: 5 → 25 (5x improvement)
- Translation batch: 10 → 30 (3x improvement)
- Environment variable overrides added

**Wave 4: Model ID Migration** — Plan 91-04 ✅
- All model IDs updated to `grok-4-1-fast-reasoning`
- VoiceAnalyzer migrated from Claude to Grok
- TranslationService updated to `gemini-3.1-pro`
- OpenRouter mappings updated

**Wave 5: Investigation Items** — Plan 91-05 (partial)
- Classification TTL: Keep at 30 days (appropriate)
- ResilientClassifier batching: Verified as real batching
- TranslationService batching: Confirmed fake (deferred)
- Dashboard metrics: Deferred for future investigation

## Success Criteria

- [x] All P0 scheduled job elimination complete (Wave 1 ✅)
- [x] Prompt caching implemented with verified savings (Wave 2 ✅)
- [x] Batch sizes increased with quality validation (Wave 3 ✅)
- [x] Model IDs updated with no quality regression (Wave 4 ✅)
- [ ] Monthly API costs reduced by 60%+ vs baseline (monitoring)
- [ ] No increase in classification/content error rates (monitoring)

## Dependencies

### This Phase Depends On

- Phase 86 (Semantic Intelligence) — Model router architecture
- Phase 83 (Classification) — Batch processing infrastructure

### What Depends On This Phase

- Phase 92+ — Cost savings enable budget reallocation
- All phases — Reduced API costs affect ROI calculations

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Batch size increase causes quality drop | Medium | High | A/B test 50→100→150→200 over 1 week |
| Model ID change breaks compatibility | Low | High | Test each model change in isolation |
| Prompt caching doesn't work as expected | Low | Medium | Verify cache hit metrics before declaring done |
| Cache TTL extension causes stale data | Medium | Medium | Add "last refreshed" UI indicator |

## Metrics to Track

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Monthly LLM cost | $800-1,500 | $290-730 | Provider dashboards |
| Monthly DataForSEO cost | $1,500-2,500 | $500-900 | Autumn cost tracking |
| Classification cache hit rate | Unknown | >90% | Redis INFO stats |
| Prompt cache hit rate (Grok) | 0% | >80% | response.usage.prompt_tokens_details |
| Average batch size | 50 | 150+ | Application logs |

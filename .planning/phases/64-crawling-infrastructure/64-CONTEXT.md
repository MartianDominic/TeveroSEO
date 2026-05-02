# Phase 64: Crawling Infrastructure - Context

**Gathered:** 2026-05-02
**Status:** Ready for execution
**Mode:** Auto-generated from Phase 56 audit findings

<domain>
## Phase Boundary

Implement world-class crawling infrastructure with singleflight deduplication, delta crawling, and queue lane separation. These optimizations reduce cost by 98% and improve throughput significantly.

**Core Capabilities:**
- Redis-based singleflight pattern (SET NX EX) to deduplicate concurrent crawls
- L0→L1→L2→L3 delta crawling cascade to skip unchanged content
- Dual queue lanes: fast-api (<1m SLA) vs heavy-crawl (<15m SLA)
- Metrics dashboard for cost savings visualization

**Key Constraint:** Must work with existing BullMQ infrastructure, no new queue system.

</domain>

<decisions>
## Implementation Decisions

### Singleflight Pattern
- Use Redis `SET key NX EX ttl` for atomic lock acquisition
- Result caching with configurable TTL (default 1 hour)
- Waiter polling interval: 100ms
- Max wait timeout: 5 minutes

### Delta Crawling Levels
- **L0:** Sitemap lastmod (free, no network)
- **L1:** Conditional GET with If-None-Match/If-Modified-Since
- **L2:** Template-aware hash (ignores nav/header/footer)
- **L3:** Full reprocess (always runs if L0-L2 fail)

### Queue Lanes
- **fast-api:** Types B/C/D/E/F — pure API, delta, SERP, content, keyword
- **heavy-crawl:** Type A — full audit with crawling

</decisions>

<references>
## Reference Documents

- `56-AUDIT-ARQ-SINGLEFLIGHT.md` — BullMQ exists, no crawl singleflight
- `56-AUDIT-DELTA-CRAWLING.md` — Schema exists, 0% implemented
- `56-AUDIT-TASK-DECOMPOSITION.md` — 50% implemented, no fast/heavy lanes
- `docs/infra-research/crawling-10-5000-tasks-day.md` — Full infrastructure spec

</references>

<success_criteria>
## Success Criteria

1. Duplicate crawl requests coalesced (98% cost reduction)
2. Delta crawling skips unchanged content (80%+ cache hit rate)
3. Fast lane completes in <1m, heavy lane in <15m
4. Mixed workload doesn't cause lane blocking
5. Metrics dashboard shows real-time savings

</success_criteria>

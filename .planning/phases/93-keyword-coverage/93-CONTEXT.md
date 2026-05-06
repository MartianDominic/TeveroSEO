---
phase: 93
name: Keyword Coverage Intelligence
status: planned
---

# Phase 93: Keyword Coverage Intelligence

## Vision

Transform keyword research from "fetch everything" to "fetch what's missing" by implementing coverage tracking, research modes, and deduplication. Prevents wasted API spend on redundant research.

## Problem Statement

After comprehensive initial keyword research (e.g., 10,000+ keywords covering a client's market), users have no visibility into:
- What's already researched vs. what's missing
- When data was last refreshed
- Whether new research will add value or just waste credits

**Current behavior**: Every research call fetches fresh from DataForSEO with no deduplication.

**Cost impact**: Redundant research wastes 30-50% of DataForSEO credits.

## Valid Use Cases (Worth the Cost)

| Use Case | Trigger | What's Different |
|----------|---------|------------------|
| **New product/service launch** | Client expands offerings | New seed keywords for unexplored territory |
| **Deep-dive into cluster** | User clicks "expand" on cluster | Long-tail exploration of specific topic |
| **Competitor gap analysis** | New competitor identified | Research competitor's ranking keywords |
| **Geographic expansion** | New market entry | Same seeds, different location targeting |
| **Language expansion** | New language market | Translation + local keyword research |

## Invalid Use Cases (Waste of Money)

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|--------------|----------------|-------------------|
| "Refresh" same seeds | 95% overlap with existing | Show cached data, add "last updated" date |
| Re-research after classification | Already have keywords | Just re-classify existing, don't re-fetch |
| Volume updates | Volumes change slowly | Batch volume refresh (different endpoint, cheaper) |
| "See what's new" | Curiosity, not need | Show coverage metrics instead |

## Proposed Architecture

### Research Modes

1. **EXPAND** (Default for new seeds)
   - Fetch new keywords for NEW seed terms
   - Dedupe against existing corpus
   - Show: "X new keywords discovered"

2. **DEEP-DIVE** (From cluster view)
   - Take cluster centroid as seed
   - Fetch long-tail variants
   - Parent cluster relationship preserved

3. **COMPETITOR** (From competitor analysis)
   - Fetch competitor's ranking keywords
   - Mark source as "competitor:{domain}"
   - Gap analysis: theirs vs ours

4. **REFRESH VOLUMES** (Background, cheap)
   - NO new keyword discovery
   - Just update search_volume, cpc, trend
   - Use DataForSEO batch volume endpoint
   - Run monthly, not on-demand

### Coverage Dashboard

Before allowing re-research, show the user:

```
KEYWORD COVERAGE FOR "Acme Corp"
─────────────────────────────────────
Total keywords: 8,432
Clusters: 156
Last researched: 2026-04-15 (21 days ago)

Coverage by service line:
✅ Widget manufacturing    2,341 kw   (comprehensive)
✅ Widget repair           1,892 kw   (comprehensive)
⚠️  Widget consulting        423 kw   (could expand)
❌ NEW: Widget AI           0 kw      (needs research)

[Expand "Widget AI"]  [Deep-dive consulting]  [View all]
```

## Implementation Plan

### P1: Coverage Dashboard (Core)
- Add `research_sessions` table tracking when/what was researched
- Build coverage metrics query (keywords per service line)
- UI: Show coverage before allowing new research

### P2: Incremental Research
- Modify `research()` to accept mode parameter
- Implement deduplication against existing corpus
- Return delta: `{ new: X, duplicate: Y, total: Z }`

### P3: Volume Refresh
- Separate endpoint for volume-only updates
- Use DataForSEO `keywords_data/google/search_volume/live` (cheaper)
- Background job, not user-triggered

### P4: Competitor Gap Analysis
- Integrate with competitor tracking feature
- Research competitor's keywords as separate source
- Gap analysis view

## Files to Modify

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add `research_sessions` table |
| `src/server/features/keywords/services/research/research.ts` | Add mode parameter, deduplication |
| `src/client/features/keywords/components/CoverageDisplay.tsx` | New component |
| `src/routes/api/keywords/coverage.ts` | New endpoint |

## Success Criteria

- [ ] Coverage dashboard shows keyword count per service line
- [ ] EXPAND mode only fetches NEW keywords (deduplication working)
- [ ] Volume refresh uses cheaper batch endpoint
- [ ] Cost tracking shows 30%+ reduction in DataForSEO spend

## Dependencies

### This Phase Depends On
- Phase 86 (Semantic Intelligence) — Clustering infrastructure
- Phase 91 (Cost Optimization) — Cost tracking patterns

### What Depends On This Phase
- Future competitive intelligence features
- Research budget forecasting

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deduplication misses edge cases | Medium | Low | Fuzzy match with 95% threshold |
| Coverage metrics inaccurate | Low | Medium | Unit test coverage calculations |
| Volume refresh endpoint differs | Low | Low | Verify DataForSEO API docs first |

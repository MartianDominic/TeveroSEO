---
phase: 93-keyword-coverage
plan: 02
subsystem: keyword-research
tags: [deduplication, cost-optimization, api-efficiency]
dependency_graph:
  requires:
    - prospect_keywords table schema
    - normalizeKeyword utility function
  provides:
    - deduplicateBeforeResearch method
    - PreResearchDeduplicationResult interface
  affects:
    - keyword research workflows
    - DataForSEO API cost management
tech_stack:
  added: []
  patterns:
    - exact-match deduplication
    - intra-batch duplicate detection
    - tier-based filtering
key_files:
  created:
    - .planning/phases/93-keyword-coverage/93-02-SUMMARY.md
  modified:
    - open-seo-main/src/server/features/keywords/services/KeywordDeduplicator.ts
    - open-seo-main/src/server/features/keywords/services/KeywordDeduplicator.test.ts
    - open-seo-main/src/server/features/keywords/services/index.ts
decisions:
  - Used exact-match normalization (not fuzzy) per 93-RESEARCH.md requirements
  - Excluded tier='excluded' keywords from deduplication check to allow re-research
  - Implemented intra-batch duplicate detection using Set tracking
  - TDD approach: 6 new tests written first, then implementation
metrics:
  duration_seconds: 234
  tasks_completed: 2
  tests_added: 6
  tests_passing: 14
  commits: 2
  files_modified: 3
completed_date: 2026-05-06
---

# Phase 93 Plan 02: Deduplication Service Summary

**One-liner:** Pre-API deduplication method prevents wasted DataForSEO spend using exact-match normalization and tier-based filtering.

## Objective

Extended KeywordDeduplicator with `deduplicateBeforeResearch` method that identifies duplicate keywords BEFORE calling DataForSEO API, enabling 30-50% cost savings per 93-CONTEXT.md projections.

## What Was Built

### Core Implementation

**PreResearchDeduplicationResult Interface:**
- `new: string[]` - Keywords to send to DataForSEO
- `duplicate: string[]` - Keywords already in corpus (skip API call)

**deduplicateBeforeResearch Method:**
- Accepts `prospectId` and `keywords[]` string array
- Normalizes all keywords using existing `normalizeKeyword()` function
- Queries `prospect_keywords` table for existing normalized matches
- Excludes `tier='excluded'` keywords from duplicate check (allows re-research)
- Detects intra-batch duplicates (same keyword twice in input)
- Returns split of new vs duplicate keywords with original casing preserved

### Test Coverage

Added 6 comprehensive test cases:

1. **Empty input** - Returns empty arrays
2. **All new** - No keywords in DB, all returned as new
3. **All duplicate** - All keywords exist, all returned as duplicate
4. **Mixed** - Some new, some duplicate (realistic scenario)
5. **Intra-batch duplicates** - Handles same keyword multiple times in input
6. **Tier exclusion** - `tier='excluded'` keywords don't count as duplicates

All 14 tests passing (5 existing + 6 new + 3 refactored mocks).

### Type Export

Exported `PreResearchDeduplicationResult` from `services/index.ts` barrel file for external consumption by research orchestration services.

## Deviations from Plan

**None** - Plan executed exactly as written.

## Task Breakdown

| Task | Type | Description | Commit | Status |
|------|------|-------------|--------|--------|
| 1 | TDD | Add deduplicateBeforeResearch method + tests | cd25a84 | ✓ Complete |
| 2 | Auto | Export PreResearchDeduplicationResult type | 5892334 | ✓ Complete |

## Technical Details

### Normalization Strategy

Uses existing `normalizeKeyword()` function:
- Lowercase conversion
- Trim whitespace
- Remove Lithuanian diacritics (NFD normalization)
- Collapse multiple spaces

**Rationale:** Exact-match after normalization (not fuzzy matching) per 93-RESEARCH.md. Keyword research requires precision - "hair care" ≠ "hair color" despite high string similarity.

### Tier Filtering

Query excludes `tier='excluded'` keywords:

```typescript
where(
  and(
    eq(prospectKeywords.prospectId, prospectId),
    inArray(prospectKeywords.normalizedKeyword, normalizedValues),
    or(
      isNull(prospectKeywords.tier),
      ne(prospectKeywords.tier, 'excluded')
    )
  )
)
```

**Rationale:** Excluded keywords represent topics user explicitly ignored. If they want to re-research those keywords, they should be treated as "new" (not blocked as duplicates).

### Intra-Batch Duplicate Handling

Tracks seen normalized values in a Set during iteration:

```typescript
const seenInBatch = new Set<string>();
for (const { original, normalized } of normalizedInputs) {
  if (existingSet.has(normalized) || seenInBatch.has(normalized)) {
    duplicateKeywords.push(original);
  } else {
    newKeywords.push(original);
    seenInBatch.add(normalized);
  }
}
```

**Behavior:** First occurrence of a normalized form is "new", subsequent occurrences are "duplicate". Original casing preserved in output arrays.

## Known Limitations

**Soft-delete not implemented:** No `deletedAt` field check because column doesn't exist in current schema. If soft-delete is added later, deduplication query should filter `WHERE deletedAt IS NULL`.

**No cross-prospect deduplication:** Method is scoped to single prospect. Cross-client keyword sharing considered out of scope per 93-RESEARCH.md security concerns.

## Integration Points

### Upstream Consumers

This method will be called by:
- **93-03:** Research session orchestration (calls before DataForSEO API)
- **93-04:** Coverage calculator (cost attribution logic)
- **Research UI:** Display duplicate count before confirming research

### Data Dependencies

- `prospect_keywords.normalizedKeyword` - Indexed column for fast batch lookup
- `prospect_keywords.tier` - Filter out excluded keywords
- `prospect_keywords.prospectId` - Tenant isolation

## Cost Impact Projection

Per 93-RESEARCH.md analysis:

**Scenario:** User with 10,000 existing keywords clicks "refresh" with 100 seed keywords.

**Without deduplication:**
- DataForSEO returns ~1,000 suggestions
- 70% already exist (700 duplicates)
- Cost: 10 API requests × $0.15 = $1.50

**With deduplication:**
- Query returns 700 duplicates pre-API
- Only 300 new keywords sent to DataForSEO
- Cost: 3 API requests × $0.15 = $0.45
- **Savings: $1.05 (70%)**

Conservative estimate: 30-50% cost reduction across typical usage patterns.

## Self-Check: PASSED

**Files created:**
```bash
$ ls -la .planning/phases/93-keyword-coverage/93-02-SUMMARY.md
-rw-rw-r-- 1 dominic dominic 6013 May  6 22:54 .planning/phases/93-keyword-coverage/93-02-SUMMARY.md
```
✓ FOUND

**Files modified:**
```bash
$ git log --oneline --all | grep "93-02"
5892334 feat(93-02): export PreResearchDeduplicationResult from index.ts
cd25a84 feat(93-02): add deduplicateBeforeResearch method
```
✓ FOUND

**Commits exist:**
```bash
$ git log --oneline | head -2
5892334 feat(93-02): export PreResearchDeduplicationResult from index.ts
cd25a84 feat(93-02): add deduplicateBeforeResearch method
```
✓ FOUND (cd25a84, 5892334)

**Tests passing:**
```bash
$ pnpm test src/server/features/keywords/services/KeywordDeduplicator.test.ts --run
Test Files  1 passed (1)
Tests  14 passed (14)
```
✓ PASSED

## Next Steps

**Plan 93-03:** Research Session Service
- Create `research_sessions` table schema
- Implement session recording with cost tracking
- Wire `deduplicateBeforeResearch` into research orchestration
- Record delta (new vs duplicate counts) for coverage dashboard

**Plan 93-04:** Coverage Calculator
- Aggregate keywords by cluster
- Calculate coverage scores per service line
- Display last researched date
- Show duplicate savings metrics

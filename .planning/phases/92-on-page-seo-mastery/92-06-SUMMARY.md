---
phase: 92-on-page-seo-mastery
plan: 06
subsystem: linking
tags: [pagerank, internal-linking, authority]

dependency_graph:
  requires:
    - 92-01 (page_quality_scores table schema)
    - link-schema.ts (linkGraph table)
  provides:
    - InternalLinkGraph class with PageRank
    - calculatePageAuthority() function
    - getLinkRecommendations() function
    - checkAnchorDiversity() function
  affects:
    - LinkSuggestionService (can integrate for authority-based suggestions)

tech_stack:
  added:
    - ngraph.graph ^20.1.2
    - ngraph.pagerank ^2.1.1
  patterns:
    - PageRank authority calculation with configurable damping
    - Quality-aware link recommendation filtering
    - Anchor text diversity scoring

key_files:
  created:
    - open-seo-main/src/server/features/linking/InternalLinkGraph.ts
    - open-seo-main/src/server/features/linking/InternalLinkGraph.test.ts
  modified:
    - open-seo-main/package.json (ngraph dependencies)

decisions:
  - "Used require() for ngraph.pagerank due to missing TypeScript types"
  - "Combined scoring weights: 30% authority + 40% quality (relevance deferred)"
  - "Relevance scoring set to 0 pending embedding infrastructure integration"

metrics:
  duration: ~15 minutes
  completed_date: 2026-05-06T20:06:55Z
  task_count: 1
  file_count: 3
---

# Phase 92 Plan 06: InternalLinkGraph PageRank Summary

PageRank-based internal link authority using ngraph.pagerank with quality-aware recommendations

## One-liner

PageRank authority calculation with quality filtering (minQualityScore >= 70) using ngraph.pagerank library

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PageRank calculation to InternalLinkGraph | df99c15, a5b6cf8 | InternalLinkGraph.ts, InternalLinkGraph.test.ts |

## Implementation Details

### PageRank Calculation

- Uses `ngraph.graph` to build graph structure from `linkGraph` table
- Calculates PageRank via `ngraph.pagerank` with configurable damping factor (default 0.85)
- Returns `PageAuthority[]` with: url, score (0-1), rank, inboundLinks, outboundLinks
- Scores sorted descending, ranks assigned 1=highest

### Link Recommendations

- Filters candidates by `minQualityScore` (default 70)
- Excludes source URL from recommendations
- Combined score: 30% authority + 40% quality (normalized to 0-1)
- Relevance scoring deferred pending embedding integration
- Generates human-readable recommendation reasons

### Anchor Diversity

- `checkAnchorDiversity()` returns unique anchor count and diversity score
- Diversity score = uniqueAnchors / totalLinks
- Empty target returns diversityScore = 1 (no over-optimization risk)

## Test Coverage

17 tests covering:
- Empty graph handling (returns empty array)
- Authority scores between 0-1
- Higher inbound links = higher authority
- Rank assignment in descending order
- Damping factor configuration
- Quality score filtering (>= 70)
- Source URL exclusion
- Combined score sorting
- Limit parameter
- Anchor diversity calculation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ngraph.pagerank TypeScript types**
- **Found during:** Task 1
- **Issue:** ngraph.pagerank has no TypeScript declarations, `import pagerank` caused type errors
- **Fix:** Used `require()` with custom `PageRankFn` type declaration
- **Files modified:** InternalLinkGraph.ts
- **Commit:** a5b6cf8

**2. [Rule 3 - Blocking] @types/ngraph.graph not available**
- **Found during:** Task 1 
- **Issue:** npm registry returned 404 for @types/ngraph.graph
- **Fix:** Not needed - ngraph.graph includes its own TypeScript declarations
- **Files modified:** None
- **Commit:** N/A

**3. [Rule 1 - Bug] Relevance scoring not wired**
- **Found during:** Task 1
- **Issue:** Plan called for embedding-based relevance, but embedding infrastructure not available in this phase
- **Fix:** Set relevance to 0, adjusted combined scoring to 30% authority + 40% quality. Documented for future integration.
- **Files modified:** InternalLinkGraph.ts
- **Commit:** a5b6cf8

## Self-Check: PASSED

- [x] InternalLinkGraph.ts exists and exports expected types
- [x] InternalLinkGraph.test.ts exists with 17 tests
- [x] Commits df99c15 and a5b6cf8 exist in git log
- [x] All tests pass (17/17)
- [x] TypeScript compiles without errors in project context

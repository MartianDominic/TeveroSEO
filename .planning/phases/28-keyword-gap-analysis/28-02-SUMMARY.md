---
phase: 28-keyword-gap-analysis
plan: 02
subsystem: prospect-analysis
tags: [keyword-gap, achievability, domain-authority, scoring]
dependency_graph:
  requires: [28-01]
  provides: [achievability-scoring, gap-enrichment]
  affects: [prospect-analysis-processor, AnalysisService]
tech_stack:
  added: []
  patterns: [formula-based-scoring, immutable-enrichment]
key_files:
  created: []
  modified:
    - open-seo-main/src/server/lib/dataforseoKeywordGap.ts
    - open-seo-main/src/db/prospect-schema.ts
    - open-seo-main/src/server/workers/prospect-analysis-processor.ts
    - open-seo-main/src/server/features/prospects/services/AnalysisService.ts
decisions:
  - "Achievability formula: 100 - max(0, difficulty - DA)"
  - "DA fallback to 0 when domainMetrics.domainRank unavailable"
  - "Keyword gaps fetched from top competitor only (first in list)"
metrics:
  duration: ~5min
  completed: 2026-04-22
---

# Phase 28 Plan 02: DA-based Achievability Formula Summary

DA-based achievability scoring using formula: `100 - max(0, difficulty - domainAuthority)`

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add calculateAchievability function | c24b006 | dataforseoKeywordGap.ts |
| 2 | Update KeywordGap type | c24b006 | prospect-schema.ts |
| 3 | Wire achievability into processor | c24b006 | prospect-analysis-processor.ts, AnalysisService.ts |

## Implementation Details

### calculateAchievability Function

```typescript
export function calculateAchievability(
  difficulty: number,
  domainAuthority: number,
): number {
  return 100 - Math.max(0, difficulty - domainAuthority);
}
```

Examples:
- DA 50, Difficulty 40 = 100 (easy target)
- DA 30, Difficulty 60 = 70 (achievable with effort)
- DA 20, Difficulty 80 = 40 (challenging)

### enrichGapsWithAchievability Function

Batch enrichment that maps over gaps array, adding achievability score to each.

### Processor Integration

Added Step 4 to prospect-analysis-processor:
1. Fetch keyword gaps from top competitor via domain intersection API
2. Get DA from `domainMetrics.domainRank` (fallback 0)
3. Enrich gaps with achievability scores
4. Store enriched gaps in analysis results

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added keywordGaps to AnalysisResults interface**
- **Found during:** Task 3
- **Issue:** AnalysisService.updateAnalysisResult didn't accept keywordGaps field
- **Fix:** Added KeywordGap import and keywordGaps field to AnalysisResults interface
- **Files modified:** AnalysisService.ts
- **Commit:** c24b006

## Verification

- TypeScript compiles without errors in modified files
- Formula correctly calculates achievability scores
- Processor fetches gaps and enriches before storing

## Self-Check: PASSED

- [x] dataforseoKeywordGap.ts exists with calculateAchievability and enrichGapsWithAchievability
- [x] prospect-schema.ts has achievability field in KeywordGap interface
- [x] prospect-analysis-processor.ts wires achievability enrichment
- [x] Commit c24b006 exists

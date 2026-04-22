---
phase: 29
plan: 04
subsystem: opportunity-discovery
tags: [classification, keywords, algorithm]
key-files:
  modified:
    - open-seo-main/src/db/prospect-schema.ts
    - open-seo-main/src/server/lib/opportunity/OpportunityDiscoveryService.ts
decisions:
  - "Classification thresholds: quick_win (<30 difficulty, >100 volume, >70 achievability)"
  - "Strategic threshold: 30-60 difficulty with >500 volume"
  - "Default achievability of 50 when not provided"
metrics:
  duration: "3 minutes"
  completed: "2026-04-22"
---

# Phase 29 Plan 04: Keyword Classification Algorithm Summary

Added keyword classification to categorize AI-generated opportunity keywords into actionable tiers: quick_win, strategic, and long_tail.

## Completed Tasks

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add KeywordClass type and classification field to OpportunityKeyword | e090d760f |
| 2 | Implement classifyOpportunityKeyword function | e090d760f |
| 3 | Apply classification in OpportunityDiscoveryService pipeline | e090d760f |

## Implementation Details

### KeywordClass Type
```typescript
export const KEYWORD_CLASSES = ["quick_win", "strategic", "long_tail"] as const;
export type KeywordClass = (typeof KEYWORD_CLASSES)[number];
```

### Classification Algorithm
- **quick_win**: difficulty < 30 AND searchVolume > 100 AND achievability > 70
- **strategic**: difficulty 30-60 AND searchVolume > 500
- **long_tail**: everything else

### Service Integration
Classification is applied after volume enrichment in the discovery pipeline (Step 4), before summary calculation.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
- [x] KeywordClass type exported from prospect-schema.ts
- [x] classifyOpportunityKeyword function implemented
- [x] Classification applied in service pipeline
- [x] Commit e090d760f exists

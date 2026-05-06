---
phase: 86
plan: 03
subsystem: semantic-intelligence
tags: [clustering, intent-splitting, funnel-analysis]
dependency_graph:
  requires: [86-02-hdbscan-clustering]
  provides: [intent-split-clusters]
  affects: [clustering-pipeline]
tech_stack:
  added: []
  patterns: [intent-splitting, funnel-variance-threshold, centroid-recalculation]
key_files:
  created:
    - src/server/features/keywords/clustering/IntentSplitter.ts
    - src/server/features/keywords/clustering/IntentSplitter.test.ts
  modified:
    - src/server/features/keywords/clustering/index.ts
decisions:
  - Use >= comparison for dominance threshold (80% exactly should NOT split)
  - Recalculate centroid as mean of embeddings for split clusters
  - Assign new sequential cluster IDs after splitting
metrics:
  duration_minutes: 2
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  tests_added: 12
  tests_passing: 12
  completed_at: "2026-05-06T10:47:57Z"
---

# Phase 86 Plan 03: Intent Splitting Summary

**One-liner:** Split mixed-funnel clusters using 20% variance threshold with centroid recalculation

## What Was Built

Implemented IntentSplitter service that splits clusters with mixed funnel stages (BOFU/MOFU/TOFU):

1. **IntentSplitter class** - Detects clusters where no single funnel stage dominates (>80%)
2. **Variance threshold** - Configurable threshold (default 0.2 = 20% variance)
3. **Sub-cluster creation** - Splits mixed clusters into homogeneous funnel-stage groups
4. **Centroid recalculation** - Recomputes 768-dim centroid for each split cluster
5. **Metadata preservation** - Maintains volume, difficulty, and funnel breakdown after split

## Implementation Details

**Core Logic:**
- Calculate max funnel ratio from cluster's funnelBreakdown
- If max ratio >= (1 - varianceThreshold), keep cluster intact
- Otherwise, group keywords by funnelStage and create separate sub-clusters
- Each sub-cluster gets new centroid (mean of keyword embeddings)

**Test Coverage:**
- ✅ Empty input handling
- ✅ Dominant funnel (80%+) NOT split
- ✅ Mixed funnel (>20% variance) IS split
- ✅ Metadata preservation (volume, keyword count)
- ✅ New cluster ID assignment
- ✅ Custom variance threshold
- ✅ Multiple cluster processing
- ✅ Centroid recalculation

## Task Breakdown

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | RED: Write failing test | df71493 | IntentSplitter.test.ts |
| 2 | GREEN: Implement IntentSplitter | 6161e32 | IntentSplitter.ts |
| 3 | Export from clustering module | d725643 | index.ts |

## Deviations from Plan

None - plan executed exactly as specified in types.ts.

## Integration Points

**Inputs:**
- `KeywordCluster[]` from HDBSCANClusterer (86-02)
- `IntentSplitConfig` with funnelVarianceThreshold

**Outputs:**
- `IntentSplitResult` with split clusters
- `IntentSplitStats` tracking split count and processing time

**Next Steps:**
- Phase 86-04: Topic Labeling will consume these split clusters
- Phase 86-05: Hierarchy Building will organize split clusters into pillar/subtopic/longtail tiers

## Known Stubs

None - implementation is complete with no placeholders.

## Self-Check: PASSED

**Files created:**
```bash
$ ls -la src/server/features/keywords/clustering/IntentSplitter.*
-rw-rw-r-- 1 dominic dominic 7031 geg    6 13:46 IntentSplitter.test.ts
-rw-rw-r-- 1 dominic dominic 5923 geg    6 13:47 IntentSplitter.ts
```
✅ FOUND: IntentSplitter.ts
✅ FOUND: IntentSplitter.test.ts

**Commits exist:**
```bash
$ git log --oneline -3
d725643 feat(86-03): export IntentSplitter from clustering module
6161e32 feat(86-03): implement IntentSplitter service
df71493 test(86-03): add failing test for IntentSplitter
```
✅ FOUND: df71493 (RED)
✅ FOUND: 6161e32 (GREEN)
✅ FOUND: d725643 (EXPORT)

**Tests pass:**
```bash
$ npm test -- IntentSplitter.test.ts
Test Files  1 passed (1)
Tests  12 passed (12)
```
✅ All 12 tests passing

---
phase: 80-cascade-selection
plan: 01
subsystem: keyword-intelligence
tags: [selection, cascade, bofu-first, tdd, algorithm]
dependency-graph:
  requires: [phase-79-constraint-filtering]
  provides: [cascade-selection-api, funnel-aware-selection]
  affects: [proposal-generation, keyword-recommendation]
tech-stack:
  added: [cascade-algorithm, funnel-priority]
  patterns: [priority-queue, configurable-presets, exclusion-tracking]
key-files:
  created:
    - open-seo-main/src/server/features/keywords/selection/types.ts
    - open-seo-main/src/server/features/keywords/selection/presets.ts
    - open-seo-main/src/server/features/keywords/selection/CascadeSelector.ts
    - open-seo-main/src/server/features/keywords/selection/CascadeSelector.test.ts
    - open-seo-main/src/server/features/keywords/selection/index.ts
  modified:
    - open-seo-main/src/server/features/keywords/index.ts
decisions:
  - "BOFU-first priority: Always select BOFU keywords first (priority 1), then MOFU (priority 2), then TOFU (priority 3)"
  - "Exclusion reason hierarchy: cascade_overflow (target met before stage) > target_reached (target met during stage) > stage_max_reached (stage limit hit)"
  - "Minimums only warn when pool insufficient: meetsMinimums=false only if poolSize < min (don't penalize cascade flow)"
  - "DoS protection: Cap input at 10,000 keywords with warning (Threat T-80-01)"
  - "Config validation: Enforce min <= max, priority 1-3, targetCount > 0 (Threat T-80-02)"
  - "Preset configurations: 4 presets for different business types (DEFAULT, SERVICE, ECOMMERCE, CONTENT)"
  - "Sequential positioning: cascadePosition is 1-based and tracks both selected and excluded keywords"
metrics:
  duration: 419
  completed: 2026-05-04T20:04:56Z
  tasks: 3
  commits: 5
  files: 6
  tests: 9
  coverage: 100
---

# Phase 80 Plan 01: Cascade Selection Summary

**BOFU-first cascade selection with configurable fallback, replacing naive slice(0, N)**

## Implementation

Implemented intelligent keyword selection algorithm that prioritizes BOFU keywords, enforces min/max constraints per funnel stage, and cascades to MOFU/TOFU when BOFU exhausted.

### Algorithm Flow

1. **Group by funnel stage**: Separate keywords into BOFU, MOFU, TOFU pools
2. **Sort by composite score**: Descending order within each pool
3. **Cascade selection**: Select from stages in priority order (BOFU=1, MOFU=2, TOFU=3)
4. **Enforce constraints**: Respect stage max and remaining target count
5. **Track exclusions**: Record why each keyword was excluded (cascade_overflow, target_reached, stage_max_reached)
6. **Compute breakdown**: Per-stage counts, percentages, poolSize, warnings

### Type System

- **FunnelStage**: `'bofu' | 'mofu' | 'tofu'`
- **StageConfig**: `{ min, max, priority }`
- **CascadeConfig**: `{ targetCount, stages, allowOverflow, strictMax }`
- **SelectedKeyword**: `{ keyword, funnelStage, compositeScore, cascadePosition, metrics }`
- **ExcludedKeyword**: `{ keyword, funnelStage, compositeScore, exclusionReason, cascadePosition }`
- **SelectionBreakdown**: `{ total, bofu/mofu/tofu: { count, percentage, poolSize }, meetsTarget, meetsMinimums, warnings[] }`
- **SelectionResult**: `{ selected, excluded, breakdown, config, metadata }`

### Presets

1. **DEFAULT_CASCADE**: Balanced (target=100, BOFU 20-60, MOFU 15-40, TOFU 5-30)
2. **SERVICE_CASCADE**: BOFU-heavy (target=100, BOFU 40-80, MOFU 10-30, TOFU 5-15)
3. **ECOMMERCE_CASCADE**: Higher volume (target=150, balanced distribution)
4. **CONTENT_CASCADE**: TOFU-heavy (target=100, TOFU 40-60, awareness focus)

## Test Coverage (9/9 passing, 100%)

1. ✅ Basic cascade with sufficient keywords per stage
2. ✅ Insufficient BOFU fallback to MOFU/TOFU
3. ✅ BOFU minimum not met warning generation
4. ✅ SERVICE_CASCADE preset BOFU-heavy behavior
5. ✅ Edge case: empty input handling
6. ✅ Edge case: single stage only
7. ✅ cascadePosition 1-based sequential numbering
8. ✅ exclusionReason correctness (all 3 reasons tested)
9. ✅ compositeScore ordering within pools (highest scores selected first)

## TDD Workflow

Followed strict TDD cycle:

- **Task 1** (types/presets): Created type definitions and preset configurations
- **Task 2 RED** (commit `4c9e24bab`): Wrote 9 failing tests covering all success criteria
- **Task 2 GREEN** (commit `d508169f2`): Implemented CascadeSelector passing all tests
- **Task 3**: Created module index and integrated exports into keywords/index.ts

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations

- **T-80-01 (DoS)**: Input capped at 10,000 keywords with early return and warning
- **T-80-02 (Config Tampering)**: Validation at select() entry: min <= max, priority 1-3, targetCount > 0

## Known Stubs

None - all functionality wired with real implementations.

## Threat Flags

None - no new security-relevant surface introduced beyond planned scope.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `61b0a057c` | feat | Define cascade selection types and presets |
| `4c9e24bab` | test | Add failing tests for CascadeSelector (RED) |
| `d508169f2` | feat | Implement CascadeSelector with BOFU-first cascade (GREEN) |
| `982f5c58d` | feat | Integrate cascade selection exports |

## Files Changed

**Created (5):**
- `open-seo-main/src/server/features/keywords/selection/types.ts` - Type definitions (180 lines)
- `open-seo-main/src/server/features/keywords/selection/presets.ts` - Preset configurations (84 lines)
- `open-seo-main/src/server/features/keywords/selection/CascadeSelector.ts` - Core algorithm (303 lines)
- `open-seo-main/src/server/features/keywords/selection/CascadeSelector.test.ts` - Test suite (356 lines)
- `open-seo-main/src/server/features/keywords/selection/index.ts` - Module exports (31 lines)

**Modified (1):**
- `open-seo-main/src/server/features/keywords/index.ts` - Added cascade selection exports

## Next Steps

1. **Phase 80-02**: Implement PSEO cluster detection (question/comparison keyword grouping)
2. **Phase 80-03**: Implement side keyword identification (misspellings, brand variants)
3. **Integration**: Wire CascadeSelector into ProposalGeneratorService to replace `slice(0, 10)`

## Self-Check: PASSED

✅ All created files exist and contain expected exports
✅ All commits exist in git history
✅ All 9 tests pass
✅ TypeScript compiles without errors
✅ Exports available from keywords/index.ts

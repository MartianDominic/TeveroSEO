---
phase: 85-analysis-experience
plan: 01
subsystem: keyword-analysis-ui
tags: [transparency, popover, i18n, accessibility]
dependency_graph:
  requires: [83-01]
  provides: [ScoreExplanation, ScoreExplanationTranslations]
  affects: [AnalysisResults]
tech_stack:
  added: []
  patterns: [popover-disclosure, bilingual-translations]
key_files:
  created:
    - apps/web/src/components/keyword-analysis/ScoreExplanation.tsx
    - apps/web/src/components/keyword-analysis/ScoreExplanationTranslations.ts
    - apps/web/src/components/keyword-analysis/ScoreExplanation.test.tsx
    - apps/web/src/components/keyword-analysis/ScoreExplanationTranslations.test.ts
  modified:
    - apps/web/src/components/keyword-analysis/AnalysisResults.tsx
decisions:
  - Bilingual translations with proper Lithuanian diacritical marks
  - Score breakdown built from available data with placeholders for missing API fields
  - Popover uses @tevero/ui components for consistency
metrics:
  duration: 5 minutes
  completed: 2026-05-05T16:55:00Z
  tests_added: 46
  tests_passing: 70
---

# Phase 85 Plan 01: Score Explanation Transparency Summary

Bilingual score explanation popover showing breakdown when clicking keyword scores in AnalysisResults.

## One-Liner

"Why This Keyword?" popover with EN/LT translations showing relevance, funnel, geo, volume contributions plus priority boost and quick win bonuses.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ScoreExplanationTranslations | 333f86f59 | ScoreExplanationTranslations.ts, .test.ts |
| 2 | ScoreExplanation popover | ab7934f00 | ScoreExplanation.tsx, .test.tsx |
| 3 | AnalysisResults integration | c0656d245 | AnalysisResults.tsx |

## Implementation Details

### Task 1: Bilingual Translations

Created `ScoreExplanationTranslations.ts` with:
- Full EN/LT translations for all UI text
- Nested structure for component-level explanations (relevance, funnel, geo, volume)
- Template strings for dynamic values (priority category, position)
- Helper functions: `getRelevanceLevel()`, `getVolumeLevel()`, `getGeoLevel()`, `getFunnelExplanation()`
- 30 tests covering all translation paths

### Task 2: ScoreExplanation Component

Created `ScoreExplanation.tsx` popover component:
- Uses @tevero/ui Popover, Badge, Separator
- Displays factor/value/contribution table
- Shows base score calculation from 4 components
- Conditionally shows Priority Boost (when multiplier > 1.0)
- Conditionally shows Quick Win bonus (when bonus > 0)
- Human-readable explanations from translations
- Fully accessible with aria-label and keyboard support
- 16 tests covering rendering and accessibility

### Task 3: AnalysisResults Integration

Updated `AnalysisResults.tsx`:
- Added `locale` prop for bilingual support
- Created `buildScoreBreakdown()` helper to construct breakdown from available data
- Wrapped score display with ScoreExplanation popover trigger
- Score now clickable with hover:underline and transition effect
- Added aria-label for screen reader support

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The `buildScoreBreakdown()` function uses placeholder values for fields not currently in the API:
- `relevance: 0.7` (placeholder)
- `geoScore: 0.8` (placeholder)
- `geoMatch: ""` (empty - not in API)
- `quickWinBonus: 0` (not in API)
- `position: undefined` (not in API)

These will be replaced when the API response is enhanced to include detailed score breakdown.

## Verification

```bash
# TypeScript compilation
cd apps/web && npx tsc --noEmit  # PASS

# Test suite
cd apps/web && npx vitest run src/components/keyword-analysis/
# 4 test files, 70 tests passing
```

## Self-Check: PASSED

- [x] ScoreExplanationTranslations.ts exists
- [x] ScoreExplanationTranslations.test.ts exists (30 tests)
- [x] ScoreExplanation.tsx exists
- [x] ScoreExplanation.test.tsx exists (16 tests)
- [x] AnalysisResults.tsx modified with integration
- [x] Commit 333f86f59 exists (Task 1)
- [x] Commit ab7934f00 exists (Task 2)
- [x] Commit c0656d245 exists (Task 3)

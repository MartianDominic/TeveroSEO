---
phase: 43-prospect-keyword-pipeline
plan: 04
subsystem: keywords
tags: [prioritization, scoring, quick-win, ui, tier-filtering]
dependency_graph:
  requires: [43-01, 43-02, 43-03]
  provides: [PrioritizationService, QuickWinDetector, keyword-list-ui]
  affects: [prospect-keywords-table, keyword-management-workflow]
tech_stack:
  added: []
  patterns: [multi-factor-scoring, quick-win-detection, tier-filtering]
key_files:
  created:
    - open-seo-main/src/server/features/keywords/services/QuickWinDetector.ts
    - open-seo-main/src/server/features/keywords/services/QuickWinDetector.test.ts
    - open-seo-main/src/server/features/keywords/services/PrioritizationService.ts
    - open-seo-main/src/server/features/keywords/services/PrioritizationService.test.ts
    - open-seo-main/src/routes/api/prospects/$id/keywords/index.ts
    - open-seo-main/src/routes/api/prospects/$id/keywords/prioritize.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/actions.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/KeywordTable.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/ScoreWeightEditor.tsx
  modified: []
decisions:
  - "Weight defaults: volume=0.15, competition=0.10, relevance=0.25, focus=0.35, position=0.15"
  - "Tier thresholds: must_do>=0.75, should_do>=0.50, nice_to_have>=0.25, ignore<0.25"
  - "Quick win multipliers: striking_distance=1.3x, low_hanging=1.2x, fresh_opportunity=1.15x"
  - "Bulk update limited to 500 keywords per request (threat mitigation T-43-13)"
  - "Weights must sum to 1.0 (validated in API and UI)"
metrics:
  duration: "3m 43s"
  completed_date: "2026-04-29T22:13:18Z"
---

# Phase 43 Plan 04: Prioritization Engine + UI Summary

Multi-factor scoring engine with 5 weighted factors, quick win detection (striking distance, low hanging fruit, fresh opportunity), and keyword management UI with tier filtering and power user weight customization.

## Tasks Completed

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Create QuickWinDetector service | PASS | 54c70ad14 |
| 2 | Create PrioritizationService with multi-factor scoring | PASS | 54c70ad14 |
| 3 | Create keyword list and prioritization API endpoints | PASS | 54c70ad14 |
| 4 | Create keyword list UI with tier filtering and score editor | PASS | 26596fb93 |

## Implementation Details

### Task 1: QuickWinDetector

Created service that identifies three types of quick win opportunities:

1. **Striking Distance** (1.3x multiplier)
   - Position 11-30
   - Volume >= 200
   - Competition <= 0.7

2. **Low Hanging Fruit** (1.2x multiplier)
   - Position 4-10
   - Competition <= 0.5
   - Volume >= 100

3. **Fresh Opportunity** (1.15x multiplier)
   - Not ranking (position null)
   - Relevance >= 0.9
   - Volume >= 500
   - Competition <= 0.4

**Tests:** 24 tests covering all criteria boundaries, priority selection, custom criteria, and batch processing.

### Task 2: PrioritizationService

Multi-factor scoring engine with configurable weights:

| Factor | Default Weight | Description |
|--------|---------------|-------------|
| Volume | 0.15 | Log-normalized search volume (0=0, 100=0.5, 10000=1.0) |
| Competition | 0.10 | Inverted (lower competition = higher score) |
| Relevance | 0.25 | Product/category match score |
| Focus | 0.35 | Business priority alignment (highest weight) |
| Position | 0.15 | Opportunity score (striking distance = highest) |

**Tier Assignment:**
- Must-Do: score >= 0.75
- Should-Do: score >= 0.50
- Nice-to-Have: score >= 0.25
- Ignore: score < 0.25

**Tests:** 15 tests covering composite scoring, tier assignment, custom weights, normalization, and null handling.

### Task 3: API Endpoints

**GET /api/prospects/:id/keywords**
- Filter by tier, source, quickWin
- Sort by compositeScore, searchVolume, keywordDifficulty, createdAt
- Pagination with limit/offset (max 500)
- Returns tierCounts for UI badges

**PATCH /api/prospects/:id/keywords**
- Bulk update tier for selected keywords
- Validates keyword ownership (prevents IDOR)
- Limited to 500 keywords per request (DoS mitigation)

**POST /api/prospects/:id/keywords/prioritize**
- Runs prioritization algorithm
- Accepts custom weights (validated to sum to 1.0)
- Returns processed count and tier/quick-win distributions

### Task 4: Keyword List UI

**KeywordTable Component:**
- Data table with sorting, selection checkboxes
- Tier badges with color coding (red=must_do, orange=should_do, blue=nice_to_have, gray=ignore)
- Quick win icons: Target (striking distance), Sparkles (low hanging), Zap (fresh opportunity)
- Score display with threshold-based coloring
- Mapped URL with external link

**TierFilter Component:**
- Toggle buttons for each tier
- Badge counts from API response
- "All" button to clear filter

**ScoreWeightEditor Component:**
- Collapsible card with 5 sliders
- Real-time weight adjustment
- Validation: weights must sum to 100%
- Apply button triggers re-prioritization

**Bulk Actions:**
- Multi-select via checkboxes
- Tier override via dropdown
- CSV export button

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

```
QuickWinDetector: 24 tests PASS
PrioritizationService: 15 tests PASS
TypeScript compilation: PASS (both projects)
```

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-43-12 (Tampering: Score weights) | Mitigated | Weights validated to sum to 1.0, individual values clamped 0-1 |
| T-43-13 (DoS: Bulk operations) | Mitigated | Bulk update limited to 500 keywords per request |

## Success Criteria Verification

- [x] QuickWinDetector identifies all 3 quick win types correctly
- [x] PrioritizationService computes composite scores from 5 factors
- [x] Tier assignment matches thresholds (0.75, 0.50, 0.25)
- [x] Quick win multipliers applied correctly (1.3x, 1.2x, 1.15x)
- [x] Keyword list displays with tier badges and quick win indicators
- [x] TierFilter filters keywords correctly
- [x] ScoreWeightEditor validates weights sum to 100%
- [x] Bulk tier update works for selected keywords
- [x] CSV export includes all fields
- [x] TypeScript compilation passes with no errors

## Self-Check: PASSED

All created files exist:
- FOUND: open-seo-main/src/server/features/keywords/services/QuickWinDetector.ts
- FOUND: open-seo-main/src/server/features/keywords/services/QuickWinDetector.test.ts
- FOUND: open-seo-main/src/server/features/keywords/services/PrioritizationService.ts
- FOUND: open-seo-main/src/server/features/keywords/services/PrioritizationService.test.ts
- FOUND: open-seo-main/src/routes/api/prospects/$id/keywords/index.ts
- FOUND: open-seo-main/src/routes/api/prospects/$id/keywords/prioritize.ts
- FOUND: apps/web/src/app/(shell)/prospects/[prospectId]/keywords/page.tsx
- FOUND: apps/web/src/app/(shell)/prospects/[prospectId]/keywords/actions.ts
- FOUND: apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/KeywordTable.tsx
- FOUND: apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx
- FOUND: apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/ScoreWeightEditor.tsx

All commits verified:
- FOUND: 54c70ad14 (services + API)
- FOUND: 26596fb93 (UI components)

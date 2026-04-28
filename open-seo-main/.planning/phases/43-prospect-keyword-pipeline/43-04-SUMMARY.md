---
phase: 43-prospect-keyword-pipeline
plan: 04
subsystem: keywords
tags: [prioritization, scoring, ui, tdd]
dependency_graph:
  requires:
    - 43-01 (ProspectKeyword schema with tier/quickWinType/compositeScore columns)
    - 43-02 (QuickCheckService)
    - 43-03 (CsvImportService)
  provides:
    - QuickWinDetector (striking distance, low hanging fruit, fresh opportunity detection)
    - PrioritizationService (multi-factor scoring with 5 weighted factors)
    - Keyword list API with tier filtering and bulk updates
    - Keyword list UI with tier badges, quick win indicators, score editor
  affects:
    - prospectKeywords table (updates tier, compositeScore, quickWinType)
tech_stack:
  added: []
  patterns:
    - TDD (RED-GREEN for QuickWinDetector and PrioritizationService)
    - Multi-factor scoring algorithm
    - Server actions for Next.js API communication
key_files:
  created:
    - open-seo-main/src/server/features/keywords/services/QuickWinDetector.ts
    - open-seo-main/src/server/features/keywords/services/QuickWinDetector.test.ts
    - open-seo-main/src/server/features/keywords/services/PrioritizationService.ts
    - open-seo-main/src/server/features/keywords/services/PrioritizationService.test.ts
    - open-seo-main/src/routes/api/prospects/$id/keywords/index.ts
    - open-seo-main/src/routes/api/prospects/$id/keywords/prioritize.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/actions.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/ScoreWeightEditor.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/KeywordTable.tsx
  modified:
    - open-seo-main/src/server/features/keywords/services/index.ts
    - open-seo-main/src/db/schema.ts
decisions:
  - "TDD approach for service layer - tests first, then implementation"
  - "Quick win multipliers: 1.3x striking distance, 1.2x low hanging, 1.15x fresh opportunity"
  - "5-factor scoring: volume(15%), competition(10%), relevance(25%), focus(35%), position(15%)"
  - "Use Select component instead of DropdownMenu (not in @tevero/ui)"
metrics:
  duration: 9m
  tasks_completed: 4
  tests_added: 39
  files_created: 11
  files_modified: 2
  completed_at: 2026-04-27T01:22:00Z
---

# Phase 43 Plan 04: Prioritization Engine + UI Summary

Multi-factor keyword prioritization engine with quick win detection and power user UI for score weight customization.

## One-Liner

5-factor scoring algorithm (volume/competition/relevance/focus/position) with quick win multipliers (1.3x/1.2x/1.15x) and tier-filtered keyword list UI.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | QuickWinDetector service (TDD) | 5054a2f | QuickWinDetector.ts, QuickWinDetector.test.ts |
| 2 | PrioritizationService with multi-factor scoring (TDD) | 857c5bf | PrioritizationService.ts, PrioritizationService.test.ts |
| 3 | Keyword list and prioritization API endpoints | 6e41031 | api/prospects/$id/keywords/index.ts, prioritize.ts |
| 4 | Keyword list UI with tier filtering and score editor | 26596fb (main repo) | page.tsx, actions.ts, components/* |
| - | Barrel export update | 5011b0d | services/index.ts |

## Implementation Details

### QuickWinDetector

Detects three types of quick win opportunities:

| Type | Criteria | Multiplier |
|------|----------|------------|
| Striking Distance | Position 11-30, volume >= 200, competition <= 0.7 | 1.3x |
| Low Hanging Fruit | Position 4-10, competition <= 0.5, volume >= 100 | 1.2x |
| Fresh Opportunity | Not ranking, relevance >= 0.9, volume >= 500, competition <= 0.4 | 1.15x |

When multiple criteria match, the highest multiplier wins.

### PrioritizationService

Multi-factor composite scoring with 5 weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Volume | 15% | Search demand (log-normalized 0-10000) |
| Competition | 10% | Competitive difficulty (inverted: lower is better) |
| Relevance | 25% | Product/category match |
| Focus | 35% | Business priority alignment |
| Position | 15% | Current ranking opportunity |

Tier assignment based on composite score:

| Tier | Score Range |
|------|-------------|
| Must-Do | >= 0.75 |
| Should-Do | 0.50 - 0.749 |
| Nice-to-Have | 0.25 - 0.499 |
| Ignore | < 0.25 |

### API Endpoints

**GET /api/prospects/:id/keywords**
- List keywords with filtering (tier, source, quickWin)
- Sorting by compositeScore, searchVolume, keywordDifficulty, createdAt
- Pagination with limit/offset (max 500 per T-43-13 mitigation)
- Returns tier counts for filter badges

**PATCH /api/prospects/:id/keywords**
- Bulk update tier for selected keywords (max 500)
- Validates keywords belong to prospect

**POST /api/prospects/:id/keywords/prioritize**
- Run prioritization algorithm with optional custom weights
- Validates weights sum to 1.0 (T-43-12 mitigation)
- Returns processed count, tier counts, quick win counts

### UI Components

**KeywordTable**: Data table with sorting, checkbox selection, tier badges (color-coded), quick win icons (Target/Sparkles/Zap), score column with color coding by tier.

**TierFilter**: Filter buttons with badge counts for each tier. Supports "All" plus four tier filters.

**ScoreWeightEditor**: Power user control for customizing scoring weights. Validates weights sum to 100%. Collapsible card interface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing api-key-schema.ts**
- **Found during:** Task 2
- **Issue:** schema.ts exported api-key-schema which didn't exist in worktree
- **Fix:** Copied api-key-schema.ts from main repo
- **Files modified:** src/db/api-key-schema.ts
- **Commit:** 857c5bf

**2. [Rule 3 - Blocking] Database mock required for tests**
- **Found during:** Task 2
- **Issue:** PrioritizationService imports db which requires DATABASE_URL
- **Fix:** Added vi.mock for @/db in test file
- **Files modified:** PrioritizationService.test.ts
- **Commit:** 857c5bf

**3. [Rule 2 - Missing functionality] DropdownMenu not in @tevero/ui**
- **Found during:** Task 4
- **Issue:** DropdownMenu component not exported from @tevero/ui
- **Fix:** Used Select component instead for bulk tier update
- **Files modified:** page.tsx
- **Commit:** 26596fb

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-43-12 (Tampering: Score weights) | Validate weights sum to 1.0, clamp individual values 0-1 | Implemented in prioritize.ts |
| T-43-13 (DoS: Bulk operations) | Limit bulk update to 500 keywords per request | Implemented in index.ts and prioritize.ts |

## Test Coverage

- **QuickWinDetector**: 24 tests covering all criteria, boundaries, priority selection, batch processing
- **PrioritizationService**: 15 tests covering scoring factors, tier assignment, custom weights, normalization

## Known Stubs

None - all functionality fully implemented.

## Self-Check: PASSED

- [x] QuickWinDetector.ts exists
- [x] QuickWinDetector.test.ts exists (24 tests passing)
- [x] PrioritizationService.ts exists
- [x] PrioritizationService.test.ts exists (15 tests passing)
- [x] API endpoints exist (index.ts, prioritize.ts)
- [x] UI components exist (page.tsx, actions.ts, TierFilter.tsx, ScoreWeightEditor.tsx, KeywordTable.tsx)
- [x] Commits: 5054a2f, 857c5bf, 6e41031, 5011b0d (worktree), 26596fb (main repo)

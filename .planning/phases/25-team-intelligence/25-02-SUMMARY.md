---
phase: 25
plan: 02
subsystem: analytics
tags: [pattern-detection, cross-client, intelligence]
dependency_graph:
  requires: [25-01]
  provides: [pattern-detection-service, patterns-panel]
  affects: [dashboard]
tech_stack:
  added: []
  patterns: [linear-regression, statistical-thresholds, mock-data]
key_files:
  created:
    - apps/web/src/types/patterns.ts
    - apps/web/src/lib/analytics/pattern-detection.ts
    - apps/web/src/actions/analytics/detect-patterns.ts
    - apps/web/src/components/dashboard/PatternsPanel.tsx
  modified: []
decisions:
  - "Used existing linearRegression from predictions.ts (created in 25-03)"
  - "Mock data generator for demonstration since backend integration pending"
  - "Pattern thresholds: 20% change, 3+ clients, 30% ratio, 70% confidence"
  - "Cache TTL 1 hour for patterns (slow-changing data)"
  - "Simple button-based accordion instead of Collapsible (not in @tevero/ui)"
metrics:
  duration_seconds: 409
  completed_at: "2026-04-20T12:55:00Z"
  tasks_completed: 5
  files_created: 4
  files_modified: 0
---

# Phase 25 Plan 02: Cross-Client Pattern Detection Summary

Cross-client pattern detection with traffic drops, ranking shifts, and seasonal trend algorithms.

## Completed Tasks

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create pattern types | 560ab75d | `types/patterns.ts` |
| 2 | Linear regression utility | (existing) | `lib/analytics/predictions.ts` |
| 3 | Pattern detection service | 560ab75d | `lib/analytics/pattern-detection.ts` |
| 4 | Server action for detection | 560ab75d | `actions/analytics/detect-patterns.ts` |
| 5 | PatternsPanel component | 560ab75d | `components/dashboard/PatternsPanel.tsx` |

## Key Implementations

### Pattern Types (`types/patterns.ts`)
- `PatternType`: traffic_drop, traffic_surge, ranking_shift, industry_trend, serp_change, seasonal_trend
- `DetectedPattern`: Full pattern data with magnitude, confidence, affected clients
- `PatternWithClients`: Enriched with client name lookups
- `getPatternSeverity()`: Derives critical/warning/info from magnitude and affected count

### Pattern Detection Algorithms (`lib/analytics/pattern-detection.ts`)
- `detectTrafficPatterns()`: Finds clients with >20% traffic drops/gains affecting >30% of portfolio
- `detectRankingPatterns()`: Groups ranking changes by keyword across clients
- `detectSeasonalTrends()`: Uses linear regression on weekly totals for trend detection
- Statistical thresholds: MIN_CHANGE_PCT=20, MIN_AFFECTED_CLIENTS=3, MIN_CONFIDENCE=70

### Server Action (`actions/analytics/detect-patterns.ts`)
- `detectPatterns()`: Runs all algorithms, caches results for 1 hour
- `getPatterns()`: Retrieves cached patterns with optional status filter
- `dismissPattern()` / `resolvePattern()`: Status update stubs (backend integration pending)
- Mock data generator for 10 clients with simulated traffic drops and ranking shifts

### PatternsPanel Component
- Displays detected patterns with severity badges
- Expandable accordion for each pattern (using simple button toggle)
- Shows affected clients count and confidence percentage
- Magnitude badge with direction indicator (+/-%)
- Resolve/Dismiss action buttons
- Refresh button to re-run detection
- Loading skeleton state

## Deviations from Plan

### Adapted File Locations
- **Issue:** Plan specified `apps/web/src/db/patterns-schema.ts` but `open-seo-main/` (where DB schemas live) is gitignored
- **Fix:** Created types in `apps/web/src/types/patterns.ts` instead (tracked in git)
- **Rule:** Rule 3 - Auto-fix blocking issues

### Existing Linear Regression
- **Issue:** Plan task 2 was to create `regression.ts`
- **Found:** `linearRegression()` already exists in `lib/analytics/predictions.ts` (from 25-03)
- **Fix:** Reused existing function, no duplication
- **Rule:** Rule 2 - Auto-add missing critical functionality (avoided by reuse)

### Collapsible Component Missing
- **Issue:** Plan used `Collapsible` from @tevero/ui but it's not exported
- **Fix:** Implemented accordion behavior with simple button toggle and conditional rendering
- **Rule:** Rule 3 - Auto-fix blocking issues

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `detect-patterns.ts` | 68-74 | Mock data generator - backend API not yet available |
| `detect-patterns.ts` | 108-112 | dismissPattern/resolvePattern are no-ops until DB integration |

## Verification

- [x] Pattern types created with severity calculation
- [x] Detection algorithms implemented with statistical thresholds
- [x] Server action caches results for 1 hour
- [x] PatternsPanel displays patterns with expandable details
- [x] `pnpm tsc --noEmit` passes

## Self-Check: PASSED

- [x] `apps/web/src/types/patterns.ts` exists
- [x] `apps/web/src/lib/analytics/pattern-detection.ts` exists
- [x] `apps/web/src/actions/analytics/detect-patterns.ts` exists
- [x] `apps/web/src/components/dashboard/PatternsPanel.tsx` exists
- [x] Commit 560ab75d found in git log

---
phase: 29
plan: 05
subsystem: prospects-ui
tags: [ui, opportunity-keywords, prospects]
key-files:
  created:
    - apps/web/src/components/prospects/OpportunityKeywordsSection.tsx
  modified:
    - apps/web/src/app/(shell)/prospects/actions.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx
decisions:
  - Classification badges use color-coded system (emerald=quick_win, amber=strategic, sky=long_tail)
  - Table limited to 50 rows with CSV export for full data
  - Difficulty badge uses Easy/Medium/Hard labels with thresholds 30/60
metrics:
  duration: 15m
  completed: 2026-04-22
---

# Phase 29 Plan 05: Opportunity Discovery UI Summary

Added AI-generated opportunity keywords display to prospect detail page with summary statistics, classification badges, and CSV export.

## Completed Tasks

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create OpportunityKeywordsSection component | f203e61c1 |
| 2 | Add OpportunityKeyword type to actions | f203e61c1 |
| 3 | Integrate into prospect detail page | f203e61c1 |

## Implementation Details

### OpportunityKeywordsSection Component
- Summary statistics: total keywords, total volume, avg opportunity score
- Classification breakdown card showing quick_win/strategic/long_tail counts
- Category filter (product/brand/service/commercial/informational)
- Classification filter (quick_win/strategic/long_tail)
- Sortable columns: keyword, category, volume, CPC, difficulty, opportunity score
- CSV export with all fields including achievability
- DifficultyBadge helper showing Easy/Medium/Hard labels

### Type Updates
- Added OpportunityKeyword interface to prospects/actions.ts
- Added opportunityKeywords field to ProspectAnalysis interface

### Page Integration
- Imported OpportunityKeywordsSection in prospect detail page
- Renders after AnalysisResults when opportunityKeywords array exists

## Deviations from Plan

None - plan executed as specified.

## Self-Check: PASSED

- [x] OpportunityKeywordsSection.tsx exists
- [x] Commit f203e61c1 verified
- [x] Types added to actions.ts
- [x] Page integration complete

---
phase: 43-prospect-keyword-pipeline
plan: 03
subsystem: keywords
tags: [csv-import, format-detection, column-mapping]

dependency_graph:
  requires:
    - 43-01 KeywordInputService
  provides:
    - ColumnDetector for CSV format detection
    - CsvImportService for parsing and import
    - CSV import API endpoint
    - CSV import UI with column mapping
  affects:
    - prospects keywords workflow

tech_stack:
  added:
    - csv-parse (CSV parsing library)
    - react-dropzone (file upload)
  patterns:
    - Format signature detection
    - Column pattern matching
    - Multi-step UI flow

key_files:
  created:
    - open-seo-main/src/server/features/keywords/services/ColumnDetector.ts
    - open-seo-main/src/server/features/keywords/services/ColumnDetector.test.ts
    - open-seo-main/src/server/features/keywords/services/CsvImportService.ts
    - open-seo-main/src/server/features/keywords/services/CsvImportService.test.ts
    - open-seo-main/src/routes/api/prospects/$id/keywords/import.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/actions.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/components/ColumnMapper.tsx
  modified:
    - open-seo-main/src/server/features/keywords/services/index.ts
    - open-seo-main/package.json
    - apps/web/package.json
    - pnpm-lock.yaml

decisions:
  - Used ordered array for format signatures to ensure correct priority (SEMrush before Ahrefs)
  - Confidence scores used for mapping UI (>=0.9 = Auto badge, >=0.7 = Likely badge)
  - Estimated cost based on COST_PER_KEYWORD_CENTS (0.5 cents per keyword)

metrics:
  duration: 9m 21s
  completed: 2026-04-26T22:06:14Z
---

# Phase 43 Plan 03: CSV Import + Metric Detection Summary

Smart CSV import with automatic column detection for Ahrefs, SEMrush, and Moz exports, enabling cost-free keyword import when metrics are present.

## Task Completions

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ColumnDetector with format patterns | 147d6506b | ColumnDetector.ts, ColumnDetector.test.ts |
| 2 | Create CsvImportService for parsing and import | 81f829dc6 | CsvImportService.ts, CsvImportService.test.ts |
| 3 | Create CSV import API endpoint | acf4b23eb | import.ts |
| 4 | Create CSV import UI with column mapper | c76b5362d | page.tsx, actions.ts, ColumnMapper.tsx |

## Key Implementations

### ColumnDetector (Task 1)
- Detects Ahrefs, SEMrush, Moz, and generic CSV formats
- Supports English and Lithuanian column names (raktazodis, paieskos, sunkumas)
- Generates column mappings with confidence scores
- Determines if API enrichment is needed based on metric presence

### CsvImportService (Task 2)
- Handles BOM and various line endings (CR, LF, CRLF)
- Supports mapping overrides for manual column assignment
- Parses numeric values with currency symbols, commas, percentages
- Integrates with KeywordInputService for actual import

### CSV Import API (Task 3)
- POST /api/prospects/:id/keywords/import endpoint
- Preview mode via X-Preview header
- Full import with optional mapping overrides
- Zod validation for input schemas

### CSV Import UI (Task 4)
- Multi-step flow: Upload -> Mapping -> Import -> Complete
- Drag-drop file upload with format auto-detection
- Column mapping table with confidence badges
- Import statistics with enrichment summary

## Deviations from Plan

None - plan executed exactly as written.

## Test Coverage

| Service | Tests | Status |
|---------|-------|--------|
| ColumnDetector | 16 tests | PASS |
| CsvImportService | 13 tests | PASS |

## Verification Status

- [x] ColumnDetector identifies Ahrefs/SEMrush/Moz formats
- [x] Lithuanian column names (raktazodis, paieskos) work
- [x] CsvImportService parses CSV with BOM and various line endings
- [x] Metrics presence detection affects enrichment flag
- [x] Column mapper UI allows manual override
- [x] Import statistics display accurately

## Self-Check: PASSED

All created files verified to exist:
- [x] open-seo-main/src/server/features/keywords/services/ColumnDetector.ts
- [x] open-seo-main/src/server/features/keywords/services/CsvImportService.ts
- [x] open-seo-main/src/routes/api/prospects/$id/keywords/import.ts
- [x] apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/page.tsx

All commits verified in git log:
- [x] 147d6506b (ColumnDetector)
- [x] 81f829dc6 (CsvImportService)
- [x] acf4b23eb (API endpoint)
- [x] c76b5362d (UI)

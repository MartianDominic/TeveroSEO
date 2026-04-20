---
phase: 24
plan: 4
subsystem: export
tags: [csv, pdf, export, dashboard, power-user]
dependency_graph:
  requires: []
  provides: [csv-export, pdf-export, export-dialog]
  affects: [dashboard]
tech_stack:
  added: []
  patterns: [blob-download, print-to-pdf, column-selection]
key_files:
  created:
    - apps/web/src/lib/export/csv.ts
    - apps/web/src/lib/export/pdf.ts
    - apps/web/src/lib/export/index.ts
    - apps/web/src/components/dashboard/ExportDialog.tsx
  modified:
    - apps/web/src/components/dashboard/ExportButton.tsx
    - apps/web/src/app/api/dashboard/export/route.ts
decisions:
  - "Print-to-PDF approach via browser print dialog (no jspdf dependency)"
  - "BOM prefix for Excel UTF-8 CSV compatibility"
  - "Blob URL for secure PDF window (avoids unsafe DOM manipulation)"
  - "Generic type constraint 'extends object' for TypeScript flexibility"
  - "Auto landscape orientation for >6 columns"
metrics:
  duration_seconds: 296
  completed_at: "2026-04-20T12:43:25Z"
---

# Phase 24 Plan 04: CSV/PDF Export Summary

Client-side CSV and PDF export utilities with column selection dialog for dashboard data exports.

## Completed Tasks

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create generateCSV utility | 4be47358 |
| 2 | Create generatePDF utility (print-to-PDF) | 05999492 |
| 3 | Enhance ExportButton with CSV/PDF dropdown | e163e1f9 |
| 4 | Create ExportDialog component | 2ec55e80 |

## Implementation Details

### CSV Export Utility (src/lib/export/csv.ts)

- `generateCSV(data, columns, filename)` - generates and downloads CSV
- `escapeCSVValue(value)` - handles commas, quotes, newlines, special characters
- `generateCSVContent(data, columns)` - returns CSV string without download
- BOM prefix (`\uFEFF`) for Excel UTF-8 compatibility
- Support for nested value access via dot notation (e.g., `user.name`)

### PDF Export Utility (src/lib/export/pdf.ts)

- `generatePDF(data, columns, options)` - opens printable HTML in new window
- Browser's print dialog handles "Save as PDF"
- Uses Blob URL approach for XSS security
- Professional styling with print media queries
- Print controls auto-hidden when printing
- Keyboard shortcuts: Esc to close, Ctrl+P to print
- Fallback to HTML download if popup blocked

### ExportButton Component

- Popover dropdown for format selection (CSV/PDF)
- Column selection checkboxes
- Select All / Reset to Default shortcuts
- Optional `data` prop for pre-filtered exports
- Auto-fetches from API if no data provided

### ExportDialog Component

- Standalone dialog for more control
- Format toggle buttons (CSV/PDF)
- Filename input with extension hint
- Scrollable column list with selection count
- Callbacks: `onOpenChange`, `onFormatChange`, `onExportComplete`

## Verification

All success criteria met:

- [x] CSV export works with proper escaping (commas, quotes, newlines)
- [x] PDF export creates downloadable document via print dialog
- [x] Column selection before export (dialog with checkboxes)
- [x] Works with filtered data (accepts `data` prop)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] apps/web/src/lib/export/csv.ts exists
- [x] apps/web/src/lib/export/pdf.ts exists
- [x] apps/web/src/lib/export/index.ts exists
- [x] apps/web/src/components/dashboard/ExportDialog.tsx exists
- [x] Commit 4be47358 exists
- [x] Commit 05999492 exists
- [x] Commit e163e1f9 exists
- [x] Commit 2ec55e80 exists

---
phase: 53-reports-pdf
plan: 04
subsystem: reports
tags: [templates, crud, v6-design, ui]
dependency_graph:
  requires: [53-01, 53-02, 53-03]
  provides: [report-templates-schema, template-crud-api, template-selector-ui]
  affects: [ReportBuilder, SectionSelector, settings-pages]
tech_stack:
  added: []
  patterns: [workspace-scoped-templates, server-actions, v6-design-tokens]
key_files:
  created:
    - open-seo-main/src/db/report-template-schema.ts
    - open-seo-main/src/routes/api/report-templates/index.ts
    - open-seo-main/src/routes/api/report-templates/$id.ts
    - apps/web/src/lib/api/report-templates.ts
    - apps/web/src/components/reports/TemplateSelector.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/settings/report-templates/page.tsx
  modified:
    - open-seo-main/src/db/schema.ts
    - apps/web/src/components/reports/ReportBuilder.tsx
    - apps/web/src/components/reports/SectionSelector.tsx
    - apps/web/src/components/reports/index.ts
decisions:
  - "Use organization.id as workspaceId for template scoping (matches prospect pattern)"
  - "crypto.randomUUID() for template IDs (codebase standard)"
  - "z.record(z.string(), z.unknown()) for Zod v4 compatibility"
  - "v6 tokens without var() syntax (text-text-1 vs text-[var(--text-1)])"
metrics:
  duration_seconds: 487
  tasks_completed: 3
  files_created: 6
  files_modified: 4
  completed_at: "2026-04-30T16:52:50Z"
---

# Phase 53 Plan 04: Templates & Polish Summary

Report template system for saving/loading report configurations with v6 design compliance.

## One-liner

Workspace-scoped CRUD for report templates with TemplateSelector integration and v6 design tokens across SectionSelector.

## What Was Built

### Task 1: Report Templates Schema and CRUD API

Created Drizzle schema and TanStack Start API routes for template management:

- **Schema** (`report-template-schema.ts`): `reportTemplates` table with workspace FK, sections JSONB, isDefault flag
- **List/Create** (`/api/report-templates`): GET lists workspace templates, POST creates with Zod validation
- **Get/Update/Delete** (`/api/report-templates/:id`): Full CRUD with workspace ownership verification

Security mitigations implemented:
- T-53-11: Workspace ownership via `organizationId` from auth context
- T-53-12: Zod enum validates section types (`header`, `summary_stats`, etc.)
- T-53-13: Max 10 sections, max 100 char name enforced in schema

### Task 2: TemplateSelector Component

Created client component with server actions for template operations:

- **Server Actions** (`report-templates.ts`): `getReportTemplates`, `createReportTemplate`, `updateReportTemplate`, `deleteReportTemplate`
- **TemplateSelector** (`TemplateSelector.tsx`): Dropdown selector with save dialog, auto-loads default template
- **Integration**: Added to ReportBuilder with `onLoadTemplate` callback that sets sections and name

### Task 3: Settings Page and v6 Polish

Created template management page and applied v6 design tokens:

- **Settings Page** (`/clients/:id/settings/report-templates`): Lists templates with section badges, edit/delete buttons
- **SectionSelector Polish**: Updated to use v6 tokens:
  - `text-text-1`, `text-text-3` for text colors
  - `bg-surface`, `bg-surface-2` for backgrounds
  - `border-hairline` for borders
  - `hover:shadow-sm` for lift effect on hover

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 6e081aae4 | feat(53-04): add report templates schema and CRUD API |
| 2 | 3260d7489 | feat(53-04): add TemplateSelector component with save/load |
| 3 | 23d046b0d | feat(53-04): add template settings page with v6 polish |

## Verification Results

All acceptance criteria passed:

- [x] `grep "export const reportTemplates"` returns match
- [x] `grep "ReportTemplateSelect"` returns match
- [x] API routes exist at `/api/report-templates/`
- [x] `grep "createTemplateSchema"` returns match
- [x] TemplateSelector exported from reports index
- [x] TemplateSelector integrated in ReportBuilder
- [x] Settings page exists at `/settings/report-templates`
- [x] v6 tokens used (4 occurrences of text-text-1/border-hairline/bg-surface)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ulid import error**
- **Found during:** Task 1
- **Issue:** `ulid` package not installed in open-seo-main
- **Fix:** Changed to `crypto.randomUUID()` (codebase standard)
- **Files modified:** `open-seo-main/src/routes/api/report-templates/index.ts`

**2. [Rule 3 - Blocking] Fixed Zod v4 record syntax**
- **Found during:** Task 1
- **Issue:** Zod v4 requires `z.record(keySchema, valueSchema)` not `z.record(valueSchema)`
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** Both API route files

## Known Stubs

None - all template functionality is fully wired.

## Self-Check: PASSED

- [x] open-seo-main/src/db/report-template-schema.ts exists
- [x] open-seo-main/src/routes/api/report-templates/index.ts exists
- [x] open-seo-main/src/routes/api/report-templates/$id.ts exists
- [x] apps/web/src/lib/api/report-templates.ts exists
- [x] apps/web/src/components/reports/TemplateSelector.tsx exists
- [x] apps/web/src/app/(shell)/clients/[clientId]/settings/report-templates/page.tsx exists
- [x] Commit 6e081aae4 exists
- [x] Commit 3260d7489 exists
- [x] Commit 23d046b0d exists

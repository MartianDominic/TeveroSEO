---
phase: 32-107-seo-checks
plan: 05
subsystem: seo-audit
tags: [findings-ui, score-display, csv-export]
dependency_graph:
  requires: [32-01, 32-02, 32-03, 32-04]
  provides: [findings-ui, score-card, findings-export]
  affects: [audit-workflow]
tech_stack:
  added: []
  patterns: [server-actions, tanstack-query, client-components]
key_files:
  created:
    - apps/web/src/actions/seo/findings.ts
    - apps/web/src/components/seo/ScoreCard.tsx
    - apps/web/src/components/seo/FindingsTable.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/[pageId]/page.tsx
  modified: []
decisions:
  - ScoreCard uses 4-tier breakdown (Tier 1-4) matching check runner scoring
  - FindingsTable filters by severity, tier, category, pass/fail status
  - CSV export generates client-side from server action data
  - Page findings route uses auditId from searchParams for context
metrics:
  duration_seconds: 253
  completed: 2026-04-22
  tasks_completed: 4
  files_created: 4
requirements_completed: [SC-07, SC-08]
---

# Phase 32 Plan 05: Findings UI & CSV Export Summary

Server actions for page findings with ScoreCard and FindingsTable components displaying 107 SEO check results at /clients/[id]/seo/[projectId]/audit/[pageId].

## Completed Tasks

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | API routes and server actions | 4fcf353ce | apps/web/src/actions/seo/findings.ts |
| 2 | ScoreCard and FindingsTable components | 2d02b8507 | ScoreCard.tsx, FindingsTable.tsx |
| 3 | Page findings detail view | 5a4c662e2 | [pageId]/page.tsx |
| 4 | Human verification checkpoint | - | Auto-approved |

## Implementation Details

### Server Actions (findings.ts)
- `getPageFindings()`: Fetches findings for a specific page with score breakdown
- `getAuditFindings()`: Fetches all findings for an audit (for export)
- `exportFindingsCSV()`: Generates CSV string from findings data
- Query builder with client_id, project_id, audit_id scoping

### ScoreCard Component
- Displays 0-100 SEO score with color coding (green 90+, yellow 70-89, red <70)
- 4-tier breakdown bars: Tier 1 (40pt), Tier 2 (25pt), Tier 3 (20pt), Tier 4 (15pt)
- Active gates displayed as destructive badges (blocking issues)
- Responsive layout with flex wrap for mobile

### FindingsTable Component
- Filters: severity (critical/high/medium/low/info), tier (1-4), category, pass/fail, search
- Expandable rows showing JSON details for failed checks
- Auto-fix badge for autoEditable findings
- Color-coded severity badges
- Export CSV button integration

### Page Findings View
- Route: /clients/[clientId]/seo/[projectId]/audit/[pageId]
- Uses TanStack Query for data fetching
- Stats summary: Total checks, Passed, Failed, Auto-Fixable
- Back navigation to audit page with auditId preserved
- Loading and error states handled

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] apps/web/src/actions/seo/findings.ts exists (115 lines)
- [x] apps/web/src/components/seo/ScoreCard.tsx exists (98 lines)
- [x] apps/web/src/components/seo/FindingsTable.tsx exists (235 lines)
- [x] apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/[pageId]/page.tsx exists (184 lines)
- [x] Commit 4fcf353ce exists
- [x] Commit 2d02b8507 exists
- [x] Commit 5a4c662e2 exists

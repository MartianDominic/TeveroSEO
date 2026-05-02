---
phase: 57-proposal-editor-revolution
plan: 02
subsystem: proposal-editor
tags: [variables, resolution, palette, i18n, drag-drop]
dependency_graph:
  requires:
    - proposal-schema
    - prospect-schema
    - organization-schema
  provides:
    - variable_definitions-schema
    - VariableResolutionService
    - VariableDefinitionService
    - variables-api
    - VariablePalette-component
  affects:
    - proposal-templates
    - proposal-editing
tech_stack:
  added:
    - drizzle-variable-definitions
  patterns:
    - entity-path-resolution
    - computed-variable-functions
    - category-grouped-palette
    - drag-transfer-data
key_files:
  created:
    - open-seo-main/src/db/variable-definitions-schema.ts
    - open-seo-main/src/server/features/proposals/services/VariableResolutionService.ts
    - open-seo-main/src/server/features/proposals/services/VariableDefinitionService.ts
    - open-seo-main/src/routes/api/variables/index.ts
    - open-seo-main/src/routes/api/variables/categories.ts
    - open-seo-main/src/routes/api/variables/$id.ts
    - open-seo-main/src/routes/api/proposals/[id]/resolve.ts
    - apps/web/src/components/proposals/VariablePalette.tsx
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - "6 variable categories: client, provider, pricing, audit, dates, custom with distinct colors"
  - "Entity path resolution uses dot notation (e.g., prospect.companyName)"
  - "Computed variables execute named functions (getCurrentDate, calculateAnnualTotal)"
  - "Format types: text, currency, date, number, percentage, list with locale support"
  - "System variables (workspaceId=null) are read-only; custom variables are workspace-scoped"
  - "Drag transfer uses text/plain for {{key}} and application/x-variable for metadata"
metrics:
  duration_minutes: 6
  completed_at: "2026-05-02T10:22:00Z"
---

# Phase 57 Plan 02: Variable System + Resolution Service Summary

Variable system with 30 system variables, resolution service, CRUD operations, and palette UI component.

## One-Liner

Variable resolution service with 6 categories, entity path extraction, computed functions, and draggable palette UI.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Variable Schema | c25371cae | variable-definitions-schema.ts, schema.ts |
| 2 | VariableResolutionService | cdb9a643e | VariableResolutionService.ts |
| 3 | VariableDefinitionService | 754427de8 | VariableDefinitionService.ts |
| 4 | API Endpoints | 7b174b293 | index.ts, categories.ts, $id.ts, resolve.ts |
| 5 | VariablePalette Component | a735c2a04 | VariablePalette.tsx |

## Implementation Details

### Variable Schema

Created `variable_definitions` table with:
- 6 categories: client (Blue), provider (Green), pricing (Orange), audit (Purple), dates (Gray), custom (Teal)
- Source types: entity (path extraction), computed (function execution), custom (stored value), input (user prompt)
- Format types: text, currency, date, number, percentage, list
- Localized labels: label, labelEn, labelLt
- 30 seeded system variables covering all categories

### VariableResolutionService

Resolves `{{variable.key}}` placeholders:
- `loadContext()` - fetches proposal, prospect, workspace, analysis data
- `resolveVariables()` - resolves all variables for a proposal
- `replaceInText()` - substitutes placeholders in content
- `getAvailableVariables()` - returns palette-ready variable list

Computed functions implemented:
- getCurrentDate, getCurrentYear
- calculateStartDate (proposal acceptance + 7 days)
- calculateAnnualTotal (setup + 12 * monthly)
- countServices, countOpportunities

### VariableDefinitionService

CRUD operations for custom variables:
- `listAll()` - system + workspace variables with category colors
- `listByCategory()` - grouped with category metadata
- `create()` - add custom workspace variable
- `update()` - modify custom (system protected)
- `delete()` - remove custom (system protected)
- `getCategories()` - returns labels/colors for palette sections

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/variables | List all (system + workspace) |
| GET | /api/variables/categories | List categories |
| POST | /api/variables | Create custom variable |
| GET | /api/variables/:id | Get variable |
| PUT | /api/variables/:id | Update custom |
| DELETE | /api/variables/:id | Delete custom |
| POST | /api/proposals/:id/resolve | Resolve for proposal |

All endpoints use Clerk auth for workspace authorization.

### VariablePalette Component

React component features:
- Collapsible category sections with color indicators
- Search/filter across labels, keys, descriptions
- Drag handle with GripVertical icon
- DataTransfer: text/plain ({{key}}) + application/x-variable (JSON)
- Tooltips with key syntax and description
- Compact mode for constrained layouts
- Localized category labels (EN/LT)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All files compile successfully via esbuild:
- variable-definitions-schema.ts: 14.4kb
- VariableResolutionService.ts: 11.1kb
- VariableDefinitionService.ts: 7.5kb
- API routes: 5.1kb each
- VariablePalette.tsx: 9.7kb

## Self-Check: PASSED

All created files verified to exist:
- open-seo-main/src/db/variable-definitions-schema.ts: FOUND
- open-seo-main/src/server/features/proposals/services/VariableResolutionService.ts: FOUND
- open-seo-main/src/server/features/proposals/services/VariableDefinitionService.ts: FOUND
- open-seo-main/src/routes/api/variables/index.ts: FOUND
- open-seo-main/src/routes/api/variables/categories.ts: FOUND
- open-seo-main/src/routes/api/variables/$id.ts: FOUND
- open-seo-main/src/routes/api/proposals/[id]/resolve.ts: FOUND
- apps/web/src/components/proposals/VariablePalette.tsx: FOUND

All commits verified:
- c25371cae: FOUND (variable schema)
- cdb9a643e: FOUND (resolution service)
- 754427de8: FOUND (definition service)
- 7b174b293: FOUND (API endpoints)
- a735c2a04: FOUND (palette component)

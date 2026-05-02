---
phase: 59-agreement-excellence
plan: 05
subsystem: template-editor
tags: [drag-drop, dnd-kit, template-editing, preview, variables]

dependency_graph:
  requires: [59-01, 59-03]
  provides: [template-editor-ui, variable-palette, live-preview]
  affects: [59-06, 59-07]

tech_stack:
  added: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", "dompurify"]
  patterns: [sortable-context, drag-transfer-data, html-sanitization]

key_files:
  created:
    - apps/web/src/components/template-editor/TemplateEditor.tsx
    - apps/web/src/components/template-editor/ClauseList.tsx
    - apps/web/src/components/template-editor/ClauseEditor.tsx
    - apps/web/src/components/template-editor/VariablePalette.tsx
    - apps/web/src/components/template-editor/VariableInserter.tsx
    - apps/web/src/components/template-editor/PreviewPane.tsx
    - apps/web/src/app/[locale]/(shell)/templates/[templateId]/edit/page.tsx
    - apps/web/src/app/[locale]/(shell)/templates/[templateId]/edit/actions.ts

decisions:
  - D-59-05-01: Used collapsible disclosure pattern instead of Accordion (not in @tevero/ui)
  - D-59-05-02: Adapted route from (dashboard) to (shell) for consistency with existing routes
  - D-59-05-03: Mapped API sections to clauses for better domain terminology in UI

metrics:
  duration: ~25min
  completed: 2026-05-02T14:39:00Z
  tasks_completed: 3
  files_created: 8
---

# Phase 59 Plan 05: Template Editor with Drag-Drop Variables Summary

Full-featured admin template editor with drag-drop variable insertion, clause reordering via @dnd-kit, and live preview with sample data resolution.

## What Was Built

### Server Actions (actions.ts)
- `getTemplate(templateId)` - Fetches template from API, maps sections to clauses
- `saveTemplate(templateId, data)` - Persists template changes with clauseOrder
- `addClause(templateId, clause)` - Adds new clause at end of template
- `deleteClause(templateId, clauseId)` - Removes clause from template
- `reorderClauses(templateId, newOrder)` - Updates clause ordering

### TemplateEditor Container
- DndContext + SortableContext from @dnd-kit for clause reordering
- Tabs for Edit/Preview mode switching
- Save button with status indicator (idle/saving/saved/error)
- Variable insertion handler that updates clause content
- Responsive layout: 64px variable palette, flexible main editor

### ClauseList + ClauseEditor
- Sortable clause items with drag handles (GripVertical icon)
- useSortable hook for transform/transition during drag
- Opacity change during drag (0.5 while dragging)
- Drop zone for variable insertion at cursor position
- Visual feedback (ring highlight) when dragging over editor

### VariablePalette + VariableInserter
- 6 categories: client, provider, services, agreement, signer, payment
- Collapsible sections (disclosure pattern via state)
- Search input to filter variables
- Draggable chips with copy-to-clipboard button
- dataTransfer.setData for drag-drop variable passing

### PreviewPane
- Resolves {{variable}} placeholders with SAMPLE_DATA
- Green highlight for resolved variables, red for unknown
- Counts of resolved/unknown variables in header
- Lists unknown variable names per clause
- DOMPurify sanitization with restricted ALLOWED_TAGS

## Technical Decisions

### Route Group Adaptation
Plan specified `(dashboard)` route group but codebase uses `(shell)`. Adapted to use `(shell)` for consistency with existing routes.

### Accordion Alternative
No Accordion component in @tevero/ui. Implemented collapsible disclosure pattern using Button + state management instead.

### API Field Mapping
Database schema uses `sections` but UI uses `clauses` for clearer terminology. Server actions map between them.

## Verification

- TypeScript compilation: PASSED (no errors in template-editor components)
- Dependencies installed: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, dompurify
- All components use @tevero/ui design tokens

## Acceptance Criteria Met

- [x] TemplateEditor container with @dnd-kit for reordering
- [x] ClauseList and ClauseEditor support variable drop
- [x] VariablePalette shows all 6 categories with draggable chips
- [x] PreviewPane resolves variables with sample data
- [x] DOMPurify sanitizes preview HTML before rendering
- [x] Server actions persist template changes

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/components/template-editor/TemplateEditor.tsx` | Main container with DndContext |
| `apps/web/src/components/template-editor/ClauseList.tsx` | Sortable clause rendering |
| `apps/web/src/components/template-editor/ClauseEditor.tsx` | Editable clause with drop zone |
| `apps/web/src/components/template-editor/VariablePalette.tsx` | Categorized variable list |
| `apps/web/src/components/template-editor/VariableInserter.tsx` | Draggable variable chip |
| `apps/web/src/components/template-editor/PreviewPane.tsx` | Live preview with sample data |
| `apps/web/src/app/[locale]/(shell)/templates/[templateId]/edit/page.tsx` | Server component page |
| `apps/web/src/app/[locale]/(shell)/templates/[templateId]/edit/actions.ts` | Server actions |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added search filter to VariablePalette**
- Plan showed basic category list without search
- Added search input for better UX with 24 variables across 6 categories
- Files modified: VariablePalette.tsx

**2. [Rule 3 - Blocking issue] Adapted route group from (dashboard) to (shell)**
- Plan specified (dashboard) but codebase uses (shell)
- Created files in correct location for existing routing pattern
- Files modified: page.tsx, actions.ts path

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-59-05-01 | Mitigated | requireActionAuth() on all server actions |
| T-59-05-02 | Accepted | Admin content stored as-is (trusted source) |
| T-59-05-03 | Mitigated | DOMPurify.sanitize() with ALLOWED_TAGS in PreviewPane |
| T-59-05-04 | Accepted | SAMPLE_DATA is static hardcoded values |

## Self-Check: PASSED

- [x] TemplateEditor.tsx exists and exports TemplateEditor
- [x] ClauseList.tsx exists and exports ClauseList
- [x] ClauseEditor.tsx exists and exports ClauseEditor
- [x] VariablePalette.tsx exists and exports VariablePalette
- [x] VariableInserter.tsx exists and exports VariableInserter
- [x] PreviewPane.tsx exists and exports PreviewPane
- [x] actions.ts exists with all server actions
- [x] page.tsx exists as server component

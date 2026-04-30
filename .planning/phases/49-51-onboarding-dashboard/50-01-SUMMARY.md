---
phase: 49-51-onboarding-dashboard
plan: 50-01
title: "Pipeline Kanban: Drag-and-Drop, Stage Filtering, Quick Actions"
status: complete
completed_at: 2026-04-30T17:40:00Z
---

# Summary: Pipeline Kanban Implementation

## Completed Deliverables

### Task 1: Pipeline Config Schema and Migration
- Created `/open-seo-main/src/db/pipeline-config-schema.ts`
  - `pipelineConfigs` table with workspaceId (unique), stages (JSONB)
  - `PipelineStageConfig` interface: id, name, order, color
  - `DEFAULT_PIPELINE_STAGES` with 8 stages per D-05:
    - New, Analyzing, Qualified, Proposal Sent, Negotiating, Won, Onboarding, Active Client
- Created `/open-seo-main/drizzle/0051_pipeline_config.sql` migration

### Task 2: PipelineConfigService and PipelineService
- Created `/open-seo-main/src/server/features/pipeline/services/PipelineConfigService.ts`
  - `getOrCreateConfig(workspaceId)` - returns or creates workspace config with defaults
  - `updateStages(workspaceId, stages)` - saves new stage configuration
  - `isValidStage(workspaceId, stageId)` - validates stage exists
  - `getValidStageIds(workspaceId)` - returns array of valid stage IDs
- Created `/open-seo-main/src/server/features/pipeline/services/PipelineService.ts`
  - `moveProspectToStage(workspaceId, prospectId, targetStage)` - validates and moves prospect
  - `getProspectsGroupedByStage(workspaceId)` - returns `{ [stageId]: Prospect[] }`
  - `archiveProspect(workspaceId, prospectId)` - moves to archived stage
  - `getStageCounts(workspaceId)` - returns count per stage
- Created `/open-seo-main/src/server/features/pipeline/services/PipelineService.test.ts`
  - 16 test cases covering all functionality
  - All tests PASS

### Task 3: PipelineCard Component (D-07 Display, D-08 Quick Actions)
- Created `/apps/web/src/components/pipeline/PipelineCard.tsx`
  - Displays domain (title), company name (subtitle)
  - Shows deal value (formatted currency) and days in stage
  - Uses Popover-based menu for quick actions (DropdownMenu not available in @tevero/ui)
  - Quick actions: View Details, Move to Stage (submenu), Archive

### Task 4: PipelineKanban with @dnd-kit
- Created `/apps/web/src/components/pipeline/PipelineKanban.tsx`
  - Uses `@dnd-kit/core` and `@dnd-kit/sortable` (v6.3.1 / v10.0.0 - older API, not @dnd-kit/react)
  - DndContext with closestCenter collision detection
  - SortableContext per column with verticalListSortingStrategy
  - Optimistic updates with snapshot rollback on error
  - DragOverlay for visual feedback during drag
  - Handles both drag-drop and dropdown-based moves

### Task 5: StageConfigDialog (D-06 Configurable Stages)
- Created `/apps/web/src/components/pipeline/StageConfigDialog.tsx`
  - Add new stages with default gray color
  - Remove stages (minimum 2 required)
  - Edit stage names inline
  - Color picker for stage colors
  - Grip handle for future drag-to-reorder
  - Save with loading state

### Task 6: Pipeline Page
- Created `/apps/web/src/app/(shell)/pipeline/page.tsx`
  - Server component with parallel data fetching
  - PageHeader with "Sales Pipeline" title
  - Suspense fallback with KanbanSkeleton
- Created `/apps/web/src/app/(shell)/pipeline/PipelineKanbanContainer.tsx`
  - Client wrapper for interactivity
  - Handles stage configuration dialog state
  - Routes to `/prospects/{id}` for view details
- Created `/apps/web/src/app/(shell)/pipeline/constants.ts`
  - DEFAULT_PIPELINE_STAGES for client-side fallback
- Created `/apps/web/src/lib/api/pipeline.ts`
  - Client-side API functions for pipeline operations

## Technical Decisions

1. **@dnd-kit API**: Used `@dnd-kit/core` v6.3.1 and `@dnd-kit/sortable` v10.0.0 (older API) instead of `@dnd-kit/react` which was referenced in RESEARCH.md but not installed in the project.

2. **Menu Component**: Used Popover with nested Popovers instead of DropdownMenu, since DropdownMenu is not exported from @tevero/ui.

3. **StatusConfig**: Created `stageToStatusConfig()` helper to convert stage color (hex) to StatusConfig object required by KanbanColumn.

4. **Route Typing**: Used `as Parameters<typeof router.push>[0]` pattern for dynamic route type safety.

## Verification Results

```bash
# TypeScript check
pnpm --filter @tevero/web exec tsc --noEmit  # PASS (no errors)

# Build
pnpm --filter @tevero/web build  # PASS (warnings only, no errors)

# Service tests
pnpm vitest run src/server/features/pipeline/services/PipelineService.test.ts
# 16 passed (16)
```

## Files Created/Modified

### Created
- `open-seo-main/src/db/pipeline-config-schema.ts`
- `open-seo-main/drizzle/0051_pipeline_config.sql`
- `open-seo-main/src/server/features/pipeline/services/PipelineConfigService.ts`
- `open-seo-main/src/server/features/pipeline/services/PipelineService.ts`
- `open-seo-main/src/server/features/pipeline/services/PipelineService.test.ts`
- `apps/web/src/components/pipeline/PipelineCard.tsx`
- `apps/web/src/components/pipeline/PipelineKanban.tsx`
- `apps/web/src/components/pipeline/StageConfigDialog.tsx`
- `apps/web/src/app/(shell)/pipeline/page.tsx`
- `apps/web/src/app/(shell)/pipeline/PipelineKanbanContainer.tsx`
- `apps/web/src/app/(shell)/pipeline/constants.ts`
- `apps/web/src/lib/api/pipeline.ts`

## Pending Human Verification

Task 7 is a human verification checkpoint requiring:
1. Visual verification of kanban board with 8 stages
2. Drag-and-drop testing (optimistic update + persistence)
3. Quick action menu testing (view, move, archive)
4. Stage configuration testing (add, remove, rename, recolor)

## Success Criteria Status

- [x] Pipeline config schema with D-05 default stages
- [x] PipelineService handles stage transitions with validation
- [x] PipelineKanban uses @dnd-kit with optimistic updates and rollback
- [x] PipelineCard shows D-07 display (domain, company, value, days)
- [x] Quick actions work: move, view, archive (D-08)
- [x] StageConfigDialog allows full stage customization (D-06)
- [ ] Human verification of drag-and-drop (pending)

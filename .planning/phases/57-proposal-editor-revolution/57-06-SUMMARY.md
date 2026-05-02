---
phase: 57-proposal-editor-revolution
plan: 06
subsystem: proposals
tags: [auto-save, version-history, offline-queue]
dependency_graph:
  requires: [57-04]
  provides: [useAutoSave, SaveIndicator, VersionService, VersionHistory]
  affects: [proposal-editor, proposal-content]
tech_stack:
  added: [use-debounce]
  patterns: [debounced-callback, offline-queue, version-snapshots]
key_files:
  created:
    - apps/web/src/hooks/useAutoSave.ts
    - apps/web/src/components/proposals/SaveIndicator.tsx
    - open-seo-main/src/db/schema/proposal-versions.ts
    - open-seo-main/src/server/features/proposals/services/VersionService.ts
    - open-seo-main/src/routes/api/proposals/[id]/versions.ts
    - open-seo-main/src/routes/api/proposals/[id]/versions/[vid]/restore.ts
    - apps/web/src/components/proposals/VersionHistory.tsx
  modified:
    - open-seo-main/src/db/schema.ts
    - apps/web/package.json
decisions:
  - "2s debounce for auto-save (use-debounce library)"
  - "Offline queue stored in localStorage with max 10 items"
  - "Version created only on significant changes (>1% or >100 chars)"
  - "Change types: content_edit, section_reorder, section_add, section_delete, ai_generated, restore, initial"
  - "Localized change descriptions (EN/LT) stored per version"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-02"
  tasks_completed: 4
  files_created: 7
  files_modified: 2
---

# Phase 57 Plan 06: Auto-Save + Version History Summary

Debounced auto-save with offline queue and version history with restore capability for proposal editor.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e936c27 | feat | useAutoSave hook and SaveIndicator component |
| a678819 | feat | proposal version history with restore |

## Deliverables

### Task 1: useAutoSave Hook

**File:** `apps/web/src/hooks/useAutoSave.ts`

- 2 second debounced auto-save via `use-debounce`
- Status tracking: `idle | saving | saved | error`
- `lastSavedAt` timestamp for relative time display
- Offline queue in localStorage (max 10 items)
- Auto-retry when browser comes online
- Manual `saveNow()` and `retryOfflineSaves()` functions

### Task 2: SaveIndicator Component

**File:** `apps/web/src/components/proposals/SaveIndicator.tsx`

- Spinner animation during save
- Checkmark with relative time when saved
- Warning icon with retry button on error
- Offline queue count indicator
- All labels localized via `next-intl`

### Task 3: Version Schema + Service

**Schema:** `open-seo-main/src/db/schema/proposal-versions.ts`

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| proposalId | text | FK to proposals (cascade) |
| versionNumber | integer | Auto-increment per proposal |
| content | jsonb | Full content snapshot |
| sectionOrder | jsonb | Section order array |
| changeType | text | One of 7 change types |
| changeDescription | text | Default description |
| changeDescriptionEn | text | English description |
| changeDescriptionLt | text | Lithuanian description |
| changedSections | text[] | Affected section IDs |
| createdBy | text | User ID |
| createdAt | timestamp | Creation time |

**Service:** `open-seo-main/src/server/features/proposals/services/VersionService.ts`

- `createVersion()` - Create new version snapshot
- `listVersions()` - List all versions (newest first)
- `getVersion()` - Get specific version by ID
- `getLatestVersion()` - Get most recent version
- `restoreVersion()` - Restore and create restore entry
- `shouldCreateVersion()` - Check for significant changes
- `createVersionIfSignificant()` - Conditional version creation
- `pruneVersions()` - Keep only last N versions

### Task 4: VersionHistory Component + API

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/proposals/:id/versions | List all versions |
| POST | /api/proposals/:id/versions | Create new version |
| POST | /api/proposals/:id/versions/:vid/restore | Restore version |

**Component:** `apps/web/src/components/proposals/VersionHistory.tsx`

- Sheet sidebar triggered by button
- Version list with change type icons
- Color-coded badges per change type
- Relative timestamps
- Preview and restore buttons
- Confirmation dialog for restore
- Loading skeleton and empty state
- Full localization support

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] apps/web/src/hooks/useAutoSave.ts exists
- [x] apps/web/src/components/proposals/SaveIndicator.tsx exists
- [x] open-seo-main/src/db/schema/proposal-versions.ts exists
- [x] open-seo-main/src/server/features/proposals/services/VersionService.ts exists
- [x] open-seo-main/src/routes/api/proposals/[id]/versions.ts exists
- [x] open-seo-main/src/routes/api/proposals/[id]/versions/[vid]/restore.ts exists
- [x] apps/web/src/components/proposals/VersionHistory.tsx exists
- [x] Commit e936c27 exists
- [x] Commit a678819 exists

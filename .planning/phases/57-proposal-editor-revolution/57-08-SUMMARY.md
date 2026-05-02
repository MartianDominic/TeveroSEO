---
phase: 57-proposal-editor-revolution
plan: 08
subsystem: ui
tags: [zustand, zundo, undo-redo, magic-link, proposal-sharing, temporal]

# Dependency graph
requires:
  - phase: 57-05
    provides: Custom section types and CRUD
  - phase: 57-06
    provides: Auto-save and version history infrastructure
provides:
  - Zustand store with temporal middleware for undo/redo
  - Keyboard shortcuts Cmd+Z / Ctrl+Z and Cmd+Shift+Z / Ctrl+Shift+Z
  - DuplicateButton component with backend API
  - ShareModal with magic link generation
  - Public proposal view route /p/[token]
affects: [proposal-editor, public-access]

# Tech tracking
tech-stack:
  added: [zundo]
  patterns: [temporal-middleware, magic-link-generation, public-token-routes]

key-files:
  created:
    - apps/web/src/stores/proposalStore.ts
    - apps/web/src/components/proposals/UndoRedoButtons.tsx
    - apps/web/src/components/proposals/DuplicateButton.tsx
    - apps/web/src/components/proposals/ShareModal.tsx
    - apps/web/src/app/p/[token]/page.tsx
    - apps/web/src/app/p/[token]/PublicProposalView.tsx
    - open-seo-main/src/routes/api/proposals/[id]/duplicate.ts
    - open-seo-main/src/routes/api/proposals/[id]/link.ts
  modified:
    - apps/web/src/stores/index.ts
    - apps/web/src/components/proposals/index.ts
    - apps/web/package.json

key-decisions:
  - "50 state limit for temporal history to prevent memory issues"
  - "Platform detection for Mac vs Windows keyboard shortcuts"
  - "32-char nanoid tokens for magic links (~10^57 entropy)"
  - "30-day default expiry for magic links"
  - "Beacon API for page leave duration tracking"

patterns-established:
  - "Temporal middleware: useProposalStore.temporal.getState() for undo/redo"
  - "Magic link pattern: /p/[token] route with token validation and expiry"
  - "Duplicate pattern: POST /api/proposals/:id/duplicate with keepProspect flag"

requirements-completed: [SC-8, SC-10]

# Metrics
duration: 8min
completed: 2026-05-02
---

# Phase 57 Plan 08: Clone + Undo/Redo + Magic Link Summary

**Zustand store with zundo temporal middleware enabling Cmd+Z undo/redo, proposal duplication with keep-prospect option, and magic link sharing with 30-day expiry**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-02T11:04:11Z
- **Completed:** 2026-05-02T11:12:00Z
- **Tasks:** 5
- **Files modified:** 12

## Accomplishments
- Zustand store with 50-state temporal history for undo/redo
- Cmd+Z / Ctrl+Z and Cmd+Shift+Z / Ctrl+Shift+Z keyboard shortcuts
- DuplicateButton component with modal and "Keep prospect" checkbox
- ShareModal with copy button, regenerate, and social sharing (Email, WhatsApp)
- Public proposal view route /p/[token] with branded styling and view tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Zustand Store with Temporal** - `0a56b947d` (feat)
2. **Task 2: Undo/Redo Keyboard Shortcuts** - `3a6cf8e8f` (feat)
3. **Task 3: Duplicate Proposal** - `7b4ad52ed` (feat)
4. **Task 4: Magic Link Generation** - `497996284` (feat)
5. **Task 5: Public Proposal View** - `699291242` (feat)
6. **Dependencies** - `69e9e3f2b` (chore)

## Files Created/Modified

**Created:**
- `apps/web/src/stores/proposalStore.ts` - Zustand store with zundo temporal
- `apps/web/src/components/proposals/UndoRedoButtons.tsx` - Toolbar undo/redo buttons
- `apps/web/src/components/proposals/DuplicateButton.tsx` - Clone proposal modal
- `apps/web/src/components/proposals/ShareModal.tsx` - Magic link sharing UI
- `apps/web/src/app/p/[token]/page.tsx` - Public proposal route
- `apps/web/src/app/p/[token]/PublicProposalView.tsx` - Read-only proposal view
- `open-seo-main/src/routes/api/proposals/[id]/duplicate.ts` - Duplicate endpoint
- `open-seo-main/src/routes/api/proposals/[id]/link.ts` - Magic link endpoint

**Modified:**
- `apps/web/src/stores/index.ts` - Export proposal store
- `apps/web/src/components/proposals/index.ts` - Export new components
- `apps/web/package.json` - Add zundo dependency

## Decisions Made

- **50 state limit:** Prevents memory issues with deep history; sufficient for typical editing sessions
- **Platform detection:** Mac users see Cmd+Z, Windows/Linux users see Ctrl+Z in tooltips
- **32-char nanoid tokens:** ~10^57 entropy prevents enumeration attacks on magic links
- **30-day default expiry:** Balances accessibility with security; can be customized in API
- **Beacon API:** Ensures duration tracking even on tab close/navigation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in the codebase (unrelated to this plan)
- UI component imports fixed to use @tevero/ui package instead of local paths

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Proposal editor feature-complete with undo/redo, duplication, and sharing
- Magic links enable external proposal viewing without authentication
- Ready for final Phase 57 integration and polish

---
*Phase: 57-proposal-editor-revolution*
*Completed: 2026-05-02*

## Self-Check: PASSED

All created files verified to exist:
- apps/web/src/stores/proposalStore.ts: FOUND
- apps/web/src/components/proposals/UndoRedoButtons.tsx: FOUND
- apps/web/src/components/proposals/DuplicateButton.tsx: FOUND
- apps/web/src/components/proposals/ShareModal.tsx: FOUND
- apps/web/src/app/p/[token]/page.tsx: FOUND
- apps/web/src/app/p/[token]/PublicProposalView.tsx: FOUND
- open-seo-main/src/routes/api/proposals/[id]/duplicate.ts: FOUND
- open-seo-main/src/routes/api/proposals/[id]/link.ts: FOUND

All commits verified in git log.

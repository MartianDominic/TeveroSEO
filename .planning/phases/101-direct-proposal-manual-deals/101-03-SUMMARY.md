---
phase: 101-direct-proposal-manual-deals
plan: 03
subsystem: pipeline-entry
tags: [command-palette, quick-capture, entity-chain, tanstack-form]
dependency_graph:
  requires: [101-01]
  provides: [QuickCaptureService, GlobalCommandPalette, QuickCaptureModal, /api/deals/quick-capture]
  affects: [CommandPaletteProvider, useCommandPalette]
tech_stack:
  added: ["@tanstack/react-form", "cmdk"]
  patterns: [zustand-global-store, entity-chain-creation, context-aware-commands]
key_files:
  created:
    - open-seo-main/src/server/features/deals/services/QuickCaptureService.ts
    - open-seo-main/src/server/features/deals/services/QuickCaptureService.test.ts
    - open-seo-main/src/routes/api/deals/quick-capture.ts
    - apps/web/src/components/command-palette/GlobalCommandPalette.tsx
    - apps/web/src/components/command-palette/CommandPaletteProvider.tsx
    - apps/web/src/components/command-palette/command-groups.ts
    - apps/web/src/components/command-palette/index.ts
    - apps/web/src/components/quick-capture/QuickCaptureModal.tsx
    - apps/web/src/components/quick-capture/quick-capture-form.ts
    - apps/web/src/components/quick-capture/index.ts
    - apps/web/src/hooks/useCommandPalette.ts
  modified: []
decisions:
  - "Used @tanstack/react-form instead of react-hook-form due to TypeScript 5.9 + bundler resolution incompatibility"
  - "Entity chain creation logic: new/contacted=prospect only, negotiating=+proposal, converted=full chain"
  - "Validation functions exported separately for tanstack-form field-level validators"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-13T22:55:00Z"
---

# Phase 101 Plan 03: Quick Capture & Command Palette Summary

Two-layer entry system with global command palette (Cmd+K) and quick capture modal for < 5 second deal creation, with entity chain auto-creation for deals inserted at later pipeline stages.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | QuickCaptureService with entity chain | c5010df | QuickCaptureService.ts, .test.ts |
| 2 | GlobalCommandPalette with context-aware groups | 257cd27 | GlobalCommandPalette.tsx, command-groups.ts, useCommandPalette.ts |
| 3 | QuickCaptureModal UI component | 5335114 | QuickCaptureModal.tsx, quick-capture-form.ts |
| 4 | /api/deals/quick-capture endpoint | fbfbe01 | quick-capture.ts |

## Implementation Details

### Task 1: QuickCaptureService

Created service with entity chain creation logic per D-01:

- **new, analyzing, scored, qualified, contacted**: Creates prospect only
- **negotiating**: Creates prospect + proposal stub (status: accepted)
- **converted**: Creates prospect + proposal (status: paid) + contract stub (status: executed)

Domain normalization strips protocol, www, path, port, query string, and fragment.

14 tests passing covering:
- Domain normalization (6 tests)
- Entity chain creation for different stages (5 tests)
- Activity logging (3 tests)

### Task 2: GlobalCommandPalette

Implemented Cmd+K command palette with:

- **Context-aware command groups**: Different commands for pipeline, deal-detail, payment-review views
- **Keyboard shortcuts**: Cmd+K (toggle), Cmd+N (new deal), Cmd+Shift+N (quick capture)
- **Stage-aware filtering**: Deal detail commands filtered based on current deal stage
- **Zustand store**: useCommandPalette for global state management

Command views:
- pipeline: Quick capture, record payment, close deal
- deal-detail: Send proposal, record payment, edit, comment, archive (filtered by stage)
- payment-review: Confirm match, find match, create credit
- default: Navigation commands

### Task 3: QuickCaptureModal

Built modal with @tanstack/react-form for form state:

- **3 fields**: Domain (auto-focus), Contact (email or phone), Stage
- **Field-level validation**: validateDomain, validateContact functions
- **Stage hints**: Shows what entities will be created for negotiating/converted stages
- **Keyboard nav**: Tab cycles through fields, Escape closes modal

Note: Used @tanstack/react-form instead of react-hook-form due to TypeScript 5.9 bundler resolution incompatibility with react-hook-form's type exports.

### Task 4: /api/deals/quick-capture

POST endpoint with:

- **Authentication**: requireApiAuth middleware
- **Validation**: Zod schema requiring domain + either email or phone
- **Response**: { success: true, data: { prospectId, proposalId?, contractId?, chainCreated } }
- **Error handling**: 400 for validation, 401 for auth, 500 for internal errors

## Deviations from Plan

### [Rule 3 - Blocking] Switched from react-hook-form to @tanstack/react-form

- **Found during**: Task 3
- **Issue**: react-hook-form@7.75.0 type exports fail with TypeScript 5.9 + bundler moduleResolution. Error: "Module has no exported member 'useForm'"
- **Fix**: Used @tanstack/react-form which is already used in open-seo-main and works correctly
- **Files modified**: QuickCaptureModal.tsx, quick-capture-form.ts
- **Commit**: 5335114

## Test Results

```
Test Files  1 passed (1)
     Tests  14 passed (14)
  Duration  358ms
```

## Known Limitations

1. **Route types**: TanStack Router route path `/api/deals/quick-capture` shows type error until routes are regenerated at build time. This is expected behavior - other new routes (payments/allocate, payments/review) have the same status.

2. **Phone validation**: Basic regex validation; doesn't validate against specific country formats.

3. **No toast notifications**: Error handling in modal logs to console; toast integration deferred.

## Self-Check: PASSED

- [x] QuickCaptureService.ts exists with quickCapture and normalizeDomain exports
- [x] QuickCaptureService.test.ts exists with 14 passing tests
- [x] GlobalCommandPalette.tsx renders with cmdk Command component
- [x] useCommandPalette.ts exports Zustand store
- [x] QuickCaptureModal.tsx renders Dialog with 3 fields
- [x] /api/deals/quick-capture.ts exports POST handler
- [x] All commits exist: c5010df, 257cd27, 5335114, fbfbe01

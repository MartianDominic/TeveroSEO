---
phase: 56-prospect-input-excellence
plan: 03
subsystem: prospects
tags: [confirmation-ui, keyword-selector, inline-editing, prospect-creation]
dependency_graph:
  requires: [56-01, 56-02]
  provides: [extraction-confirmation-ui, keyword-management, prospect-confirm-endpoint]
  affects: [prospect-creation-flow, wizard-completion]
tech_stack:
  added: [inline-editing-pattern, checkbox-badge-ui]
  patterns: [editable-confirmation, re-analyze-flow]
key_files:
  created:
    - apps/web/src/components/prospects/KeywordSelector.tsx
    - apps/web/src/components/prospects/ExtractionConfirmation.tsx
    - open-seo-main/src/routes/api/prospects/confirm.ts
  modified:
    - apps/web/src/components/prospects/AddProspectModal.tsx
    - apps/web/src/app/(shell)/prospects/actions.ts
    - apps/web/messages/en.json
    - apps/web/messages/lt.json
decisions:
  - "Use checkbox badges for keyword selection (visual toggle + remove button)"
  - "Confidence color coding: green >= 70%, yellow >= 50%, red < 50%"
  - "Re-analyze prepends corrections as JSON context to contextNotes"
  - "Generate placeholder domain from business name for conversation-only mode"
  - "ExtractionConfirmation has its own footer buttons, hide modal footer"
metrics:
  duration_seconds: 278
  tasks_completed: 3
  files_created: 3
  files_modified: 4
  commits: 3
  tests_added: 0
  completed_date: "2026-04-30"
---

# Phase 56 Plan 03: Confirmation Flow UI Summary

**One-liner:** User verification screen with editable fields, keyword checkboxes, and confirm/re-analyze actions before prospect creation.

## Overview

Implemented the human-in-the-loop confirmation step that prevents AI hallucination from affecting prospect data quality. Users now see all extracted data in editable form, can toggle keywords on/off with checkboxes, add/remove keywords, and either confirm to create the prospect or re-analyze with corrections. The confirmation step integrates with the existing wizard flow and calls the new `/api/prospects/confirm` endpoint to persist the verified data.

## Tasks Completed

### Task 1: Create KeywordSelector component
**Status:** Complete
**Commit:** aaa5c23c4

Created reusable keyword management component with:
- Checkbox badges for each keyword (selected = filled, unselected = outline)
- X button on each badge to remove keyword
- Input field with Enter key to add new keywords
- Selection count display with i18n ("X of Y keywords selected")
- Disabled state support for form submission
- Props: `keywords`, `selectedKeywords`, `onSelectionChange`, `onAddKeyword`, `onRemoveKeyword`

### Task 2: Create ExtractionConfirmation component and wire to modal
**Status:** Complete
**Commit:** cdae1d6b0

Created confirmation UI with:
- Confidence badge with color coding (green/yellow/red based on score)
- Low confidence warning banner for scores < 50%
- Editable fields for: businessName, industry (Select), services, targetAudience, location
- KeywordSelector integration for keyword management
- Re-analyze button returns to input with corrections context
- Confirm button triggers prospect creation

Updated AddProspectModal with:
- Consolidated store destructuring for all needed actions
- `handleAnalyze` calls `extractFromConversationAction` and transitions to confirmation
- `handleConfirm` calls `confirmAndCreateProspectAction` and closes modal
- `handleReanalyze` prepends corrections JSON to contextNotes and returns to input
- Progress step shows loading spinner during extraction
- Footer hidden on confirmation step (ExtractionConfirmation has its own buttons)

### Task 3: Create confirm endpoint and action, add translations
**Status:** Complete
**Commit:** bec1fa917

Created API endpoint `/api/prospects/confirm`:
- Zod validation for confirmedData structure (T-56-08 mitigation)
- `requireAuthenticatedContext` validates user before creating (T-56-09 mitigation)
- Generates placeholder domain from business name for conversation-only mode
- Creates prospect via ProspectService.create
- Updates with extraction columns via ProspectService.update
- Returns `{ prospectId, domain }` on success

Added server action:
- `confirmAndCreateProspectAction` wraps API call with auth
- `ConfirmResult` interface exported for type safety
- Input validation with Zod schema
- Path revalidation after successful creation

Added i18n translations:
- EN: confirmation fields, keywords namespace, error messages
- LT: matching Lithuanian translations for all keys

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

1. **Checkbox badges for keywords**: Visual toggle pattern with Badge component wrapping Checkbox. Selected state uses filled variant, unselected uses outline.

2. **Confidence color coding**: Three-tier system using text-success (>= 70%), text-warning (>= 50%), text-error (< 50%) to guide user attention.

3. **Re-analyze flow**: Prepends user corrections as JSON context to the contextNotes field, then returns to input step. This provides the AI with explicit feedback for the next extraction attempt.

4. **Placeholder domain generation**: For conversation-only mode without a domain, generates `{business-name-slugified}.prospect` to satisfy the domain requirement while clearly marking it as synthetic.

5. **Confirmation step has own footer**: ExtractionConfirmation renders its own Re-analyze and Confirm buttons, so the modal footer is hidden during this step to avoid duplicate controls.

## Threat Model Compliance

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-56-08   | Zod schema validation on confirmedData | `confirmRequestSchema.safeParse(body)` in confirm.ts |
| T-56-09   | Auth before prospect creation | `requireAuthenticatedContext()` validates session |
| T-56-10   | Showing extracted data to owner | Intentional - user is confirming their own extraction |

All threat mitigations applied as specified in plan.

## Integration Points

**Upstream dependencies:**
- Plan 56-01: Wizard store, WizardStep types, modal foundation
- Plan 56-02: extractFromConversationAction, ExtractionResult type

**Downstream blockers removed:**
- Plan 56-04 can build CSV import with similar confirmation flow
- Plan 56-05 can implement entry manager with extraction triggers

**Files ready for integration:**
- KeywordSelector reusable for other keyword selection needs
- ExtractionConfirmation pattern reusable for other AI extraction confirmation
- `/api/prospects/confirm` endpoint ready for any client that has confirmed extraction data

## Testing Notes

**Manual testing required:**
1. Open modal, enter conversation text, click Analyze
2. Verify extraction data appears in editable fields
3. Edit business name, select different industry
4. Toggle keywords on/off, add new keyword, remove existing
5. Click Re-analyze -> should return to input with corrections context
6. Click Confirm -> should create prospect and close modal
7. Verify prospect appears in list with confirmed data

## Known Limitations

1. **No server-side i18n for industry options**: Industry dropdown uses hardcoded English strings in ExtractionConfirmation. Future plan could add industry translation keys.

2. **Re-analyze is basic**: Currently just prepends corrections as JSON context. More sophisticated approach could use structured correction format.

3. **No undo for keyword removal**: Removed keywords must be re-added manually. Could add undo functionality in future.

## Files Created

1. **apps/web/src/components/prospects/KeywordSelector.tsx** (129 lines)
   - Checkbox badge keyword selection
   - Add/remove keyword functionality
   - Selection count with i18n

2. **apps/web/src/components/prospects/ExtractionConfirmation.tsx** (218 lines)
   - Editable fields for all extraction data
   - Confidence badge with color coding
   - KeywordSelector integration
   - Re-analyze and Confirm buttons

3. **open-seo-main/src/routes/api/prospects/confirm.ts** (124 lines)
   - POST endpoint for prospect creation
   - Zod validation, auth, error handling
   - Placeholder domain generation

## Files Modified

1. **apps/web/src/components/prospects/AddProspectModal.tsx** (+165 lines)
   - Confirmation step rendering
   - handleConfirm, handleReanalyze handlers
   - Progress step with loading spinner
   - Footer visibility logic

2. **apps/web/src/app/(shell)/prospects/actions.ts** (+62 lines)
   - confirmAndCreateProspectAction function
   - confirmAndCreateSchema validation
   - ConfirmResult interface

3. **apps/web/messages/en.json** (+28 lines)
   - prospects.wizard.confirmation namespace
   - prospects.wizard.keywords namespace
   - Error messages for extraction/creation

4. **apps/web/messages/lt.json** (+28 lines)
   - Lithuanian translations for all new keys

## Success Criteria Met

- [x] KeywordSelector renders keywords as checkbox badges
- [x] KeywordSelector allows adding and removing keywords
- [x] ExtractionConfirmation shows confidence badge with color coding
- [x] ExtractionConfirmation has editable fields for all extracted data
- [x] AddProspectModal shows confirmation step after extraction
- [x] confirm.ts creates prospect with confirmed data
- [x] confirmAndCreateProspectAction wraps API call
- [x] EN and LT translations for confirmation and keywords namespaces

## Self-Check: PASSED

**Files created:**
- [x] apps/web/src/components/prospects/KeywordSelector.tsx
- [x] apps/web/src/components/prospects/ExtractionConfirmation.tsx
- [x] open-seo-main/src/routes/api/prospects/confirm.ts

**Commits exist:**
- [x] aaa5c23c4 (Task 1: KeywordSelector)
- [x] cdae1d6b0 (Task 2: ExtractionConfirmation + modal integration)
- [x] bec1fa917 (Task 3: confirm endpoint + translations)

All files and commits verified in repository.

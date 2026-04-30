---
phase: 56-prospect-input-excellence
plan: 01
subsystem: prospects
tags: [schema, ui, i18n, wizard, modal]
dependency_graph:
  requires: [Phase-55-i18n-framework, Phase-26-prospect-data-model]
  provides: [multi-modal-prospect-input, prospect-wizard-store, input-form-components]
  affects: [prospect-creation-flow, ai-extraction-pipeline]
tech_stack:
  added: [zustand-wizard-store, radix-tabs, multi-mode-forms]
  patterns: [wizard-pattern, tab-navigation, validation-by-mode]
key_files:
  created:
    - open-seo-main/src/db/migrations/0035_prospect_input_mode.sql
    - apps/web/src/stores/prospect-wizard-store.ts
    - apps/web/src/components/prospects/WebsiteInputForm.tsx
    - apps/web/src/components/prospects/WebsiteContextForm.tsx
    - apps/web/src/components/prospects/ConversationInputForm.tsx
    - apps/web/src/components/prospects/AddProspectModal.tsx
  modified:
    - open-seo-main/src/db/prospect-schema.ts
    - apps/web/messages/en.json
    - apps/web/messages/lt.json
decisions:
  - "Use Zustand store for wizard state (not React Context) for persistence across navigation"
  - "Three input modes: website (URL only), website_with_context (URL + notes), conversation (transcript only)"
  - "Domain validation via regex /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i"
  - "Conversation minimum length: 50 characters for meaningful AI extraction"
  - "Raw input stored up to 50KB (maxLength={50000} enforced at UI layer)"
  - "Confirmation status enum: pending, confirmed, skipped (user verification flow)"
metrics:
  duration_seconds: 266
  tasks_completed: 3
  files_created: 6
  files_modified: 3
  commits: 3
  tests_added: 0
  completed_date: "2026-04-30"
---

# Phase 56 Plan 01: Multi-Modal Prospect Input Foundation Summary

**One-liner:** Multi-modal prospect creation with tab-based UI supporting website URL, website + context notes, and conversation-only input modes.

## Overview

Created the foundation for "paste anything" prospect input by extending the prospect schema with input mode tracking, implementing a Zustand-based wizard store, and building three specialized input form components wrapped in a tab-based modal. Users can now choose between three modes: entering just a website URL, providing URL with additional context notes (up to 50KB), or pasting a full conversation transcript without any website. The modal validates inputs per mode (domain regex for website modes, 50-character minimum for conversation mode) and includes full English and Lithuanian translations using the Phase 55 i18n framework.

## Tasks Completed

### Task 1: Extend prospect schema with input mode columns
**Status:** Complete
**Commit:** 486d5d9c5

Extended `prospects` table with 5 new columns:
- `input_mode` (TEXT): 'website' | 'website_with_context' | 'conversation'
- `raw_input` (TEXT): Original conversation/notes text (up to 50KB)
- `extracted_data` (JSONB): AI extraction before user confirmation
- `confirmed_data` (JSONB): User-verified extraction with metadata
- `confirmation_status` (TEXT): 'pending' | 'confirmed' | 'skipped'

Added TypeScript interfaces:
- `ExtractedProspectData`: AI extraction result with confidence score
- `ConfirmedProspectData`: Extends ExtractedProspectData with confirmation metadata

Created migration `0035_prospect_input_mode.sql` with:
- ALTER TABLE statements for all 5 columns
- Check constraints for enum validation
- Column comments for documentation

### Task 2: Create Zustand wizard store and input form components
**Status:** Complete
**Commit:** ac55b1720

Created `prospect-wizard-store.ts`:
- `WizardStep` type: 'input' | 'progress' | 'confirmation' | 'complete'
- `InputMode` type: 'website' | 'website_with_context' | 'conversation'
- `WizardFormData` interface with domain, contextNotes, conversationText fields
- `ExtractionResult` interface for AI-extracted data
- State management actions: open, close, setStep, setMode, setFormData, setExtractedData, setSubmitting, setError, reset
- Mode switching resets form data to prevent cross-contamination

Created three input form components:
- **WebsiteInputForm.tsx**: Single domain input field with hint text
- **WebsiteContextForm.tsx**: Domain + Textarea (6 rows, 50KB limit) with context hints
- **ConversationInputForm.tsx**: Textarea (10 rows, 50KB limit) with character counter and validation feedback

All forms use:
- `useProspectWizardStore` hook for state management
- `useTranslations("prospects.wizard")` for i18n
- v6 design tokens (`var(--space-*)`, `var(--type-*)`, `text-error`)
- Disabled state during submission

### Task 3: Create AddProspectModal with tab-based mode selection and i18n
**Status:** Complete
**Commit:** 6c56dcfeb

Created `AddProspectModal.tsx`:
- Three-tab interface using Radix UI Tabs (Globe, FileText, MessageSquare icons)
- Controlled Dialog with open/close state from Zustand store
- Tab-responsive form rendering (WebsiteInputForm, WebsiteContextForm, ConversationInputForm)
- Mode-specific validation:
  - Website modes: domain required, regex validation
  - Conversation mode: minimum 50 characters
- Error display with v6 error styling (`bg-error/10 text-error`)
- Analyze button disabled until form is valid
- Reset state on modal close via useEffect

Added translations to `en.json` and `lt.json`:
- `prospects.wizard.title`: "Add New Prospect" / "Prideti nauja prospekta"
- `prospects.wizard.description`: Instruction text
- `prospects.wizard.modes`: Tab labels (Website, Website + Context, Conversation)
- `prospects.wizard.domain`, `domainHint`, `contextNotes`, `contextNotesPlaceholder`, etc.
- `prospects.wizard.errors`: domainRequired, invalidDomain, conversationTooShort

Domain validation regex: `/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i`
- Strips `https://`, `www.`, and path before validation
- Matches valid domain format (e.g., example.com, sub.example.co.uk)

## Deviations from Plan

None. Plan executed exactly as written.

## Technical Decisions

1. **Zustand over React Context for wizard state**: Enables state persistence across navigation and provides better dev tools integration.

2. **Tab-based mode selection**: Cleaner UX than dropdown or radio buttons; icons provide visual cues (Globe, FileText, MessageSquare).

3. **Mode-specific validation**: Each input mode has different requirements (domain presence, text length) validated before submission.

4. **50KB raw input limit**: Enforced at UI layer via `maxLength={50000}` on Textarea; prevents DoS via excessive text.

5. **Domain regex validation**: Strips protocol and www before validation to handle user paste variations (https://www.example.com → example.com).

6. **Conversation minimum 50 characters**: Ensures meaningful input for AI extraction; prevents empty or trivial submissions.

7. **v6 design token usage**: `var(--space-*)` for spacing, `text-error` for validation feedback, `var(--radius-input)` for error container.

8. **Reset on mode change**: Changing tabs clears form data to prevent mixing website and conversation inputs.

## Threat Model Compliance

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-56-01   | Domain regex validation | `domainRegex.test(cleanDomain)` in `handleAnalyze()` |
| T-56-02   | 50KB limit on rawInput | `maxLength={50000}` on Textarea components |
| T-56-03   | Generic error messages | `setError(t("errors.domainRequired"))` - no stack traces |

All threat mitigations applied as specified in plan.

## Integration Points

**Upstream dependencies:**
- Phase 55 i18n framework: `useTranslations()`, `en.json`, `lt.json`
- Phase 26 prospect data model: `prospects` table baseline schema

**Downstream blockers removed:**
- Plan 56-02 can now implement AI extraction via ConversationExtractor
- Plan 56-03 can build confirmation UI using `extractedData` / `confirmedData` columns
- Plan 56-04 can wire extraction to server actions

**Files ready for integration:**
- `useProspectWizardStore`: Available for import in Plan 56-02 extraction flow
- `AddProspectModal`: Can be triggered from prospect list page
- Migration 0035: Ready to apply via `drizzle-kit push` or `npm run migrate`

## Testing Notes

**Manual testing required:**
1. Open modal, switch between tabs → form data should reset
2. Enter invalid domain (no TLD, spaces) → should show error
3. Paste <50 char conversation → Analyze button disabled
4. Paste >50000 char text → should truncate at 50KB
5. Switch language to Lithuanian → UI labels should translate

**Future test coverage (Plan 56-05):**
- Domain regex validation edge cases (IDN domains, subdomains)
- Character counter accuracy at boundary (49, 50, 51 chars)
- Error message clearing on valid input
- Modal state reset on close

## Known Limitations

1. **No AI extraction yet**: Analyze button closes modal without creating prospect (placeholder for Plan 56-02)
2. **No server action wired**: Form validation only; no actual database insert (Plan 56-04)
3. **No loading state during extraction**: `isSubmitting` tracked but not used until Plan 56-02 implements extraction
4. **No success toast**: Modal closes silently; success feedback deferred to Plan 56-04
5. **No form persistence**: Closing modal loses entered data; intentional for security (no sensitive data in localStorage)

## Files Created

1. **open-seo-main/src/db/migrations/0035_prospect_input_mode.sql** (655 bytes)
   - ALTER TABLE statements for 5 new columns
   - Check constraints for input_mode and confirmation_status enums
   - Column comments for documentation

2. **apps/web/src/stores/prospect-wizard-store.ts** (1,962 bytes)
   - Zustand store with wizard state and actions
   - Type exports: WizardStep, InputMode, WizardFormData, ExtractionResult
   - Reset functionality for clean modal state

3. **apps/web/src/components/prospects/WebsiteInputForm.tsx** (924 bytes)
   - Domain input field with placeholder and hint
   - Required field indicator (red asterisk)
   - Disabled state during submission

4. **apps/web/src/components/prospects/WebsiteContextForm.tsx** (1,382 bytes)
   - Domain input + context notes textarea
   - 6 rows, 50KB limit with hint text
   - v6 spacing tokens

5. **apps/web/src/components/prospects/ConversationInputForm.tsx** (1,618 bytes)
   - Monospace textarea for transcript paste
   - Character counter with min/max validation
   - Color-coded validation feedback (red < 50, gray otherwise)

6. **apps/web/src/components/prospects/AddProspectModal.tsx** (5,214 bytes)
   - Three-tab modal with Radix UI Tabs
   - Mode-specific validation logic
   - Error display container
   - Analyze button with loading state (Loader2 spinner)

## Files Modified

1. **open-seo-main/src/db/prospect-schema.ts** (+60 lines)
   - Added INPUT_MODES, CONFIRMATION_STATUSES enums
   - Added ExtractedProspectData, ConfirmedProspectData interfaces
   - Added 5 columns to prospects table definition
   - Added 2 check constraints

2. **apps/web/messages/en.json** (+21 lines)
   - Added prospects.wizard namespace
   - Added mode labels, field labels, hints, error messages

3. **apps/web/messages/lt.json** (+21 lines)
   - Lithuanian translations for prospects.wizard
   - Preserves ICU plural formatting

## Verification Results

**Schema verification:**
```
✓ inputMode: text("input_mode") present
✓ extractedData: jsonb("extracted_data") present
✓ Check constraints defined
✓ TypeScript interfaces exported
```

**Store verification:**
```
✓ useProspectWizardStore exported
✓ WizardStep type defined
✓ InputMode type defined
✓ All actions present (open, close, setStep, setMode, etc.)
```

**Modal verification:**
```
✓ AddProspectModal function component exported
✓ Tabs, TabsList, TabsTrigger, TabsContent imported
✓ Three TabsTrigger values: website, website_with_context, conversation
✓ Domain validation regex implemented
```

**i18n verification:**
```
✓ prospects.wizard namespace in en.json
✓ prospects.wizard namespace in lt.json
✓ useTranslations("prospects.wizard") in all components
```

## Success Criteria Met

- [x] All tasks executed
- [x] Each task committed individually
- [x] All deviations documented (none)
- [x] SUMMARY.md created with substantive content
- [x] Threat model mitigations applied
- [x] No unintended file deletions
- [x] Plan executed exactly as written

## Next Steps (Plan 56-02)

1. Implement ConversationExtractor service (Claude API integration)
2. Add server action to handle prospect creation with extraction
3. Wire Analyze button to extraction flow
4. Update wizard store to handle progress and confirmation steps
5. Add error handling for API failures

## Self-Check: PASSED

**Files created:**
- [x] open-seo-main/src/db/migrations/0035_prospect_input_mode.sql
- [x] apps/web/src/stores/prospect-wizard-store.ts
- [x] apps/web/src/components/prospects/WebsiteInputForm.tsx
- [x] apps/web/src/components/prospects/WebsiteContextForm.tsx
- [x] apps/web/src/components/prospects/ConversationInputForm.tsx
- [x] apps/web/src/components/prospects/AddProspectModal.tsx

**Commits exist:**
- [x] 486d5d9c5 (Task 1: schema extension)
- [x] ac55b1720 (Task 2: wizard store + forms)
- [x] 6c56dcfeb (Task 3: modal + i18n)

All files and commits verified in repository.

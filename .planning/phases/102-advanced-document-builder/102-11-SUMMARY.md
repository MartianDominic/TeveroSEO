---
phase: 102-advanced-document-builder
plan: 11
subsystem: document-builder
tags: [theme-extraction, verification-ui, pdf-export, undo-redo]
dependency_graph:
  requires: [102-10, 102-08, 102-07]
  provides: [theme-extraction, verification-ui, pdf-export, manual-block-creation, undo-redo]
  affects: [processing-queue, document-builder-schema]
tech_stack:
  added: [puppeteer]
  patterns: [TDD, undo-redo-hook, theme-extraction, pdf-generation]
key_files:
  created:
    - apps/web/src/db/__tests__/brand-themes.test.ts
    - apps/web/src/lib/document-processing/theme-extractor.ts
    - apps/web/src/lib/document-processing/__tests__/theme-extractor.test.ts
    - apps/web/src/hooks/useUndoRedo.ts
    - apps/web/src/components/document-builder/VerificationUI.tsx
    - apps/web/src/components/document-builder/ManualBlockCreator.tsx
    - apps/web/src/lib/document-processing/pdf-export.ts
    - apps/web/src/lib/document-processing/__tests__/pdf-export.test.ts
  modified:
    - apps/web/src/db/schema/document-builder.ts
    - apps/web/src/lib/document-processing/processing-queue.ts
    - apps/web/package.json
decisions:
  - "Gemini 2.0 Flash for voice analysis (per CLAUDE.md model guidance)"
  - "Font classification by size (>16pt = heading) and usage count (most used = body)"
  - "Theme extraction non-blocking in processing queue (failure doesn't stop processing)"
  - "Puppeteer for PDF generation (serverless-compatible, per plan spec)"
  - "useUndoRedo generic hook with Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts"
metrics:
  duration: "8m 42s"
  completed: "2026-05-16T23:24:49Z"
  tests_passing: 23
  files_created: 8
  files_modified: 3
---

# Phase 102 Plan 11: Theme Extraction & Verification UI Summary

Theme extraction with brand colors/fonts/voice, verification UI for block review, manual block creation escape hatch, and PDF export with Puppeteer.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 67e2ca681 | Add brand_themes table with colors, fonts, voiceAttributes |
| 2 | 29b93dd06 | Create theme extractor service with AI voice analysis |
| 3 | 0c194db2a | Add useUndoRedo hook with keyboard shortcuts |
| 4 | ecc5e7084 | Add VerificationUI component for block review |
| 5 | 1cee708da | Add ManualBlockCreator escape hatch component |
| 6 | b1014f941 | Add PDF export service with Puppeteer |
| 7 | 27933cb39 | Integrate theme extraction into processing queue |

## Key Deliverables

### 1. Brand Themes Database Table

- `brandThemes` table with documentId FK, workspace scoping
- Colors: `colors` array, `primaryColor`, `secondaryColor`
- Fonts: `fonts` array with usage classification, `headingFont`, `bodyFont`
- Voice: `voiceAttributes` JSON (tone, vocabulary, patterns)
- Confidence score 0-100 with CHECK constraint

### 2. Theme Extractor Service

- `extractTheme(documentId)` extracts colors, fonts, voice from processed documents
- `classifyFonts()` categorizes fonts as heading/body/accent by size and usage
- AI voice analysis with Gemini 2.0 Flash for tone/vocabulary/patterns
- Confidence scoring based on data completeness (50 base + 15 colors + 15 fonts + 20 voice)

### 3. Undo/Redo Hook

- `useUndoRedo<T>(initialState)` generic hook
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
- Tracks past/present/future state stack
- Functional update support: `set(prev => newValue)`

### 4. Verification UI Component

- Side-by-side view: original text left, detected blocks right
- Per-block actions: Accept, Reject, Edit with icons
- Block type dropdown to change detection classification
- Confidence indicator with color coding (green >= 80%, yellow >= 60%, red < 60%)
- Bulk actions: Accept All, Reject Low Confidence
- Progress bar showing verified/total blocks
- Integrated with useUndoRedo for Ctrl+Z support

### 5. Manual Block Creator

- Sheet-based creator for manual block addition
- Block type selector with all 11 persuasion types
- Show/hide block descriptions toggle
- Position selector (before/after reference block)
- InlineBlockCreator variant for inline use within verification flow

### 6. PDF Export Service

- `exportToPdf(options)` generates PDF from proposal blocks
- Apply brand theme via CSS variables (--primary-color, --heading-font, etc.)
- Block-specific styling (pain_amplifier red border, cta centered, etc.)
- Variable interpolation before rendering
- Puppeteer headless rendering with A4 format

## Test Coverage

- **brand-themes.test.ts**: 7 tests (schema structure)
- **theme-extractor.test.ts**: 9 tests (extraction, classification, confidence)
- **pdf-export.test.ts**: 7 tests (generation, blocks, themes, variables)
- **Total**: 23 tests passing

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All files verified to exist:
- apps/web/src/db/schema/document-builder.ts (brandThemes table)
- apps/web/src/lib/document-processing/theme-extractor.ts
- apps/web/src/hooks/useUndoRedo.ts
- apps/web/src/components/document-builder/VerificationUI.tsx
- apps/web/src/components/document-builder/ManualBlockCreator.tsx
- apps/web/src/lib/document-processing/pdf-export.ts

All commits verified in git log.

## Phase 102 Complete

This was the final wave (Wave 6) of Phase 102: Advanced Document Builder. The phase is now complete with all 11 plans executed:

- 102-01 to 102-06: Foundation, blocks, templates, analytics
- 102-07 to 102-10: Upload pipeline, parsing, OCR, structure detection
- 102-11: Theme extraction, verification UI, PDF export

The Upload-First workflow is now functional from upload to polished PDF export.

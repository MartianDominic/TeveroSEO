---
phase: 102-advanced-document-builder
plan: 05
status: complete
completed_at: 2026-05-16T20:35:00Z
---

# Plan 102-05 Summary: A/B Testing UI and Version Diff

## Objective

Implement A/B testing UI and side-by-side version diff for the document builder.

## Tasks Completed

### Task 1: A/B Testing Service with Deterministic Assignment

**Files:**
- `apps/web/src/lib/document-builder/ab-testing-service.ts` (NEW)
- `apps/web/src/lib/document-builder/__tests__/ab-testing-service.test.ts` (NEW)

**Implementation:**
- `getVariantForProspect()` - Deterministic hash assignment using `sha256(prospectId:blockId)` per D-03 from CONTEXT.md
- `calculateSignificance()` - Z-test for proportions with confidence level calculation
- `normalizeWeights()` - Weight normalization to ensure 100% total allocation
- `validateWeights()` - Weight validation (0-100 range)
- `canDeclareWinner()` - Winner criteria check (isSignificant && recommendation === 'winner')
- `getStatusLabel()` - Human-readable status labels

**Tests:** 16 passing tests covering:
- Deterministic variant assignment (same prospect+block always returns same variant)
- Even distribution across variants based on weights
- Statistical significance calculation
- `needs_more_data` recommendation when impressions < 100
- Winner/loser identification

### Task 2: VariantCreator and VariantTabs Components

**Files:**
- `apps/web/src/components/document-builder/VariantCreator.tsx` (NEW)
- `apps/web/src/components/document-builder/VariantTabs.tsx` (NEW)

**VariantCreator Features:**
- Modal dialog using `@tevero/ui` Dialog pattern
- Form fields: variant name, content source (clone/blank), traffic weight slider
- Clone from control or start blank options
- Traffic weight slider (0-100%)

**VariantTabs Features:**
- Tab bar for switching between variants
- Visual states per UI-SPEC:
  - Inactive: `--surface-2` background, `--text-3`
  - Active: `--accent-soft` background, `--accent-ink` text
  - Winner badge: `--success-soft` pill with checkmark
  - Loser badge: `--error-soft` pill with x
  - Needs data: `--surface-3` pill, `--text-4`
- Inline analytics (impressions, conversion rate)
- Statistical significance badges

### Task 3: VersionDiff Component and Service

**Files:**
- `apps/web/src/lib/document-builder/version-diff.ts` (NEW)
- `apps/web/src/lib/document-builder/__tests__/version-diff.test.ts` (NEW)
- `apps/web/src/components/document-builder/VersionDiff.tsx` (NEW)

**version-diff.ts Service:**
- `computeBlockDiff()` - Block-level diff using ID matching
- `computeTextDiff()` - Word-level diff using LCS algorithm
- `extractTextFromContent()` - TipTap content to plain text extraction
- `getDiffSummary()` - Counts of added/removed/modified/unchanged
- `hasChanges()` - Quick check if any changes exist

**VersionDiff Component:**
- Side-by-side layout with version selectors
- Block-level highlighting per UI-SPEC:
  - Added: `--success-soft` background, 3px `--success` border
  - Removed: `--error-soft` background, 3px `--error` border
  - Modified: `--warning-soft` background, 3px `--warning` border
- Inline text diff with word-level highlighting
- "No changes between these versions" empty state

**Tests:** 21 passing tests covering:
- Block addition/removal/modification detection
- Text diff with word boundaries
- Edge cases (empty arrays, null content)
- Summary calculation

## Verification Results

### TypeScript Check
```bash
cd apps/web && npx tsc --noEmit
# No errors
```

### Test Results
```bash
cd apps/web && npm test -- run src/lib/document-builder/__tests__/
# Test Files: 8 passed
# Tests: 133 passed
```

### Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `grep -q "sha256"` ab-testing-service.ts | PASS |
| `grep -q "getVariantForProspect"` ab-testing-service.ts | PASS |
| `grep -q "calculateSignificance"` ab-testing-service.ts | PASS |
| `grep -q "needs_more_data\|winner\|loser"` ab-testing-service.ts | PASS |
| `grep -q "createVariant"` VariantCreator.tsx | PASS |
| `grep -q "Dialog"` VariantCreator.tsx | PASS |
| `grep -q "accent-soft\|success-soft\|error-soft"` VariantTabs.tsx | PASS |
| `grep -q "computeBlockDiff\|computeTextDiff"` version-diff.ts | PASS |
| `grep -q "strikethrough\|line-through"` VersionDiff.tsx | PASS |

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `apps/web/src/lib/document-builder/ab-testing-service.ts` | Created | 246 |
| `apps/web/src/lib/document-builder/__tests__/ab-testing-service.test.ts` | Created | 188 |
| `apps/web/src/lib/document-builder/version-diff.ts` | Created | 281 |
| `apps/web/src/lib/document-builder/__tests__/version-diff.test.ts` | Created | 201 |
| `apps/web/src/components/document-builder/VariantCreator.tsx` | Created | 239 |
| `apps/web/src/components/document-builder/VariantTabs.tsx` | Created | 209 |
| `apps/web/src/components/document-builder/VersionDiff.tsx` | Created | 321 |
| `apps/web/src/components/document-builder/index.ts` | Modified | +6 |

## Requirements Addressed

- **REQ-06**: A/B testing per block with statistical significance
- **REQ-08**: Version history with side-by-side diff

## Next Steps

- Integrate VariantTabs into PersuasionBlock footer
- Connect variant creation to database operations
- Add variant analytics tracking via Redis counters
- Implement version history UI with VersionDiff integration

---
phase: 44-component-library-foundation
reviewed: 2026-04-30T12:30:00Z
depth: standard
files_reviewed: 72
files_reviewed_list:
  - packages/ui/src/lib/tokens.ts
  - packages/ui/src/lib/tokens.css
  - packages/ui/src/lib/utils.ts
  - packages/ui/src/lib/status-config.ts
  - packages/ui/src/lib/format-time.ts
  - packages/ui/src/lib/keyboard-patterns.ts
  - packages/ui/src/components/button.tsx
  - packages/ui/src/components/dialog.tsx
  - packages/ui/src/components/input.tsx
  - packages/ui/src/components/select.tsx
  - packages/ui/src/components/textarea.tsx
  - packages/ui/src/components/command.tsx
  - packages/ui/src/components/focus-trap.tsx
  - packages/ui/src/components/checklist.tsx
  - packages/ui/src/components/health-gauge.tsx
  - packages/ui/src/components/kanban.tsx
  - packages/ui/src/components/step-wizard.tsx
  - packages/ui/src/components/connection-status-card.tsx
  - packages/ui/src/components/drop-causes-panel.tsx
  - packages/ui/src/components/data-state-wrapper.tsx
  - packages/ui/src/components/empty-state.tsx
  - packages/ui/src/components/error-state.tsx
  - packages/ui/src/components/loading-skeleton.tsx
  - packages/ui/src/components/ops-strip.tsx
  - packages/ui/src/components/report-preview-card.tsx
  - packages/ui/src/components/tier-breakdown-table.tsx
  - packages/ui/src/components/aria-live.tsx
  - packages/ui/src/components/skip-to-main.tsx
  - packages/ui/src/components/progress-bar.tsx
  - packages/ui/src/components/numerals.tsx
  - packages/ui/src/components/entity-card.tsx
  - packages/ui/src/components/metric-card.tsx
  - packages/ui/src/components/velocity-strip.tsx
  - packages/ui/src/components/period-selector.tsx
  - packages/ui/src/components/card-action-menu.tsx
  - packages/ui/src/components/typography.tsx
  - packages/ui/src/components/relative-timestamp.tsx
  - packages/ui/src/components/severity-dots.tsx
  - packages/ui/src/components/segmented-progress-bar.tsx
  - packages/ui/src/components/step-indicator.tsx
  - packages/ui/src/components/intent-badge.tsx
  - packages/ui/src/components/count-badge.tsx
  - packages/ui/src/components/keyboard-shortcut-hint.tsx
  - packages/ui/src/components/today-feed-item.tsx
  - packages/ui/src/components/pipeline-stage-card.tsx
  - packages/ui/src/components/badge.tsx
  - packages/ui/src/components/card.tsx
  - packages/ui/src/components/chart.tsx
  - packages/ui/src/components/checkbox.tsx
  - packages/ui/src/components/cms-health-badge.tsx
  - packages/ui/src/components/error-banner.tsx
  - packages/ui/src/components/label.tsx
  - packages/ui/src/components/page-header.tsx
  - packages/ui/src/components/popover.tsx
  - packages/ui/src/components/separator.tsx
  - packages/ui/src/components/sheet.tsx
  - packages/ui/src/components/skeleton.tsx
  - packages/ui/src/components/slider.tsx
  - packages/ui/src/components/status-chip.tsx
  - packages/ui/src/components/switch.tsx
  - packages/ui/src/components/table.tsx
  - packages/ui/src/components/tabs.tsx
  - packages/ui/src/index.ts
  - packages/ui/.storybook/main.ts
  - packages/ui/.storybook/preview.ts
  - packages/ui/vitest.setup.ts
  - packages/ui/src/__tests__/checklist.test.tsx
  - packages/ui/src/__tests__/health-gauge.test.tsx
  - packages/ui/src/__tests__/progress-bar.test.tsx
  - packages/ui/src/__tests__/format-time.test.ts
  - packages/ui/src/__tests__/status-config.test.ts
  - packages/ui/src/__tests__/empty-state.test.tsx
  - apps/web/src/app/globals.css
  - apps/web/src/app/layout.tsx
findings:
  critical: 0
  warning: 5
  info: 9
  total: 14
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-04-30T12:30:00Z
**Depth:** standard
**Files Reviewed:** 72
**Status:** issues_found

## Summary

Phase 44 (Component Library Foundation) establishes a comprehensive design system with 56+ components, CSS design tokens, and TypeScript token exports. The code quality is generally high with good accessibility considerations, consistent use of v6 design tokens, and proper TypeScript typing.

Key strengths:
- Consistent use of CSS custom properties for theming
- Good accessibility patterns (aria-labels, roles, focus management)
- Proper value clamping in progress components
- Solid test coverage for core utilities

Areas for improvement:
- Several components missing displayName (minor consistency issue)
- Unused Icon variable in OpsStrip component
- Missing type button attribute on some interactive elements
- Potential XSS vector in EntityCard image handling

No critical security issues found. All findings are warnings or informational.

## Warnings

### WR-01: Unused Variable Declaration in OpsStrip

**File:** `packages/ui/src/components/ops-strip.tsx:119`
**Issue:** The `Icon` variable is declared but never used in the main strip rendering loop. It's only used in the expanded details section but is declared outside that scope.
**Fix:**
```tsx
// Remove line 119 or move inside the expanded section
// Current (line 119):
const Icon = TYPE_ICONS[item.type]; // Declared but unused in this scope

// The variable is re-declared at line 200 where it's actually used
// Remove the declaration at line 119 to avoid confusion
```

### WR-02: Missing type="button" on Interactive Elements

**File:** `packages/ui/src/components/period-selector.tsx:88-104`
**Issue:** Buttons inside forms default to type="submit". While these buttons have `type="button"` set, several other interactive elements in the codebase use `<div>` or `<button>` without explicit type, which could cause unexpected form submissions in some contexts.
**Fix:** Ensure all interactive button elements include `type="button"` explicitly. The PeriodSelector does this correctly, but review other components like DropCausesPanel (lines 151-166) where div elements are used with role="button".

### WR-03: Potential XSS Vector in EntityCard Image Handling

**File:** `packages/ui/src/components/entity-card.tsx:124-129`
**Issue:** The EntityCard component renders user-provided image URLs directly without validation. While React escapes attribute values, malicious data URIs or javascript: URLs could potentially be injected.
**Fix:**
```tsx
// Add URL validation before rendering
{avatar.type === "image" && typeof avatar.value === "string" && (
  <img
    src={avatar.value.startsWith('http') || avatar.value.startsWith('/') 
      ? avatar.value 
      : undefined}
    alt=""
    className="w-full h-full rounded-full object-cover"
  />
)}
```

### WR-04: Accessibility - SegmentedProgressBar Only Reports First Segment Value

**File:** `packages/ui/src/components/segmented-progress-bar.tsx:99-102`
**Issue:** The progressbar role only reports `aria-valuenow` for the first segment, which doesn't accurately represent a multi-segment progress bar to screen reader users.
**Fix:**
```tsx
// Consider using aria-label or aria-describedby to describe all segments
<div
  className={cn(...)}
  role="progressbar"
  aria-label={`Progress: ${computedSegments.map(s => `${s.label} ${Math.round(s.percentage)}%`).join(', ')}`}
  aria-valuemin={0}
  aria-valuemax={100}
>
```

### WR-05: FocusTrap Does Not Handle Dynamic Content

**File:** `packages/ui/src/components/focus-trap.tsx:80-81`
**Issue:** The focusable elements query runs only during keyboard events. If content inside the trap changes dynamically (e.g., buttons becoming disabled), the trap may not handle edge cases correctly.
**Fix:**
```tsx
// Consider caching focusable elements in a useRef that updates on children change
// Or use MutationObserver to track DOM changes within the trap
// For now, the implementation works for static content but document the limitation
```

## Info

### IN-01: Missing displayName on Several Components

**File:** Multiple component files
**Issue:** Several components are missing the `displayName` property, which aids debugging in React DevTools:
- `packages/ui/src/components/step-indicator.tsx`
- `packages/ui/src/components/today-feed-item.tsx`
- `packages/ui/src/components/pipeline-stage-card.tsx`
**Fix:** Add `ComponentName.displayName = "ComponentName";` at the end of each component file.

### IN-02: Console-Free Codebase (Good Practice)

**File:** All reviewed files
**Issue:** No `console.log`, `debugger`, or development artifacts found. This is noted as positive - the codebase follows production-ready practices.

### IN-03: Inconsistent CSS Variable Syntax

**File:** `packages/ui/src/components/metric-card.tsx:174`
**Issue:** Uses `font-[tabular-nums]` instead of the pattern used elsewhere: `[font-variant-numeric:tabular-nums_lining-nums]`. While both work, consistency would be better.
**Fix:** Standardize on `[font-variant-numeric:tabular-nums_lining-nums]` throughout.

### IN-04: Token CSS and TS Files Should Stay Synchronized

**File:** `packages/ui/src/lib/tokens.ts` and `packages/ui/src/lib/tokens.css`
**Issue:** The TypeScript tokens export mirrors the CSS custom properties. Any future changes to one file must be reflected in the other. Consider a build-time sync mechanism or single source of truth.

### IN-05: Empty Interface in InputProps

**File:** `packages/ui/src/components/input.tsx:5-6`
**Issue:** The `InputProps` interface extends `React.InputHTMLAttributes<HTMLInputElement>` but adds nothing:
```tsx
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}
```
**Fix:** This is acceptable for future extensibility, but consider adding a comment explaining the pattern.

### IN-06: Storybook Configuration References Non-Existent Directory

**File:** `packages/ui/.storybook/main.ts:16`
**Issue:** The `staticDirs` config points to `../public` which may not exist:
```typescript
staticDirs: ['../public'],
```
**Fix:** Ensure the `packages/ui/public` directory exists or remove this config line.

### IN-07: Test Files Use Good Patterns

**File:** `packages/ui/src/__tests__/*.tsx`
**Issue:** Test files use proper mocking with vitest, fake timers for time-dependent tests, and userEvent for realistic interaction testing. Good coverage of edge cases (invalid dates, boundary values). This is noted as positive.

### IN-08: Hardcoded Locale in Date Formatting

**File:** `packages/ui/src/lib/format-time.ts:59`
**Issue:** The `formatShortDate` function hardcodes `"en-US"` locale:
```typescript
return d.toLocaleDateString("en-US", { ... });
```
**Fix:** Consider accepting locale as an optional parameter or using `undefined` to use the user's browser locale:
```typescript
export function formatShortDate(date: Date | string | number, locale?: string): string {
  // ...
  return d.toLocaleDateString(locale ?? "en-US", { ... });
}
```

### IN-09: CSS Custom Properties Correctly Scoped

**File:** `apps/web/src/app/globals.css`
**Issue:** The Tailwind v4 `@theme inline` block correctly maps v6 design tokens to Tailwind utilities. Skeleton animation keyframes and reduced motion preferences are properly handled. This is noted as positive implementation.

---

_Reviewed: 2026-04-30T12:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

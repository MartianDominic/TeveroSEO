---
phase: 57-proposal-editor-revolution
plan: 03
subsystem: proposal-editor
tags: [tiptap, rich-text, variable-chips, wysiwyg, drag-drop]
dependency_graph:
  requires:
    - proposal_templates_schema
    - VariableResolutionService
    - VariablePalette-component
  provides:
    - ProposalInlineEditor-component
    - VariableExtension-tiptap
    - VariableChip-component
    - useVariableValue-hook
    - VariableProvider-context
  affects:
    - proposal-editing
    - template-rendering
tech_stack:
  added:
    - "@tiptap/react@3.22.5"
    - "@tiptap/starter-kit@3.22.5"
    - "@tiptap/core@3.22.5"
    - "@tiptap/pm@3.22.5"
    - "@tiptap/extension-placeholder@3.22.5"
    - "@tiptap/extension-typography@3.22.5"
    - "@tiptap/extension-link@3.22.5"
    - "@tiptap/extension-highlight@3.22.5"
    - "@radix-ui/react-tooltip"
    - "@radix-ui/react-collapsible"
    - "@radix-ui/react-scroll-area"
    - "@radix-ui/react-toggle-group"
  patterns:
    - tiptap-custom-node
    - react-node-view
    - variable-context-provider
    - category-color-system
key_files:
  created:
    - apps/web/src/components/proposals/ProposalInlineEditor.tsx
    - apps/web/src/components/proposals/extensions/VariableExtension.ts
    - apps/web/src/components/proposals/VariableChip.tsx
    - apps/web/src/hooks/useVariableValue.tsx
    - apps/web/src/components/ui/tooltip.tsx
    - apps/web/src/components/ui/collapsible.tsx
    - apps/web/src/components/ui/scroll-area.tsx
    - apps/web/src/components/ui/toggle-group.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/i18n/messages/en.json
    - apps/web/src/i18n/messages/lt.json
decisions:
  - "TipTap with StarterKit as rich text foundation - extensible, ProseMirror-based"
  - "Variable nodes as inline atoms - cannot be split or partially selected"
  - "Category colors match VariablePalette (client=blue, provider=green, pricing=orange, audit=purple, dates=gray, custom=teal)"
  - "Red dashed border for unresolved variables - visual feedback for missing data"
  - "VariableProvider fetches all variables in single request - avoids N+1 queries"
  - "Character count excludes variable markup - accurate content length measurement"
metrics:
  duration: 663s
  tasks_completed: 5
  files_created: 12
  files_modified: 4
  completed_at: "2026-05-02T10:41:05Z"
---

# Phase 57 Plan 03: Rich Text Inline Editing with TipTap Summary

TipTap-based WYSIWYG editor with variable chip rendering, drop target support, and character counting.

## One-Liner

ProposalInlineEditor with TipTap, VariableExtension for {{variable}} atom nodes, category-colored chips with resolved value tooltips, and drag-from-palette support.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TipTap Setup | 44260d1 | ProposalInlineEditor.tsx, package.json |
| 2 | VariableExtension | 5d79e54 | VariableExtension.ts |
| 3 | VariableChip Component | f9ee03f | VariableChip.tsx, tooltip.tsx |
| 4 | useVariableValue Hook | 3dd21af | useVariableValue.tsx |
| 5 | Character Count i18n | 24329b1 | en.json, lt.json |
| - | UI Components | ea70569 | collapsible.tsx, scroll-area.tsx, toggle-group.tsx, etc. |
| - | Lock File | b5fa70d | pnpm-lock.yaml |

## Implementation Details

### ProposalInlineEditor Component

TipTap editor with comprehensive extension stack:
- **StarterKit**: Bold, italic, headings, lists, blockquotes
- **Placeholder**: Localized empty state (EN/LT)
- **Typography**: Smart quotes, em dashes, ellipsis
- **Link**: Clickable hyperlinks with styling
- **Highlight**: Yellow background for emphasis
- **VariableExtension**: Custom inline atom nodes

Drop target implementation:
- Handles `application/x-variable` data transfer from palette
- Inserts variable node at drop position via ProseMirror transaction
- Shows copy cursor during dragover

### VariableExtension

Custom TipTap Node for {{variable}} placeholders:
- **Inline atom**: Cannot be split, selected partially, or edited directly
- **Attributes**: key, category, label stored as data attributes
- **Parse rules**: Recognizes `span[data-variable]` and `.variable-chip`
- **Render**: Outputs `<span data-variable="key">{{key}}</span>`
- **Commands**: `insertVariable(attrs)` for programmatic insertion
- **Keyboard**: Backspace/Delete remove entire node

### VariableChip Component

React NodeView for visual variable rendering:
- Category background colors (blue/green/orange/purple/gray/teal)
- Tooltip showing resolved value or "Value not available"
- Red dashed border when `isResolved === false`
- Selected state with ring styling
- Standalone `VariableChipDisplay` for use outside TipTap

### useVariableValue Hook

Context-based variable resolution:
- `VariableContext` holds Map of resolved variables
- `useVariableValue(key)` returns `{ value, isResolved, isLoading }`
- `VariableProvider` fetches all variables in single API call
- Supports manual value setting and refetch
- `createVariableMap` helper for initialization

### Character Count

Real-time character counting:
- Uses `editor.getText()` for safe text extraction
- Excludes `{{variable}}` markup from count
- Includes word count for content metrics
- Localized label (EN: "chars", LT: "simb.")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] UI Components Missing**
- **Found during:** Task 3
- **Issue:** VariablePalette.tsx (from 57-02) imports from `@/components/ui/*` but files don't exist
- **Fix:** Created re-export files for badge, button, card, input, skeleton + new Radix components for tooltip, collapsible, scroll-area, toggle-group
- **Files modified:** 8 new UI component files
- **Commit:** ea70569

## Verification

```bash
# TypeScript compiles without errors for new files
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -E "(ProposalInlineEditor|VariableExtension|VariableChip|useVariableValue)"
# No output (no errors)

# JSON i18n files are valid
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/i18n/messages/en.json'))"
node -e "JSON.parse(require('fs').readFileSync('apps/web/src/i18n/messages/lt.json'))"
# Both succeed
```

## Self-Check: PASSED

All files created and committed successfully:
- [x] ProposalInlineEditor.tsx exists
- [x] VariableExtension.ts exists
- [x] VariableChip.tsx exists
- [x] useVariableValue.tsx exists
- [x] UI component files exist (8 files)
- [x] i18n files updated
- [x] All commits recorded (7 commits)

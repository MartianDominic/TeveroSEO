---
phase: 57-proposal-editor-revolution
plan: 04
subsystem: proposal-editor
tags: [dnd-kit, drag-drop, sortable, sections, reorder, accessibility]
dependency_graph:
  requires:
    - ProposalInlineEditor-component
    - VariableExtension-tiptap
  provides:
    - SectionList-component
    - SortableSection-component
    - SectionHandle-component
    - useSectionOrder-hook
    - EditorSection-type
  affects:
    - proposal-editing
    - section-reordering
tech_stack:
  added: []
  patterns:
    - dnd-kit-sortable
    - useSortable-hook
    - debounced-persistence
    - optimistic-updates
key_files:
  created:
    - apps/web/src/components/proposals/SectionList.tsx
    - apps/web/src/components/proposals/SortableSection.tsx
    - apps/web/src/components/proposals/SectionHandle.tsx
    - apps/web/src/components/proposals/useSectionOrder.ts
    - apps/web/src/components/proposals/types.ts
    - apps/web/src/components/proposals/index.ts
  modified:
    - apps/web/src/i18n/messages/en.json
    - apps/web/src/i18n/messages/lt.json
decisions:
  - "@dnd-kit already installed in package.json (v6.3.1 core, v10.0.0 sortable)"
  - "Use older @dnd-kit/sortable API with attributes/listeners for consistency with existing codebase patterns"
  - "SectionHandle receives attributes/listeners from parent to enable handle-only dragging"
  - "useSectionOrder hook provides debounced persistence with optimistic updates"
  - "DragOverlay renders section preview with slight rotation for visual feedback"
metrics:
  duration: 385s
  tasks_completed: 5
  files_created: 6
  files_modified: 2
  completed_at: "2026-05-02T10:53:03Z"
---

# Phase 57 Plan 04: Drag-and-Drop Sections (@dnd-kit) Summary

Drag-and-drop section reordering for proposal editor with @dnd-kit sortable integration and keyboard accessibility.

## One-Liner

SectionList with DndContext, SortableSection wrappers, drag handle with GripVertical icon, CSS transforms for smooth animation, and useSectionOrder hook for debounced persistence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DndContext Setup | b6d6ed4 | SectionList.tsx, types.ts |
| 2 | SortableSection | fa5643e | SortableSection.tsx |
| 3 | Drag Handle | 57b8115 | SectionHandle.tsx |
| 4 | Animation + i18n | 7e742b5 | en.json, lt.json |
| 5 | Persist Order | 69436c1 | useSectionOrder.ts, index.ts |

## Implementation Details

### SectionList Component

DndContext-wrapped sortable container:
- **Sensors**: PointerSensor (8px activation distance) + KeyboardSensor with sortableKeyboardCoordinates
- **Collision**: closestCenter algorithm for vertical reordering
- **Strategy**: verticalListSortingStrategy for optimal performance
- **DragOverlay**: Renders preview of dragged section with slight rotation effect

### SortableSection Component

Individual sortable section wrapper:
- **useSortable hook**: Provides attributes, listeners, setNodeRef, transform, transition, isDragging
- **CSS Transform**: Uses @dnd-kit/utilities CSS.Transform.toString() for smooth animations
- **Visual feedback**: Shadow on drag, opacity reduction for source item, ring for active state
- **Section header**: Displays title, required badge, drag handle, delete action

### SectionHandle Component

Accessible drag handle:
- **Icon**: GripVertical from lucide-react for clear visual affordance
- **Cursor states**: grab on hover, grabbing when active
- **Focus ring**: Keyboard-accessible with focus:ring-2 styling
- **Visibility**: 50% opacity, full on parent hover (group-hover)
- **ARIA**: aria-label for screen reader support

### useSectionOrder Hook

Debounced persistence layer:
- **Optimistic updates**: UI updates immediately, save debounced by 1000ms (configurable)
- **Save status**: idle -> saving -> saved/error state machine
- **Error handling**: Captures error message, calls onError callback
- **Dirty tracking**: isDirty flag for unsaved changes warning
- **Flush on unmount**: Ensures pending saves complete on component unmount

### Types

```typescript
interface EditorSection {
  id: string;
  key: string;
  title: string;
  content: string;
  sectionType: TemplateSectionType;
  isRequired?: boolean;
  isEditable?: boolean;
  position?: number;
}
```

### i18n Keys Added

| Key | EN | LT |
|-----|----|----|
| sections.dragHandle | Drag handle | Vilkimo rankenele |
| sections.dragInstructions | Press Space or Enter... | Paspauskite tarpa... |
| sections.sectionMoved | Section moved to position {position} | Sekcija perkelta i pozicija {position} |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

```bash
# TypeScript compiles without errors
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -E "(SectionList|SortableSection|SectionHandle)"
# No output (no errors)

# Files exist and are committed
git log --oneline -5 | grep "57-04"
# 5 commits for plan 57-04
```

## Self-Check: PASSED

All files created and committed successfully:
- [x] SectionList.tsx exists with DndContext
- [x] SortableSection.tsx exists with useSortable
- [x] SectionHandle.tsx exists with GripVertical
- [x] useSectionOrder.ts exists with debounced save
- [x] types.ts exists with EditorSection
- [x] index.ts barrel file exports all components
- [x] i18n files updated with accessibility keys
- [x] All commits recorded (5 commits)

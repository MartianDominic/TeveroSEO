# 3-Layer Store Architecture Refactor

> Phase 102 Remediation: Converting flat `blocks[]` store to proper `Structure/Content/Context` layers

**Status:** Implementation Guide  
**Priority:** HIGH (critical architectural gap)  
**Estimated Effort:** 3-4 days  
**Risk Level:** HIGH (touches all document builder components)

---

## Problem Statement

### Current Implementation (documentBuilderStore.ts)

```typescript
interface DocumentBuilderState {
  blocks: PersuasionBlock[];        // FLAT - mixes structure + content
  selectedBlockId: string | null;
  frameworkId: string | null;
  frameworkName: string | null;
  proposalId: string | null;
}
```

### Target Implementation (types.ts - unused)

```typescript
interface DocumentState {
  structure: StructureLayer;  // Block order, framework, validation
  content: ContentLayer;      // TipTap JSON, styling, version
  context: ContextLayer;      // Prospect info, style refs, previous wins
}
```

### Why This Matters

| Capability | Current | With 3 Layers |
|------------|---------|---------------|
| **Reusable structures** | Cannot separate structure from content | Apply same framework to different prospects |
| **Content versioning** | Mixed with position changes | Independent version history per layer |
| **AI context injection** | Manual prop drilling | ContextLayer automatically available |
| **Template modes** | `fixed/variable/regenerate` unused | Mode governs content generation |
| **Prospect switching** | Full rebuild required | Swap ContextLayer, keep Structure |

---

## Migration Strategy

### Phase 1: Parallel Store (Days 1-2)

Create new `useLayeredDocumentStore` alongside existing store. Both stores coexist - no breaking changes.

```
documentBuilderStore.ts       # Legacy (unchanged)
layeredDocumentStore.ts       # New 3-layer implementation
```

### Phase 2: Adapter Layer (Day 2)

Create `useDocumentAdapter()` hook that:
1. Reads from layered store
2. Returns `PersuasionBlock[]` for backward compatibility
3. Components continue working unchanged

### Phase 3: Component Migration (Days 2-3)

Migrate components one-by-one to use layer-specific selectors:
- Canvas/blocks → `useStructure()` + `useContent()`
- AI generation → `useContext()`
- Framework → `useStructure()`

### Phase 4: Deprecate Legacy (Day 4)

1. Remove `useDocumentBuilderStore` calls
2. Delete old store file
3. Rename `useLayeredDocumentStore` → `useDocumentStore`

---

## New Store Interface

### File: `apps/web/src/stores/layeredDocumentStore.ts`

```typescript
"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type {
  StructureLayer,
  StructureBlockRef,
  ContentLayer,
  ContentBlock,
  ContextLayer,
  ProspectContext,
  StyleReference,
  PreviousSuccess,
  PersuasionBlockType,
  TipTapContent,
  BlockStyling,
  FrameworkValidation,
} from "@/lib/document-builder/types";

// ---------------------------------------------------------------------------
// State Types
// ---------------------------------------------------------------------------

interface LayeredDocumentState {
  // === THE 3 LAYERS ===
  structure: StructureLayer;
  content: ContentLayer;
  context: ContextLayer;
  
  // === UI STATE (ephemeral, not persisted) ===
  selectedBlockId: string | null;
  proposalId: string | null;
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Action Types (grouped by layer)
// ---------------------------------------------------------------------------

interface StructureActions {
  /** Add block reference to structure */
  addBlockRef: (type: PersuasionBlockType, position?: number) => string;
  /** Remove block reference */
  removeBlockRef: (id: string) => void;
  /** Reorder blocks */
  moveBlockRef: (fromIndex: number, toIndex: number) => void;
  /** Set framework */
  setFramework: (id: string | null, name?: string | null) => void;
  /** Set validation result */
  setValidation: (validation: FrameworkValidation) => void;
  /** Initialize structure from template */
  initializeStructure: (blocks: StructureBlockRef[], frameworkId?: string, frameworkName?: string) => void;
}

interface ContentActions {
  /** Update block content */
  updateContent: (blockId: string, content: TipTapContent) => void;
  /** Update block styling */
  updateStyling: (blockId: string, styling: Partial<BlockStyling>) => void;
  /** Bulk update content blocks */
  setContentBlocks: (blocks: ContentBlock[]) => void;
  /** Increment content version */
  bumpVersion: () => void;
}

interface ContextActions {
  /** Set prospect context */
  setProspect: (prospect: ProspectContext) => void;
  /** Add style reference */
  addStyleReference: (ref: StyleReference) => void;
  /** Remove style reference */
  removeStyleReference: (id: string) => void;
  /** Set previous successes */
  setPreviousSuccesses: (successes: PreviousSuccess[]) => void;
  /** Clear all context */
  clearContext: () => void;
}

interface UIActions {
  /** Select block */
  selectBlock: (id: string | null) => void;
  /** Set proposal ID */
  setProposalId: (id: string | null) => void;
  /** Mark as dirty */
  markDirty: () => void;
  /** Mark as clean */
  markClean: () => void;
  /** Full reset */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Combined Types
// ---------------------------------------------------------------------------

type LayeredDocumentActions = 
  & StructureActions 
  & ContentActions 
  & ContextActions 
  & UIActions;

type LayeredDocumentStore = LayeredDocumentState & LayeredDocumentActions;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialStructure: StructureLayer = {
  blocks: [],
  frameworkId: undefined,
  frameworkName: undefined,
  validation: undefined,
};

const initialContent: ContentLayer = {
  blocks: [],
  version: 1,
  lastModified: new Date().toISOString(),
};

const initialContext: ContextLayer = {
  prospect: { id: "" },
  styleReferences: [],
  previousSuccesses: [],
};

const initialState: LayeredDocumentState = {
  structure: initialStructure,
  content: initialContent,
  context: initialContext,
  selectedBlockId: null,
  proposalId: null,
  isDirty: false,
};

// ---------------------------------------------------------------------------
// Store Implementation
// ---------------------------------------------------------------------------

export const useLayeredDocumentStore = create<LayeredDocumentStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ===============================
        // STRUCTURE ACTIONS
        // ===============================

        addBlockRef: (type, position) => {
          const id = nanoid();
          const insertPos = position ?? get().structure.blocks.length;

          set((state) => {
            // Insert block ref at position
            const newRef: StructureBlockRef = { id, type, position: insertPos };
            state.structure.blocks.splice(insertPos, 0, newRef);
            
            // Re-index positions
            state.structure.blocks.forEach((block, idx) => {
              block.position = idx;
            });

            // Create empty content block
            state.content.blocks.push({
              id,
              content: { type: "doc", content: [] },
              styling: undefined,
            });

            state.content.lastModified = new Date().toISOString();
            state.isDirty = true;
          });

          return id;
        },

        removeBlockRef: (id) => {
          set((state) => {
            // Remove from structure
            state.structure.blocks = state.structure.blocks.filter(b => b.id !== id);
            
            // Re-index positions
            state.structure.blocks.forEach((block, idx) => {
              block.position = idx;
            });

            // Remove from content
            state.content.blocks = state.content.blocks.filter(b => b.id !== id);
            state.content.lastModified = new Date().toISOString();

            // Clear selection if removed
            if (state.selectedBlockId === id) {
              state.selectedBlockId = null;
            }

            state.isDirty = true;
          });
        },

        moveBlockRef: (fromIndex, toIndex) => {
          set((state) => {
            const blocks = state.structure.blocks;
            if (
              fromIndex < 0 || fromIndex >= blocks.length ||
              toIndex < 0 || toIndex >= blocks.length ||
              fromIndex === toIndex
            ) {
              return;
            }

            const [moved] = blocks.splice(fromIndex, 1);
            blocks.splice(toIndex, 0, moved);

            // Re-index positions
            blocks.forEach((block, idx) => {
              block.position = idx;
            });

            state.isDirty = true;
          });
        },

        setFramework: (id, name) => {
          set((state) => {
            state.structure.frameworkId = id ?? undefined;
            state.structure.frameworkName = name ?? undefined;
            state.isDirty = true;
          });
        },

        setValidation: (validation) => {
          set((state) => {
            state.structure.validation = validation;
          });
        },

        initializeStructure: (blocks, frameworkId, frameworkName) => {
          set((state) => {
            state.structure.blocks = blocks.map((b, idx) => ({ ...b, position: idx }));
            state.structure.frameworkId = frameworkId;
            state.structure.frameworkName = frameworkName;
            
            // Create empty content blocks for each structure ref
            state.content.blocks = blocks.map(b => ({
              id: b.id,
              content: { type: "doc", content: [] },
              styling: undefined,
            }));
            state.content.version = 1;
            state.content.lastModified = new Date().toISOString();

            state.selectedBlockId = null;
            state.isDirty = true;
          });
        },

        // ===============================
        // CONTENT ACTIONS
        // ===============================

        updateContent: (blockId, content) => {
          set((state) => {
            const block = state.content.blocks.find(b => b.id === blockId);
            if (block) {
              block.content = content;
              state.content.lastModified = new Date().toISOString();
              state.isDirty = true;
            }
          });
        },

        updateStyling: (blockId, styling) => {
          set((state) => {
            const block = state.content.blocks.find(b => b.id === blockId);
            if (block) {
              block.styling = { ...block.styling, ...styling };
              state.content.lastModified = new Date().toISOString();
              state.isDirty = true;
            }
          });
        },

        setContentBlocks: (blocks) => {
          set((state) => {
            state.content.blocks = blocks;
            state.content.lastModified = new Date().toISOString();
            state.isDirty = true;
          });
        },

        bumpVersion: () => {
          set((state) => {
            state.content.version += 1;
            state.content.lastModified = new Date().toISOString();
          });
        },

        // ===============================
        // CONTEXT ACTIONS
        // ===============================

        setProspect: (prospect) => {
          set((state) => {
            state.context.prospect = prospect;
            state.isDirty = true;
          });
        },

        addStyleReference: (ref) => {
          set((state) => {
            state.context.styleReferences = [
              ...(state.context.styleReferences ?? []),
              ref,
            ];
            state.isDirty = true;
          });
        },

        removeStyleReference: (id) => {
          set((state) => {
            state.context.styleReferences = state.context.styleReferences?.filter(
              r => r.id !== id
            );
            state.isDirty = true;
          });
        },

        setPreviousSuccesses: (successes) => {
          set((state) => {
            state.context.previousSuccesses = successes;
          });
        },

        clearContext: () => {
          set((state) => {
            state.context = initialContext;
            state.isDirty = true;
          });
        },

        // ===============================
        // UI ACTIONS
        // ===============================

        selectBlock: (id) => {
          set((state) => {
            state.selectedBlockId = id;
          });
        },

        setProposalId: (id) => {
          set((state) => {
            state.proposalId = id;
          });
        },

        markDirty: () => {
          set((state) => {
            state.isDirty = true;
          });
        },

        markClean: () => {
          set((state) => {
            state.isDirty = false;
          });
        },

        reset: () => {
          set(initialState);
        },
      })),
      {
        name: "document-builder-v2",
        partialize: (state) => ({
          structure: state.structure,
          content: state.content,
          context: state.context,
          proposalId: state.proposalId,
        }),
      }
    )
  )
);

export default useLayeredDocumentStore;
```

---

## Selector Patterns

### File: `apps/web/src/stores/documentSelectors.ts`

```typescript
import { useShallow } from "zustand/react/shallow";
import { useLayeredDocumentStore } from "./layeredDocumentStore";
import type { PersuasionBlock } from "@/lib/document-builder/types";

// ---------------------------------------------------------------------------
// Layer-Specific Selectors
// ---------------------------------------------------------------------------

/** Select entire structure layer */
export const useStructure = () => 
  useLayeredDocumentStore(useShallow((s) => s.structure));

/** Select entire content layer */
export const useContent = () => 
  useLayeredDocumentStore(useShallow((s) => s.content));

/** Select entire context layer */
export const useContext = () => 
  useLayeredDocumentStore(useShallow((s) => s.context));

// ---------------------------------------------------------------------------
// Granular Selectors
// ---------------------------------------------------------------------------

/** Get block IDs in order */
export const useBlockIds = () =>
  useLayeredDocumentStore((s) => s.structure.blocks.map((b) => b.id));

/** Get selected block ID */
export const useSelectedBlockId = () =>
  useLayeredDocumentStore((s) => s.selectedBlockId);

/** Get framework info */
export const useFramework = () =>
  useLayeredDocumentStore(
    useShallow((s) => ({
      id: s.structure.frameworkId,
      name: s.structure.frameworkName,
      validation: s.structure.validation,
    }))
  );

/** Get prospect context */
export const useProspect = () =>
  useLayeredDocumentStore((s) => s.context.prospect);

/** Get dirty state */
export const useIsDirty = () =>
  useLayeredDocumentStore((s) => s.isDirty);

// ---------------------------------------------------------------------------
// Computed Selectors
// ---------------------------------------------------------------------------

/** Get content for specific block */
export const useBlockContent = (blockId: string) =>
  useLayeredDocumentStore((s) => 
    s.content.blocks.find((b) => b.id === blockId)?.content
  );

/** Get styling for specific block */
export const useBlockStyling = (blockId: string) =>
  useLayeredDocumentStore((s) => 
    s.content.blocks.find((b) => b.id === blockId)?.styling
  );

/** Get block type from structure */
export const useBlockType = (blockId: string) =>
  useLayeredDocumentStore((s) => 
    s.structure.blocks.find((b) => b.id === blockId)?.type
  );

// ---------------------------------------------------------------------------
// Backward Compatibility Adapter
// ---------------------------------------------------------------------------

/**
 * ADAPTER: Returns flat PersuasionBlock[] for legacy components.
 * Use this during migration, then remove.
 */
export const useFlatBlocks = (): PersuasionBlock[] => {
  const structure = useLayeredDocumentStore((s) => s.structure);
  const content = useLayeredDocumentStore((s) => s.content);

  // Merge structure + content into flat blocks
  return structure.blocks.map((ref) => {
    const contentBlock = content.blocks.find((c) => c.id === ref.id);
    return {
      id: ref.id,
      type: ref.type,
      position: ref.position,
      content: contentBlock?.content,
      title: ref.type, // Would need metadata lookup
      styling: contentBlock?.styling,
      persuasionMeta: {
        frameworkId: structure.frameworkId,
      },
      createdAt: content.lastModified,
      updatedAt: content.lastModified,
    };
  });
};

/**
 * ADAPTER: Actions that match old store interface.
 */
export const useLegacyActions = () => {
  const store = useLayeredDocumentStore();
  
  return {
    addBlock: store.addBlockRef,
    removeBlock: store.removeBlockRef,
    moveBlock: store.moveBlockRef,
    updateBlockContent: store.updateContent,
    updateBlockStyling: store.updateStyling,
    selectBlock: store.selectBlock,
    setFramework: store.setFramework,
    setProposalId: store.setProposalId,
    reset: store.reset,
  };
};
```

---

## Component Migration Checklist

### Priority 1: Canvas (use adapter first)

| Component | Current Usage | Migration Path |
|-----------|---------------|----------------|
| `DocumentCanvas.tsx` | `blocks`, `selectBlock`, `moveBlock` | Use `useFlatBlocks()` + `useLegacyActions()` initially |
| `PersuasionBlock.tsx` | Block rendering | Use `useBlockContent(id)`, `useBlockType(id)` |
| `DropZone.tsx` | Position for drop | No store usage - unchanged |

### Priority 2: Editor & Content

| Component | Current Usage | Migration Path |
|-----------|---------------|----------------|
| `BlockEditor.tsx` | `updateBlockContent`, `blocks` (for context) | `useBlockContent(id)`, `store.updateContent()` |
| `VariantCreator.tsx` | Block content | `useBlockContent(id)` |
| `VersionDiff.tsx` | Content comparison | Pass content as props |

### Priority 3: Framework & Structure

| Component | Current Usage | Migration Path |
|-----------|---------------|----------------|
| `FrameworkSelector.tsx` | `setFramework`, `initialize` | `store.setFramework()`, `store.initializeStructure()` |
| `BlockPalette.tsx` | `addBlock`, `setFramework`, `initialize` | `store.addBlockRef()`, keep framework logic |

### Priority 4: Context-Aware

| Component | Current Usage | Migration Path |
|-----------|---------------|----------------|
| AI generation API | Manual prop drilling | `useContext()` provides prospect/style refs |
| Variable picker | No context | `useProspect()` for variable values |

---

## Persistence Strategy

### What to Persist

```typescript
partialize: (state) => ({
  structure: state.structure,      // Block order, framework
  content: state.content,          // TipTap JSON, styling, version
  context: state.context,          // Prospect, style refs
  proposalId: state.proposalId,    // Link to saved proposal
})
```

### What NOT to Persist

- `selectedBlockId` - ephemeral UI state
- `isDirty` - computed from changes
- Validation results - recomputed on load

### Storage Key Migration

```typescript
// Old key (will be removed after migration)
"document-builder-draft"

// New key
"document-builder-v2"
```

### Hydration Strategy

1. On mount, check for `document-builder-v2` in localStorage
2. If missing but `document-builder-draft` exists, run migration
3. Migration: convert flat `blocks[]` to 3-layer structure
4. Delete old key after successful migration

```typescript
// Migration function
function migrateFromLegacyStore(legacyState: LegacyState): LayeredDocumentState {
  const blocks = legacyState.blocks ?? [];
  
  return {
    structure: {
      blocks: blocks.map((b, idx) => ({
        id: b.id,
        type: b.type,
        position: idx,
      })),
      frameworkId: legacyState.frameworkId ?? undefined,
      frameworkName: legacyState.frameworkName ?? undefined,
    },
    content: {
      blocks: blocks.map((b) => ({
        id: b.id,
        content: b.content ?? { type: "doc", content: [] },
        styling: b.styling,
      })),
      version: 1,
      lastModified: new Date().toISOString(),
    },
    context: {
      prospect: { id: "" },
      styleReferences: [],
      previousSuccesses: [],
    },
    selectedBlockId: null,
    proposalId: legacyState.proposalId ?? null,
    isDirty: false,
  };
}
```

---

## Risk Mitigation

### 1. Feature Flag Rollout

```typescript
// In app config or env
const USE_LAYERED_STORE = process.env.NEXT_PUBLIC_USE_LAYERED_STORE === "true";

// In components
const store = USE_LAYERED_STORE 
  ? useLayeredDocumentStore() 
  : useDocumentBuilderStore();
```

### 2. Dual-Write During Migration

Both stores write simultaneously, read from new:

```typescript
const addBlock = (type: PersuasionBlockType) => {
  const id = layeredStore.addBlockRef(type);
  legacyStore.addBlock(type); // Shadow write for rollback
  return id;
};
```

### 3. Validation Before Deploy

- [ ] All 11 block types can be added/removed
- [ ] Drag-drop reordering works
- [ ] Framework selection initializes correctly
- [ ] Content edits persist
- [ ] LocalStorage migration succeeds
- [ ] Page refresh preserves state
- [ ] Empty canvas shows empty state

### 4. Rollback Plan

If issues found post-deploy:

1. Set `USE_LAYERED_STORE=false`
2. Legacy store still contains shadow writes
3. Delete `document-builder-v2` from localStorage
4. Users continue with legacy store

### 5. Testing Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit tests for store actions | 100% action coverage |
| Integration tests for selectors | All selectors return correct data |
| E2E: block CRUD | Add, edit, delete, reorder |
| E2E: framework selection | Load template, validate blocks |
| Migration test | Legacy → new format |

---

## Implementation Order

```
Day 1 (AM):
  [x] Create layeredDocumentStore.ts with full implementation
  [x] Create documentSelectors.ts with adapters

Day 1 (PM):
  [ ] Add migration logic for localStorage
  [ ] Create feature flag

Day 2 (AM):
  [ ] Migrate DocumentCanvas using adapters
  [ ] Migrate BlockEditor

Day 2 (PM):
  [ ] Migrate BlockPalette
  [ ] Migrate FrameworkSelector

Day 3:
  [ ] Unit tests for new store
  [ ] Integration tests for selectors
  [ ] E2E tests for critical flows

Day 4:
  [ ] Remove adapters, use layer-specific selectors
  [ ] Remove legacy store
  [ ] Remove feature flag
```

---

## Success Criteria

1. **Structure reusability**: Same framework can be applied to different prospects without content loss
2. **Context injection**: AI generation automatically receives prospect info from ContextLayer
3. **Version tracking**: ContentLayer.version increments on saves
4. **Zero data loss**: Migration preserves all existing drafts
5. **Performance**: No perceptible latency change in UI interactions

---

*Document created: 2026-05-18*  
*Author: Claude Code Agent*

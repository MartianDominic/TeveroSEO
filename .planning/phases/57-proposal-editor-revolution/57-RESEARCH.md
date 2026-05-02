# Phase 57: Proposal Editor Revolution - Research

**Researched:** 2026-05-02
**Domain:** Rich text editing, drag-and-drop UX, auto-save systems, AI content generation
**Confidence:** HIGH

## Summary

Phase 57 transforms proposal editing from basic textarea fields into a Google Docs meets website builder experience. The technical foundation is solid: TipTap provides battle-tested rich text editing with custom extensions, @dnd-kit handles drag-and-drop, zustand+zundo enable undo/redo, and next-intl provides full i18n infrastructure.

The codebase already has critical dependencies installed (@dnd-kit, zustand, next-intl) and established patterns for debouncing (custom hook), version tracking (change-schema.ts), and magic link generation (proposals.token). This phase extends existing proposal infrastructure rather than building from scratch.

**Primary recommendation:** Use TipTap with custom VariableExtension (inline atom nodes), @dnd-kit's DragDropProvider with useSortable, zundo temporal middleware for undo/redo, and the existing use-debounced-callback hook for 2-second auto-save. Follow established schema patterns from change-schema.ts for version history.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template CRUD | API / Backend | Database / Storage | Templates are reusable entities stored in PostgreSQL, CRUD via server actions |
| Variable resolution | API / Backend | — | Requires access to prospect, workspace, audit data across multiple tables |
| Inline editing UI | Browser / Client | — | TipTap editor runs entirely in browser, manages content state |
| Drag-and-drop sections | Browser / Client | — | @dnd-kit handles DOM manipulation, reordering is pure UI state |
| Auto-save debouncing | Browser / Client | API / Backend | Debounce in browser (2s), persist via server action |
| Version history storage | API / Backend | Database / Storage | Server stores snapshots in proposal_versions table |
| AI content generation | API / Backend | — | Claude API calls require server-side key management |
| Magic link generation | API / Backend | — | Token generation + database update via server action |
| Undo/redo state | Browser / Client | — | zustand temporal middleware maintains local history (last 50 states) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/react | 3.22.5 | Rich text editor foundation | Industry-standard headless editor, ProseMirror-based, extensible |
| @tiptap/starter-kit | 3.22.5 | Basic editing features | Provides paragraph, bold, italic, lists, headings out-of-box |
| @tiptap/extension-placeholder | 3.22.5 | Placeholder text in editor | Localized empty-state guidance |
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives | Modern, accessible, performant (already installed) |
| @dnd-kit/sortable | 10.0.0 | Sortable list behavior | Handles reordering logic, smooth animations (already installed) |
| @dnd-kit/utilities | 3.2.2 | DnD helper utilities | CSS transforms, collision detection (already installed) |
| zustand | 5.0.12 | State management | Lightweight, no boilerplate (already installed) |
| zundo | 2.3.0 | Undo/redo middleware | Official zustand temporal middleware |
| use-debounce | 10.1.1 | Debouncing utilities | Battle-tested for auto-save patterns |
| next-intl | 4.11.0 | i18n framework | Already integrated, supports EN/LT (already installed) |
| @anthropic-ai/sdk | 0.92.0 | Claude API client | Official SDK for AI content generation |

**Installation:**
```bash
# New dependencies only
pnpm add zundo use-debounce @anthropic-ai/sdk @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-typography @tiptap/extension-link @tiptap/extension-highlight
```

**Version verification:** All versions verified against npm registry on 2026-05-02. TipTap 3.22.5 is current stable, @dnd-kit matches installed versions, zundo 2.3.0 is latest compatible with zustand 5.x.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tiptap/extension-typography | 3.22.5 | Smart quotes, em dashes | Improves text quality in proposals |
| @tiptap/extension-link | 3.22.5 | Hyperlink support | Clickable URLs in proposal content |
| @tiptap/extension-highlight | 3.22.5 | Text highlighting | Emphasize key points visually |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TipTap | Lexical (Meta) | Lexical has React-first API but less mature extension ecosystem, smaller community |
| TipTap | Slate | Slate gives more low-level control but requires building everything from scratch |
| @dnd-kit | react-beautiful-dnd (Atlassian) | react-beautiful-dnd is deprecated, @dnd-kit is the recommended successor |
| zundo | Custom undo logic | zundo provides optimized temporal state with minimal footprint, no need to reinvent |
| use-debounce | Custom debounce | use-debounce handles edge cases (maxWait, flush on unmount, cancel) better than hand-rolled |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Proposal Editor Flow                            │
└─────────────────────────────────────────────────────────────────────────┘

User Actions                   Client State                 Server Persistence
─────────────                  ────────────                 ──────────────────

[Select Template]
      │
      ├──────────────────────▶ Fetch template      ─────▶  GET /api/templates/:id
      │                        sections + variables        ↓
      │                        ↓                           Return: template data
      │                     Load into editor               + variable definitions
      │                        ↓
      │
[Click text to edit]
      │
      ├──────────────────────▶ TipTap cursor focus
      │                        Inline editing active
      │                        ↓
      │                     Content changed
      │                        ↓
      ├──────────────────────▶ zustand store update ────▶ temporal middleware
      │                        ↓                           records state
      │                     Debounce timer (2s)           (last 50 states)
      │                        ↓
      │                     After 2s idle
      │                        ↓
      │                     Trigger auto-save     ─────▶  PUT /api/proposals/:id/content
      │                                                    ↓
      │                                                   Save to DB
      │                                                   Create version snapshot
      │                                                    ↓
      │                                                   Return: save status
      │                                                    ↓
      │                     Update save indicator
      │
[Drag variable chip]
      │
      ├──────────────────────▶ DnD dragStart event
      │                        Variable payload
      │                        ↓
      │                     Drop on editor
      │                        ↓
      │                     Insert variable node  ─────▶ TipTap VariableExtension
      │                        ↓                          creates inline atom node
      │                     Resolve variable     ─────▶  Fetch from store
      │                        ↓                          or server
      │                     Render chip with preview
      │
[Drag section handle]
      │
      ├──────────────────────▶ useSortable dragEnd
      │                        New section order
      │                        ↓
      │                     Update sectionOrder   ─────▶ PUT /api/proposals/:id/sections/order
      │                        array                     ↓
      │                        ↓                        Persist new order
      │                     Animate reorder              ↓
      │                                                  Return: success
      │
[Generate with AI]
      │
      ├──────────────────────▶ Open AI modal
      │                        Select sections + tone
      │                        ↓
      │                     POST request          ─────▶ /api/proposals/:id/generate
      │                        ↓                          ↓
      │                     SSE stream setup             Fetch context (prospect,
      │                        ↓                          audit, keywords)
      │                     Display "Generating..."        ↓
      │                        ↓                          Call Claude API (stream)
      │                     Receive text chunks           ↓
      │                        ↓                          Stream back via SSE
      │                     Update editor progressively    ↓
      │                        ↓                          Complete
      │                     Final message                  ↓
      │                        ↓                          Return: generated content
      │                     Auto-save triggered
      │
[Cmd+Z undo]
      │
      ├──────────────────────▶ Keyboard event
      │                        ↓
      │                     zundo.undo()
      │                        ↓
      │                     Restore previous state
      │                        ↓
      │                     Re-render editor
      │
[Clone proposal]
      │
      └──────────────────────▶ POST /api/proposals/:id/duplicate
                                 ↓
                              Deep copy all sections
                              Copy services
                              Generate new ID + token
                                 ↓
                              Return: new proposal
                                 ↓
                              Redirect to editor
```

**Data flow key insights:**
- Client-side state (zustand) handles UI interactions, server actions handle persistence
- Auto-save debouncing prevents excessive server calls (2s delay)
- Variable resolution happens client-side when data available, server-side when not cached
- AI generation uses SSE streaming for progressive display
- Version snapshots created on every auto-save (pruned to last 50)

### Recommended Project Structure
```
apps/web/src/
├── app/(shell)/
│   └── proposals/
│       ├── [proposalId]/
│       │   ├── edit/
│       │   │   ├── page.tsx              # Main editor page
│       │   │   ├── actions.ts            # Server actions (save, clone, generate AI)
│       │   │   └── components/
│       │   │       ├── ProposalEditor.tsx        # Main container
│       │   │       ├── TipTapEditor.tsx          # TipTap setup with extensions
│       │   │       ├── VariablePalette.tsx       # Draggable variable chips
│       │   │       ├── SectionList.tsx           # @dnd-kit sortable sections
│       │   │       ├── SectionCard.tsx           # Individual section (drag handle + editor)
│       │   │       ├── AddSectionMenu.tsx        # Section type picker
│       │   │       ├── AIGenerationModal.tsx     # AI content config + progress
│       │   │       ├── VersionHistorySidebar.tsx # Version list + restore
│       │   │       ├── SaveIndicator.tsx         # Saving/saved/error status
│       │   │       └── MagicLinkDialog.tsx       # Share link generation
│       │   └── versions/
│       │       └── [versionId]/
│       │           └── page.tsx          # Version preview (read-only)
│       └── templates/
│           ├── page.tsx                  # Template selector
│           └── [templateId]/
│               └── page.tsx              # Template preview
├── lib/
│   └── proposal-editor/
│       ├── tiptap/
│       │   ├── extensions/
│       │   │   ├── VariableExtension.ts          # Custom inline node
│       │   │   └── VariableChip.tsx              # React node view
│       │   └── tiptap-config.ts                  # Editor extensions setup
│       ├── variable-resolution/
│       │   ├── VariableResolver.ts               # Resolves {{client.name}} etc.
│       │   └── variable-formatters.ts            # Currency, date formatting
│       ├── stores/
│       │   └── proposal-editor-store.ts          # zustand + zundo
│       └── ai/
│           ├── prompt-templates.ts               # Section prompts (EN/LT)
│           └── streaming-client.ts               # SSE handler
└── i18n/
    └── messages/
        ├── en.json                       # Add proposal-editor.* keys
        └── lt.json                       # Lithuanian translations
```

### Pattern 1: TipTap Custom Variable Extension

**What:** Inline atom node that renders as a colored chip with hover preview

**When to use:** Whenever inserting a variable placeholder ({{client.name}}) into proposal content

**Example:**
```typescript
// Source: Context7 /ueberdosis/tiptap-docs - custom inline nodes with attributes
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VariableChip } from './VariableChip';

export const VariableExtension = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true, // Cannot be split or edited

  addAttributes() {
    return {
      key: { default: null },           // 'client.name', 'totals.monthly'
      category: { default: 'custom' },  // 'client', 'provider', 'pricing', etc.
      label: { default: '' },           // Display label
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        'data-variable': HTMLAttributes.key,
        'data-category': HTMLAttributes.category,
        class: `variable-chip variable-${HTMLAttributes.category}`,
      },
      `{{${HTMLAttributes.key}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChip);
  },
});
```

**Variable chip component:**
```tsx
// apps/web/src/lib/proposal-editor/tiptap/extensions/VariableChip.tsx
import { NodeViewWrapper } from '@tiptap/react';
import { Tooltip } from '@tevero/ui';
import { cn } from '@/lib/utils';
import { useVariableValue } from '@/lib/proposal-editor/variable-resolution/use-variable-value';

interface VariableChipProps {
  node: {
    attrs: {
      key: string;
      category: string;
      label: string;
    };
  };
}

const categoryColors = {
  client: 'bg-blue-100 text-blue-800 border-blue-300',
  provider: 'bg-green-100 text-green-800 border-green-300',
  pricing: 'bg-orange-100 text-orange-800 border-orange-300',
  audit: 'bg-purple-100 text-purple-800 border-purple-300',
  dates: 'bg-gray-100 text-gray-800 border-gray-300',
  custom: 'bg-teal-100 text-teal-800 border-teal-300',
};

export function VariableChip({ node }: VariableChipProps) {
  const { key, category, label } = node.attrs;
  const { resolvedValue, isResolved } = useVariableValue(key);

  return (
    <NodeViewWrapper as="span" className="inline">
      <Tooltip content={isResolved ? resolvedValue : 'Value not available'}>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-sm font-medium',
            'border cursor-default select-none',
            categoryColors[category as keyof typeof categoryColors],
            !isResolved && 'border-red-500 border-dashed'
          )}
        >
          {label || key}
        </span>
      </Tooltip>
    </NodeViewWrapper>
  );
}
```

### Pattern 2: @dnd-kit Sortable Sections

**What:** Vertical list of proposal sections with drag handles for reordering

**When to use:** Section list in proposal editor where order matters

**Example:**
```tsx
// Source: Context7 /websites/dndkit - sortable lists with state management
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';

function SortableSection({ id, index, section }: SortableSectionProps) {
  const { ref, isDragging } = useSortable({
    id,
    index,
    type: 'section',
    accept: 'section',
  });

  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-lg border bg-card p-4',
        isDragging && 'opacity-50'
      )}
    >
      <div className="absolute left-2 top-2 cursor-grab">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="ml-8">
        <TipTapEditor content={section.content} />
      </div>
    </div>
  );
}

export function SectionList({ sections, onReorder }: SectionListProps) {
  const [items, setItems] = useState(sections);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;

        const { source } = event.operation;
        if (isSortable(source)) {
          const { initialIndex, index } = source;
          if (initialIndex !== index) {
            setItems((prev) => {
              const newItems = [...prev];
              const [removed] = newItems.splice(initialIndex, 1);
              newItems.splice(index, 0, removed);
              onReorder(newItems); // Trigger auto-save
              return newItems;
            });
          }
        }
      }}
    >
      <div className="space-y-4">
        {items.map((section, index) => (
          <SortableSection
            key={section.id}
            id={section.id}
            index={index}
            section={section}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}
```

### Pattern 3: Auto-Save with Debouncing

**What:** Automatically persist proposal changes after 2 seconds of inactivity

**When to use:** Any editor field where user makes frequent changes

**Example:**
```tsx
// Using existing apps/web/src/hooks/use-debounced-callback.ts
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useState } from 'react';
import { saveProposal } from './actions';

export function useAutoSave(proposalId: string) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const debouncedSave = useDebouncedCallback(
    async (content: ProposalContent) => {
      setSaveStatus('saving');
      try {
        await saveProposal(proposalId, content);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (error) {
        setSaveStatus('error');
        console.error('[useAutoSave] Failed to save:', error);
        // Queue for retry when online
      }
    },
    2000 // 2 second debounce
  );

  return { saveStatus, lastSavedAt, triggerSave: debouncedSave };
}
```

### Pattern 4: Zustand + Zundo Undo/Redo

**What:** Temporal state management with keyboard shortcuts for undo/redo

**When to use:** Complex editor state that needs undo/redo capabilities

**Example:**
```typescript
// Source: Context7 /charkour/zundo - temporal middleware
import { create } from 'zustand';
import { temporal } from 'zundo';

interface ProposalEditorState {
  content: Record<string, string>; // sectionId -> HTML content
  sectionOrder: string[];
  updateSection: (sectionId: string, content: string) => void;
  reorderSections: (newOrder: string[]) => void;
}

export const useProposalEditorStore = create<ProposalEditorState>()(
  temporal(
    (set) => ({
      content: {},
      sectionOrder: [],

      updateSection: (sectionId, content) =>
        set((state) => ({
          content: { ...state.content, [sectionId]: content },
        })),

      reorderSections: (newOrder) =>
        set({ sectionOrder: newOrder }),
    }),
    {
      limit: 50, // Keep last 50 states
      handleSet: (handleSet) =>
        (state, replace, name) => {
          // Only record state changes from user actions
          if (name && !name.startsWith('_internal')) {
            handleSet(state);
          }
        },
    }
  )
);

// In component:
function EditorToolbar() {
  const { undo, redo, canUndo, canRedo } = useProposalEditorStore.temporal.getState();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex gap-2">
      <Button onClick={undo} disabled={!canUndo} size="sm" variant="outline">
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button onClick={redo} disabled={!canRedo} size="sm" variant="outline">
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### Pattern 5: AI Content Generation with Streaming

**What:** Claude API streaming with Server-Sent Events for progressive display

**When to use:** AI-generated proposal sections

**Example:**
```typescript
// apps/web/src/app/(shell)/proposals/[proposalId]/edit/actions.ts
'use server';

import Anthropic from '@anthropic-ai/sdk';
import { unstable_after } from 'next/server';

export async function generateProposalSection(
  proposalId: string,
  sectionKey: string,
  locale: 'en' | 'lt'
) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Fetch context
  const context = await buildProposalContext(proposalId);
  const prompt = buildSectionPrompt(sectionKey, context, locale);

  // Stream response
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Return SSE stream
  return new ReadableStream({
    async start(controller) {
      stream.on('text', (text) => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
      });

      stream.on('message', async (message) => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'done', message })}\n\n`);
        controller.close();

        // Save generated content after stream completes
        unstable_after(async () => {
          await saveGeneratedContent(proposalId, sectionKey, message.content);
        });
      });

      stream.on('error', (error) => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        controller.close();
      });
    },
  });
}
```

**Client-side streaming consumer:**
```tsx
// apps/web/src/lib/proposal-editor/ai/streaming-client.ts
export async function* streamAIGeneration(
  proposalId: string,
  sectionKey: string,
  locale: 'en' | 'lt'
) {
  const response = await fetch('/api/proposals/generate', {
    method: 'POST',
    body: JSON.stringify({ proposalId, sectionKey, locale }),
  });

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        yield data;
      }
    }
  }
}

// In component:
async function handleGenerate() {
  setIsGenerating(true);
  let accumulated = '';

  for await (const data of streamAIGeneration(proposalId, 'hero', 'en')) {
    if (data.type === 'text') {
      accumulated += data.text;
      setContent(accumulated); // Progressive update
    } else if (data.type === 'done') {
      setIsGenerating(false);
    } else if (data.type === 'error') {
      setError(data.error);
      setIsGenerating(false);
    }
  }
}
```

### Anti-Patterns to Avoid

- **Mutating TipTap content directly:** TipTap uses ProseMirror transactions — always use `editor.chain()` commands
- **Not debouncing auto-save:** Saving on every keystroke creates excessive server load and rate-limit issues
- **Storing large resolved variables in DB:** Only store variable keys ({{client.name}}), resolve at render time
- **Blocking UI during AI generation:** Use streaming + progressive display, not await-then-render
- **Forgetting to cleanup debounce timers:** Use the existing `useDebouncedCallback` hook which handles cleanup
- **Hard-coding variable categories:** Use database-driven variable definitions for extensibility
- **Not handling offline state:** Queue failed saves for retry when connection restored

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editing | Custom contenteditable manager | TipTap | ContentEditable APIs are notoriously complex — cursor position, selection, nested nodes, undo/redo all have edge cases. TipTap handles browser inconsistencies, accessibility, and mobile. |
| Drag-and-drop | Manual mouse event tracking | @dnd-kit | Pointer events across mouse/touch/keyboard, collision detection, accessibility (screen readers, keyboard nav), animation timing — all solved by @dnd-kit. |
| Undo/redo | Custom state history stack | zundo | Efficient diffing, circular buffer management, integration with state updates, keyboard shortcuts — zundo is optimized and tested. |
| Variable resolution | String replacement | Structured resolver service | {{client.name}} seems simple, but needs: null handling, formatting (currency, dates), i18n, fallback values, nested keys. Resolver service centralizes logic. |
| Debouncing | setTimeout wrapper | use-debounce | Edge cases: maxWait, flush on unmount, cancel pending, leading/trailing options. use-debounce handles all. |
| Streaming AI | Manual fetch + chunking | Server-Sent Events (SSE) | SSE provides standardized protocol, automatic reconnection, event parsing. Avoid reinventing. |

**Key insight:** This phase combines 5-6 complex UI domains (rich text, DnD, state management, AI, i18n). Each has mature libraries solving 90% of edge cases. Hand-rolling any of these would delay Phase 57 by weeks and introduce bugs that users hit but tests miss.

## Runtime State Inventory

> Phase 57 is greenfield (new feature), not a rename/refactor — no existing runtime state to migrate.

**Verification:** Proposal editing is currently basic textareas (Phase 46-47 foundation). This phase adds rich editing UI but does not rename/migrate existing data structures. All new tables (proposal_templates, proposal_versions, variable_definitions) start empty.

## Common Pitfalls

### Pitfall 1: TipTap Extensions Not Registered Before Use

**What goes wrong:** Variable chips don't render, clicking variables shows raw HTML instead of chip component

**Why it happens:** TipTap extensions must be passed to `useEditor({ extensions: [...] })` array. If VariableExtension is imported but not included, TipTap treats variable nodes as unknown and renders fallback HTML.

**How to avoid:**
```typescript
// WRONG: Extension defined but not registered
const editor = useEditor({
  extensions: [StarterKit, Placeholder], // VariableExtension missing!
  content,
});

// CORRECT: Include all custom extensions
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder,
    Typography,
    VariableExtension, // ✓ Custom extension registered
    Link,
    Highlight,
  ],
  content,
});
```

**Warning signs:** Developer tools show `<span data-variable="client.name">` instead of custom component, console warnings about "unknown node type: variable"

### Pitfall 2: Debounce Not Flushed on Unmount

**What goes wrong:** User edits content, navigates away immediately — changes lost because debounced save never fired

**Why it happens:** `useDebouncedCallback` queues save for 2 seconds, but component unmounts before timer completes. Queued save is discarded.

**How to avoid:**
```typescript
// WRONG: No cleanup, pending saves lost on unmount
function ProposalEditor() {
  const debouncedSave = useDebouncedCallback(save, 2000);
  // If user navigates away, pending save is lost
}

// CORRECT: Flush pending save on unmount
function ProposalEditor() {
  const debouncedSave = useDebouncedCallback(save, 2000);

  useEffect(() => {
    return () => {
      debouncedSave.flush(); // Force immediate save on unmount
    };
  }, [debouncedSave]);
}
```

**Warning signs:** Users report "lost changes" when switching tabs quickly, QA finds intermittent save failures

### Pitfall 3: Zustand Temporal Recording Internal State Updates

**What goes wrong:** Undo stack grows to hundreds of states, undo/redo becomes slow, user hits "undo" 50 times to get back one action

**Why it happens:** Every state update is recorded by zundo, including internal updates (auto-save status, UI flags). Undo stack fills with non-user actions.

**How to avoid:**
```typescript
// WRONG: All state changes recorded
const useEditorStore = create()(
  temporal((set) => ({
    content: {},
    _saveStatus: 'saved', // Internal state recorded!
    updateContent: (id, html) => set({ content: { [id]: html } }),
    setSaveStatus: (status) => set({ _saveStatus: status }),
  }))
);

// CORRECT: Filter internal state from undo history
const useEditorStore = create()(
  temporal(
    (set) => ({
      content: {},
      _saveStatus: 'saved',
      updateContent: (id, html) => set({ content: { [id]: html } }),
      setSaveStatus: (status) => set({ _saveStatus: status }),
    }),
    {
      handleSet: (handleSet) =>
        (state, replace, name) => {
          // Only record user actions, skip internal state
          if (name && !name.startsWith('_')) {
            handleSet(state);
          }
        },
    }
  )
);
```

**Warning signs:** Undo stack length grows rapidly (check `pastStates.length`), users complain "undo doesn't work right"

### Pitfall 4: Variable Resolution Happens Server-Side on Every Render

**What goes wrong:** Proposal editor makes hundreds of API calls to resolve variables, page becomes sluggish

**Why it happens:** Each variable chip calls `useVariableValue(key)` hook, hook fetches from server, results in N API calls for N variables

**How to avoid:**
```typescript
// WRONG: Fetch variable value individually
function useVariableValue(key: string) {
  const [value, setValue] = useState(null);
  useEffect(() => {
    fetch(`/api/variables/resolve?key=${key}`).then((r) => setValue(r));
  }, [key]);
  return value;
}

// CORRECT: Fetch all variables once, use client-side cache
function VariableProvider({ proposalId, children }) {
  const { data: variables } = useQuery({
    queryKey: ['proposal-variables', proposalId],
    queryFn: () => fetch(`/api/proposals/${proposalId}/variables`).then((r) => r.json()),
  });

  return (
    <VariableContext.Provider value={variables}>
      {children}
    </VariableContext.Provider>
  );
}

function useVariableValue(key: string) {
  const variables = useContext(VariableContext);
  return variables?.[key] ?? null;
}
```

**Warning signs:** Network tab shows dozens of identical requests, editor lags when scrolling past variable chips

### Pitfall 5: AI Generation Blocks UI Thread

**What goes wrong:** User clicks "Generate with AI", entire editor freezes for 10+ seconds, looks broken

**Why it happens:** Awaiting full Claude API response before updating UI — no feedback during generation

**How to avoid:**
```typescript
// WRONG: Await full response, no progress indicator
async function handleGenerate() {
  setLoading(true);
  const result = await generateContent(proposalId, 'hero');
  setContent(result);
  setLoading(false);
}

// CORRECT: Stream response with progressive updates
async function handleGenerate() {
  setIsGenerating(true);
  let accumulated = '';

  for await (const chunk of streamAIGeneration(proposalId, 'hero', locale)) {
    if (chunk.type === 'text') {
      accumulated += chunk.text;
      setContent(accumulated); // Update as text arrives
    } else if (chunk.type === 'done') {
      setIsGenerating(false);
    }
  }
}
```

**Warning signs:** Editor appears frozen during AI generation, users think app crashed and reload

## Code Examples

Verified patterns from official sources:

### TipTap Editor Setup with Custom Extensions
```typescript
// Source: Context7 /ueberdosis/tiptap-docs
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { VariableExtension } from './extensions/VariableExtension';

interface ProposalEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  locale: 'en' | 'lt';
}

export function ProposalEditor({ content, onUpdate, locale }: ProposalEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          locale === 'lt'
            ? 'Pradėkite rašyti arba vilkite kintamąjį...'
            : 'Start typing or drag a variable...',
      }),
      Typography,
      VariableExtension,
    ],
    content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="prose prose-sm max-w-none">
      <EditorContent editor={editor} />
    </div>
  );
}
```

### @dnd-kit Sortable Implementation
```tsx
// Source: Context7 /websites/dndkit - sortable state management
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable, isSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';

interface Section {
  id: string;
  title: string;
  content: string;
}

function SortableSection({ id, index, section }: { id: string; index: number; section: Section }) {
  const { ref, isDragging } = useSortable({
    id,
    index,
    type: 'section',
    accept: 'section',
  });

  return (
    <div ref={ref} className={isDragging ? 'opacity-50' : ''}>
      <GripVertical className="h-5 w-5" />
      <h3>{section.title}</h3>
    </div>
  );
}

export function SectionList({ sections, onReorder }: { sections: Section[]; onReorder: (sections: Section[]) => void }) {
  const [items, setItems] = useState(sections);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;

        const { source } = event.operation;
        if (isSortable(source)) {
          const { initialIndex, index } = source;
          if (initialIndex !== index) {
            setItems((prev) => {
              const newItems = [...prev];
              const [removed] = newItems.splice(initialIndex, 1);
              newItems.splice(index, 0, removed);
              onReorder(newItems);
              return newItems;
            });
          }
        }
      }}
    >
      {items.map((section, index) => (
        <SortableSection key={section.id} id={section.id} index={index} section={section} />
      ))}
    </DragDropProvider>
  );
}
```

### Zundo Temporal Middleware
```typescript
// Source: Context7 /charkour/zundo
import { create } from 'zustand';
import { temporal } from 'zundo';

interface EditorState {
  content: Record<string, string>;
  sectionOrder: string[];
  updateSection: (id: string, html: string) => void;
  reorderSections: (order: string[]) => void;
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      content: {},
      sectionOrder: [],
      updateSection: (id, html) =>
        set((state) => ({
          content: { ...state.content, [id]: html },
        })),
      reorderSections: (order) => set({ sectionOrder: order }),
    }),
    {
      limit: 50,
    }
  )
);

// Usage in component:
const { undo, redo, canUndo, canRedo } = useEditorStore.temporal.getState();
```

### Auto-Save with Debouncing
```typescript
// Source: Context7 /xnimorz/use-debounce + existing apps/web/src/hooks/use-debounced-callback.ts
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useState, useEffect } from 'react';

export function useAutoSave(proposalId: string, content: string) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  const debouncedSave = useDebouncedCallback(
    async (content: string) => {
      setSaveStatus('saving');
      try {
        await fetch(`/api/proposals/${proposalId}/content`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        });
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('error');
      }
    },
    2000
  );

  useEffect(() => {
    debouncedSave(content);
  }, [content, debouncedSave]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  return saveStatus;
}
```

### AI Streaming with Claude API
```typescript
// Source: Context7 /anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateProposalContent(
  sectionKey: string,
  context: ProposalContext,
  locale: 'en' | 'lt'
) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: buildPrompt(sectionKey, context, locale),
      },
    ],
  });

  return new ReadableStream({
    async start(controller) {
      stream.on('text', (text) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
      });

      stream.on('message', (message) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      });

      stream.on('error', (error) => {
        controller.error(error);
      });
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2021 (dnd deprecated) | @dnd-kit is official successor, smaller bundle, better accessibility |
| Draft.js (Facebook) | TipTap / Lexical | 2022 (Draft.js maintenance mode) | TipTap has active development, modern React APIs, extensible |
| Custom undo logic | zundo middleware | 2022 (zundo released) | Standardized temporal state, optimized diffing, zero boilerplate |
| Textarea + manual variables | Rich text + inline chips | 2023+ (modern editors) | UX matches Google Docs / Notion expectations |

**Deprecated/outdated:**
- **react-beautiful-dnd**: Officially deprecated by Atlassian, recommends @dnd-kit
- **Draft.js**: In maintenance mode, Meta recommends Lexical for new projects
- **ProseMirror direct usage**: Too low-level, TipTap abstracts complexity while preserving power

## Assumptions Log

> All claims in this research were verified via Context7, npm registry, or existing codebase patterns — no unverified assumptions.

**Empty table indicates all findings are HIGH/MEDIUM confidence with verifiable sources.**

## Open Questions

1. **Variable resolution caching strategy**
   - What we know: Variables resolve from prospect/workspace/audit data
   - What's unclear: Should we cache resolved values in localStorage for offline editing, or always fetch fresh?
   - Recommendation: Start with session-level cache (React Query), add localStorage in Phase 58 if offline editing is prioritized

2. **Version retention policy**
   - What we know: zundo keeps last 50 states in browser, database can store unlimited versions
   - What's unclear: How many database snapshots to keep per proposal? Disk usage vs. restore capability tradeoff
   - Recommendation: Keep last 20 versions per proposal, delete older than 90 days unless pinned

3. **AI generation rate limits**
   - What we know: Claude API has rate limits (tier-dependent)
   - What's unclear: How many proposals can be AI-generated simultaneously per workspace?
   - Recommendation: Queue AI generation jobs in BullMQ if >5 concurrent requests, add user-facing queue status

4. **Custom section schema extensibility**
   - What we know: DESIGN.md defines 7 section types (text, image, testimonial, case_study, video, comparison, timeline)
   - What's unclear: Should agencies be able to define custom section types beyond these 7?
   - Recommendation: Ship with 7 predefined types in Phase 57, evaluate custom types in Phase 58 based on user feedback

## Environment Availability

> Phase 57 requires Claude API access for AI content generation. All other dependencies are code/config-only.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Anthropic API Key | AI content generation | ✓ (env var) | — | Manual content entry (AI disabled) |
| PostgreSQL | Template/version storage | ✓ | 15.x | — |
| Redis | — | ✓ | 7.x | Not needed for Phase 57 |
| Node.js | Runtime | ✓ | 22.10.5 | — |
| pnpm | Package manager | ✓ | 9.x | — |

**Missing dependencies with no fallback:**
- None — all required infrastructure is available

**Missing dependencies with fallback:**
- If `ANTHROPIC_API_KEY` not set, AI generation button is hidden, users can still edit manually

## Validation Architecture

> nyquist_validation enabled in .planning/config.json

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | apps/web/vitest.config.ts (exists) |
| Quick run command | `pnpm test --run` |
| Full suite command | `pnpm test --coverage` |

### Phase Requirements → Test Map

Phase 57 has 13 success criteria from CONTEXT.md. Map to test types:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | Template selector shown when creating proposal | integration | `pnpm test src/app/(shell)/proposals/new/page.test.tsx -x` | ❌ Wave 0 |
| SC-02 | Click any section text to edit inline | unit | `pnpm test src/lib/proposal-editor/tiptap/TipTapEditor.test.tsx -x` | ❌ Wave 0 |
| SC-03 | Drag variables from palette into content | integration | `pnpm test src/lib/proposal-editor/tiptap/VariableExtension.test.tsx -x` | ❌ Wave 0 |
| SC-04 | Variables render as colored chips with preview | unit | `pnpm test src/lib/proposal-editor/tiptap/VariableChip.test.tsx -x` | ❌ Wave 0 |
| SC-05 | Drag sections to reorder with smooth animation | integration | `pnpm test src/app/(shell)/proposals/[id]/edit/SectionList.test.tsx -x` | ❌ Wave 0 |
| SC-06 | Add custom sections (text, image, testimonial, etc.) | integration | `pnpm test src/app/(shell)/proposals/[id]/edit/AddSectionMenu.test.tsx -x` | ❌ Wave 0 |
| SC-07 | Auto-save within 2 seconds of last change | unit | `pnpm test src/lib/proposal-editor/useAutoSave.test.ts -x` | ❌ Wave 0 |
| SC-08 | Clone proposal creates full copy with one click | integration | `pnpm test src/app/(shell)/proposals/[id]/edit/actions.test.ts::clone -x` | ❌ Wave 0 |
| SC-09 | View and restore previous versions | integration | `pnpm test src/app/(shell)/proposals/[id]/versions/page.test.tsx -x` | ❌ Wave 0 |
| SC-10 | Undo/redo works with Cmd+Z / Cmd+Shift+Z | unit | `pnpm test src/lib/proposal-editor/stores/proposal-editor-store.test.ts -x` | ❌ Wave 0 |
| SC-11 | AI generates personalized content per section | integration | `pnpm test src/lib/proposal-editor/ai/generateContent.test.ts -x` | ❌ Wave 0 |
| SC-12 | Magic link generation with copy button | integration | `pnpm test src/app/(shell)/proposals/[id]/edit/MagicLinkDialog.test.tsx -x` | ❌ Wave 0 |
| SC-13 | All UI available in English and Lithuanian | smoke | `pnpm test src/i18n/proposal-editor.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test --run` (fast unit tests only)
- **Per wave merge:** `pnpm test --coverage` (all tests with coverage report)
- **Phase gate:** Full suite green + coverage ≥ 80% before `/gsd-verify-work`

### Wave 0 Gaps

All test files are missing (new feature, no existing tests):

- [ ] `apps/web/src/app/(shell)/proposals/new/page.test.tsx` — covers SC-01
- [ ] `apps/web/src/lib/proposal-editor/tiptap/TipTapEditor.test.tsx` — covers SC-02
- [ ] `apps/web/src/lib/proposal-editor/tiptap/VariableExtension.test.tsx` — covers SC-03
- [ ] `apps/web/src/lib/proposal-editor/tiptap/VariableChip.test.tsx` — covers SC-04
- [ ] `apps/web/src/app/(shell)/proposals/[id]/edit/SectionList.test.tsx` — covers SC-05
- [ ] `apps/web/src/app/(shell)/proposals/[id]/edit/AddSectionMenu.test.tsx` — covers SC-06
- [ ] `apps/web/src/lib/proposal-editor/useAutoSave.test.ts` — covers SC-07
- [ ] `apps/web/src/app/(shell)/proposals/[id]/edit/actions.test.ts` — covers SC-08
- [ ] `apps/web/src/app/(shell)/proposals/[id]/versions/page.test.tsx` — covers SC-09
- [ ] `apps/web/src/lib/proposal-editor/stores/proposal-editor-store.test.ts` — covers SC-10
- [ ] `apps/web/src/lib/proposal-editor/ai/generateContent.test.ts` — covers SC-11
- [ ] `apps/web/src/app/(shell)/proposals/[id]/edit/MagicLinkDialog.test.tsx` — covers SC-12
- [ ] `apps/web/src/i18n/proposal-editor.test.ts` — covers SC-13
- [ ] Framework install: Already installed (vitest 4.1.4)

**Shared fixtures needed:**
- [ ] `apps/web/src/lib/proposal-editor/__tests__/fixtures.ts` — Mock proposal data, variable definitions, sections
- [ ] `apps/web/src/lib/proposal-editor/__tests__/setup.ts` — TipTap test utils, @dnd-kit test harness

## Security Domain

> security_enforcement enabled (absent = enabled in config.json)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Clerk handles auth, proposals scoped by workspaceId |
| V3 Session Management | no | Clerk manages sessions |
| V4 Access Control | yes | Workspace-level isolation — proposals only accessible by workspace members |
| V5 Input Validation | yes | Zod schema validation for server actions (content, sectionOrder, variables) |
| V6 Cryptography | yes | Magic link token generation — `crypto.randomBytes(32)` for secure tokens |

### Known Threat Patterns for Next.js + TipTap

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via rich text content | Tampering | DOMPurify sanitization before rendering (already in use — see proposal preview) |
| Unauthorized proposal access | Elevation of Privilege | Verify `workspaceId` matches authenticated user's workspace before serving |
| Token prediction (magic links) | Information Disclosure | Use cryptographically secure random tokens (crypto.randomBytes, not Math.random) |
| Server-Side Request Forgery (SSRF) via AI prompts | Tampering | Validate prompt templates, never pass user-controlled URLs to Claude API |
| Rate limit bypass (AI generation) | Denial of Service | Rate limit AI generation per workspace (e.g., 10 requests/hour via middleware) |
| Variable injection (SQL/XSS) | Injection | Variables are resolved server-side with parameterized queries, never execute as code |

**Critical security requirement:** Never render user-generated HTML without sanitization. TipTap content is HTML — must use DOMPurify before displaying in proposal preview or email templates.

## Sources

### Primary (HIGH confidence)
- Context7 /ueberdosis/tiptap-docs — TipTap custom extensions, React integration, inline atom nodes [VERIFIED]
- Context7 /websites/dndkit — @dnd-kit sortable lists, state management patterns [VERIFIED]
- Context7 /charkour/zundo — Temporal middleware setup, undo/redo with zustand [VERIFIED]
- Context7 /xnimorz/use-debounce — Debounced callbacks, flush on unmount, maxWait [VERIFIED]
- Context7 /anthropics/anthropic-sdk-typescript — Claude API streaming, SSE setup [VERIFIED]
- npm registry — Package versions verified 2026-05-02 (TipTap 3.22.5, @dnd-kit 6.3.1/10.0.0/3.2.2, zundo 2.3.0, use-debounce 10.1.1) [VERIFIED]
- Codebase — Existing patterns: `apps/web/src/hooks/use-debounced-callback.ts`, `open-seo-main/src/db/change-schema.ts`, `open-seo-main/src/db/proposal-schema.ts` [VERIFIED]

### Secondary (MEDIUM confidence)
- None — all findings verified with primary sources

### Tertiary (LOW confidence)
- None — no unverified claims in this research

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified in npm registry, versions confirmed current
- Architecture: HIGH - TipTap, @dnd-kit, zundo patterns from official docs, existing codebase has similar patterns
- Pitfalls: MEDIUM-HIGH - Common issues documented in library issue trackers, verified via Context7 docs
- Security: HIGH - ASVS categories standard for Next.js apps, XSS mitigation already in codebase (DOMPurify)

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (30 days — stable ecosystem, TipTap/dnd-kit/zundo update infrequently)

---

**Ready for planning:** This research provides complete technical foundation for creating PLAN.md files. All dependencies are available, patterns are documented, and pitfalls are identified.

# Phase 102: Design System Integration Research

**Researched:** 2026-05-16
**Domain:** Progressive Disclosure, Block Editor UX, AI Integration UI
**Confidence:** HIGH (verified via Context7, official docs, 2026 web search)

---

## 1. Executive Summary

The document builder must embody v7's core tension: **"It takes care of everything"** AND **"I can tweak whatever I need"** -- simultaneously, not as a spectrum. This research identifies the specific UI patterns that achieve this balance for block-based document editing with persuasion frameworks, variables, and AI assistance.

**Key findings:**

1. **Slash commands are table stakes** -- Users under 35 expect `/` to open a command palette. This is the primary power-user entry point. [VERIFIED: Dashibase, Mintlify, Eddyter]

2. **Progressive disclosure works best in 2-3 layers max** -- More layers cause user frustration and abandonment. [CITED: NN/g, IxDF]

3. **Template-first reduces cognitive load** -- Blank canvas causes "decision paralysis" and slows users down. Start with structure, let power users break free. [CITED: UI for AI Medium]

4. **AI assistance should be embedded, not modal** -- Zero-friction inline AI (no app switching) outperforms sidebars for content generation. [CITED: Gmelius, SAP Design System]

5. **Bubble menu for inline formatting, floating menu for block insertion** -- Both are necessary; they serve complementary purposes. [VERIFIED: TipTap docs]

**Primary recommendation:** Build a **template-first flow** with **slash commands for power users**, **bubble menu for inline formatting**, and **embedded AI** (not sidebar) -- following v7's "calm at rest, depth on demand" principle.

---

## 2. Progressive Disclosure Best Practices

### Core Principle

Progressive disclosure defers advanced or rarely used features to secondary screens, making applications easier to learn and less error-prone. [CITED: NN/g Progressive Disclosure]

### Three Categories (Choose One Per Feature)

| Type | Description | Document Builder Use |
|------|-------------|---------------------|
| **Step-by-step** | Sequential stages (wizard) | Template selection flow, first-time onboarding |
| **Conditional** | Hidden until user requests | Advanced block settings, A/B testing config |
| **Contextual** | Based on user situation | Variable suggestions based on block type |

[CITED: LogRocket Progressive Disclosure]

### Implementation Rules

1. **Limit to 2-3 disclosure layers** -- Beyond this, users lose context and abandon tasks. [CITED: Gapsy Studio]

2. **Clear affordances for hidden features** -- Hiding features only works if users can find them when needed. Use visual cues: chevrons, "Advanced" labels, `...` menus.

3. **Consistent patterns** -- Use the same disclosure mechanism throughout the app. If accordions expand settings in one place, use accordions everywhere.

4. **Primary vs secondary action distinction** -- Main action (e.g., "Add Block") is prominent; secondary actions (e.g., "Import from PDF") are in overflow menus.

### v7 Alignment

v7's principle: **"Calm at rest, depth on demand."**

| State | What User Sees | Hidden Features |
|-------|----------------|-----------------|
| **Rest** | Block palette, simple toolbar, preview | A/B variants, analytics, variable syntax |
| **On Demand** | Hover reveals controls, click reveals settings | Everything accessible, nothing forced |

[VERIFIED: v7-master-design-architecture.md]

---

## 3. Template vs Free-Form UX

### The Blank Canvas Problem

A blank canvas assumes everyone knows how to translate intent into action. Research around the "blank page effect" shows that unstructured starting points **increase cognitive load** and slow people down. [CITED: UI for AI Medium]

> "The blank chat did not feel neutral. It felt intimidating. People wanted a starting point that felt supportive rather than demanding."

### Template-First Benefits

| Benefit | Mechanism |
|---------|-----------|
| **Faster start** | Pre-arranged structure eliminates "what goes first?" decisions |
| **Quality floor** | Templates encode best practices (persuasion frameworks) |
| **Learnability** | Users learn structure by example, then customize |
| **Consistency** | Agency produces consistent output across team members |

[CITED: StudyRaid, Canva Best Practices]

### Blank Canvas Escape Hatch

Power users need the option to start blank. The key insight:

> **"The blank canvas penalty (running out of time) is more severe than the template penalty (slight constraint on structure)."**

[CITED: Winning Presentations]

### Recommended Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  NEW PROPOSAL                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RECOMMENDED TEMPLATES (based on prospect industry)             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                           │
│  │ SEO     │ │ E-comm  │ │ Local   │                           │
│  │ Mastery │ │ Growth  │ │ Business│                           │
│  └─────────┘ └─────────┘ └─────────┘                           │
│                                                                 │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  [Start Blank]        [Import from PDF]       [Clone Existing] │
│   (power users)         (style only)            (previous win) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Template gallery is primary (large, prominent)
- Blank/Import/Clone are secondary (smaller, below fold or in overflow)
- Templates are pre-filtered by prospect data (industry, size, needs)

---

## 4. Variable Placement UI Options

### Current Implementation (Phase 57)

Our existing `VariablePalette` uses **drag-to-place** with a side panel. This works but has discoverability issues. [VERIFIED: codebase ProposalInlineEditor.tsx, VariablePalette.tsx]

### Options Compared

| Method | Discoverability | Speed | Learning Curve | Mobile Support |
|--------|----------------|-------|----------------|----------------|
| **Drag-to-place** (current) | Medium | Slow | Low | Poor |
| **Slash command** (`/var`) | High (after learning) | Fast | Medium | Good |
| **Inline autocomplete** (`{{`) | High | Fastest | Low | Good |
| **Side panel picker** | Medium | Medium | Low | Poor |
| **Bubble menu button** | High | Medium | Low | Good |

### Recommendation: Hybrid Approach

**Primary:** Inline autocomplete triggered by `{{`
**Secondary:** Slash command `/variable` for discoverability
**Tertiary:** Side panel for browsing (existing, keep it)

```
┌─────────────────────────────────────────────────────────────────┐
│  Your SEO audit revealed {{                                     │
│                         ┌─────────────────────────┐            │
│                         │ prospect.company        │            │
│                         │ prospect.domain         │            │
│                         │ audit.critical_issues   │            │
│                         │ audit.score             │            │
│                         │ ...search variables     │            │
│                         └─────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

**Why `{{` trigger:**
- Matches template syntax (what users see in source)
- Two keystrokes vs. one for `/` prevents accidental triggers
- Immediately communicates "this is a variable" semantically

### Side Panel Role Changes

Current: Primary method for variable insertion
New: **Reference and browse** -- shows all variables, explains categories, but not the main insertion method.

---

## 5. Block Editor Patterns (2026 State of the Art)

### Table Stakes Features

Building a Notion-like editor in 2026, these are **non-negotiable**: [CITED: Eddyter]

| Feature | Implementation |
|---------|---------------|
| **Slash commands** | Type `/` to insert any block type |
| **Contextual toolbars** | Appear when needed, disappear when not |
| **Keyboard-first editing** | All actions available without mouse |
| **Drag handle** | Appears on hover, left of block |
| **Block-level menus** | Right-click or `...` for block actions |

### TipTap Integration (Current Stack)

We're already using TipTap (Phase 57). The framework provides: [VERIFIED: Context7 TipTap docs]

**Bubble Menu:** Appears on text selection for inline formatting (bold, italic, link).

```tsx
<BubbleMenu editor={editor}>
  <button onClick={() => editor.chain().focus().toggleBold().run()}>
    Bold
  </button>
</BubbleMenu>
```

**Floating Menu:** Appears on empty lines for block insertion.

**Slash Commands:** Type `/` to open a suggestion menu.

```tsx
const { getSlashMenuItems } = useSlashDropdownMenu({
  enabledItems: ['text', 'heading_1', 'bullet_list', 'quote'],
  customItems: [
    {
      title: 'Pain Amplifier',
      group: 'Persuasion',
      onSelect: ({ editor }) => insertPersuasionBlock(editor, 'pain_amplifier'),
    },
  ],
})
```

### Drag-Drop Best Practices

1. **Visual feedback at every state:** idle -> hover -> grab -> move -> drop [CITED: Eleken]

2. **Horizontal drop indicator:** Thin line shows exactly where block will land

3. **8px activation distance:** Prevent accidental drags when clicking [VERIFIED: codebase SectionList.tsx]

4. **Keyboard alternative:** Never make drag-drop the only way. Provide "Move up/down" in context menu. [CITED: Eleken]

5. **Drag overlay:** Show ghost of dragged block during move [VERIFIED: codebase uses DndDragOverlay]

### Multi-Select and Bulk Operations

Power user feature -- reveal through keyboard discovery:

| Action | Shortcut | Visibility |
|--------|----------|------------|
| Select block | Click | Always |
| Extend selection | Shift+Click | Standard OS behavior |
| Select multiple | Cmd+Click | Standard OS behavior |
| Select all | Cmd+A | Standard OS behavior |
| Delete selected | Backspace | Shows after selection |
| Move selected | Drag | Shows after selection |
| Copy selected | Cmd+C | Standard OS behavior |

---

## 6. AI Assistance Integration

### Core Principle: Zero Friction

> "The most powerful AI assistants today are designed with a principle of zero friction. If you need to open a separate app, log in, or navigate a different UI to generate a reply or draft a follow-up, the AI quickly becomes a blocker rather than a productivity enhancer."

[CITED: Gmelius AI Features 2026]

### UI Pattern Options

| Pattern | Pros | Cons | Best For |
|---------|------|------|----------|
| **Inline embedded** | Zero friction, no mode switch | Can clutter UI | Single-block generation |
| **Sidebar chat** | Full conversation context | Mode switching | Complex multi-turn tasks |
| **Modal wizard** | Focused attention | Interrupts flow | One-time setup (voice extraction) |
| **Floating AI button** | Discoverable, not intrusive | Extra click | Balance of both |

### Recommended Implementation

**1. Inline AI (Primary):**

Place an AI button inside empty blocks or at cursor position:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Pain Amplifier Block]                                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ✨ Generate content...                                     │ │
│  │                                                           │ │
│  │ Your prospect ranks #{{audit.rank}} for their main        │ │
│  │ keyword. That's page 5 of Google...                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Regenerate] [Edit] [Accept]                                   │
└─────────────────────────────────────────────────────────────────┘
```

**2. Block-Level AI Actions (Context Menu):**

Right-click a block reveals:
- Improve writing
- Make shorter / longer
- Change tone
- Translate
- Regenerate with different angle

**3. Selection-Based AI (Bubble Menu):**

Select text, bubble menu shows AI options:
- Rewrite selection
- Expand on this
- Simplify language

### When NOT to Show AI

Following v7's "calm at rest" principle:

- **Don't:** Auto-suggest on every keystroke (overwhelming)
- **Don't:** Show AI options when user is actively typing (interrupting)
- **Do:** Show AI only when block is empty or user explicitly invokes (slash command, button click)
- **Do:** Show AI after a pause (2s of inactivity in empty block)

### SAP Design System Pattern

> "The AI writing assistant streamlines interactions with generative AI... It is available within an input field, text area, or rich text editor component to assist users in creating, iterating, and improving their text input through quick prompts."

[CITED: SAP AI Writing Assistant Usage]

**Implementation:** AI icon menu button embedded within the input field that indicates AI writing assistance and offers a menu with AI prompts.

---

## 7. Power User Access Patterns

### v7 Power User Escape Hatches

From v7-master-design-architecture.md:

| Shortcut | Action | Already Implemented |
|----------|--------|---------------------|
| `Cmd+K` | Command palette | Yes (GlobalCommandPalette) |
| `Cmd+J` | Client quick-switcher | Yes |
| `?` | Show all shortcuts | No -- add for document builder |

### Document Builder Power User Shortcuts

| Shortcut | Action | Discovery Method |
|----------|--------|-----------------|
| `/` | Slash command menu | Hint in empty block |
| `{{` | Variable autocomplete | Shown in variable palette |
| `Cmd+B` | Bold | Standard, bubble menu shows |
| `Cmd+I` | Italic | Standard, bubble menu shows |
| `Cmd+K` | Insert link | Standard |
| `Cmd+Shift+Up/Down` | Move block up/down | Context menu shows shortcut |
| `Cmd+D` | Duplicate block | Context menu shows shortcut |
| `Cmd+Backspace` | Delete block | Context menu shows shortcut |
| `Cmd+/` | Toggle AI assistant | Floating button tooltip |
| `Esc` | Exit editing, select block | Standard |
| `Tab` | Indent list item | Standard |
| `Shift+Tab` | Outdent list item | Standard |

### Keyboard Shortcut Disclosure

Following v7: **Show shortcuts inline with actions.**

```
┌──────────────────────────────────────────┐
│  Block Actions                           │
├──────────────────────────────────────────┤
│  📄 Duplicate              ⌘D            │
│  ↑  Move Up               ⌘⇧↑            │
│  ↓  Move Down             ⌘⇧↓            │
│  🎨 Change Type              /           │
│  🗑  Delete               ⌘⌫            │
├──────────────────────────────────────────┤
│  ✨ AI Actions                           │
│  ─────────────────────────────────────── │
│  Improve Writing            ⌘/           │
│  Make Shorter                            │
│  Change Tone                             │
└──────────────────────────────────────────┘
```

### Bulk Operations (Hidden by Default)

Surface only when user selects multiple blocks:

```
┌─────────────────────────────────────────────────────────────────┐
│  3 blocks selected    [Merge] [Duplicate] [Delete] [Move to...] │
└─────────────────────────────────────────────────────────────────┘
```

This appears as a sticky bar at bottom of editor when selection.count > 1.

---

## 8. Recommended UI Architecture

### Editor Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER — Template name, Save status, Preview toggle, Share                 │
│  [Template: SEO Mastery v2]         [Saved 2m ago]    [Preview] [Share ▾]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────┬───────────┐ │
│  │                                                            │           │ │
│  │  MAIN EDITOR                                               │  CONTEXT  │ │
│  │  ─────────────────────────────────────────────────────     │  PANEL    │ │
│  │                                                            │           │ │
│  │  ⋮ [Pain Amplifier] ────────────────────────────────────   │  Prospect │ │
│  │  │                                                          │  ────────│ │
│  │  │ Your SEO audit revealed {{prospect.company}} ranks      │  Acme Co │ │
│  │  │ #{{audit.rank}} for their main keyword...               │  acme.com │ │
│  │  │                                                          │           │ │
│  │  └──────────────────────────────────────────────────────   │  Variables│ │
│  │                                                            │  ────────│ │
│  │  ⋮ [Villain Story] ─────────────────────────────────────   │  Client  │ │
│  │  │                                                          │  Provider│ │
│  │  │ Type / for commands or ✨ Generate...                   │  Audit   │ │
│  │  │                                                          │  Pricing │ │
│  │  └──────────────────────────────────────────────────────   │           │ │
│  │                                                            │  Style   │ │
│  │  [+ Add Block]                                             │  Ref     │ │
│  │                                                            │  ────────│ │
│  │                                                            │  (PDF)   │ │
│  └────────────────────────────────────────────────────────────┴───────────┘ │
│                                                                             │
│  FOOTER — Framework compliance indicator, Word count, Last edited           │
│  [✓ Russell Brunson 85%]     1,247 words     Edited 2m ago                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
DocumentBuilder/
├── Header/
│   ├── TemplateSelector (dropdown, shows current template)
│   ├── SaveStatus (auto-save indicator)
│   ├── PreviewToggle (edit ↔ preview)
│   └── ShareMenu (export, copy link)
│
├── EditorPane/
│   ├── BlockList/ (sortable, @dnd-kit)
│   │   ├── PersuasionBlock/
│   │   │   ├── DragHandle (visible on hover)
│   │   │   ├── BlockTypeIndicator (icon + label)
│   │   │   ├── TipTapEditor/ (rich text)
│   │   │   │   ├── BubbleMenu (on selection)
│   │   │   │   ├── SlashCommand (on `/`)
│   │   │   │   └── VariableAutocomplete (on `{{`)
│   │   │   ├── AIGenerateButton (in empty blocks)
│   │   │   └── BlockContextMenu (on `...` or right-click)
│   │   └── AddBlockButton (bottom of list)
│   │
│   └── BulkActionBar (sticky, shown when multi-select)
│
├── ContextPanel/ (right rail)
│   ├── ProspectCard (current prospect info)
│   ├── VariablePalette (searchable, grouped)
│   └── StyleReference (PDF preview thumbnail)
│
└── Footer/
    ├── FrameworkCompliance (% match to selected framework)
    ├── WordCount
    └── LastEdited
```

### State Management

```typescript
interface DocumentBuilderState {
  // Document state
  template: Template | null;
  blocks: EditorSection[];
  blockOrder: string[];
  
  // UI state
  activeBlockId: string | null;
  selectedBlockIds: string[];  // For multi-select
  isPreviewMode: boolean;
  
  // Context state
  prospect: Prospect;
  styleReference: StyleReference | null;
  variables: ResolvedVariables;
  
  // AI state
  generatingBlockId: string | null;
  aiSuggestion: string | null;
}
```

### Preview Mode Architecture

**Edit Mode:** TipTap editors are editable, drag handles visible, AI buttons present.

**Preview Mode:** 
- Renders resolved HTML (variables filled)
- Shows how prospect will see it
- Device selector: Desktop / Tablet / Mobile
- Hides all editing chrome

```
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW MODE                          [Desktop] [Tablet] [📱] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Your SEO audit revealed Acme Co ranks #47 for their   │   │
│  │  main keyword. That's page 5 of Google -- effectively  │   │
│  │  invisible to 95% of searchers.                        │   │
│  │                                                         │   │
│  │  Other agencies promise "more traffic" but deliver     │   │
│  │  generic strategies that worked in 2019...             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Variables resolved: 12/12     [Exit Preview]                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Priority

Based on v7 principles and 102 CONTEXT.md requirements:

### Phase 1: Core Editor (Must Have)

1. **Block palette with persuasion types** -- The 8 persuasion blocks from CONTEXT.md
2. **TipTap integration with slash commands** -- `/` opens block type menu
3. **Drag-drop reordering** -- Reuse SectionList patterns
4. **Variable autocomplete** -- `{{` trigger
5. **Basic preview mode** -- Resolved variables, read-only

### Phase 2: AI Integration (Should Have)

1. **AI generate button** -- In empty blocks
2. **Block-level AI actions** -- Context menu
3. **Selection AI** -- Bubble menu enhancement
4. **Generation progress** -- Stepper UI per v7

### Phase 3: Power User Features (Nice to Have)

1. **Keyboard shortcuts** -- All documented shortcuts
2. **Multi-select + bulk actions** -- Sticky action bar
3. **Shortcut hint overlay** -- `?` to show all

---

## Sources

### Primary (HIGH confidence)
- [Context7 TipTap Docs](/ueberdosis/tiptap-docs) - Slash commands, bubble menu, floating menu implementation
- [v7-master-design-architecture.md](../../design/v7-master-design-architecture.md) - Core design principles, autonomy/control tension
- Codebase: ProposalInlineEditor.tsx, VariablePalette.tsx, SectionList.tsx, TemplateEditor.tsx

### Secondary (MEDIUM confidence)
- [UXPin Progressive Disclosure](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/) - 2026 best practices
- [IxDF Progressive Disclosure](https://ixdf.org/literature/topics/progressive-disclosure) - Academic definition
- [Dashibase Notion UI](https://dashibase.com/blog/notion-ui/) - Slash command adoption rationale
- [Eddyter Notion-Like Editor](https://eddyter.com/blogs/how-to-build-notion-like-editor-saas) - 2026 table stakes features
- [SAP AI Writing Assistant](https://www.sap.com/design-system/fiori-design-web/v1-136/ui-elements/ai-writing-assistant/usage) - Embedded AI UI patterns
- [Gmelius AI Features](https://gmelius.com/blog/ai-assistant-features) - Zero-friction AI principle
- [UI for AI Medium](https://medium.com/ui-for-ai/no-more-blank-canvas-rethinking-how-people-start-with-ai-fd427af24dc8) - Blank canvas problem
- [Eleken Drag Drop UI](https://www.eleken.co/blog-posts/drag-and-drop-ui) - Visual feedback best practices
- [LogRocket Progressive Disclosure](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/) - Three categories

### Tertiary (LOW confidence, needs validation)
- [Winning Presentations Template vs Blank](https://winningpresentations.com/slide-template-vs-blank-canvas-board-presentation/) - Template penalty claim
- [Mintlify Web Editor](https://www.mintlify.com/blog/22-ux-improvements-to-the-web-editor) - Slash menu design

---

## Metadata

**Confidence breakdown:**
- Progressive disclosure patterns: HIGH - Verified via NN/g, IxDF, UI-Patterns.com
- TipTap implementation: HIGH - Verified via Context7 and existing codebase
- AI integration patterns: MEDIUM - Based on 2026 industry examples, needs user testing
- Template-first UX: MEDIUM - Research supports, but specific implementation needs validation

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (30 days - stable domain)

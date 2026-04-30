# Phase 57: Proposal Editor Revolution

**Goal:** Transform proposal editing into a Google Docs meets website builder experience

**Depends on:** Phase 56 (prospect input complete)

**Estimated effort:** 50-60 hours

---

## Problem Statement

Current proposal editing is clunky:

1. **Textarea editing** — not inline, requires modal/page switch
2. **Fixed section order** — cannot reorder sections
3. **No custom sections** — locked to 6 predefined sections
4. **Manual save only** — risk of losing work
5. **No clone/duplicate** — must recreate from scratch
6. **No version history** — cannot recover previous versions
7. **No undo/redo** — accidents cannot be reversed

The experience is functional but not delightful. Users expect Notion/Google Docs-level editing.

---

## User Journey (Target State)

```
Agency User creates/edits proposal:
1. Click "Create Proposal" or open existing
2. See live preview with editable sections
3. Click any text → cursor appears → type to edit (inline)
4. Drag section handles to reorder
5. Click "+" to add custom section (text, image, testimonial, etc.)
6. Changes auto-save (debounced, no save button needed)
7. Undo with Cmd+Z, redo with Cmd+Shift+Z
8. View version history in sidebar
9. Clone proposal with one click
10. Generate magic link for manual sending
```

---

## Core Features

### 1. Inline Editing

**Implementation:** TipTap editor (ProseMirror-based)

```typescript
// Each section content becomes a TipTap editor instance
<TipTapEditor
  content={section.content}
  onUpdate={handleContentChange}
  extensions={[StarterKit, Placeholder, Typography]}
  editable={true}
/>
```

**Behavior:**
- Click any text → cursor appears
- Type to edit directly
- Rich text: bold, italic, links, bullet points
- Placeholder text when empty
- Real-time character count for length-sensitive sections

### 2. Drag-and-Drop Sections

**Implementation:** @dnd-kit/core + @dnd-kit/sortable

```typescript
// Section order stored in proposal
sectionOrder: ['hero', 'current_state', 'opportunities', 'custom_1', 'roi', 'investment', 'cta']
```

**Behavior:**
- Grab handle on left of each section
- Drag to reorder
- Visual drop indicator
- Order persists immediately (auto-save)
- Keyboard accessible (arrow keys when focused)

### 3. Custom Sections

**Types:**
- **Text Block** — Rich text content
- **Image** — Upload or URL with caption
- **Testimonial** — Quote + author + company
- **Case Study** — Title + metrics + description
- **Video Embed** — YouTube/Vimeo/Loom URL
- **Service Details** — From service catalog (Phase 58)

**Schema:**
```typescript
interface CustomSection {
  id: string;
  type: 'text' | 'image' | 'testimonial' | 'case_study' | 'video' | 'service';
  title?: string;
  content: Record<string, unknown>; // Type-specific content
  position: number;
}
```

### 4. Auto-Save

**Implementation:** Debounced save with optimistic UI

```typescript
const debouncedSave = useDebouncedCallback(
  async (content) => {
    setSaveStatus('saving');
    await saveProposal(content);
    setSaveStatus('saved');
  },
  2000 // 2 second debounce
);
```

**Status indicator:**
- "Saving..." (while debouncing/saving)
- "Saved" (after successful save)
- "Offline" (if network error, queue for retry)

### 5. Clone/Duplicate

**Endpoint:** `POST /api/proposals/:id/duplicate`

**Behavior:**
- Creates copy with name "Copy of [original]"
- Copies all sections, pricing, settings
- Clears prospect association (or optionally keeps)
- Opens new proposal in editor

### 6. Version History

**Schema:**
```typescript
interface ProposalVersion {
  id: string;
  proposalId: string;
  content: ProposalContent;
  createdAt: Date;
  createdBy: string;
  changeDescription?: string; // Auto-generated or manual
}
```

**UI:**
- Sidebar panel showing version list
- Click to preview any version
- "Restore" button to revert
- Auto-versions created on significant changes

### 7. Undo/Redo

**Implementation:** zustand with temporal middleware or use-undo hook

```typescript
const { past, present, future, undo, redo, canUndo, canRedo } = useTemporalStore();
```

**Scope:** Local to current session (not persisted)
**Keyboard:** Cmd+Z (undo), Cmd+Shift+Z (redo)

---

## Magic Link Generation

Since proposals are sent manually:

```typescript
// Generate shareable link
const magicLink = await generateProposalLink(proposalId);
// Returns: https://app.teveroseo.com/p/{token}

// Copy to clipboard UI
<CopyButton value={magicLink} label="Copy link" />
```

**Features:**
- One-click copy
- Optional expiration setting
- Track when link is accessed
- Regenerate link (invalidates old one)

---

## Technical Implementation

### Schema Changes

```sql
-- Add to proposals table
ALTER TABLE proposals ADD COLUMN section_order jsonb DEFAULT '[]';
ALTER TABLE proposals ADD COLUMN last_saved_at timestamp;
ALTER TABLE proposals ADD COLUMN last_saved_by text;

-- New table for custom sections
CREATE TABLE proposal_custom_sections (
  id TEXT PRIMARY KEY,
  proposal_id TEXT REFERENCES proposals(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  content JSONB NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- New table for version history
CREATE TABLE proposal_versions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT REFERENCES proposals(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  change_description TEXT
);
```

### Components

```
apps/web/src/components/proposals/editor/
├── ProposalEditor.tsx          # Main editor container
├── SectionList.tsx             # Drag-and-drop section list
├── SectionCard.tsx             # Individual section wrapper
├── SectionHandle.tsx           # Drag handle component
├── InlineEditor.tsx            # TipTap wrapper
├── AddSectionMenu.tsx          # "+" button with section types
├── CustomSectionRenderer.tsx   # Render custom section by type
├── SaveIndicator.tsx           # Auto-save status
├── VersionHistory.tsx          # Sidebar version list
├── VersionPreview.tsx          # Preview old version
├── MagicLinkGenerator.tsx      # Link copy UI
└── EditorToolbar.tsx           # Undo/redo buttons
```

### API Endpoints

```
PUT  /api/proposals/:id/content      # Auto-save content
PUT  /api/proposals/:id/sections/order  # Update section order
POST /api/proposals/:id/sections     # Add custom section
PUT  /api/proposals/:id/sections/:sectionId  # Update custom section
DELETE /api/proposals/:id/sections/:sectionId  # Remove custom section
POST /api/proposals/:id/duplicate    # Clone proposal
GET  /api/proposals/:id/versions     # List versions
GET  /api/proposals/:id/versions/:versionId  # Get specific version
POST /api/proposals/:id/versions/:versionId/restore  # Restore version
POST /api/proposals/:id/link         # Generate magic link
```

---

## UI Design (v6 System)

### Editor Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Prospects    Proposal for Acme Corp    [Saved ✓] [⋯] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┐  ┌───────────────────────┐  │
│ │ [Preview Mode Toggle]           │  │ Version History    ▾ │  │
│ │                                 │  │                      │  │
│ │ ⋮⋮ Hero Section                 │  │ Today 14:32         │  │
│ │    Click to edit title...       │  │ Today 14:15         │  │
│ │    Click to edit subtitle...    │  │ Yesterday 18:45     │  │
│ │                                 │  │                      │  │
│ │ ⋮⋮ Current State                │  │                      │  │
│ │    Your website currently...    │  │                      │  │
│ │                                 │  │                      │  │
│ │ ⋮⋮ Opportunities                │  │                      │  │
│ │    Based on our analysis...     │  │                      │  │
│ │                                 │  │                      │  │
│ │ [+ Add Section]                 │  │                      │  │
│ │                                 │  │                      │  │
│ │ ⋮⋮ ROI Calculator               │  │                      │  │
│ │    ...                          │  │                      │  │
│ │                                 │  │                      │  │
│ │ ⋮⋮ Investment                   │  │                      │  │
│ │    ...                          │  │                      │  │
│ │                                 │  │                      │  │
│ │ ⋮⋮ Call to Action               │  │                      │  │
│ │    ...                          │  │                      │  │
│ └─────────────────────────────────┘  └───────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│ [Undo] [Redo]                      [Preview] [Copy Link] [Send] │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Style
- Section cards with ghost-edge shadows (v6)
- Drag handles: `⋮⋮` icon, visible on hover
- Add section button: dashed border, centered `+`
- Save indicator: subtle text in header
- Version history: collapsible sidebar

---

## Success Criteria

1. Click any section text to edit inline
2. Drag sections to reorder with smooth animation
3. Add custom sections (text, image, testimonial, case study, video)
4. Auto-save within 2 seconds of last change
5. Clone proposal creates full copy with one click
6. View and restore previous versions
7. Undo/redo works with Cmd+Z / Cmd+Shift+Z
8. Magic link generation with copy button

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 57-01 | Schema + Inline Editing (TipTap) | 1 |
| 57-02 | Drag-and-Drop Sections (@dnd-kit) | 1 |
| 57-03 | Custom Sections + Add Section Menu | 2 |
| 57-04 | Auto-Save + Version History | 2 |
| 57-05 | Clone + Undo/Redo + Magic Link | 3 |

---

## Dependencies

- TipTap: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`
- Drag-and-drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- State: `zustand` (if not already installed)

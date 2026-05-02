# Phase 57: Proposal Editor Revolution - Context

**Gathered:** 2026-05-02
**Status:** Ready for execution
**Mode:** Auto-generated from DESIGN.md

<domain>
## Phase Boundary

Transform proposal editing into a Google Docs meets website builder experience with template system, drag-and-drop variables, and AI generation.

**Core Capabilities:**
- Three-layer template hierarchy (system → workspace → instance)
- Variable system with 6 categories (client, provider, pricing, audit, dates, custom)
- TipTap inline editing with variable chip extension
- @dnd-kit drag-and-drop section reordering
- Auto-save with 2s debounce
- Version history with restore capability
- AI content generation per section
- Clone/duplicate with zustand temporal undo/redo
- Magic link generation for manual sharing

**Key Constraint:** Full i18n support (EN/LT) for all UI, templates, and variable labels.

</domain>

<decisions>
## Implementation Decisions

### Rich Text Editor
- TipTap with StarterKit, Placeholder, Typography, custom VariableExtension
- Variable chips render inline with category colors
- Real-time character count

### Drag-and-Drop
- @dnd-kit for section reordering
- SortableContext with verticalListSortingStrategy
- Section order stored as string[] in database

### State Management
- zustand with zundo temporal for undo/redo
- Keep last 50 states
- Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z

### Auto-Save
- 2 second debounce via use-debounce
- Offline queue for failed saves
- Status indicator (saving/saved/error) localized

### AI Generation
- Claude API for content generation
- Per-section prompts with context injection
- Locale-aware prompt templates (EN/LT)

</decisions>

<references>
## Reference Documents

- `DESIGN.md` — Full specification with schemas and UI mockups
- `56-CONTEXT.md` — Prospect input patterns (prerequisite)
- Phase 46-47 — Existing proposal system foundation

</references>

<success_criteria>
## Success Criteria

1. Template selector shown when creating proposal
2. Click any section text to edit inline
3. Drag variables from palette into content
4. Variables render as colored chips with preview
5. Drag sections to reorder with smooth animation
6. Add custom sections (text, image, testimonial, etc.)
7. Auto-save within 2 seconds of last change
8. Clone proposal creates full copy with one click
9. View and restore previous versions
10. Undo/redo works with Cmd+Z / Cmd+Shift+Z
11. AI generates personalized content per section
12. Magic link generation with copy button
13. All UI available in English and Lithuanian

</success_criteria>

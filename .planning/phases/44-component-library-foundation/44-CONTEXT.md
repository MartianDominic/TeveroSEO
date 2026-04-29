# Phase 44: Component Library Foundation - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Establish the shared design token layer and component library that all v6 UI depends on. Design tokens from design-system-v6.md mapped to Tailwind, 41 extracted/new components, Storybook documentation, 80%+ test coverage.

**Critical constraint:** These components MUST adhere to the design system anti-patterns list. Any component that violates the rules is rejected.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key references:
- `.planning/design/design-system-v6.md` — Design tokens specification
- `.planning/design/gsd-phase0-component-library.md` — Detailed component specifications
- `packages/ui/` — Existing component library location

</decisions>

<code_context>
## Existing Code Insights

**Current packages/ui structure:**
- `src/components/` — 24 existing shadcn components (badge, button, card, etc.)
- `src/lib/` — Utilities (cn function)
- `src/index.ts` — Barrel exports

**Existing components that can be extended:**
- button.tsx, card.tsx, badge.tsx — can add v6 variants
- skeleton.tsx — needs v6 animation update
- status-chip.tsx — consolidate with status-config

**Fonts needed:**
- Geist (sans) — via next/font
- Geist Mono (mono) — via next/font  
- Newsreader (display) — via next/font

</code_context>

<specifics>
## Specific Ideas

From gsd-phase0-component-library.md:
1. Sprint 0A: Tokens Foundation (3.5h)
2. Sprint 0B: Extraction Tasks (7h) — ProgressBar, status-config, formatRelativeTime, CardActionMenu, StepIndicator
3. Sprint 0C: New Primitives (21.5h) — Checklist, PipelineStageCard, KanbanColumn, etc.
4. Sprint 0D: Stories & Tests (11h)
5. Sprint 5: v6/v7 Components (12h)
6. Sprint 6: UX State Components (8h)
7. Sprint 7: Accessibility Foundation (6h)
8. Sprint 8: Additional Overlays (4h)

Total: 73 hours, 41 components

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

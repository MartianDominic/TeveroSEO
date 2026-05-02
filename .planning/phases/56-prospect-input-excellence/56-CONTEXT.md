# Phase 56: Prospect Input Excellence - Context

**Gathered:** 2026-04-30
**Status:** Ready for execution
**Mode:** Auto-generated (discuss skipped per user request)

<domain>
## Phase Boundary

Make the core value proposition real — "paste anything, get brilliant insights" with conversation dump parsing, confirmation flows, real-time progress, AND strict keyword intelligence with zero contextual drift.

**Expanded Scope (56.1):** Keyword Intelligence Pipeline
- 4-stage pipeline: Context Extraction → Universe Generation → AI Classification → pSEO Patterns
- Strict business context enforcement (no more "siuvinėjimo paslaugos" mixed with B2B jackets)
- Tiered keyword classification with manual override UI
- PAA, autocomplete, pSEO pattern generation

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase skipped per user request. Use ROADMAP phase goal, success criteria, DESIGN.md specifications, and codebase conventions to guide decisions.

Key guidance from DESIGN.md:
- Three input modes: Website URL, Website + Context, Conversation Only
- Confirmation flow required before analysis proceeds
- SSE for real-time progress feedback
- v6 design system tokens and patterns

Key guidance from 56-KEYWORD-INTELLIGENCE.md:
- XML meta-prompts for each AI stage
- Zod schemas for structured outputs
- 4-tier keyword classification (Pure, Adjacent, Commercial, Exclude)
- Business context extraction with negative associations

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddProspectDialog.tsx` — existing dialog to extend with modes
- `@tevero/ui` Dialog, Tabs, Input, Textarea components
- `createProspectAction` server action exists

### Established Patterns
- Server actions for mutations
- Zustand for client state
- Zod for validation
- TanStack Query for server state

### Integration Points
- `/prospects` page renders AddProspectDialog
- `open-seo-main` backend handles prospect creation/analysis

</code_context>

<specifics>
## Specific Ideas

Per DESIGN.md specifications — follow the detailed technical implementation section.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>

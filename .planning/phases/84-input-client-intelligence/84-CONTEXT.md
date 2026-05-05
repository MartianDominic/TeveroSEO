# Phase 84: Conversational Input Integration - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning
**Revised:** Scope reduced after codebase investigation — most components already built

<domain>
## Phase Boundary

Wire existing conversation intelligence services into the keyword analysis pipeline. This is INTEGRATION work, not new builds.

**Key insight:** PROSPECT and CLIENT are separate paths (`/prospects/:id` vs `/clients/:id`), not a "mode" to detect within the same flow.

</domain>

<decisions>
## Implementation Decisions

### D-01: KeywordGenerator Integration
The KeywordGenerator already exists at `open-seo-main/src/server/lib/opportunity/keywordGenerator.ts` (from Phase 29). It uses Claude to generate 50-100 keywords from business info.

**Decision:** Wire this into the main keyword analysis chat flow. When user describes their business, call KeywordGenerator THEN run the full analysis pipeline on the generated keywords.

### D-02: Clarifying Question Handler
ConstraintExtractor already returns `clarificationNeeded[]` when confidence < 0.5.

**Decision:** Build a conversational loop that presents these as follow-up questions in the chat UI, collects answers, and re-runs extraction with enriched context.

### D-03: GSC Data Bridge (Client Path Only)
GSC service exists in AI-Writer (`gsc_service.py`). Client schemas have GSC credentials.

**Decision:** For `/clients/:id` path, call AI-Writer's GSC service to get current rankings, then overlay this data in the analysis results (show ranking gaps, position data).

### D-04: Frontend Import Dialog
CsvImportService and ColumnDetector exist with full backend support. No UI exists.

**Decision:** Build `CsvImportDialog.tsx` that calls existing preview endpoint, shows detected format (Ahrefs/SEMrush/Moz), allows column mapping override, and triggers import.

### Claude's Discretion
- Google Sheets sync (lower priority, can defer)
- Constraint undo/redo (nice-to-have)
- Smart follow-up suggestions (nice-to-have)

</decisions>

<code_context>
## Existing Code (Already Built)

### Conversation Intelligence
- `conversation/ConstraintExtractor.ts` — Claude Sonnet 4.6, 7 constraint categories, confidence scoring, clarificationNeeded[]
- `conversation/types.ts` — Full Zod schemas (BusinessContext, GeoConstraints, etc.)
- `conversation/prompts.ts` — XML metaprompt with Lithuanian examples
- `context/NegativeAssociationExtractor.ts` — Competitors, wrong intents extraction

### Keyword Generation
- `lib/opportunity/keywordGenerator.ts` — Claude generates 50-100 keywords from business info (Phase 29)
- Input: products, brands, services, location, targetMarket, language
- Output: Keywords across 5 categories (product, brand, service, commercial, informational)

### CSV Import
- `services/CsvImportService.ts` — csv-parse/sync, preview mode, BOM cleanup
- `services/ColumnDetector.ts` — Auto-detection of Ahrefs, SEMrush, Moz formats
- API endpoint exists in worktree (needs merge to main)

### Client Data
- `db/client-schema.ts` — GSC credentials (gscRefreshToken, gscSiteUrl)
- `AI-Writer/backend/services/gsc_service.py` — Full OAuth, search analytics

</code_context>

<gaps>
## Actual Gaps (Work To Do)

| Gap | Description | Effort |
|-----|-------------|--------|
| KeywordGenerator wiring | Call from chat flow, pipe to analysis pipeline | 2-3 hours |
| Clarifying question loop | Use clarificationNeeded[] in conversational UI | 3-4 hours |
| GSC bridge | HTTP call from open-seo-main to AI-Writer GSC endpoint | 2-3 hours |
| CsvImportDialog.tsx | Frontend for existing backend | 3-4 hours |

**Total estimated effort:** ~2 days (not 3 weeks)

</gaps>

<deferred>
## Deferred Ideas

- Google Sheets sync — Can add later if agencies request it
- Constraint undo/redo — Nice-to-have, not critical for MVP
- Smart follow-up suggestions — Can enhance after core flow works

</deferred>

---

*Phase: 84-input-client-intelligence*
*Context gathered: 2026-05-05*
*Revised after Opus agent codebase investigation*

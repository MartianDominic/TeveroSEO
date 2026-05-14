# Phase 102: Advanced Document Builder — Specification

**Created:** 2026-05-14
**Ambiguity score:** 0.14 (gate: ≤ 0.20)
**Requirements:** 8 locked

## Goal

Build a persuasion-aware visual document builder that enables non-technical agency users to create direct-response proposals (Russell Brunson / Dan Kennedy style) using drag-drop blocks, optional frameworks, and conversion analytics — simple enough that users don't abandon it for manual copy-paste.

## Background

**Current state:**
- TipTap rich-text editor exists (ProposalInlineEditor.tsx) with variable injection
- @dnd-kit drag-drop is used elsewhere (Kanban, SectionSelector)
- VersionHistory.tsx shows version list + restore, but no diff view
- ContentBlockRepository with 8 categories exists from Phase 101
- No persuasion-aware block types
- No conversion analytics (heatmaps, block correlation)

**What triggers this work:**
- The TipTap editor requires formatting knowledge — non-technical users struggle
- Templates have fixed sections — can't dynamically reorder per prospect
- No visibility into which content blocks correlate with closed deals
- User's real-world proposal (Lithuanian SEO sales letter) follows Russell Brunson's "Perfect Webinar" structure but can't be built with current tools

**Primary deliverable:**
A visual block builder that can recreate the user's 3000-word Lithuanian SEO proposal with persuasion blocks, live preview, and conversion tracking.

## Requirements

1. **Persuasion Block Types**: Builder provides 8+ block types mapped to direct-response copywriting elements.
   - Current: Generic blocks (text, image, table) — no persuasion awareness
   - Target: Block types include: Risk Reversal, Pain Amplifier, Villain Story, Social Proof, Objection Handler, Process Reveal, Offer Stack, CTA — each with purpose-specific templates
   - Acceptance: Can find and insert each block type; each block has placeholder content explaining its persuasion purpose

2. **Drag-Drop Block Reordering**: Blocks can be reordered via drag-drop with live preview.
   - Current: Section reorder exists in SectionSelector but not for document blocks
   - Target: Drag handles on each block, drop zones between blocks, smooth animation, preview updates in real-time
   - Acceptance: Can drag a block from position 3 to position 7; preview reflects new order within 200ms

3. **Optional Framework Templates**: Pre-built persuasion frameworks available as starting points.
   - Current: No framework templates exist
   - Target: At least 3 frameworks: "Russell Brunson Perfect Webinar", "StoryBrand", "PAS (Problem-Agitate-Solution)" — each pre-populates blocks in recommended order with placeholder guidance
   - Acceptance: Can start from a framework and see all blocks pre-arranged; can also start blank and build freestyle

4. **Section Heatmaps**: Track where prospects spend time reading.
   - Current: documentSectionViews table exists from Phase 101 but no heatmap visualization
   - Target: Visual heatmap overlay showing engagement time per section; color gradient from cold (skipped) to hot (read thoroughly)
   - Acceptance: After a prospect views a proposal, heatmap shows which sections got attention

5. **Block → Close Correlation**: Track which block variations correlate with closed deals.
   - Current: No correlation tracking
   - Target: Analytics dashboard shows "This guarantee block version appeared in 12 closed deals vs 7 for the other version"; surfaces top-performing block variants
   - Acceptance: Can see which block variants have highest close rate; data updates as deals close

6. **A/B Testing UI**: Create and manage block-level A/B tests.
   - Current: No A/B testing capability
   - Target: Can mark a block as "A/B test", provide 2+ variants, system randomly assigns to prospects, tracks performance
   - Acceptance: Can create an A/B test on the guarantee block; different prospects see different variants; winner can be identified from analytics

7. **AI Content Generation**: Generate block content using AI based on context.
   - Current: AI proposal generation exists in Phase 101-06 but not integrated with block builder
   - Target: "Generate with AI" button on each block; uses prospect data + block purpose to generate relevant copy; can regenerate or edit
   - Acceptance: Can click "Generate" on a Pain Amplifier block; AI produces relevant copy based on prospect's industry/situation

8. **Side-by-Side Version Diff**: Compare two document versions visually.
   - Current: VersionHistory.tsx shows list + restore, but no diff view
   - Target: Can select two versions and see side-by-side comparison with added/removed/changed blocks highlighted
   - Acceptance: After editing a proposal, can compare v1 to v2 and see exactly what changed

## Boundaries

**In scope:**
- Visual drag-drop block builder for proposals, contracts, reports
- 8+ persuasion-aware block types with templates
- 3+ framework templates (Perfect Webinar, StoryBrand, PAS)
- Section heatmaps showing reading engagement
- Block → close correlation analytics
- A/B testing UI for block variants
- AI content generation per block
- Side-by-side version diff view
- Desktop-first editing experience
- Single-user editing (no concurrent editors on same document)

**Out of scope:**
- Real-time collaboration (co-editing with presence indicators) — deferred, adds architectural complexity
- Mobile editing UI — mobile is read-only; editing is desktop
- Approval workflows — deferred to Phase 103+
- Scheduled sends — deferred to Phase 103+
- A/B testing at the full-document level — only block-level in this phase

## Constraints

- **Performance**: Editor must handle 5000 words / 50+ blocks without lag (< 100ms re-render)
- **Simplicity**: Primary failure mode is "too complex, users give up" — every feature must justify its UI complexity
- **Concurrency**: Single editor at a time; no real-time sync needed (simplifies architecture)
- **Integration**: Must integrate with existing ContentBlockRepository, ProposalGenerationService, documentSectionViews schema
- **Framework**: Use @dnd-kit (already in codebase) for drag-drop; extend existing TipTap for rich text within blocks

## Acceptance Criteria

- [ ] Can recreate the 3000-word Lithuanian SEO proposal using the builder (the "litmus test")
- [ ] All 8 persuasion block types are available and insertable
- [ ] Blocks can be reordered via drag-drop with live preview
- [ ] At least 3 framework templates available (Perfect Webinar, StoryBrand, PAS)
- [ ] Section heatmap shows engagement data after prospect views proposal
- [ ] Analytics dashboard shows block → close correlation data
- [ ] Can create A/B test on a block and see which variant performs better
- [ ] Can generate AI content for any block based on prospect context
- [ ] Can compare two versions side-by-side with diff highlighting
- [ ] Editor does not lag with 50+ blocks (< 100ms re-render)
- [ ] Build passes TypeScript compilation with no errors
- [ ] 80%+ test coverage on new services

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                    |
|--------------------|-------|------|--------|------------------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      | Persuasion-aware builder for direct-response proposals |
| Boundary Clarity   | 0.90  | 0.70 | ✓      | Clear in/out scope; real-time collab deferred |
| Constraint Clarity | 0.75  | 0.65 | ✓      | 5000 words, 50+ blocks, simplicity critical |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | Lithuanian proposal as litmus test |
| **Ambiguity**      | 0.14  | ≤0.20| ✓      |                                          |

## Interview Log

| Round | Perspective     | Question summary                           | Decision locked                                |
|-------|-----------------|-------------------------------------------|------------------------------------------------|
| 1     | Researcher      | What document types?                      | All types (proposals, contracts, reports)      |
| 1     | Researcher      | Core problem TipTap doesn't solve?        | Non-technical users, rigid templates, no analytics |
| 2     | Simplifier      | MVP core?                                 | Visual builder + preview (selected)            |
| 2     | Simplifier      | Should include frameworks?                | Optional — templates available, can freestyle  |
| 2     | Simplifier      | Analytics priority?                       | Both heatmaps AND block correlation in MVP     |
| 3     | Boundary Keeper | What's explicitly NOT Phase 102?          | Real-time collaboration (co-editing)           |
| 3     | Boundary Keeper | Definition of done?                       | Can build the exact Lithuanian SEO proposal    |
| 4     | Failure Analyst | Worst failure mode?                       | Builder too complex, users give up → simplicity critical |
| 4     | Failure Analyst | Performance constraints?                  | 5000 words, 50+ blocks, single editor          |

---

*Phase: 102-advanced-document-builder*
*Spec created: 2026-05-14*
*Next step: /gsd-discuss-phase 102 — implementation decisions (block architecture, analytics schema, AI integration)*

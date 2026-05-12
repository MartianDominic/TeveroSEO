# Phase 98: Implementation Checklist

> **Reference:** See `PHASE-98-COMPLETE-SPEC.md` for full specification
>
> **Estimated Duration:** 5-6 weeks
>
> **Updated:** 2026-05-10

---

## Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Tenant Isolation | ✅ COMPLETE | 7 files in `apps/web/src/lib/tenant/` |
| Keyword Intelligence | ✅ EXISTS | `open-seo-main/src/server/features/keywords/` |
| Proposals | ✅ EXISTS | Full workflow, magic links, payments |
| Prospects/Clients | ✅ EXISTS | 8-stage pipeline, conversion flow |
| Stripe Integration | ✅ EXISTS | Multi-provider (Stripe + Revolut) |
| DataForSEO | ✅ EXISTS | All APIs wrapped |
| Chat Infrastructure | ⚠️ PARTIAL | CopilotKit exists, needs routing |
| Intent Router | 🔲 TODO | |
| Analysis Registry | 🔲 TODO | |
| Configuration UI | 🔲 TODO | |

---

## Phase 1: Core Chat (Week 1-2)

### Intent Detection & Routing
- [ ] Create `apps/web/src/lib/seo-chat/router/intent-detector.ts`
- [ ] Pattern matching for 9 intent types
- [ ] LLM fallback for ambiguous queries
- [ ] Context extractor (domain, keywords, competitor)

### Analysis Framework
- [ ] Create `apps/web/src/lib/seo-chat/analyses/registry.ts`
- [ ] Create `apps/web/src/lib/seo-chat/analyses/executor.ts` (DAG executor)
- [ ] Define `Analysis` interface with dependencies

### Core Analyses
- [ ] `domain_health` - Wire to DataForSEO Domain Analytics
- [ ] `keyword_feasibility` - Implement calculation logic
  - [ ] DA gap calculation
  - [ ] Links needed estimation
  - [ ] Timeline calculation
  - [ ] Effort level classification

### Chat UI
- [ ] Create `apps/web/src/app/(dashboard)/seo-chat/page.tsx`
- [ ] Create `apps/web/src/components/seo-chat/ChatProvider.tsx`
- [ ] Create `apps/web/src/components/seo-chat/ChatInput.tsx`
- [ ] Create `apps/web/src/components/seo-chat/ChatMessage.tsx`
- [ ] Create `apps/web/src/components/seo-chat/AnalysisCard.tsx`
- [ ] SSE streaming endpoint for progress

---

## Phase 2: Keyword Intelligence (Week 2-3)

### Analyses
- [ ] `keyword_universe` - Wire to `KeywordUniverseBuilder`
- [ ] `topical_map` - Wire to `HierarchyBuilder` + `HDBSCANClusterer`
- [ ] `competitor_discovery` - Wire to DataForSEO Competitors
- [ ] `content_gaps` - Wire to Ranked Keywords + gap logic
- [ ] `quick_wins` - Composite analysis (domain + feasibility)

### Topical Map UI
- [ ] Create `apps/web/src/components/seo-chat/TopicalMapView.tsx`
- [ ] Hierarchical tree visualization
- [ ] Keyword difficulty indicators
- [ ] Volume and value per cluster

---

## Phase 3: Proposal Integration (Week 3-4)

### Keyword Assignment
- [ ] Create `apps/web/src/lib/seo-chat/proposal/keyword-assigner.ts`
- [ ] Implement assignment strategies:
  - [ ] `first_n` - First N keywords from list
  - [ ] `by_priority` - Sort by priority score
  - [ ] `by_feasibility` - Sort by easiest first
  - [ ] `manual` - Agency picks per proposal

### Proposal Generation
- [ ] Create `apps/web/src/lib/seo-chat/proposal/generator.ts`
- [ ] Wire to `ProposalGeneratorService`
- [ ] Include topical map in proposal
- [ ] Package-to-keyword mapping

### Magic Link
- [ ] Create `apps/web/src/lib/seo-chat/proposal/magic-link.ts`
- [ ] Generate shareable token
- [ ] "Copy Link" action in chat
- [ ] "Send via Email" action in chat

### Prospect Management
- [ ] Auto-create prospect on first domain mention
- [ ] Store conversation context with prospect
- [ ] Update pipeline stage on proposal sent

---

## Phase 4: Prospect Portal (Week 4-5)

### Enhanced Proposal View
- [ ] Update `apps/web/src/app/proposals/[token]/page.tsx`
- [ ] Add opportunity summary section
- [ ] Add topical map viewer for prospects
- [ ] Show keyword assignments per package

### Package Selection
- [ ] Create package selection UI with comparisons
- [ ] Show which keywords are in each package
- [ ] Highlight recommended package

### Checkout Flow
- [ ] Terms acceptance checkbox
- [ ] Stripe checkout integration
- [ ] Success/confirmation page
- [ ] Client creation on payment success
- [ ] Onboarding checklist auto-created

---

## Phase 5: Configuration (Week 5)

### Settings UI
- [ ] Create `apps/web/src/app/(dashboard)/seo-chat/settings/page.tsx`

### Feasibility Settings
- [ ] Max feasible keyword difficulty
- [ ] Agency link building capacity
- [ ] Agency content capacity
- [ ] Timeline calculation parameters

### Package Settings
- [ ] Package CRUD (name, price, keyword limit)
- [ ] Service inclusions checkboxes
- [ ] Default package selection
- [ ] Keyword assignment strategy

### Proposal Settings
- [ ] Logo upload
- [ ] Brand color picker
- [ ] Expiry days
- [ ] Contract minimum months
- [ ] Terms URL

### Response Settings
- [ ] Tone selection (professional/casual/technical)
- [ ] Language selection
- [ ] Auto-suggest settings

---

## Phase 6: Polish (Week 5-6)

### Additional Analyses
- [ ] `technical_audit` - Wire to DataForSEO Lighthouse
- [ ] General Q&A handler (no external APIs)

### Edge Cases
- [ ] Handle missing domain in conversation
- [ ] Handle ambiguous intents (ask for clarification)
- [ ] Handle DataForSEO rate limits/errors
- [ ] Handle expired proposals gracefully

### Testing
- [ ] Unit tests for intent detection
- [ ] Unit tests for feasibility calculation
- [ ] Integration tests for analysis pipeline
- [ ] E2E tests for full flow (chat → proposal → payment)

### Documentation
- [ ] Update CLAUDE.md with chat commands
- [ ] User guide for agency

---

## File Structure (Final)

```
apps/web/src/lib/seo-chat/
├── index.ts
├── types.ts
├── router/
│   ├── intent-detector.ts
│   ├── context-extractor.ts
│   └── pipeline-mapper.ts
├── analyses/
│   ├── registry.ts
│   ├── executor.ts
│   ├── domain-health.ts
│   ├── keyword-feasibility.ts
│   ├── keyword-universe.ts
│   ├── topical-map.ts
│   ├── competitor-discovery.ts
│   ├── technical-audit.ts
│   ├── content-gaps.ts
│   └── quick-wins.ts
├── proposal/
│   ├── generator.ts
│   ├── keyword-assigner.ts
│   └── magic-link.ts
├── state/
│   ├── conversation-context.ts
│   └── prospect-manager.ts
├── config/
│   ├── settings-loader.ts
│   └── defaults.ts
└── api/
    └── route.ts

apps/web/src/components/seo-chat/
├── ChatProvider.tsx
├── ChatInput.tsx
├── ChatMessage.tsx
├── AnalysisCard.tsx
├── TopicalMapView.tsx
├── ProposalActions.tsx
└── SettingsPanel.tsx

apps/web/src/app/(dashboard)/seo-chat/
├── page.tsx
└── settings/
    └── page.tsx
```

---

## Integration Points

| Existing System | Integration Method |
|-----------------|-------------------|
| `KeywordUniverseBuilder` | Import and call in `keyword_universe` analysis |
| `HierarchyBuilder` | Import and call in `topical_map` analysis |
| `HDBSCANClusterer` | Used by `HierarchyBuilder` |
| `ProposalService` | Import and call in proposal generator |
| `ProposalGeneratorService` | Wire to chat proposal generation |
| DataForSEO client | Import and call in relevant analyses |
| Tenant middleware | Wrap all API endpoints |
| Stripe checkout | Reuse existing invoice payment flow |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Intent detection accuracy | >90% |
| Domain health analysis time | <3s |
| Keyword feasibility time | <5s |
| Proposal generation time | <8s |
| Prospect → Client conversion | Track and optimize |

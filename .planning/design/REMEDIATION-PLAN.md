# GSD Plan Remediation

> **Generated:** 2026-04-30
> **Current Phase:** 43 (Gap Closure) - New work starts Phase 44+

---

## MANDATORY: Source of Truth Documents

**All implementation MUST comply with these three documents. No exceptions.**

| Document | Path | Purpose | Compliance Level |
|----------|------|---------|------------------|
| **Design System v6** | [design-system-v6.md](./design-system-v6.md) | Visual rules: tokens, typography, shadows, motion | **BLOCKING** - UI that doesn't use v6 tokens will be rejected |
| **User Journeys v7** | [v7-master-design-architecture.md](./v7-master-design-architecture.md) | Journey flows, component mapping, cross-domain patterns | **BLOCKING** - Features must support documented journeys |
| **Agency Pipeline v8** | [v8-agency-pipeline.md](./v8-agency-pipeline.md) | 6-stage pipeline, checklists, state machines, automations | **BLOCKING** - Pipeline features must match v8 specification |

### Compliance Rules

1. **Before writing ANY component**: Read the relevant v6 section. Use exact token names.
2. **Before implementing ANY feature**: Check v7 for the journey. Implement the full flow.
3. **Before building ANY pipeline stage**: Read v8. Match the checklist items and state transitions.
4. **Code review gate**: PR descriptions must cite which v6/v7/v8 sections they implement.
5. **No invented patterns**: If it's not in v6/v7/v8, ask before building it.

### Quick Reference Links

**v6 Design System:**
- [Shadows](./design-system-v6.md#shadows) - ghost-edge, hover-lift (NO drop-shadow)
- [Typography](./design-system-v6.md#typography) - Newsreader display, Geist body, 12px floor
- [Colors](./design-system-v6.md#colors) - ONE accent color only, semantic grays
- [Motion](./design-system-v6.md#motion) - ease-micro 100ms, ease-standard 200ms, NO pulse
- [Anti-patterns](./design-system-v6.md#anti-patterns) - What NOT to do

**v7 Journeys:**
- [Journey-Component Mapping](./v7-master-design-architecture.md#journey-to-component-mapping) - Which components each journey needs
- [Cross-Domain Patterns](./v7-master-design-architecture.md#cross-domain-patterns) - Finding→Article, Keyword→Content
- [Layer Architecture](./v7-master-design-architecture.md#layer-architecture) - Calm/Control/Power layers

**v8 Pipeline:**
- [Stage Definitions](./v8-agency-pipeline.md#pipeline-stages) - Lead→Proposal→Contract→Payment→Onboarding→Active
- [Checklists](./v8-agency-pipeline.md#checklists) - Items per stage, auto vs manual
- [State Machines](./v8-agency-pipeline.md#state-machines) - Valid transitions per entity
- [Automations](./v8-agency-pipeline.md#automations) - What triggers automatically

---

## Executive Summary

Five Opus review agents audited all GSD plans against the three source-of-truth documents. Findings:

| Audit | Score | Critical Issues |
|-------|-------|-----------------|
| v6 Design Compliance | 2.5/5 | Phase 3 has ZERO v6 tokens; multiple accent colors used |
| User Journey Coverage | 75% | Reports domain = 0%; 6 orphan journeys |
| Agency Pipeline Coverage | 85% | Lead stage = 20%; monthly touchpoints missing |
| Plan Integration | MODERATE RISK | Duplicate schemas; missing handoffs |
| Missing Features | 35-40% | Mobile, a11y, empty states, notifications all missing |

**Bottom Line:** Happy path works, but plans omit UX polish, accessibility, mobile, and notification infrastructure that the source docs require. The product will be functional but won't match the "Stripe + Linear + Superhuman" quality bar.

---

## Phase Renumbering

Current work is Phase 40-43. New implementation phases:

| Old Name | New Phase # | Description |
|----------|-------------|-------------|
| Phase 0: Component Library | **Phase 44** | Design tokens + 14 shared components |
| Phase 1: Data Foundation | **Phase 45** | Schema additions for pipeline |
| Phase 2: Proposal System | **Phase 46** | Proposal sending, tracking, accept/reject |
| Phase 3: Contract + Payment | **Phase 47** | Dokobit + Stripe + Bank Transfer |
| Phase 4: Onboarding + Dashboard | **Phase 48** | Checklist system + Agency dashboard |
| Page Migration (Batch 1) | **Phase 49** | P0 routes (Dashboard, Intelligence) |
| Page Migration (Batch 2) | **Phase 50** | P1 routes (Audit, Content, Keywords) |
| Page Migration (Batch 3) | **Phase 51** | P2 routes (Pipeline, Settings) |
| Page Migration (Batch 4) | **Phase 52** | P3 routes (Admin, Remaining) |

---

## Critical Fixes (Must Do Before Execution)

### 1. Phase 47 (Contract+Payment): Add v6 Tokens

**Problem:** Phase 3/47 has ZERO v6 token references. Uses hardcoded colors.

**Fix:** Add to every Sprint task in gsd-phase3-contract-payment.md:

```markdown
**v6 Tokens Required:**
- Shadows: `--shadow-ghost-edge`, `--shadow-hover-lift`
- Colors: `--accent-600` only (no blue/yellow/emerald/purple)
- Typography: `--font-display` (Newsreader), `--font-body` (Geist)
- Spacing: `--space-md` (16px), `--space-lg` (24px)
- Motion: `--ease-micro` 100ms, `--ease-standard` 200ms
```

### 2. Remove Multi-Color Status Config

**Problem:** status-config.ts uses blue/yellow/emerald/purple. v6 mandates ONE accent color.

**Fix:** Replace color-coded statuses with:
- Semantic grays + single accent
- Icon differentiation (check, clock, alert)
- Text labels for clarity

```typescript
// WRONG (current)
const colors = { sent: 'blue', pending: 'yellow', error: 'red' }

// RIGHT (v6 compliant)
const colors = { 
  active: 'accent',      // only accent color
  inactive: 'muted',     // gray
  error: 'destructive'   // red (only for errors)
}
```

### 3. Remove Pulse Animation

**Problem:** Phase 47 uses `animate-pulse` which is banned in v6.

**Fix:** Replace with static indicators or `--ease-micro` opacity transitions.

### 4. Reconcile Duplicate Schemas

**Problem:** `onboarding_checklists` and `pipeline_activities` defined in both Phase 45 AND Phase 48.

**Fix:** Define ONCE in Phase 45, reference in Phase 48:

```markdown
Phase 45 (Data Foundation):
- CREATE TABLE onboarding_checklists (...)  <-- Source of truth
- CREATE TABLE pipeline_activities (...)    <-- Source of truth

Phase 48 (Onboarding):
- "Uses onboarding_checklists from Phase 45" <-- Reference only
```

---

## Phase 43 UI Files Requiring v6 Compliance

> **Added:** 2026-04-30
> **Reason:** These files were created during Phase 43 execution BEFORE the v6 design phases (44-53) were planned. They need to be included in Phase 49-52 page migrations for v6 token updates.

### Keyword Pipeline UI (23 files)

**Prospect Keywords (Phase 49/50):**
```
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/page.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/actions.ts
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/KeywordTable.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/ScoreWeightEditor.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/page.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/actions.ts
apps/web/src/app/(shell)/prospects/keywords/page.tsx
apps/web/src/app/(shell)/prospects/keywords/components/EntrySelector.tsx
apps/web/src/app/(shell)/prospects/keywords/quick-check/page.tsx
apps/web/src/app/(shell)/prospects/keywords/quick-check/actions.ts
apps/web/src/app/(shell)/prospects/keywords/competitor-spy/page.tsx
apps/web/src/app/(shell)/prospects/keywords/competitor-spy/actions.ts
```

**Scrape Config UI (Phase 50/51):**
```
apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/page.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/actions.ts
apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/components/RuleEditor.tsx
```

**Client Keywords (Phase 50):**
```
apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/page.tsx
apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/[keywordId]/page.tsx
```

### Required v6 Updates Per File

Each file needs:
1. **Shadows:** Replace any `shadow-*` with `--shadow-ghost-edge` or `--shadow-hover-lift`
2. **Colors:** Replace hardcoded colors with `--accent-600` (single accent) or semantic grays
3. **Typography:** Ensure `--font-display` (Newsreader) for headings, `--font-body` (Geist) for text
4. **Spacing:** Use `--space-*` tokens (12px floor)
5. **Motion:** Replace any `animate-pulse` with `--ease-micro` 100ms transitions

### Assignment to Phases

| Phase | Files to Update |
|-------|-----------------|
| Phase 49 | prospects/keywords/* (entry point) |
| Phase 50 | prospects/[prospectId]/keywords/*, clients/*/keywords/* |
| Phase 51 | prospects/[prospectId]/scrape-config/* |

---

## High Priority Additions

### 5. Create Lead Management Plan (NEW Phase 44.5)

**Problem:** Lead stage has 20% coverage. No lead checklist, no lead card UI.

**Add to Phase 45 or create Phase 44.5:**

```markdown
## Lead Management Tasks (20-25 hours)

### Schema
- CREATE TABLE lead_checklists (9 items: 5 auto + 4 manual)
- ADD COLUMN prospects.lead_source (website_form, referral, cold_outreach, demo_request)
- ADD COLUMN prospects.referrer_id (FK to users)

### Services  
- LeadQualificationService (checkComplete, markQualified)
- Lead->Proposal transition trigger

### Components
- LeadCard (ghost-edge, status indicator)
- LeadListPage (/prospects filtered to leads)
- QualificationGate modal

### API Routes
- POST /api/prospects/:id/qualify
- GET /api/prospects/leads (lead-stage filter)
```

### 6. Add Monthly Touchpoints to Phase 48

**Problem:** Active client monthly automation not planned.

**Add to Phase 48:**

```markdown
## Monthly Touchpoints Tasks (15-20 hours)

### Schema
- CREATE TABLE monthly_touchpoints (client_id, month, report_generated, report_sent, call_scheduled, call_completed)

### Services
- MonthlyReportGenerator (auto-create report)
- ReportEmailService (send via Loops)
- StrategyCallScheduler (optional calendar integration)

### Jobs (BullMQ)
- monthly-report-job: Runs 1st of month, generates reports for all active clients
- report-delivery-job: Sends reports 3 days after generation

### UI
- MonthlyTouchpointsCard in agency dashboard
- Report history tab per client
```

### 7. Add Reports Domain (NEW Phase 53)

**Problem:** Reports domain has 0% journey coverage.

**Create Phase 53:**

```markdown
## Phase 53: Reports System (40-50 hours)

### Journeys Covered
- 9.1 Generate Report
- 9.2 Custom Report Builder
- 9.3 Scheduled Reports

### Schema
- CREATE TABLE report_templates (id, name, sections, client_id nullable)
- CREATE TABLE report_schedules (client_id, frequency, day_of_month, recipients)
- CREATE TABLE generated_reports (id, client_id, template_id, data_snapshot, pdf_url)

### Components
- ReportPreviewCard
- ReportSectionPicker
- ScheduleReportModal
- ReportEmailDeliveryModal

### API Routes
- GET /api/reports/templates
- POST /api/reports/generate
- POST /api/reports/schedule
- GET /api/reports/:id/download
```

---

## Medium Priority Additions

### 8. Add Missing Phase 44 Components

**Problem:** 10+ v6 components missing from component library plan.

**Add to gsd-phase0-component-library.md (now Phase 44):**

| Component | Source | Sprint |
|-----------|--------|--------|
| TierBreakdownTable | v7 SEO Audit | 3 |
| ConnectionStatusCard | v7 Connections | 3 |
| DropCausesPanel | v7 Intelligence | 3 |
| ReportPreviewCard | v7 Reports | 4 |
| HealthGauge (SVG) | v6 Section 10.3 | 2 |
| OpsStrip (system status) | v6 Section 14.6 | 2 |
| SeverityDots | v6 Section 14.6 | 1 |
| VelocityStrip | v6 Section 14.3 | 2 |
| PeriodSelector | v6 Section 14.2 | 2 |
| CommandPalette (Cmd+K) | v7 Navigation | 4 |
| KeyboardShortcutHint (Kbd) | v6 Section 5.5 | 1 |
| GhostButton | v6 Section 5.3 | 1 |
| IntentBadge | v6 Section 6.3 | 1 |
| CountBadge (tabs) | v6 Section 6.4 | 1 |

### 9. Add Missing Phase 45 Data Models

**Add to gsd-phase1-data-foundation.md (now Phase 45):**

```markdown
### Additional Tables

- connection_health_history (connection_id, checked_at, status, latency_ms)
- audit_finding_to_article_links (finding_id, article_id, created_at)
- report_templates (id, name, sections JSONB, is_default)
- ranking_drop_causes (client_id, keyword_id, drop_date, causes JSONB)
```

### 10. Add Empty/Error/Loading States to Phase 44

**Problem:** No standard empty, error, or loading state components.

**Add to Phase 44:**

```markdown
## UX State Components (8-10 hours)

### EmptyState
- Props: icon, title, description, actionLabel, onAction
- v6: Uses --text-muted, centered layout, ghost button CTA

### ErrorState  
- Variants: inline, card, fullPage
- Props: message, retryLabel, onRetry
- v6: Uses --surface-error background, --text-error text

### LoadingSkeleton
- Props: variant (text, card, table, chart)
- v6: Uses --surface-subtle with 0.5 opacity pulse (NOT animate-pulse)
```

### 11. Add Accessibility Support

**Problem:** `prefers-reduced-motion` not in any plan. Keyboard nav not specified.

**Add to Phase 44:**

```markdown
## Accessibility Tasks (6-8 hours)

### CSS
- Add `@media (prefers-reduced-motion: reduce)` block
- Disable all transitions/animations when active
- Keep instant state changes (opacity, color)

### Focus Management
- FocusTrap component for modals
- Focus restoration after modal close
- Skip-to-main link

### Keyboard Navigation
- Arrow key navigation in menus (Listbox pattern)
- Escape to close modals/dropdowns
- Tab order audit for all new components
```

---

## Lower Priority (Post-MVP)

### 12. Mobile Responsive (Phase 54)

**Problem:** No mobile implementation plan despite v6 specifying breakpoints.

**Create Phase 54 (40-60 hours):**

```markdown
## Phase 54: Mobile Responsive

### Breakpoints (from v6)
- Desktop: > 1200px (3-column)
- Tablet: 880-1200px (2-column, sidebar collapsed)
- Mobile: < 880px (1-column, hamburger menu)

### Tasks
- Sidebar collapse to hamburger
- Touch targets 44px minimum
- Mobile-optimized tables (stacked cards)
- Bottom sheet modals
- Pull-to-refresh for feeds
```

### 13. Business Type Modules (Phase 55)

**Problem:** v7 mentions Local/Ecommerce/Affiliate variants but no plan.

**Create Phase 55:**

```markdown
## Phase 55: Business Type Modules

### Local SEO Module
- GBP integration dashboard
- NAP consistency checker
- Citation builder
- Local ranking grid

### Ecommerce Module
- Product schema validator
- Category page optimizer
- Structured data for products

### Affiliate Module
- Link decay tracker
- Commission integration
- Comparison content optimizer
```

### 14. Demo Mode (Phase 56)

**Problem:** No way to explore product without real data.

**Create Phase 56:**

```markdown
## Phase 56: Demo Mode

### Sample Data
- 3 demo clients with realistic metrics
- 6 months of historical data
- Sample articles, keywords, audits

### UI
- "Demo mode" banner
- Reset demo data button
- Upgrade CTA after demo exploration
```

---

## Cross-Domain Data Contracts

**Problem:** No specification for context passing between domains.

**Add to each cross-domain flow:**

### Finding -> Article Creation
```typescript
// From: AuditFindingsModal
// To: ArticleNewPage
// Context: URL params
?from=audit&finding_id=123&keyword=suggested_keyword&title=suggested_title
```

### Keyword -> Article Creation
```typescript
// From: KeywordDetailPanel
// To: ArticleNewPage
// Context: URL params
?keyword_id=456&intent=informational&volume=1200
```

### Drop Investigation -> Audit
```typescript
// From: RankingInvestigationPanel
// To: AuditPage
// Context: URL params + state
?run_checks=performance,mobile&keyword_id=789
```

### Proposal Accept -> Contract Creation
```typescript
// From: ProposalService.accept()
// To: ContractService.createFromProposal()
// Context: Internal API call
{ proposal_id, services, pricing, client_details }
```

---

## Phase Handoff Definitions

### Phase 44 -> Phase 45
```markdown
Delivers:
- Design tokens (CSS custom properties)
- 14 shared components (Checklist, KanbanColumn, etc.)
- Status-config utility (semantic, not colored)

Expects from Phase 45:
- Nothing (foundation phase)
```

### Phase 45 -> Phase 46
```markdown
Delivers:
- contracts, invoices, onboarding_checklists tables
- ProspectStatus enum with all 14 values
- pipeline_activities table

Expects from Phase 46:
- ProposalService for state transitions
```

### Phase 46 -> Phase 47
```markdown
Delivers:
- Proposal accept webhook trigger
- Proposal data for contract generation

Expects from Phase 47:
- ContractService.createFromProposal()
```

### Phase 47 -> Phase 48
```markdown
Delivers:
- Contract fully_executed event
- Payment received event
- Invoice data for onboarding trigger

Expects from Phase 48:
- OnboardingService.createChecklist()
- ConversionService.convertToClient()
```

---

## Updated Effort Estimates

| Phase | Original | After Remediation | Delta |
|-------|----------|-------------------|-------|
| 44 (Components) | 32h | 52h | +20h (missing components, a11y) |
| 45 (Data) | 15h | 22h | +7h (missing tables, lead schema) |
| 46 (Proposal) | 49h | 52h | +3h (email templates) |
| 47 (Contract+Payment) | 74h | 82h | +8h (v6 tokens, status-config fix) |
| 48 (Onboarding) | 125h | 145h | +20h (monthly touchpoints) |
| 49-52 (Migration) | 367h | 380h | +13h (UX states) |
| 53 (Reports) | NEW | 45h | NEW |
| 54 (Mobile) | NEW | 55h | NEW (post-MVP) |
| 55 (Business Types) | NEW | 80h | NEW (post-MVP) |
| 56 (Demo) | NEW | 20h | NEW (post-MVP) |
| **TOTAL** | 662h | 778h | +116h |

---

## Action Items Checklist

### Immediate (Before Any Execution)

- [ ] Rename plan files with Phase 44-52 numbers
- [ ] Add v6 token references to Phase 47 (Contract+Payment)
- [ ] Replace multi-color status-config with semantic version
- [ ] Remove animate-pulse from Phase 47
- [ ] Deduplicate schemas: single source in Phase 45
- [ ] Document phase handoffs in each plan file

### Before Phase 44 Execution

- [ ] Add 14 missing components to Phase 44 plan
- [ ] Add UX state components (Empty, Error, Loading)
- [ ] Add accessibility tasks to Phase 44

### Before Phase 45 Execution

- [ ] Add lead_checklists schema
- [ ] Add lead_source/referrer_id columns
- [ ] Add connection_health_history table
- [ ] Add report_templates table

### Before Phase 48 Execution

- [ ] Add monthly touchpoints tasks
- [ ] Add MonthlyReportGenerator service
- [ ] Add report delivery jobs

### New Phase Creation

- [ ] Create Phase 53 (Reports) plan document
- [ ] Create Phase 54 (Mobile) plan document
- [ ] Create Phase 55 (Business Types) plan document
- [ ] Create Phase 56 (Demo Mode) plan document

---

## Files to Update

| File | Changes Required |
|------|------------------|
| gsd-phase0-component-library.md | Rename to phase-44, add 14 components, add UX states, add a11y |
| gsd-phase1-data-foundation.md | Rename to phase-45, add lead schema, add missing tables, dedupe |
| phase-2-proposal-system.md | Rename to phase-46, add email templates |
| gsd-phase3-contract-payment.md | Rename to phase-47, add v6 tokens, fix status-config, remove pulse |
| phase4-onboarding-dashboard-plan.md | Rename to phase-48, add monthly touchpoints, reference Phase 45 tables |
| gsd-page-migration-strategy.md | Rename batches to phase-49-52, add UX state requirements |
| NEW: phase-53-reports.md | Create from scratch |
| NEW: phase-54-mobile.md | Create from scratch (post-MVP) |

---

*Last updated: 2026-04-30*
*Source audits: v6-compliance, journey-coverage, pipeline-coverage, integration, missing-features*

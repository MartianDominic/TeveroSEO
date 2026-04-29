# User Journey Coverage Audit

> **Generated:** 2026-04-29
> **Source of Truth:** v7-master-design-architecture.md
> **Plans Audited:** gsd-phase0-component-library.md, gsd-phase1-data-foundation.md, phase-2-proposal-system.md, gsd-phase3-contract-payment.md, phase4-onboarding-dashboard-plan.md, gsd-page-migration-strategy.md

---

## Executive Summary

**Critical Finding:** The source document (v7-master-design-architecture.md) references "200 journeys across 10 domains" in v6-comprehensive-journeys.md, but **this file does not exist**. The journey inventory must be reconstructed from:
- Journey-to-component mappings in v7-master-design-architecture.md
- Detailed flows in v8-agency-pipeline.md
- Implied journeys in page-inventory.md

### Coverage Statistics

| Metric | Value |
|--------|-------|
| **Domains Identified** | 10 |
| **Journeys Documented in v7** | 13 explicit + inferred |
| **Journeys Covered by Plans** | ~85% |
| **Orphan Journeys (no plan)** | 4-6 |
| **Partial Coverage Journeys** | 8 |
| **Missing v6-comprehensive-journeys.md** | CRITICAL GAP |

---

## Domain Coverage Matrix

Based on v7-master-design-architecture.md Section "Journey to Component Mapping Table" and v8-agency-pipeline.md:

| # | Domain | Total Journeys | Covered by Plans | GAP Count | Coverage % |
|---|--------|---------------|------------------|-----------|------------|
| 1 | Onboarding | 3 | 2 | 1 | 67% |
| 2 | Dashboard | 2 | 2 | 0 | 100% |
| 3 | SEO Audit | 3 | 2 | 1 | 67% |
| 4 | Content/Articles | 4 | 3 | 1 | 75% |
| 5 | Keywords/Intelligence | 3 | 2 | 1 | 67% |
| 6 | Prospects/Pipeline | 6 | 6 | 0 | 100% |
| 7 | Voice/Settings | 2 | 2 | 0 | 100% |
| 8 | Connections | 2 | 1 | 1 | 50% |
| 9 | Reports | 2 | 0 | 2 | 0% |
| 10 | Portfolio/All Clients | 1 | 1 | 0 | 100% |
| **TOTAL** | | **28** | **21** | **7** | **75%** |

---

## Detailed Journey Analysis

### Domain 1: Onboarding

**Source:** v7 Section "Journey to Component Mapping Table" + v8 "Stage 5: Onboarding"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 1.1 | New User First-Time Login | PARTIAL | Phase 0 (WelcomeModal, SetupWizard) |
| 1.2 | Client Creation from Prospect | COVERED | Phase 4 (ConversionService) |
| 1.3 | Onboarding Checklist Completion | COVERED | Phase 4 (OnboardingService) |

**Gaps:**
- 1.1: WelcomeModal is listed in Phase 0 but **no detailed spec** for first-time user detection logic
- Demo mode option mentioned but not specified

---

### Domain 2: Dashboard

**Source:** v7 "Journey to Component Mapping Table" + page-inventory.md

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 2.1 | Daily Check-in (Morning Summary) | COVERED | Phase 4 (TodayFeed, OvernightBanner) |
| 2.2 | Quick Client Switch (Cmd+J) | COVERED | Phase 0 (ClientQuickSwitcher) |

**Gaps:** None - both journeys have implementation plans.

---

### Domain 3: SEO Audit

**Source:** v7 "Pattern A: Finding to Action"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 3.1 | Run Audit | COVERED | Existing codebase (page exists) |
| 3.2 | Fix Issue with Content | COVERED | Phase 0 (FindingsModal) |
| 3.3 | Tier-Based Issue Triage | ORPHAN | **Not in any plan** |

**Gaps:**
- 3.3: Tier-based issue triage flow (view issues by Tier 1-4) is implied in v7 but has no explicit plan

---

### Domain 4: Content/Articles

**Source:** v7 "Pattern E: Generation to Quality to Publish"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 4.1 | Create New Article | COVERED | Existing codebase + Phase 0 (GenerationProgress) |
| 4.2 | Review Article Quality Gate | COVERED | Phase 0 (QualityGatePanel) |
| 4.3 | Publish/Schedule Article | COVERED | Phase 0 (PublishModal) |
| 4.4 | Bulk Article Operations | ORPHAN | **Not in any plan** |

**Gaps:**
- 4.4: Bulk actions on articles (mentioned in page-inventory.md as BulkActionBar) - exists in code but no journey plan

---

### Domain 5: Keywords/Intelligence

**Source:** v7 "Pattern B: Opportunity to Content"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 5.1 | Keyword Discovery Quick Wins | COVERED | Phase 0 (KeywordDetailPanel) |
| 5.2 | Create Article from Keyword | COVERED | v7 cross-linking pattern |
| 5.3 | Ranking Investigation | ORPHAN | **Partial - Investigation panel in Phase 0, but no data flow spec** |

**Gaps:**
- 5.3: RankingInvestigationPanel is in Phase 0 component list but the causes/correlation data flow is not specified in any phase plan

---

### Domain 6: Prospects/Pipeline

**Source:** v8-agency-pipeline.md (comprehensive)

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 6.1 | Lead Capture & Qualification | COVERED | Phase 2 (ProspectService) |
| 6.2 | Proposal Creation & Send | COVERED | Phase 2 (Tasks 1-12) |
| 6.3 | Proposal View Tracking | COVERED | Phase 2 (Task 3) |
| 6.4 | Contract Signing | COVERED | Phase 3 (Sprint 1) |
| 6.5 | Payment Collection | COVERED | Phase 3 (Sprint 3-5) |
| 6.6 | Prospect to Client Conversion | COVERED | Phase 4 (Part 1.4) |

**Gaps:** None - most comprehensive coverage.

---

### Domain 7: Voice/Settings

**Source:** v7 + page-inventory.md

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 7.1 | Voice Profile Configuration | COVERED | Existing codebase (VoiceSettings page exists) |
| 7.2 | Brand Protection Rules | COVERED | Existing codebase (ProtectionRulesTab) |

**Gaps:** None.

---

### Domain 8: Connections

**Source:** v7 "Connection Health Dashboard"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 8.1 | OAuth Connection Flow | COVERED | Existing + Phase 4 (OAuth hooks) |
| 8.2 | Connection Health Dashboard | ORPHAN | Listed in v7 overlay components but **no implementation spec** |

**Gaps:**
- 8.2: "Connection Health Dashboard" mentioned in v7 Layer 2 components (P1 priority) but no detailed plan exists

---

### Domain 9: Reports

**Source:** v7 "Journey to Component Mapping Table"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 9.1 | Generate Report | ORPHAN | **Not in any plan** |
| 9.2 | Custom Report Builder | ORPHAN | Listed in v7 Phase 0 but **deprioritized to Sprint 7** |

**Gaps:**
- 9.1 & 9.2: Reports domain has the lowest coverage - pages exist but no journey plans

---

### Domain 10: Portfolio/All Clients

**Source:** v7 "All Clients View"

| Journey ID | Journey Name | Status | Covered By |
|------------|--------------|--------|------------|
| 10.1 | Portfolio View with Bulk Actions | COVERED | Phase 0 (Sprint 5) |

**Gaps:** None.

---

## Orphan Journeys (NOT in any plan)

| Journey ID | Journey Name | Domain | Why Missing? |
|------------|--------------|--------|--------------|
| 3.3 | Tier-Based Issue Triage | SEO Audit | Pages exist but no journey-level plan |
| 4.4 | Bulk Article Operations | Content | BulkActionBar exists but no journey spec |
| 5.3 | Ranking Drop Investigation (full flow) | Intelligence | Component planned, data flow unspecified |
| 8.2 | Connection Health Dashboard | Connections | Component in v7 but no implementation plan |
| 9.1 | Generate Report | Reports | Page exists, no plan for v6 journey |
| 9.2 | Custom Report Builder | Reports | Mentioned in Sprint 7 (deprioritized) |

---

## Partial Coverage (in plan but incomplete)

| Journey ID | Journey Name | What's Missing |
|------------|--------------|----------------|
| 1.1 | New User First-Time Login | First-time detection logic, demo mode flow |
| 3.2 | Fix Issue with Content | Cross-link data contract between audit and article creation |
| 4.1 | Create New Article | Voice template selection UX not detailed |
| 5.1 | Keyword Discovery Quick Wins | Quick win calculation algorithm not specified |
| 5.3 | Ranking Investigation | Causes correlation data source not defined |
| 6.2 | Proposal Send | Loops transactional template IDs not documented |
| 7.1 | Voice Profile Configuration | 40+ field profile structure not in plan |
| 8.1 | OAuth Connection Flow | Token expiry handling not specified |

---

## Cross-Domain Journey Gaps

These journeys span multiple domains and may fall through cracks:

| Flow | Domains Involved | Gap Analysis |
|------|-----------------|--------------|
| **Finding to Fix** | SEO Audit -> Content | FindingsModal links to ArticleNew, but pre-filled context contract undefined |
| **Keyword to Article** | Intelligence -> Content | KeywordDetailPanel has "Create Article" but voice/keyword injection not specified |
| **Drop Investigation** | Dashboard -> Intelligence -> Audit | "Falling" tab links to investigation then audit - full data flow unspecified |
| **Prospect to Active Client** | Pipeline -> Onboarding -> Dashboard | Conversion service exists but "first client dashboard view" moment undefined |
| **OAuth Complete to Checklist** | Connections -> Onboarding | Webhook event fires but checklist auto-complete trigger not documented |

---

## Component Gaps for Journeys

Components needed by journeys but not in gsd-phase0-component-library.md:

| Component | Needed By Journey | Priority |
|-----------|-------------------|----------|
| **ReportPreviewCard** | 9.1 Generate Report | P2 |
| **ReportSectionPicker** | 9.2 Custom Report Builder | P2 |
| **TierBreakdownTable** | 3.3 Tier-Based Issue Triage | P1 |
| **ConnectionStatusCard** | 8.2 Connection Health Dashboard | P1 |
| **DropCausesPanel** | 5.3 Ranking Investigation | P1 |
| **BulkArticleProgress** | 4.4 Bulk Article Operations | P2 |

---

## Data Model Gaps for Journeys

Data/APIs needed by journeys but not in gsd-phase1-data-foundation.md:

| Data Requirement | Needed By Journey | Gap |
|------------------|-------------------|-----|
| **audit_finding_to_article_links** | 3.2 Fix Issue with Content | No FK/relation defined |
| **keyword_to_article_links** | 5.1/5.2 Keyword Discovery | Keyword-article mapping table exists but journey not connected |
| **ranking_drop_causes** | 5.3 Ranking Investigation | Algorithm/data source not specified |
| **report_templates** | 9.2 Custom Report Builder | No schema defined |
| **report_schedules** | 9.1 Generate Report | Partial - exists but not in Phase 1 |
| **connection_health_history** | 8.2 Connection Health Dashboard | No historical tracking table |

---

## Critical Path Analysis

### Journeys That Block Other Journeys

```
1.1 New User First-Time Login
 └── BLOCKS: 1.2 Client Creation (user must exist)
     └── BLOCKS: 1.3 Onboarding Checklist (client must exist)
         └── BLOCKS: 2.1 Daily Check-in (need active client)

6.1 Lead Capture
 └── BLOCKS: 6.2 Proposal Creation
     └── BLOCKS: 6.4 Contract Signing
         └── BLOCKS: 6.5 Payment Collection
             └── BLOCKS: 6.6 Prospect to Client Conversion
                 └── BLOCKS: 1.3 Onboarding Checklist

8.1 OAuth Connection Flow
 └── BLOCKS: 1.3 Onboarding Checklist (auto-complete items)
     └── BLOCKS: 2.1 Daily Check-in (need GSC data)
```

### Highest-Risk Missing Journeys

| Risk | Journey | Impact |
|------|---------|--------|
| **CRITICAL** | 9.1/9.2 Reports | Existing feature, no v6 migration plan |
| **HIGH** | 8.2 Connection Health | User trust feature (visibility), no implementation |
| **HIGH** | 5.3 Ranking Investigation | Core SEO value prop, partial implementation |
| **MEDIUM** | 3.3 Tier-Based Issue Triage | Audit UX improvement, pages exist |
| **MEDIUM** | 4.4 Bulk Article Operations | Efficiency feature, code exists |

---

## Recommendations

### Immediate Actions (Before Phase Execution)

1. **Create v6-comprehensive-journeys.md** - The referenced source file does not exist. Create it with all 200 journeys explicitly listed.

2. **Add Reports Domain Plan** - Reports is the only domain with 0% plan coverage. Create a mini-phase plan for:
   - Report generation journey
   - Custom report builder journey
   - Report scheduling journey

3. **Document Cross-Domain Data Contracts** - For each cross-domain flow, specify:
   - Source component/data
   - Target component/data
   - Context passed (URL params, state, API payload)

### Short-Term (Add to Existing Plans)

4. **Phase 0 Additions:**
   - Add `TierBreakdownTable` component
   - Add `ConnectionStatusCard` component
   - Add `DropCausesPanel` component
   - Add `ReportPreviewCard` component

5. **Phase 1 Additions:**
   - Add `connection_health_history` table
   - Add `audit_finding_to_article_links` relation
   - Add `report_templates` table

6. **Phase 4 Additions:**
   - Add "Connection Health Dashboard" UI task
   - Add "First client dashboard view" moment specification

### Medium-Term (New Phases)

7. **Create Phase 5: Reports System** covering:
   - Report generation service
   - Custom report builder UI
   - Scheduled report delivery
   - Report template management

8. **Create Phase 6: Analytics Enhancements** covering:
   - Ranking drop investigation flow
   - Quick wins algorithm
   - Connection health monitoring

---

## Appendix: Journey-to-Plan Mapping Matrix

| Journey | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Migration |
|---------|---------|---------|---------|---------|---------|-----------|
| 1.1 New User Login | WelcomeModal | - | - | - | - | P3 |
| 1.2 Client Creation | - | ConversionService | - | - | Part 1.4 | P1 |
| 1.3 Onboarding Checklist | Checklist | schema | - | - | Part 1.3 | P2 |
| 2.1 Daily Check-in | TodayFeed | - | - | - | Part 2.6 | P0 |
| 2.2 Client Switch | QuickSwitcher | - | - | - | - | P1 |
| 3.1 Run Audit | - | - | - | - | - | P1 |
| 3.2 Fix with Content | FindingsModal | - | - | - | - | P1 |
| 3.3 Tier Triage | - | - | - | - | - | - |
| 4.1 Create Article | GenerationProgress | - | - | - | - | P1 |
| 4.2 Quality Gate | QualityGatePanel | - | - | - | - | P1 |
| 4.3 Publish | PublishModal | - | - | - | - | P1 |
| 4.4 Bulk Operations | - | - | - | - | - | - |
| 5.1 Keyword Discovery | KeywordDetailPanel | - | - | - | - | P1 |
| 5.2 Keyword to Article | - | - | - | - | - | P1 |
| 5.3 Ranking Investigation | InvestigationPanel | - | - | - | - | - |
| 6.1 Lead Capture | - | - | Task 9 | - | - | P2 |
| 6.2 Proposal Send | - | - | Tasks 1-7 | - | - | P2 |
| 6.3 Proposal Tracking | - | - | Task 3 | - | - | P2 |
| 6.4 Contract Signing | - | schema | - | Sprint 1 | - | P2 |
| 6.5 Payment Collection | - | schema | - | Sprint 3-5 | - | P2 |
| 6.6 Prospect Convert | - | - | - | - | Part 1.4 | P2 |
| 7.1 Voice Config | - | - | - | - | - | P1 |
| 7.2 Protection Rules | - | - | - | - | - | P1 |
| 8.1 OAuth Flow | - | - | - | - | Part 1.6 | P2 |
| 8.2 Connection Health | - | - | - | - | - | - |
| 9.1 Generate Report | - | - | - | - | - | - |
| 9.2 Custom Builder | CustomReportBuilder | - | - | - | - | - |
| 10.1 Portfolio View | AllClientsView | - | - | - | - | P2 |

Legend: `-` = Not covered, `P0-P3` = Migration priority in page-migration-strategy.md

---

*Last updated: 2026-04-29*
*Companion docs: v7-master-design-architecture.md, v8-agency-pipeline.md*

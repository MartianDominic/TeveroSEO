# Phase 99: Unified SEO Content Pipeline — World-Class Specification

> **Status:** Research Phase  
> **Created:** 2026-05-11  
> **Goal:** Design the complete Keywords → Proposal → Client → Content → On-Page SEO pipeline with world-class internal linking, v6 design system compliance, and intelligent automation (autopilot + human-in-the-loop)

---

## Executive Summary

This phase unifies the entire TeveroSEO workflow from prospect keyword scraping through content generation and on-page SEO optimization. The system must:

1. **Keywords → Proposal:** Scrape competitor/prospect keywords, generate AI-powered proposals
2. **Proposal → Client:** Convert prospects with signed agreements, import all keyword data
3. **Client → Content Calendar:** Build world-class content calendar with v6 design system
4. **Content Generation:** AI content with voice compliance, quality gates, auto-publish
5. **On-Page SEO:** 109 checks across 4 tiers, world-class internal linking
6. **Internal Linking:** Intelligent page-to-page linking for existing AND new content
7. **Link Health:** Dead link detection (internal + external), tracking, replacement workflows

---

## The Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           UNIFIED SEO CONTENT PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  PROSPECT   │───►│  PROPOSAL   │───►│   CLIENT    │───►│  CONTENT    │          │
│  │  KEYWORDS   │    │  GENERATION │    │  ONBOARDING │    │  CALENDAR   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘          │
│        │                  │                  │                  │                   │
│        ▼                  ▼                  ▼                  ▼                   │
│  DataForSEO         XML Prompts         Keyword Import    Kanban + Timeline        │
│  Ahrefs MCP         Schwartz/Halbert    Voice Profile     Priority Queue           │
│  Competitor Scrape  ROI Projections     GSC/GA Connect    Publishing Schedule      │
│                                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  CONTENT    │───►│  QUALITY    │───►│  ON-PAGE    │───►│  INTERNAL   │          │
│  │  GENERATION │    │  GATE       │    │  SEO        │    │  LINKING    │          │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘          │
│        │                  │                  │                  │                   │
│        ▼                  ▼                  ▼                  ▼                   │
│  Gemini 3.1 Pro     Score ≥ 80         109 Checks         Hub & Spoke             │
│  Voice Compliance   E-E-A-T Check      seobuild-onpage    PageRank Flow           │
│  500-Token Chunks   Auto/Manual        4-Tier System      Topic Clusters          │
│                                                                                     │
│  ┌─────────────┐    ┌─────────────┐                                                │
│  │  LINK       │───►│  PUBLISH &  │                                                │
│  │  HEALTH     │    │  MONITOR    │                                                │
│  └─────────────┘    └─────────────┘                                                │
│        │                  │                                                         │
│        ▼                  ▼                                                         │
│  Dead Link Scan     GSC Submit                                                      │
│  External Monitor   IndexNow                                                        │
│  Replacement Queue  Performance Track                                               │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Design System Compliance (v6 + v7)

All interfaces MUST follow design-system-v6.md principles:

| Component | v6 Requirement | Implementation |
|-----------|---------------|----------------|
| **Content Calendar** | One editorial moment per page | Big serif numeral showing "12 articles this month" |
| **Keyword Tables** | Hover-to-reveal, ghost-edge shadows | Sparklines on hover, → arrow reveals |
| **Link Health Dashboard** | Status pills, severity dots | ON TRACK/WARNING/BROKEN pills |
| **Progress Indicators** | Goal Hero pattern | 12/20 articles progress block |
| **Pipeline Stages** | Volume bars under counts | Draft/Review/Published stages |

### Autonomy vs Control Balance (v7)

| Feature | Autonomy | Control Point |
|---------|----------|---------------|
| Content generation | Auto-generate on schedule | Quality gate pause |
| Internal linking | Auto-insert links | Review table before confirm |
| Dead link replacement | Auto-detect | Human approves replacements |
| Publishing | Auto if score ≥ 80 | Manual publish option |

---

## Research Areas (20 Subagent Exploration)

### Stream A: Keywords → Proposal (Agents 1-4)
1. **Keyword Scraping Architecture** — DataForSEO, Ahrefs MCP, competitor analysis
2. **Keyword Intelligence Classification** — BOFU/MOFU/TOFU, geo filtering, cascade selection
3. **Proposal Generation System** — XML prompts, awareness classification, ROI projections
4. **Prospect → Client Conversion** — Agreement generation, data migration

### Stream B: Content Calendar (Agents 5-8)
5. **Content Calendar Architecture** — World-class calendar design, v6 compliance
6. **Priority Queue System** — Quick wins, opportunity scoring, schedule optimization
7. **Editorial Workflow** — Draft → Review → Publish states, role-based access
8. **Publishing Automation** — GSC submit, IndexNow, social scheduling

### Stream C: Content Generation (Agents 9-12)
9. **AI Content Pipeline** — Gemini 3.1 Pro, 500-token chunks, seobuild-onpage integration
10. **Voice Compliance System** — 40+ field profiles, VoiceConstraintBuilder
11. **Quality Gate Architecture** — Score calculation, E-E-A-T checks, auto vs manual
12. **Content Editor UX** — WYSIWYG, real-time scoring, revision history

### Stream D: On-Page SEO (Agents 13-16)
13. **109 Checks System** — 4-tier architecture, severity classification
14. **Tiered Scraping Pipeline** — Proxy escalation, cost optimization
15. **Audit Workflow** — Scheduled audits, finding remediation
16. **Technical SEO Automation** — Schema validation, CWV monitoring

### Stream E: Internal Linking (Agents 17-20)
17. **Link Architecture Design** — Hub & spoke, topic clusters, PageRank flow
18. **Existing Page Optimization** — Crawl analysis, link opportunity detection
19. **New Content Linking** — Auto-link to products, related articles
20. **Dead Link System** — Detection, tracking, replacement workflow (autopilot vs HITL)

---

## Critical Questions to Answer

### Internal Linking
1. How do we identify optimal internal link targets for new content?
2. What's the anchor text strategy (exact match vs varied)?
3. How do we balance automation with editorial control?
4. What's the replacement workflow for dead links?

### Human-in-the-Loop vs Autopilot
1. Which operations should be fully automatic?
2. Which require human review before execution?
3. How do we present the review interface (table, queue, dashboard)?
4. What's the escalation path for uncertain decisions?

### Design Integration
1. How does the content calendar fit the v6 shell?
2. What's the "editorial moment" for each page?
3. How do we show internal link health at a glance?
4. What are the empty states for each component?

---

## Subagent Findings (COMPLETE)

> See `FINDINGS-SUMMARY.md` for full consolidation. Key highlights below.

### Stream A: Keywords → Proposal (Agents 1-4)

| Agent | Key Finding | Existing Code | Gap |
|-------|-------------|---------------|-----|
| **1: Keyword Scraping** | DataForSEO Keywords API, $0.015/kw at scale | None | Full implementation needed |
| **2: Classification** | 95+ Lithuanian patterns, dual-signal | `keywords/funnel/patterns.ts` | Wire to pipeline |
| **3: Proposal** | Schwartz + Halbert + XML prompts | Planning docs | ProposalGenerationService |
| **4: Conversion** | Agreement trigger, atomic migration | None | convertProspectToClient() |

### Stream B: Content Calendar (Agents 5-8)

| Agent | Key Finding | Existing Code | Gap |
|-------|-------------|---------------|-----|
| **5: Calendar** | 3 views (Calendar/Kanban/Timeline), v6 | Design tokens | Full component build |
| **6: Priority Queue** | Composite scoring, quick wins pos 11-30 | None | PriorityQueueService |
| **7: Editorial** | 8 states, 4 roles RBAC | Partial in AI-Writer | Unified state machine |
| **8: Publishing** | **CRITICAL: GSC API harms non-job SEO** | Phase 97 IndexNow spec | Replace GSC with IndexNow |

### Stream C: Content Generation (Agents 9-12)

| Agent | Key Finding | Existing Code | Gap |
|-------|-------------|---------------|-----|
| **9: AI Content** | 500-token chunks, 41-point checklist | seobuild-onpage spec | ChunkWriter service |
| **10: Voice** | 40+ fields, VoiceConstraintBuilder | `voice-schema.ts` | Mostly complete |
| **11: Quality Gate** | ≥80 auto-publish, 70-79 manual, <60 regen | scoring_constants.py | QualityGateService |
| **12: Editor UX** | TipTap v2, real-time scoring sidebar | TipTap installed | Custom extensions |

### Stream D: On-Page SEO (Agents 13-16)

| Agent | Key Finding | Existing Code | Gap |
|-------|-------------|---------------|-----|
| **13: 109 Checks** | 4-tier + Tier 5 quality (122 total) | `audit/checks/` | Tier 5 implementation |
| **14: Tiered Scraping** | T0-T5 escalation, 97% savings | DomainLearningService | Phase 100 Scrapling |
| **15: Audit Workflow** | Scheduled via BullMQ, v6 severity dots | schedule-schema.ts | Remediation tracking |
| **16: Technical SEO** | **CrUX API is FREE** (150 req/min) | Schema extraction | CrUX integration |

### Stream E: Internal Linking (Agents 17-20)

| Agent | Key Finding | Existing Code | Gap |
|-------|-------------|---------------|-----|
| **17: Link Architecture** | Hub & spoke, 30-43% more traffic | None | LinkArchitectureService |
| **18: Existing Pages** | Crawl → detect → suggest → optimize | `link-schema.ts` | LinkOpportunityService |
| **19: New Content** | Multi-signal scoring, wrap existing text | Schema ready | NewContentLinker |
| **20: Dead Links** | **Autopilot ≥85% internal, HITL external** | None | Full implementation |

---

## Critical Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Replace GSC Indexing API with IndexNow | GSC API restricted to JobPosting/BroadcastEvent | Prevents SEO harm |
| CrUX API is FREE | 150 requests/minute | No cost for CWV monitoring |
| Autopilot ≥85% for internal dead links | High-confidence same-site replacements | Faster fixes |
| External links always HITL | Editorial decision required | Quality control |
| Hub & spoke topology | 30-43% more traffic, 3.2x AI citations | Better rankings |
| 41-point quality checklist | 33/41 pass, 37/41 auto-publish | Consistent quality |

---

## Implementation Gaps (IDENTIFIED)

### Needs Full Implementation

| Component | Est | Dependencies |
|-----------|-----|--------------|
| KeywordScrapingService | 5d | Phase 100 Scrapling |
| ProposalGenerationService | 4d | Keyword classification |
| ClientConversionService | 4d | Proposal generation |
| ContentCalendar (3 views) | 5d | Design tokens |
| PriorityQueueService | 3d | None |
| ChunkWriter (500-token) | 5d | Voice compliance |
| QualityGateService | 4d | AI content pipeline |
| ContentEditor (TipTap) | 5d | TipTap installed |
| LinkArchitectureService | 4d | None |
| DeadLinkSystem | 5d | Link schema |

### Needs Wiring/Extension

| Component | Est | Existing |
|-----------|-----|----------|
| Funnel classification pipeline | 2d | patterns.ts |
| Voice extraction tuning | 2d | VoiceConstraintBuilder |
| Editorial state machine | 4d | Partial schema |
| IndexNow publishing | 4d | Phase 97 spec |
| Tier 5 quality checks | 3d | 109 checks exist |
| CrUX integration | 3d | Schema extraction |
| Existing page optimizer | 4d | link-schema.ts |
| New content linker | 4d | Schema ready |

---

## Sprint Breakdown

### Sprint 1: Foundation (Week 1-2)
- Phase 100: Scrapling engine setup (5d)
- Wire keyword classification (2d)
- Voice compliance tuning (2d)

### Sprint 2: Pipeline Core (Week 3-4)
- Keyword scraping service (5d)
- Proposal generation (4d)
- Client conversion (4d)

### Sprint 3: Content System (Week 5-6)
- Content calendar (3 views) (5d)
- Priority queue (3d)
- Editorial workflow (4d)

### Sprint 4: Generation & Quality (Week 7-8)
- AI content pipeline (5d)
- Quality gate (4d)
- IndexNow publishing (4d)

### Sprint 5: Editor & SEO (Week 9-10)
- Content editor UX (5d)
- Tier 5 quality checks (3d)
- CrUX integration (3d)

### Sprint 6: Linking System (Week 11-12)
- Link architecture (4d)
- Existing page optimization (4d)
- New content linking (4d)
- Dead link system (5d)

**Total: 12 weeks (3 months)**

---

## Document References

- `.planning/design/design-system-v6.md` — Visual rules
- `.planning/design/v7-master-design-architecture.md` — Autonomy/control patterns
- `.planning/phases/92-on-page-seo-mastery/seobuild-onpage.md` — On-page SEO framework
- `.planning/phases/92-on-page-seo-mastery/COST-OPTIMIZATION-MASTERPLAN.md` — Scraping costs
- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Keyword pipeline
- `.planning/keyword-intelligence/PROPOSAL-XML-PROMPTS.md` — Proposal generation

---

*Document will be updated as subagent research completes.*

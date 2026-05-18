# Phase 99: Unified SEO Content Pipeline — Consolidated Findings

> **Status:** Consolidation Complete  
> **Created:** 2026-05-11  
> **Source:** 20 RESEARCH-*.md files (600KB+ total)

---

## Executive Summary

Phase 99 research covers the complete Keywords → Proposal → Client → Content → On-Page SEO pipeline. Key discoveries:

| Finding | Impact | Action |
|---------|--------|--------|
| **GSC Indexing API harmful** | Non-job content penalized | Replace with IndexNow (Phase 97 spec ready) |
| **CrUX API is FREE** | 150 req/min, no cost | Use for CWV monitoring |
| **link-schema.ts exists** | Tables ready | Only workflow layer needed |
| **$1.37/proposal cost** | DataForSEO Standard Queue | Batch processing optimal |
| **41-point quality checklist** | 33/41 to pass | 37/41 for auto-publish |

---

## Stream A: Keywords → Proposal (Agents 1-4)

### Agent 1: Keyword Scraping Architecture

| Category | Finding |
|----------|---------|
| **Key Decision** | DataForSEO Keywords API (primary) + Ahrefs MCP (gap fill) |
| **Cost Target** | $0.015/keyword at 3000+ scale via Standard Queue |
| **Batching** | 1000 keywords/task, 100 tasks/request, webhook collection |
| **Deduplication** | Bloom filter + normalized key (lowercase, stemmed) |
| **Existing Code** | None - needs full implementation |
| **Gaps** | KeywordScrapingService, DataForSEO client wrapper, webhook handlers |
| **Estimate** | L (5-7 days) |

### Agent 2: Keyword Classification

| Category | Finding |
|----------|---------|
| **Key Decision** | Dual-signal: 95+ Lithuanian patterns + DataForSEO intent fallback |
| **Existing Code** | `open-seo-main/src/server/features/keywords/funnel/patterns.ts` |
| **Existing Code** | `open-seo-main/src/server/features/keywords/geo/cities.ts` |
| **Coverage** | BOFU (40+), MOFU (30+), TOFU (25+) patterns exist |
| **Gaps** | Wire patterns to pipeline, add pSEO detection |
| **Estimate** | S (1-2 days) - mostly exists |

### Agent 3: Proposal Generation

| Category | Finding |
|----------|---------|
| **Key Decision** | Schwartz awareness + Halbert fascinations + XML prompts |
| **Framework Stack** | Schwartz (awareness), Halbert (fascinations), Kennedy, Ogilvy, Cialdini |
| **Existing Code** | `.planning/keyword-intelligence/PROPOSAL-XML-PROMPTS.md` (templates) |
| **Outputs** | Awareness classification, pre-sale hooks, ROI projections |
| **Gaps** | `ProposalGenerationService`, Grok 4.1 integration, Lithuanian templates |
| **Estimate** | M (3-4 days) |

### Agent 4: Client Conversion

| Category | Finding |
|----------|---------|
| **Key Decision** | Agreement signed triggers conversion, data migrates atomically |
| **Trigger** | `agreementSigners.status = 'signed'` or Stripe webhook |
| **Migration** | prospects → shared_clients, prospect_keywords → client_keywords |
| **Voice Profile** | Auto-generated draft from scraped content |
| **GSC Connection** | OAuth flow post-conversion, store tokens per client |
| **Gaps** | `convertProspectToClient()` transaction, voice profile extraction |
| **Estimate** | M (3-4 days) |

---

## Stream B: Content Calendar → Publishing (Agents 5-8)

### Agent 5: Content Calendar Architecture

| Category | Finding |
|----------|---------|
| **Key Decision** | 3-view architecture: Calendar (Notion), Kanban (Linear), Timeline (Superhuman) |
| **Editorial Moment** | "12 / 20 articles this month" with progress bar |
| **v6 Compliance** | Ghost-edge shadows, Newsreader mega numerals, hover-to-reveal |
| **Status System** | Idea → Outline → Draft → Review → Approved → Published |
| **Existing Code** | Design tokens exist in `@tevero/ui` |
| **Gaps** | ContentCalendar component, all 3 views, drag-drop state machine |
| **Estimate** | L (5-7 days) |

### Agent 6: Priority Queue System

| Category | Finding |
|----------|---------|
| **Key Decision** | Composite scoring: volume + difficulty + intent + quick win bonus |
| **Quick Wins** | Position 11-30, KD ≤40, volume ≥100 |
| **Funnel Distribution** | 30% BOFU / 40% MOFU / 30% TOFU per quarter |
| **Tier Thresholds** | must_do ≥75, should_do ≥50, nice_to_have ≥25 |
| **Existing Code** | None |
| **Gaps** | `PriorityQueueService`, scoring algorithms, schedule optimizer |
| **Estimate** | M (3-4 days) |

### Agent 7: Editorial Workflow

| Category | Finding |
|----------|---------|
| **Key Decision** | 8 states, 4 roles (Writer/Editor/Admin/Viewer) |
| **State Machine** | Idea → Draft → Review → Revision Requested → Approved → Published |
| **RBAC** | Writer: own content, Editor: any content, Admin: publish + manage |
| **Version Control** | content_versions table with full snapshot + commit_message |
| **Existing Code** | Schema exists in AI-Writer (partial) |
| **Gaps** | Unified state machine, role enforcement, revision history UI |
| **Estimate** | M (3-4 days) |

### Agent 8: Publishing Automation

| Category | Finding |
|----------|---------|
| **CRITICAL** | GSC Indexing API harms SEO for non-job content |
| **Key Decision** | Replace with IndexNow + sitemap lastmod signals |
| **IndexNow Support** | 10 platforms (WordPress, Shopify, Wix, etc.) |
| **Existing Code** | `AI-Writer/backend/services/gsc_service.py` (to deprecate) |
| **Existing Code** | `apps/web/src/hooks/use-indexnow-instructions.ts` |
| **Existing Code** | Phase 97 spec complete |
| **Gaps** | IndexNow worker, sitemap generation, deprecate GSC submit |
| **Estimate** | M (3-4 days) |

---

## Stream C: AI Content Generation (Agents 9-12)

### Agent 9: AI Content Pipeline

| Category | Finding |
|----------|---------|
| **Key Decision** | 500-token chunks for AI retrieval optimization |
| **Model** | Gemini 3.1 Pro for all content generation |
| **Quality Framework** | 41-point scorecard (33/41 to pass, 37/41 auto-publish) |
| **Reddit Test** | 3+ of 6 prove-it details required |
| **QFO Facets** | Each H2 section = 1 facet (cost, timing, comparison, etc.) |
| **Existing Code** | seobuild-onpage.md spec complete |
| **Gaps** | ChunkWriter service, QFO validator, Reddit Test scorer |
| **Estimate** | L (5-7 days) |

### Agent 10: Voice Compliance

| Category | Finding |
|----------|---------|
| **Key Decision** | 40+ voice profile fields, 5-dimension scoring |
| **Existing Code** | `open-seo-main/src/db/voice-schema.ts` (complete) |
| **Existing Code** | `VoiceConstraintBuilder.ts` (single source of truth) |
| **Modes** | preservation / application / best_practices |
| **Scoring** | Tone, vocabulary, structure, personality, rules |
| **Gaps** | Voice extraction from samples, blend algorithm tuning |
| **Estimate** | S (1-2 days) - mostly exists |

### Agent 11: Quality Gate

| Category | Finding |
|----------|---------|
| **Key Decision** | Score ≥80 auto-publish, 70-79 manual, <60 regenerate |
| **E-E-A-T Checks** | Experience 20%, Expertise 30%, Authority 25%, Trust 25% |
| **Readability** | Flesch 60-70, Grade 8-10, Sentence 15-20 words |
| **Existing Code** | `AI-Writer/backend/core/scoring_constants.py` |
| **Gaps** | Unified QualityGateService, E-E-A-T detector, auto-regenerate loop |
| **Estimate** | M (3-4 days) |

### Agent 12: Content Editor UX

| Category | Finding |
|----------|---------|
| **Key Decision** | TipTap v2 (ProseMirror) with real-time scoring sidebar |
| **Extensions** | SEOHighlight, InternalLinkSuggestion, TableResize |
| **Debounce** | 500ms analysis debounce for performance |
| **v6 Compliance** | 3-column layout (outline / editor / SEO panel) |
| **Existing Code** | TipTap installed in apps/web |
| **Gaps** | Custom extensions, scoring panel, revision diff viewer |
| **Estimate** | L (5-7 days) |

---

## Stream D: On-Page SEO (Agents 13-16)

### Agent 13: 109 Checks System

| Category | Finding |
|----------|---------|
| **Key Decision** | 4-tier + Tier 5 quality (122 total checks) |
| **Tier Distribution** | T1: 68 DOM/regex, T2: 21 calculation, T3: 13 API, T4: 7 crawl |
| **Tier 5** | 13 content quality checks (Reddit Test, AI slop, thin content) |
| **Scoring** | Base 60 + variable 40 = max 100 |
| **Blocking Checks** | Missing H1 (cap 70), duplicate >60% (cap 50), CWV critical (cap 75) |
| **Existing Code** | `open-seo-main/src/server/lib/audit/checks/` |
| **Gaps** | Tier 5 implementation, blocking gate enforcement |
| **Estimate** | M (3-4 days) - partial exists |

### Agent 14: Tiered Scraping

| Category | Finding |
|----------|---------|
| **Key Decision** | T0-T5 escalation with per-domain learning |
| **Cost Savings** | 97% ($4,250 → $118 per 1M pages) |
| **Tiers** | T0 Direct → T1 Webshare → T2 Geonode → T3 DFS Basic → T4 DFS JS → T5 DFS Browser |
| **Learning** | domain_scrape_config table, 30-day TTL |
| **Existing Code** | `domain-scrape-learning-schema.ts` (500+ lines) |
| **Existing Code** | `DomainLearningService.ts` (800+ lines) |
| **Gaps** | TieredFetcher orchestrator (superseded by Phase 100 Scrapling) |
| **Estimate** | S (1-2 days) - mostly exists, Phase 100 replaces |

### Agent 15: Audit Workflow

| Category | Finding |
|----------|---------|
| **Key Decision** | Scheduled audits (weekly/daily/post-publish) via BullMQ |
| **Existing Code** | `open-seo-main/src/db/schedule-schema.ts` |
| **Severity Dots** | 5-level (1-5 dots, color-coded per v6) |
| **Finding States** | open → in_progress → fixed → ignored |
| **Gaps** | Remediation tracking, fix-via-content-generation flow |
| **Estimate** | S (1-2 days) |

### Agent 16: Technical SEO

| Category | Finding |
|----------|---------|
| **CRITICAL** | CrUX API is FREE (150 req/min) |
| **Schema Validation** | FAQPage, HowTo, Product, Article, LocalBusiness |
| **Validators** | Ajv + ajv-formats for JSON Schema |
| **Existing Code** | Schema extraction in audit checks |
| **Gaps** | CrUX integration, schema auto-fix suggestions |
| **Estimate** | M (3-4 days) |

---

## Stream E: Internal Linking (Agents 17-20)

### Agent 17: Link Architecture

| Category | Finding |
|----------|---------|
| **Key Decision** | Hub & spoke topology, topic clusters |
| **Impact** | 30-43% more organic traffic, 3.2x more AI citations |
| **Link Rules** | 2-5 contextual links per 1000 words, varied anchors |
| **Anchor Distribution** | 15-25% exact, 30-40% partial, 25-35% semantic |
| **Existing Code** | None - architectural pattern only |
| **Gaps** | LinkArchitectureService, cluster mapping |
| **Estimate** | M (3-4 days) |

### Agent 18: Existing Page Optimization

| Category | Finding |
|----------|---------|
| **Key Decision** | Crawl → detect opportunities → suggest → bulk optimize |
| **Existing Code** | `link-schema.ts` has linkGraph, pageLinks, orphanPages, linkSuggestions |
| **Opportunity Types** | orphan_rescue (1.0), link_velocity (0.8), depth_reduction (0.7), anchor_diversity (0.6) |
| **Detection** | SQL queries for orphan/low-link/poor-anchor pages |
| **Gaps** | LinkOpportunityService, bulk optimization workflow |
| **Estimate** | M (3-4 days) - schema exists |

### Agent 19: New Content Linking

| Category | Finding |
|----------|---------|
| **Key Decision** | Multi-signal scoring for target discovery |
| **Score Formula** | 30% semantic + 25% link deficit + 20% orphan + 15% depth + 10% traffic |
| **Insertion** | Wrap existing text (preferred) or append contextual sentence |
| **Constraints** | Max 5 links/article, 1 link/paragraph, 100 words between links |
| **Existing Code** | Schema ready in link-schema.ts |
| **Gaps** | NewContentLinker service, TipTap integration |
| **Estimate** | M (3-4 days) |

### Agent 20: Dead Link System

| Category | Finding |
|----------|---------|
| **CRITICAL DECISION** | Autopilot ≥85% confidence for internal, ALWAYS HITL for external |
| **Autopilot Criteria** | isInternal + confidence ≥0.85 + relevance ≥0.7 + anchor unchanged |
| **HITL Triggers** | External, archive, alternative, remove, confidence <0.85 |
| **Replacement Sources** | Internal page → Wayback archive → Alternative → Remove |
| **Existing Code** | None |
| **Gaps** | linkHealth table, LinkHealthService, replacement generator, review UI |
| **Estimate** | L (5-7 days) |

---

## Implementation Dependencies

```
                          DEPENDENCY GRAPH
                          
Phase 100 (Scrapling)
    └── Required for: R14 (Tiered Scraping), R01 (Keyword Scraping)
    
R02 (Classification) ←── R01 (Keyword Scraping)
    └── Patterns exist, just wire to pipeline
    
R03 (Proposal) ←── R02 (Classification)
    └── Needs classified keywords for ROI projections
    
R04 (Conversion) ←── R03 (Proposal)
    └── Agreement triggers client creation
    
R05 (Calendar) ←── R04 (Conversion) + R06 (Priority Queue)
    └── Calendar displays prioritized content from converted clients
    
R07 (Editorial) ←── R05 (Calendar)
    └── Workflow manages calendar items
    
R09 (AI Content) ←── R07 (Editorial) + R10 (Voice)
    └── Content generation feeds editorial workflow with voice compliance
    
R11 (Quality Gate) ←── R09 (AI Content)
    └── Gate validates AI output before publish
    
R08 (Publishing) ←── R11 (Quality Gate)
    └── Only publish content that passes gate
    
R17-20 (Linking) ←── R13 (109 Checks)
    └── Linking feeds into audit checks
```

---

## Sprint Breakdown Recommendation

### Sprint 1: Foundation (Week 1-2)
| Task | Est | Priority |
|------|-----|----------|
| Phase 100: Scrapling engine setup | 5d | P0 |
| R02: Wire keyword classification | 2d | P1 |
| R10: Voice compliance tuning | 2d | P1 |

### Sprint 2: Pipeline Core (Week 3-4)
| Task | Est | Priority |
|------|-----|----------|
| R01: Keyword scraping service | 5d | P0 |
| R03: Proposal generation | 4d | P1 |
| R04: Client conversion | 4d | P1 |

### Sprint 3: Content System (Week 5-6)
| Task | Est | Priority |
|------|-----|----------|
| R05: Content calendar (3 views) | 5d | P0 |
| R06: Priority queue | 3d | P1 |
| R07: Editorial workflow | 4d | P1 |

### Sprint 4: Generation & Quality (Week 7-8)
| Task | Est | Priority |
|------|-----|----------|
| R09: AI content pipeline | 5d | P0 |
| R11: Quality gate | 4d | P1 |
| R08: IndexNow publishing | 4d | P1 |

### Sprint 5: Editor & SEO (Week 9-10)
| Task | Est | Priority |
|------|-----|----------|
| R12: Content editor UX | 5d | P0 |
| R13: Tier 5 quality checks | 3d | P1 |
| R16: CrUX integration | 3d | P2 |

### Sprint 6: Linking System (Week 11-12)
| Task | Est | Priority |
|------|-----|----------|
| R17: Link architecture service | 4d | P0 |
| R18: Existing page optimization | 4d | P1 |
| R19: New content linking | 4d | P1 |
| R20: Dead link system | 5d | P1 |

---

## Autopilot vs Human-in-the-Loop Summary

| Operation | Autopilot | HITL Required |
|-----------|-----------|---------------|
| **Content Publishing** | Score ≥80 + E-E-A-T ≥70 + Voice ≥75 | Score 70-79 |
| **Internal Link Suggestions** | Confidence ≥90% | 80-89% confidence |
| **Internal Dead Link Replacement** | Confidence ≥85% + internal | <85% confidence |
| **External Links** | Never | Always |
| **Link Removal** | Never | Always |
| **Archive Replacement** | Never | Always (may be outdated) |
| **Redirect Updates (301/302)** | Always (safe) | Never |

---

## Existing Code Inventory

| Location | Purpose | Status |
|----------|---------|--------|
| `open-seo-main/src/db/voice-schema.ts` | 40+ voice fields | Complete |
| `open-seo-main/src/server/features/voice/services/VoiceConstraintBuilder.ts` | Voice prompt injection | Complete |
| `open-seo-main/src/server/features/keywords/funnel/patterns.ts` | 95+ Lithuanian patterns | Complete |
| `open-seo-main/src/server/features/keywords/geo/cities.ts` | 50+ cities with variants | Complete |
| `open-seo-main/src/db/link-schema.ts` | linkGraph, pageLinks, orphanPages | Complete |
| `open-seo-main/src/db/domain-scrape-learning-schema.ts` | Per-domain tier learning | Complete |
| `open-seo-main/src/server/services/DomainLearningService.ts` | Scrape tier selection | Complete |
| `open-seo-main/src/db/schedule-schema.ts` | Cron schedules for audits | Complete |
| `open-seo-main/src/server/lib/audit/checks/` | 109 SEO checks | Partial (Tier 5 missing) |
| `AI-Writer/backend/services/gsc_service.py` | GSC submission | Deprecate (use IndexNow) |
| `AI-Writer/backend/core/scoring_constants.py` | Quality thresholds | Complete |
| `apps/web/src/hooks/use-indexnow-instructions.ts` | IndexNow onboarding | Complete |

---

## Critical Decisions Made

1. **Replace GSC Indexing API with IndexNow** — GSC API restricted to JobPosting/BroadcastEvent, harms other content
2. **CrUX API is FREE** — 150 requests/minute, no cost for Core Web Vitals monitoring
3. **$1.37 per proposal** — DataForSEO Standard Queue with batch processing
4. **41-point quality checklist** — 33/41 to pass, 37/41 for auto-publish
5. **Autopilot ≥85% for internal dead links** — External links always require HITL
6. **Hub & spoke topology** — 30-43% more traffic, 3.2x AI citations
7. **Scrapling-first architecture** — Phase 100 replaces TieredFetcher + Camoufox

---

## Next Steps

1. **Update PHASE-99-MASTER-SPEC.md** with findings from each agent section
2. **Begin Sprint 1** with Phase 100 Scrapling setup + R02/R10 quick wins
3. **Create implementation tickets** for each sprint task
4. **Review with stakeholders** for priority adjustments

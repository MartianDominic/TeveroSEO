# Autonomous SEO Platform - Roadmap

> Zero-human-oversight SEO platform: keyword intelligence, content generation, and SEO automation.

## Project Goal

Build a world-class autonomous SEO platform that:
1. Discovers and prioritizes keywords with client-specific feasibility scoring
2. Generates content using Gemini 3.1 Pro + client knowledge (testimonials, brand voice)
3. Auto-optimizes on-page and technical SEO
4. Refreshes decaying content automatically

**Generation Model:** Gemini 3.1 Pro (2026) only

## Success Criteria

- [ ] Client connects GSC, sees prioritized keywords within 24 hours
- [ ] Keyword filtering reduces 1000 → 50-200 actionable keywords
- [ ] Client-specific feasibility scores (not generic KD)
- [ ] Content generation includes real testimonials and brand voice
- [ ] Quality gate: all 5 dimensions score 75+ before publish
- [ ] On-page SEO fixes applied via WordPress plugin
- [ ] Content decay detected and auto-refreshed

## Milestones

### Milestone 1: Keyword Intelligence
**Goal:** Client can discover, filter, and approve keywords with feasibility scoring
**Phases:** 4
**Estimated Duration:** 4-6 weeks

### Milestone 2: Knowledge & Content  
**Goal:** Client can generate content with their unique data (testimonials, brand voice)
**Phases:** 3
**Estimated Duration:** 3-4 weeks

### Milestone 3: Full Automation
**Goal:** Zero-touch SEO optimization and content refresh
**Phases:** 3
**Estimated Duration:** 3-4 weeks

---

## Phase Details

### Phase 1: Foundation & GSC Integration

**Goal:** GSC data flowing into database daily

**Requirements:**
- R1.1: Database schema for client_knowledge, saved_keywords, keyword_constraints
- R1.2: pgvector extension enabled with embedding columns
- R1.3: GSC OAuth flow with token storage per client
- R1.4: GSC API client (search analytics, URL inspection)
- R1.5: BullMQ worker for daily GSC sync
- R1.6: Position tracking table (keyword, date, position, impressions, clicks)
- R1.7: Dashboard showing GSC connection status

**Success Criteria:**
- [ ] Client can connect GSC via OAuth
- [ ] Positions sync daily without manual trigger
- [ ] Last 16 months of history backfilled on first connect

**Dependencies:** None (foundation phase)

**Technical Notes:**
- GSC data has 2-3 day lag - don't sync more than daily
- Max 25,000 rows per API request, 50,000/day per property
- Store refresh tokens encrypted in database

---

### Phase 2: Keyword Discovery & Storage

**Goal:** Raw keywords extracted and enriched with metrics

**Requirements:**
- R2.1: Extract keywords from GSC search analytics data
- R2.2: DataForSEO enrichment (volume, difficulty, CPC, intent)
- R2.3: Intent classification (transactional, informational, commercial, navigational)
- R2.4: saved_keywords table population
- R2.5: Tiered SERP tracking setup (critical: daily, standard: weekly, monitor: GSC-only)
- R2.6: Dashboard keyword list with sortable metrics

**Success Criteria:**
- [ ] 100-1000 keywords discovered per client
- [ ] All keywords have volume, difficulty, CPC, intent
- [ ] Tiered tracking reduces SERP API cost by 95%

**Dependencies:** Phase 1 (GSC data available)

**Technical Notes:**
- DataForSEO: $0.0006/keyword (queue), $0.002/keyword (live)
- Batch enrichment to stay under rate limits
- Intent classification can use keyword modifiers + AI fallback

---

### Phase 3: Filtering & Feasibility Engine

**Goal:** Keywords scored for THIS client's ability to rank

**Requirements:**
- R3.1: Constraint engine with types (page_type, intent, volume, exclusion)
- R3.2: Authority gap calculation (client DA vs SERP competitor average)
- R3.3: Content feasibility scoring (topical authority coverage)
- R3.4: SERP feature impact analysis (AI overview, local pack, etc.)
- R3.5: Category mapping using embeddings (keyword → site taxonomy)
- R3.6: Cannibalization detection (multiple URLs ranking for same keyword)
- R3.7: filter_status and filter_reason tracking
- R3.8: Quick win identification (position 5-20, low authority gap)

**Success Criteria:**
- [ ] Every keyword has feasibility score 0-100
- [ ] Verdicts assigned: quick_win, achievable, stretch, long_term, not_feasible
- [ ] Filtering reduces keywords by 50-80% based on constraints
- [ ] Quick wins surfaced at top of list

**Dependencies:** Phase 2 (keywords with metrics)

**Technical Notes:**
- Feasibility = (Authority × 0.35) + (Content × 0.30) + (Velocity × 0.35) × SERP Modifier
- Category mapping needs client's site taxonomy (scrape or manual input)
- Cannibalization requires GSC page-level data

**Key Formulas:**
```
Authority Gap = Avg Competitor DA - Client DA
Authority Feasibility = max(0, 50 - Authority Gap)

Quick Win Score = (20 - position)/15 × 40 + max(0, 30 - authorityGap) + min(30, log10(impressions) × 10)
```

---

### Phase 4: Client Approval UI

**Goal:** Client can review, filter, and approve working keyword set

**Requirements:**
- R4.1: Keyword review dashboard with filters (category, feasibility, intent, status)
- R4.2: Bulk approve/reject functionality
- R4.3: Constraint editor UI (add/edit/delete rules)
- R4.4: "Show excluded keywords + reasons" view
- R4.5: Export to CSV
- R4.6: Working set lock after approval
- R4.7: Re-filter button when constraints change

**Success Criteria:**
- [ ] Client can approve 50-200 keywords in under 10 minutes
- [ ] Excluded keywords show clear reasons
- [ ] Constraints persist and apply to new discoveries

**Dependencies:** Phase 3 (filtering complete)

**Technical Notes:**
- approval_status: pending → approved/rejected
- Re-filtering shouldn't lose previous approvals (unless keyword now excluded)
- Consider "suggest constraints" based on client's approvals pattern

---

### Phase 5: Site Scraping & Testimonial Collection

**Goal:** Client's existing content and testimonials indexed

**Requirements:**
- R5.1: Page scraper (URL, title, meta, headings, content, word count, internal links)
- R5.2: Testimonial extractor from client website
- R5.3: Review platform integrations (G2, Capterra, Google Reviews)
- R5.4: Fingerprinting for deduplication across sources
- R5.5: Multi-source sync with merge strategies
- R5.6: Metric extraction with Gemini ("312% increase" → structured data)
- R5.7: Embed all knowledge items with text-embedding-004
- R5.8: Dashboard: knowledge base viewer

**Success Criteria:**
- [ ] All client pages scraped and indexed
- [ ] Testimonials collected from 3+ sources
- [ ] Metrics extracted (numbers, percentages, timeframes)
- [ ] Deduplication prevents same testimonial appearing twice

**Dependencies:** Phase 1 (schema), can run parallel to Phases 2-4

**Technical Notes:**
- Scraping respects robots.txt
- G2/Capterra may need API keys or scraping
- Fingerprint = hash(author_name + company normalized)

---

### Phase 6: Brand Voice & RAG System

**Goal:** Content generation has client-specific context

**Requirements:**
- R6.1: Brand voice schema (tone, vocabulary, personality, examples)
- R6.2: Auto-extraction from 5+ existing content pieces
- R6.3: Brand voice editor UI (override extracted values)
- R6.4: RAG retrieval using pgvector similarity search
- R6.5: Per-post injection template (~500 tokens of brand context)
- R6.6: Brand voice validation (forbidden words, POV consistency)
- R6.7: Retrieval accuracy testing

**Success Criteria:**
- [ ] Brand voice extracted automatically on onboarding
- [ ] RAG retrieves 3-5 relevant knowledge items per query
- [ ] Generated content passes brand voice validation

**Dependencies:** Phase 5 (content to extract voice from)

**Technical Notes:**
- text-embedding-004 produces 768-dimension vectors
- Retrieval query: `ORDER BY embedding <=> $query_embedding LIMIT 5`
- Validation checks: forbidden words, POV pronouns, tone markers

---

### Phase 7: Content Generation Pipeline

**Goal:** Full content generation with quality gates

**Requirements:**
- R7.1: Gemini 3.1 Pro integration
- R7.2: Research stage (SERP analysis, competitor content gaps)
- R7.3: Planning stage (outline, knowledge injection points)
- R7.4: Generation stage (RAG retrieval + brand voice injection)
- R7.5: Quality scoring (semantic coverage, E-E-A-T, readability, engagement, info gain)
- R7.6: 75+ threshold gate on all 5 dimensions
- R7.7: Revision loop if below threshold (max 3 attempts)
- R7.8: Dashboard: content queue, generation status, quality scores

**Success Criteria:**
- [ ] Content generates in under 2 minutes
- [ ] 90%+ pass quality gate on first attempt
- [ ] Testimonials and brand voice visibly integrated
- [ ] No generic AI-sounding phrases

**Dependencies:** Phase 6 (RAG + brand voice ready)

**Technical Notes:**
- Gemini 3.1 Pro has 1M token context - can include substantial knowledge
- Quality scoring can use separate Gemini call as judge
- Store all generated content with scores for analysis

---

### Phase 8: On-Page SEO Automation

**Goal:** Auto-optimize existing pages for approved keywords

**Requirements:**
- R8.1: Page audit against approved keyword targets
- R8.2: Title optimization (keyword placement, length, CTR)
- R8.3: Meta description rewriting
- R8.4: Heading restructuring (H1 uniqueness, H2 keyword inclusion)
- R8.5: Internal linking opportunity detection
- R8.6: WordPress plugin for applying changes
- R8.7: Before/after tracking with timestamps

**Success Criteria:**
- [ ] Pages audited within 24 hours of keyword approval
- [ ] Optimization suggestions generated automatically
- [ ] Changes applied via plugin (not just suggested)
- [ ] Position changes tracked post-optimization

**Dependencies:** Phase 4 (approved keywords), Phase 5 (page data)

**Technical Notes:**
- WordPress plugin needed because JS pixel invisible to crawlers
- Plugin uses REST API to receive optimization instructions
- Apply changes gradually (not all at once) to monitor impact

---

### Phase 9: Technical SEO Automation

**Goal:** Auto-fix technical SEO issues

**Requirements:**
- R9.1: Technical audit crawler (crawlability, indexability)
- R9.2: Schema markup injection (Article, FAQ, Breadcrumb, Product)
- R9.3: Image optimization (alt text generation, WebP conversion, lazy load)
- R9.4: Broken link detection and fixing (find closest match or remove)
- R9.5: Canonical tag management
- R9.6: Core Web Vitals monitoring integration
- R9.7: Fix verification loop (re-crawl after fix)

**Success Criteria:**
- [ ] Technical issues detected within 48 hours
- [ ] Schema markup auto-injected where missing
- [ ] Broken links fixed or flagged within 24 hours
- [ ] Fix success rate > 95%

**Dependencies:** Phase 5 (site crawl data), Phase 8 (WordPress plugin)

**Technical Notes:**
- Some fixes need plugin (schema injection)
- Some fixes need CDN/edge (image optimization)
- Prioritize by impact: indexability > schema > images > links

---

### Phase 10: Content Refresh Engine

**Goal:** Existing content kept fresh automatically

**Requirements:**
- R10.1: Decay detection triggers (ranking drop 5+, traffic drop 20%+)
- R10.2: Competitor monitoring (new competing content alerts)
- R10.3: Age-based triggers (content older than 6 months)
- R10.4: Auto-update pipeline (statistics, dates, broken links, thin sections)
- R10.5: Refresh queue management with priority
- R10.6: Performance tracking post-refresh (did rankings recover?)

**Success Criteria:**
- [ ] Decay detected within 1 week of occurrence
- [ ] Refresh applied within 48 hours of trigger
- [ ] 70%+ of refreshed content recovers rankings
- [ ] No manual intervention required

**Dependencies:** Phase 7 (content generation for expansions), Phase 8-9 (SEO fixes)

**Technical Notes:**
- Refresh = update stats + fix links + expand thin sections + update dates
- Don't refresh too aggressively (Google may see as churn)
- Track refresh history to avoid over-refreshing same page

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │   Next.js   │────▶│   BullMQ    │────▶│   Workers   │               │
│  │   App       │     │   Queues    │     │             │               │
│  └─────────────┘     └─────────────┘     └─────────────┘               │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL + pgvector                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │ keywords │ │knowledge │ │constraints│ │ content  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      External Services                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │   GSC    │ │DataForSEO│ │  Gemini  │ │ WordPress│            │   │
│  │  │   API    │ │   API    │ │ 3.1 Pro  │ │  Plugin  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| GSC API rate limits | Sync failures | Batch requests, exponential backoff, BigQuery export for large sites |
| Gemini 3.1 Pro availability | Content generation blocked | Queue with retry, fallback to 2.5 Pro if needed |
| DataForSEO costs | Budget overrun | Tiered tracking, cache aggressively, GSC for baseline |
| WordPress plugin security | Client site compromise | Code review, minimal permissions, signed updates |
| Content quality drift | Poor content published | Quality gate is hard stop, human review queue for edge cases |

## References

- [AUTONOMOUS-SEO-PLATFORM.md](../../docs/rnd/AUTONOMOUS-SEO-PLATFORM.md) — Full system design
- [KEYWORD-FILTERING-WORKFLOW.md](../../docs/rnd/KEYWORD-FILTERING-WORKFLOW.md) — Filtering pipeline details
- [KEYWORD-PRIORITIZATION-ALGORITHMS.md](../research/KEYWORD-PRIORITIZATION-ALGORITHMS.md) — Scoring formulas
- [KEYWORD-CONSTRAINT-ENGINE.md](../research/KEYWORD-CONSTRAINT-ENGINE.md) — Constraint engine spec
- [POSITION-TRACKING-SYSTEM.md](../research/POSITION-TRACKING-SYSTEM.md) — Position tracking architecture

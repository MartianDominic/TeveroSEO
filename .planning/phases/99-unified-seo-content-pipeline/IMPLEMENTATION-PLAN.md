# Phase 99: Unified SEO Content Pipeline — Implementation Plan

> **Status:** Ready for Execution  
> **Created:** 2026-05-11  
> **Synthesized from:** 5 Opus subagent deep analyses + 20 research documents

---

## Executive Summary

**12 weeks to full pipeline.** Phase 100 (Scrapling) is the critical blocker — nothing else can start until it's done. After that, the pipeline fans out into 4 parallel streams with clear dependencies.

### The Numbers

| Metric | Value |
|--------|-------|
| Total duration | 12 weeks (3 months) |
| New services | 13 |
| New database tables | 5 |
| Existing code to wire | 12 components |
| Quick wins (< 1 day) | 5 |
| Highest risk | Phase 100 Scrapling (mitigated by DataForSEO fallback) |

---

## Critical Path (The Bottleneck Chain)

```
Week 1-2: Phase 100 Scrapling ─────────────────────────────────────┐
                                                                    │
Week 3-4: R01 KeywordScrapingService ◄─────────────────────────────┘
              │
              ▼
Week 5:   R02 Funnel Classification (wire existing code) ──────────┐
              │                                                      │
              ▼                                                      │
Week 6:   R03 ProposalGenerationService                             │
              │                                                      │
              ▼                                                      │
Week 7:   R04 ClientConversionService                               │
              │                                                      │
              ▼                                                      │
Week 8:   R05 ContentCalendarViews ◄────────────────────────────────┘
              │
              ▼
Week 9:   R07 EditorialStateMachine
              │
              ▼
Week 10:  R09 ChunkWriter + R11 QualityGate
              │
              ▼
Week 11-12: R08 IndexNow Publishing
```

**Critical path length:** 12 weeks  
**Slack on parallel tracks:** 2-4 weeks

---

## Sprint Breakdown

### Sprint 1: Foundation (Week 1-2) — BLOCKERS REMOVED

| Task | Est | Dependencies | Existing Code |
|------|-----|--------------|---------------|
| Phase 100: Scrapling engine | 5d | None | DomainLearningService (800 LOC) |
| Wire keyword classification | 2d | None | `keywords/funnel/patterns.ts` |
| Voice compliance tuning | 2d | None | VoiceConstraintBuilder |

**Deliverables:**
- `services/scrapling-engine/` Python service with FastAPI
- `ScraplingClient.ts` TypeScript wrapper
- Classification pipeline wired to DataForSEO keywords
- Voice extraction tuned for Lithuanian

**Exit Criteria:**
- 5000-page scrape completes in < 3 min
- 95% classification accuracy on test set
- Voice extraction passes 5-dimension scoring

---

### Sprint 2: Keyword → Proposal (Week 3-4)

| Task | Est | Dependencies | Existing Code |
|------|-----|--------------|---------------|
| KeywordScrapingService | 5d | Scrapling | None |
| ProposalGenerationService | 4d | Classification | XML prompt templates |
| ClientConversionService | 4d | Proposals | None |

**Deliverables:**
- `KeywordScrapingService` with DataForSEO Standard Queue
- `ProposalGenerationService` with Schwartz/Halbert frameworks
- `convertProspectToClient()` atomic transaction

**Exit Criteria:**
- Keyword scrape costs ≤ $1.37/proposal
- Proposals generate in < 30s
- Client conversion migrates all keyword data atomically

---

### Sprint 3: Content Calendar (Week 5-6)

| Task | Est | Dependencies | Existing Code |
|------|-----|--------------|---------------|
| Calendar view (month) | 2d | None | Design tokens |
| Kanban view (pipeline) | 2d | None | Design tokens |
| Timeline view (Gantt) | 1d | None | Design tokens |
| PriorityQueueService | 3d | None | None |
| EditorialStateMachine | 4d | None | Partial schema |

**Deliverables:**
- 3-view ContentCalendar component (v6 compliant)
- Priority scoring: composite formula with quick wins (pos 11-30, KD≤40)
- 8-state editorial workflow with 4 RBAC roles

**Exit Criteria:**
- All views render correctly with empty, single, and many items
- Quick wins surface to top of queue
- State transitions enforce role permissions

---

### Sprint 4: AI Content Generation (Week 7-8)

| Task | Est | Dependencies | Existing Code |
|------|-----|--------------|---------------|
| ChunkWriter (500-token) | 5d | Voice | seobuild-onpage spec |
| QualityGateService | 4d | ChunkWriter | scoring_constants.py |
| IndexNow publishing | 4d | Quality gate | Phase 97 spec |

**Deliverables:**
- `ChunkWriter` service using Gemini 3.1 Pro
- 41-point quality checklist (33/41 pass, 37/41 auto-publish)
- IndexNow integration replacing GSC Indexing API

**Exit Criteria:**
- Content generates with < 2% hallucination rate
- Score ≥ 80 triggers auto-publish
- IndexNow pings succeed within 60s of publish

---

### Sprint 5: Editor & Technical SEO (Week 9-10)

| Task | Est | Dependencies | Existing Code |
|------|-----|--------------|---------------|
| ContentEditor (TipTap) | 5d | None | TipTap installed |
| Tier 5 quality checks | 3d | 109 checks | 109 checks exist |
| CrUX integration | 3d | None | Schema extraction |

**Deliverables:**
- TipTap v2 editor with 30+ shortcuts, real-time scoring sidebar
- 13 additional quality checks (122 total)
- CrUX API integration (FREE, 150 req/min)

**Exit Criteria:**
- Editor loads in < 500ms
- All 122 checks run in < 10s per page
- CWV scores display for all indexed pages

---

### Sprint 6: Internal Linking (Week 11-12)

| Task | Est | Dependencies | Existing Code |
|------|-----|--------------|---------------|
| LinkArchitectureService | 4d | None | None |
| LinkOpportunityService | 4d | Link schema | `link-schema.ts` |
| NewContentLinker | 4d | Link arch | Schema ready |
| DeadLinkSystem | 5d | Link schema | None |

**Deliverables:**
- Hub & spoke topology calculator
- Existing page link opportunity detector
- New content auto-linking (≥90% confidence = autopilot)
- Dead link detection + replacement queue

**Exit Criteria:**
- Hub pages identified with > 30% PageRank share
- Link suggestions have < 5% false positive rate
- Dead links detected within 24h of becoming dead
- Internal dead link replacement at ≥85% confidence = autopilot

---

## Quick Wins (Start Immediately)

These can be done by ANY developer while waiting for Phase 100:

| Win | Time | Impact |
|-----|------|--------|
| Wire VoiceConstraintBuilder to content gen | 4h | Voice compliance on all new content |
| Add Lithuanian patterns to classifier | 4h | 95+ patterns, better local SEO |
| Implement Tier 5 checks (13 new) | 6h | Quality score accuracy |
| Enable CrUX API (already free) | 2h | CWV monitoring without cost |
| Connect DomainLearningService to TieredFetcher | 4h | 97% cost savings on repeat domains |

---

## Database Changes

### New Tables

```sql
-- 1. content_items (content calendar entries)
CREATE TABLE content_items (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  keyword_id UUID REFERENCES client_keywords(id),
  title TEXT NOT NULL,
  status content_status NOT NULL DEFAULT 'idea',
  priority_score DECIMAL(5,2),
  scheduled_date DATE,
  published_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. content_versions (revision history)
CREATE TABLE content_versions (
  id UUID PRIMARY KEY,
  content_id UUID REFERENCES content_items(id),
  version INT NOT NULL,
  body JSONB NOT NULL,
  quality_score DECIMAL(5,2),
  eeat_score DECIMAL(5,2),
  voice_score DECIMAL(5,2),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. client_keywords (prospect keywords migrated on conversion)
CREATE TABLE client_keywords (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  keyword TEXT NOT NULL,
  search_volume INT,
  keyword_difficulty DECIMAL(5,2),
  funnel_stage funnel_stage NOT NULL,
  intent keyword_intent NOT NULL,
  current_position INT,
  imported_from UUID, -- prospect_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. link_health (dead link tracking)
CREATE TABLE link_health (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  link_type link_type NOT NULL, -- internal, external
  status link_status NOT NULL, -- alive, dead, redirect
  last_checked_at TIMESTAMPTZ,
  dead_since TIMESTAMPTZ,
  replacement_id UUID REFERENCES link_replacements(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. link_replacements (replacement suggestions)
CREATE TABLE link_replacements (
  id UUID PRIMARY KEY,
  dead_link_id UUID REFERENCES link_health(id),
  suggested_url TEXT NOT NULL,
  confidence DECIMAL(5,2) NOT NULL,
  auto_applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration Order

1. `0001_add_content_status_enum.sql`
2. `0002_add_funnel_stage_enum.sql`
3. `0003_add_link_type_enum.sql`
4. `0004_add_link_status_enum.sql`
5. `0005_create_client_keywords.sql`
6. `0006_create_content_items.sql`
7. `0007_create_content_versions.sql`
8. `0008_create_link_health.sql`
9. `0009_create_link_replacements.sql`

---

## Service Architecture

### Stream A: Keywords → Proposal

```
┌─────────────────────────┐      ┌─────────────────────────┐
│ KeywordScrapingService  │─────►│ ClassificationService   │
│                         │      │ (wire patterns.ts)      │
│ - scrapeCompetitor()    │      │                         │
│ - scrapeProspect()      │      │ - classifyFunnel()      │
│ - queueBatch()          │      │ - detectIntent()        │
└─────────────────────────┘      └───────────┬─────────────┘
                                              │
                                              ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│ ProposalGenerator       │◄─────│ ClientConversionService │
│                         │      │                         │
│ - generateProposal()    │      │ - convertProspect()     │
│ - calculateROI()        │      │ - migrateKeywords()     │
│ - renderPDF()           │      │ - seedCalendar()        │
└─────────────────────────┘      └─────────────────────────┘
```

### Stream B: Content Calendar

```
┌─────────────────────────┐      ┌─────────────────────────┐
│ ContentCalendarService  │─────►│ PriorityQueueService    │
│                         │      │                         │
│ - getMonthView()        │      │ - scoreOpportunity()    │
│ - getKanbanView()       │      │ - getQuickWins()        │
│ - getTimelineView()     │      │ - rebalanceQueue()      │
└─────────────────────────┘      └───────────┬─────────────┘
                                              │
                                              ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│ EditorialWorkflow       │◄─────│ PublishingService       │
│                         │      │                         │
│ - transition()          │      │ - publish()             │
│ - validateTransition()  │      │ - pingIndexNow()        │
│ - getAssignableRoles()  │      │ - schedulePost()        │
└─────────────────────────┘      └─────────────────────────┘
```

### Stream C: AI Content

```
┌─────────────────────────┐      ┌─────────────────────────┐
│ ChunkWriter             │─────►│ VoiceComplianceService  │
│                         │      │ (VoiceConstraintBuilder)│
│ - generateChunk()       │      │                         │
│ - assembleArticle()     │      │ - extractVoice()        │
│ - insertTributaryTrust()│      │ - scoreCompliance()     │
└─────────────────────────┘      └───────────┬─────────────┘
                                              │
                                              ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│ QualityGateService      │◄─────│ ContentEditorService    │
│                         │      │                         │
│ - evaluate41Points()    │      │ - getTipTapDoc()        │
│ - decideAutoPublish()   │      │ - saveRevision()        │
│ - flagForReview()       │      │ - getRealtimeScore()    │
└─────────────────────────┘      └─────────────────────────┘
```

### Stream D: Internal Linking

```
┌─────────────────────────┐      ┌─────────────────────────┐
│ LinkArchitectureService │─────►│ LinkOpportunityService  │
│                         │      │                         │
│ - computeHubSpoke()     │      │ - findOpportunities()   │
│ - getTopicClusters()    │      │ - scoreRelevance()      │
│ - calculatePageRank()   │      │ - suggestAnchor()       │
└─────────────────────────┘      └───────────┬─────────────┘
                                              │
                                              ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│ NewContentLinker        │◄─────│ DeadLinkService         │
│                         │      │                         │
│ - autoLinkContent()     │      │ - detectDeadLinks()     │
│ - wrapExistingText()    │      │ - suggestReplacement()  │
│ - respectLinkBudget()   │      │ - applyAutopilot()      │
└─────────────────────────┘      └─────────────────────────┘
```

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Phase 100 Scrapling fails | Medium | CRITICAL | DataForSEO fallback (100% coverage, higher cost) |
| Gemini 3.1 Pro quality insufficient | Low | High | Claude Sonnet 4.6 fallback for voice-critical content |
| IndexNow rejected by Google | Low | Medium | Manual GSC submission queue |
| Dead link autopilot causes bad replacements | Medium | High | Start with HITL-only mode, graduate to autopilot after 100 manual reviews |
| Content calendar v6 compliance issues | Low | Low | Design review before Sprint 3 |

---

## Autopilot vs Human-in-the-Loop Decision Matrix

| Operation | Autopilot Threshold | HITL Range | Never Autopilot |
|-----------|---------------------|------------|-----------------|
| Internal link insertion | ≥90% confidence | 80-89% | - |
| Internal dead link replacement | ≥85% confidence | <85% | - |
| External link replacement | - | - | Always HITL |
| Content auto-publish | Score ≥80 + E-E-A-T ≥70 + Voice ≥75 | Score 70-79 | Score <60 (regenerate) |
| Keyword classification | ≥95% confidence | <95% | - |

---

## Keyword Classification Decision (ADR)

**Decision:** Keep regex patterns + add Grok 4.1 LLM for unmatched keywords.

**Analysis by 5 Opus agents:**

| Factor | Regex | LLM-Only | Verdict |
|--------|-------|----------|---------|
| Cost | $0 | $58/year | Negligible either way |
| Accuracy | 70-75% | 92-95% | LLM better |
| Latency | <1ms | 200ms/batch | Irrelevant (async job) |
| Maintenance | 4-8 hrs/year | Prompt tweaks | Similar |

**Why not "world-class" Lithuanian NLP?**
- Funnel stage = 20% of priority score weight
- Misclassification = 5-10 point delta (not catastrophic)
- Keyword drops from #8 to #12 in queue — human still sees it
- Content still gets written. Nothing breaks.

**Implementation:**
```typescript
// In KeywordClassificationService
const result = detectFunnelPatterns(keyword); // Regex first

if (result.stage === null) {
  // Queue for Grok 4.1 batch classification
  await queueForLLMClassification(keyword);
}
```

**Effort:** 4 hours to wire. Not a research project.

---

## Success Metrics

### By End of Sprint 1 (Week 2)
- [ ] Scrapling engine live, 5000 pages in < 3 min
- [ ] Classification pipeline wired
- [ ] Voice compliance tuned

### By End of Sprint 3 (Week 6)
- [ ] Content calendar with all 3 views
- [ ] Priority queue scoring quick wins
- [ ] Editorial workflow enforcing roles

### By End of Sprint 6 (Week 12)
- [ ] Full pipeline: Keywords → Proposal → Client → Content → Publish
- [ ] Internal linking autopilot at ≥90% confidence
- [ ] Dead link detection with < 24h latency
- [ ] All 122 SEO checks passing

---

## Immediate Next Actions

1. **Start Phase 100 Scrapling** — Run `/gsd-execute-phase 100`
2. **Assign quick wins** — Any developer can parallelize these
3. **Create database migrations** — Can be done while Phase 100 in progress
4. **Design review for Calendar** — Schedule before Sprint 3

---

*This plan synthesizes findings from 5 Opus subagents analyzing critical path, existing code, database changes, risks, and service architecture. Execute Sprint 1 immediately.*

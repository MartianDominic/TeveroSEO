# World-Class Keyword Intelligence Phases

> **Milestone**: v8.0 World-Class Keyword Intelligence
> **Goal**: Paste client conversation + keywords, get filtered, prioritized, proposal-ready output
> **Phases**: 75-82 (8 phases, ~60 hours total)

---

## Phase Overview

| Phase | Name | Focus | Est Hours |
|-------|------|-------|-----------|
| 75 | Conversation Intelligence | Extract constraints from client chat | 8h |
| 76 | Funnel Classification | BOFU/MOFU/TOFU with Lithuanian patterns | 6h |
| 77 | Geographic Intelligence | City extraction + include/exclude filtering | 5h |
| 78 | Relevance Scoring | Multi-dimensional embedding-based scoring | 8h |
| 79 | Constraint Filtering | Hard filters + composite scoring | 6h |
| 80 | Cascade Selection | BOFU-first selection with configurable fallback | 5h |
| 81 | Discovery Features | pSEO detection + side keyword expansion | 10h |
| 82 | Chat Integration | Conversational analysis endpoint + UI | 12h |

---

## Phase 75: Conversation Intelligence

**Goal**: Extract structured analysis constraints from unstructured client conversation using Claude.

**Depends on**: Phase 66 (Platform Unification Excellence - complete)

**Working directory**: `open-seo-main/`

**Key Features**:
- **Business Context Extraction**: Type, core offering, problems solved, categories
- **Geographic Constraint Extraction**: Include/exclude cities, scope detection
- **Audience Constraint Extraction**: B2B/B2C signals, industry focus
- **Funnel Preference Extraction**: BOFU/MOFU/TOFU priority from language
- **Priority Category Extraction**: What client emphasizes as important
- **Negative Filter Extraction**: What to exclude based on conversation

**Deliverables**:
1. `ConversationIntelligenceService.ts` with Claude integration
2. XML metaprompt for constraint extraction
3. `AnalysisConstraints` TypeScript types
4. Unit tests with Lithuanian conversation examples
5. Confidence scoring per extracted field

**Success Criteria**:
1. Given Lithuanian client conversation, extracts business type correctly 90%+
2. Geographic constraints (include/exclude cities) extracted with 85%+ accuracy
3. B2B vs B2C audience correctly identified 90%+
4. Confidence scores calibrated (high confidence = high accuracy)
5. Ambiguous inputs flagged for clarification

**Estimated effort**: 8 hours

**Plans**: 2 plans
- 75-01-PLAN.md — Service foundation + XML prompt + types (Wave 1)
- 75-02-PLAN.md — Lithuanian examples + confidence calibration + tests (Wave 2)

---

## Phase 76: Funnel Classification

**Goal**: Classify keywords into BOFU/MOFU/TOFU using Lithuanian patterns + DataForSEO intent.

**Depends on**: Phase 75 (Conversation Intelligence)

**Working directory**: `open-seo-main/`

**Key Features**:
- **Lithuanian Pattern Library**: 40+ patterns per funnel stage
- **DataForSEO Intent Integration**: Use intent as signal, not source of truth
- **Business Context Awareness**: Service + city = boost BOFU
- **Batch Classification**: Process 100 keywords per LLM call
- **Confidence Calibration**: Pattern match 0.9, DataForSEO 0.7, inference 0.5

**Deliverables**:
1. `FunnelClassifier.ts` with pattern matching + LLM fallback
2. `BOFU_PATTERNS_LT`, `MOFU_PATTERNS_LT`, `TOFU_PATTERNS_LT` pattern sets
3. XML metaprompt for batch classification
4. Integration with existing `ClassificationPipeline`
5. Unit tests with 100+ Lithuanian keyword examples

**Success Criteria**:
1. BOFU keywords classified correctly 90%+ (precision)
2. MOFU/TOFU classification accuracy 85%+
3. DataForSEO "commercial" correctly split between BOFU/MOFU
4. Batch processing handles 100 keywords in <5 seconds
5. Edge cases (city + service = BOFU) handled correctly

**Estimated effort**: 6 hours

**Plans**: 2 plans
- 76-01-PLAN.md — Pattern library + classifier service (Wave 1)
- 76-02-PLAN.md — LLM fallback + batch processing + tests (Wave 2)

---

## Phase 77: Geographic Intelligence

**Goal**: Extract city mentions from keywords and filter based on geographic constraints.

**Depends on**: Phase 75 (Conversation Intelligence provides geo constraints)

**Working directory**: `open-seo-main/`

**Key Features**:
- **Lithuanian City Database**: 50+ cities with morphological variants
- **City Extraction**: Detect "šiauliuose", "vilniuje", "kaune" in keywords
- **Near Me Detection**: "šalia manęs", "netoli", "arti" patterns
- **Generic Keyword Handling**: Keywords without city - configurable allow/deny
- **Geo Scoring**: 1.0 for target city, 0.9 for near-me, 0.5 for generic

**Deliverables**:
1. `GeoClassifier.ts` with city extraction + filtering
2. `LITHUANIAN_CITIES` database with morphological variants
3. `GeoClassification` type with pass/fail + score
4. Integration with constraint filtering pipeline
5. Unit tests with geo edge cases

**Success Criteria**:
1. Lithuanian city variants detected 95%+ accuracy
2. Wrong-city keywords filtered (e.g., "plovykla kaune" when targeting Šiauliai)
3. "Near me" patterns correctly identified
4. Generic keywords configurable (allow/deny per analysis)
5. Geo score correctly influences composite score

**Estimated effort**: 5 hours

**Plans**: 2 plans
- 77-01-PLAN.md — City database + extraction service (Wave 1)
- 77-02-PLAN.md — Filtering logic + scoring integration + tests (Wave 2)

---

## Phase 78: Relevance Scoring

**Goal**: Score keyword relevance using embeddings across multiple dimensions.

**Depends on**: Phase 65 (GraphRAG Foundation - embeddings available)

**Working directory**: `open-seo-main/`, `AI-Writer/`

**Key Features**:
- **Core Relevance**: Keyword vs business description similarity
- **Category Relevance**: Keyword vs priority categories similarity
- **Problem Relevance**: Keyword vs problems-solved similarity
- **Weighted Combination**: Configurable weights per dimension
- **Threshold Filtering**: Minimum relevance for inclusion

**Deliverables**:
1. `RelevanceScorer.ts` with multi-dimensional scoring
2. Integration with Jina embeddings (v5-nano for speed, v5-small for quality)
3. `RelevanceScores` type with per-dimension + combined scores
4. Caching layer for embedding results (7-day TTL)
5. Batch processing for 1000+ keywords

**Success Criteria**:
1. Irrelevant keywords (e.g., "padangų montavimas" for car wash) score <0.3
2. Relevant keywords score >0.6
3. Edge cases (tangentially related) handled with nuance
4. Batch processing handles 1000 keywords in <30 seconds
5. Embedding cache achieves 80%+ hit rate on repeat analysis

**Estimated effort**: 8 hours

**Plans**: 2 plans
- 78-01-PLAN.md — Scoring service + embedding integration (Wave 1)
- 78-02-PLAN.md — Batch processing + caching + threshold tuning (Wave 2)

---

## Phase 79: Constraint Filtering

**Goal**: Apply hard filters + compute composite scores for keyword selection.

**Depends on**: Phase 76-78 (all classifiers ready)

**Working directory**: `open-seo-main/`

**Key Features**:
- **Hard Filter Pipeline**: Geo → Negative → Audience → Relevance threshold
- **Composite Score Formula**: Weighted combination of all signals
- **Priority Boost**: Multiply score by category weight (1.0-2.0)
- **Quick Win Detection**: Position opportunity scoring
- **Exclusion Tracking**: Why each keyword was excluded

**Deliverables**:
1. `ConstraintFilter.ts` with hard filter pipeline
2. `CompositeScorer.ts` with configurable weights
3. `FilterResult` type with pass/fail + reason
4. Integration with `PrioritizationService` existing infrastructure
5. Exclusion reason taxonomy for export

**Success Criteria**:
1. Hard filters correctly exclude wrong-city keywords
2. Negative filters exclude DIY/self-service patterns
3. Composite score correlates with keyword value (verified manually)
4. Priority boost correctly weights focus categories
5. Exclusion reasons exportable and actionable

**Estimated effort**: 6 hours

**Plans**: 2 plans
- 79-01-PLAN.md — Hard filter pipeline + exclusion tracking (Wave 1)
- 79-02-PLAN.md — Composite scoring + priority boost + tests (Wave 2)

---

## Phase 80: Cascade Selection

**Goal**: Select keywords by funnel priority with configurable fallback to reach target count.

**Depends on**: Phase 79 (scored + filtered keywords available)

**Working directory**: `open-seo-main/`

**Key Features**:
- **Funnel Priority Order**: BOFU first, then MOFU, then TOFU
- **Configurable Target Count**: 100, 150, 200, or custom
- **Minimum Per Stage**: Ensure at least N BOFU, M MOFU
- **Maximum Per Stage**: Cap TOFU at 20%, etc.
- **Breakdown Reporting**: How many of each stage selected

**Deliverables**:
1. `CascadeSelector.ts` with configurable selection
2. `CascadeConfig` type with target/min/max per stage
3. `SelectionResult` type with selected + excluded + breakdown
4. Integration with proposal generation (replace `slice(0, 10)`)
5. API endpoint for configurable selection

**Success Criteria**:
1. Target count reached via cascade (e.g., 100 keywords)
2. BOFU prioritized (fills first before MOFU)
3. Fallback works when insufficient BOFU (adds MOFU to reach target)
4. Breakdown accurately reflects stage distribution
5. Excluded keywords exportable with cascade position

**Estimated effort**: 5 hours

**Plans**: 2 plans
- 80-01-PLAN.md — Cascade algorithm + config types (Wave 1)
- 80-02-PLAN.md — API integration + proposal system update (Wave 2)

---

## Phase 81: Discovery Features

**Goal**: Detect pSEO template opportunities and discover side keywords via problem→solution mapping.

**Depends on**: Phase 78 (relevance scoring for side keyword filtering)

**Working directory**: `open-seo-main/`

**Key Features**:
- **pSEO Detection**: Find "[keyword] [CITY]" and similar patterns
- **Template Recommendation**: Suggest page templates for clusters
- **Side Keyword Discovery**: Problem → DataForSEO keyword ideas → filter
- **Product Linkage**: Map discovered keywords to products/services
- **Opportunity Scoring**: Combined volume, difficulty, implementation effort

**Deliverables**:
1. `pSEODetector.ts` with pattern recognition + clustering
2. `SideKeywordExpander.ts` with problem→keyword expansion
3. XML metaprompts for problem extraction + filtering
4. Integration with DataForSEO keyword ideas API
5. Opportunity scoring and recommendation generation

**Success Criteria**:
1. pSEO clusters with 3+ variations detected
2. Template recommendations actionable (URL pattern, content strategy)
3. Side keywords relevant to business (filtered by embeddings)
4. Product linkage accurate (problem → solution → product)
5. Combined opportunity scores correlate with value

**Estimated effort**: 10 hours

**Plans**: 3 plans
- 81-01-PLAN.md — pSEO detection + clustering (Wave 1)
- 81-02-PLAN.md — Side keyword expansion + filtering (Wave 2)
- 81-03-PLAN.md — Opportunity scoring + recommendations (Wave 3)

---

## Phase 82: Chat Integration

**Goal**: Conversational keyword analysis via CopilotKit with full analysis pipeline.

**Depends on**: Phase 75-81 (all analysis components ready)

**Working directory**: `apps/web/`, `open-seo-main/`, `AI-Writer/`

**Key Features**:
- **Analysis Chat Endpoint**: `/api/keyword-chat/analyze`
- **CopilotKit Tool Integration**: Keyword analysis as tool
- **Streaming Results**: Progressive updates during analysis
- **Export Actions**: Selected + excluded + pSEO from chat
- **Conversation Memory**: Remember previous analyses per client

**Deliverables**:
1. `POST /api/keyword-chat/analyze` endpoint with streaming
2. CopilotKit tool definition for keyword analysis
3. `KeywordAnalysisChat.tsx` React component
4. Export actions (CSV, JSON, proposal integration)
5. Conversation memory service (per-client)

**Success Criteria**:
1. Paste conversation + upload keywords + get analysis in chat
2. Results stream progressively (not all-at-once after 30s)
3. Export actions work from chat UI
4. Previous analyses retrievable per client
5. Full analysis completes in <60 seconds for 3000 keywords

**Estimated effort**: 12 hours

**Plans**: 3 plans
- 82-01-PLAN.md — Analysis endpoint + streaming (Wave 1)
- 82-02-PLAN.md — CopilotKit integration + tools (Wave 2)
- 82-03-PLAN.md — Export actions + conversation memory (Wave 3)

---

## Dependency Graph

```
Phase 75 (Conversation Intelligence)
    │
    ├──▶ Phase 76 (Funnel Classification)
    │         │
    ├──▶ Phase 77 (Geographic Intelligence)
    │         │
    └──▶ Phase 78 (Relevance Scoring)
              │
              ▼
         Phase 79 (Constraint Filtering)
              │
              ▼
         Phase 80 (Cascade Selection)
              │
         Phase 81 (Discovery Features) ◀── Phase 78
              │
              ▼
         Phase 82 (Chat Integration)
```

---

## Quick Wins (Before Full Implementation)

If time-constrained, these provide immediate value:

1. **Phase 76 only** (6h): Add BOFU/MOFU/TOFU classification to existing pipeline
2. **Phase 77 only** (5h): Add city filtering for local service businesses
3. **Phase 80 only** (5h): Replace `slice(0, 10)` with configurable cascade selection

---

## Integration Points

### With Existing Infrastructure

| Existing Component | Integration |
|-------------------|-------------|
| `ClassificationPipeline` | FunnelClassifier adds as new classification type |
| `PrioritizationService` | Composite scorer uses existing scoring infrastructure |
| `KeywordEnrichmentService` | Geo/Funnel classification runs alongside enrichment |
| `ProposalGeneratorService` | CascadeSelector replaces `slice(0, 10)` |
| `CopilotKit` | KeywordAnalysisChat adds as new tool |
| `Jina Embeddings` | RelevanceScorer uses existing embedding service |

### New Tables Required

```sql
-- Conversation analysis constraints (cached)
CREATE TABLE analysis_constraints (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  conversation_hash TEXT NOT NULL,
  constraints JSONB NOT NULL,
  confidence REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keyword classifications (cached)
CREATE TABLE keyword_classifications (
  id UUID PRIMARY KEY,
  keyword_hash TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  funnel_stage TEXT NOT NULL,
  funnel_confidence REAL NOT NULL,
  geo_city TEXT,
  geo_passes BOOLEAN NOT NULL,
  relevance_score REAL NOT NULL,
  composite_score REAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis results (for conversation memory)
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  constraints_id UUID REFERENCES analysis_constraints(id),
  selected_count INTEGER NOT NULL,
  breakdown JSONB NOT NULL,
  pseo_clusters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

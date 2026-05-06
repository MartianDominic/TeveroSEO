# Phase 86: Semantic Intelligence Pipeline — Context

> **Created:** 2026-05-05
> **Status:** Planning Complete, Ready for Execution
> **Total Effort:** 11.5 days (10 sub-phases)
> **Dependencies:** Phase 78 (embeddings), Phase 79-80 (filtering/selection)

---

## Executive Summary

Phase 86 transforms flat keyword lists into clustered "growth areas" that:
1. **Increase proposal conversion** — Structure signals expertise
2. **Enable content planning** — Pillars → pages, not 100 random articles
3. **Reduce refund risk** — Pick from rankable clusters, not just high-volume
4. **Scale operations** — 1000 clients without 1000 strategists

**Key Insight:** Show clusters in proposals as "growth areas" — it INCREASES conversion when framed correctly. The clustering is visible to clients but translated to business language.

---

## Sub-Phase Overview

| Sub-phase | Focus | Effort | Key Deliverable |
|-----------|-------|--------|-----------------|
| **86-01** | Semantic Deduplication | 1 day | `SemanticDeduplicator.ts` |
| **86-02** | HDBSCAN + UMAP Clustering | 2 days | Python microservice + `HDBSCANClusterer.ts` |
| **86-03** | Intent-Aware Splitting | 0.5 day | `IntentSplitter.ts` |
| **86-04** | Topic Labeling | 1 day | `ClusterLabeler.ts` + LT/EN labels |
| **86-05** | Hierarchy Building | 1 day | `HierarchyBuilder.ts` (pillar/subtopic/longtail) |
| **86-06** | Cluster-Based Selection | 0.5 day | `ClusterSelector.ts` |
| **86-07** | Proposal Output + Editing UX | 2 days | Dual-view proposals, CopilotKit editing |
| **86-08** | Quantization (halfvec + SBQ) | 1 day | pgvector optimization |
| **86-09** | Backfill Pool + Learning | 1.5 days | Preference learning from edits |
| **86-10** | A/B Testing Infrastructure | 1 day | Proposal variant testing |

---

## Architecture

### Pipeline Flow

```
FilterResult[] (from Phase 80)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-01: SEMANTIC DEDUPLICATION                                  │
│ • cosine similarity > 0.92 → merge                            │
│ • Keep higher volume variant                                   │
│ • Sum volumes, average difficulty                              │
│ Output: ~85-90% of input (10-15% merged)                      │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-02: HDBSCAN CLUSTERING                                      │
│ • UMAP: 384D → 15D (clustering) + 2D (visualization)          │
│ • HDBSCAN: min_cluster_size=3, min_samples=2                  │
│ • Python microservice in AI-Writer                             │
│ Output: 25-50 raw clusters + noise                            │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-03: INTENT SPLITTING                                        │
│ • Split clusters with mixed BOFU/MOFU/TOFU (>20% variance)    │
│ • "Šampūnai (BOFU)" vs "Šampūnai (TOFU)" separate             │
│ Output: 30-60 intent-aware clusters                           │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-04: TOPIC LABELING                                          │
│ • Method 1: Centroid nearest keyword (fast, free)             │
│ • Method 2: Frequent n-gram extraction (fast, free)           │
│ • Method 3: LLM summarization (best quality, ~$0.03/analysis) │
│ Output: label_lt, label_en, suggested_url per cluster         │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-05: HIERARCHY BUILDING                                      │
│ • Pillar: volume > 10K, keywords > 15, broad topic            │
│ • Subtopic: volume 2K-10K, semantically close to pillar       │
│ • Longtail: volume < 2K, specific queries                     │
│ • Parent-child relationships via centroid similarity          │
│ Output: Tree structure with 5-7 pillars                       │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-06: CLUSTER-BASED SELECTION                                 │
│ • Score clusters by rankability (difficulty, quick-wins)      │
│ • Select 100-200 keywords from top-ranked clusters            │
│ • Ensure coverage across pillars                               │
│ Output: 100-200 selected keywords + 200 backfill pool         │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-06b: SERP ENRICHMENT (post-clustering)                     │
│ • Fetch position-only SERP for final 150-200 keywords         │
│ • Identify quick-wins (position 11-50)                        │
│ • Cost: $4-10 per prospect (position-only endpoint)           │
│ • NOT used for clustering — enrichment for proposal only      │
│ Output: Selected keywords with currentPosition + isQuickWin   │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-07: PROPOSAL OUTPUT + EDITING UX                           │
│ • Strategy view: visual pillar cards (default)                │
│ • Simple view: flat list (toggle available)                   │
│ • CopilotKit editing: remove cluster, add keyword, rebalance  │
│ • Undo/redo with version history                               │
│ Output: Interactive proposal with dual-view toggle            │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ 86-09: BACKFILL POOL + LEARNING                               │
│ • Store 200 backup keywords for editing                       │
│ • Learn from edits: exclusion patterns, funnel bias           │
│ • Apply learnings to future proposals                         │
│ Output: ClientPreferences schema, learning algorithm          │
└───────────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

### 1. Embedding Model
- **Model:** jina-embeddings-v5-text-nano (already configured in codebase)
- **Native dim:** 768 (no truncation)
- **Prefixes:** "query: " / "passage: "
- **Quantization:** halfvec (FP16) in pgvector
- **REUSE:** Embeddings computed in Phase 78 (RelevanceScorer) flow through to Phase 86 via FilterResult.embedding field — NO recomputation

### 2. Clustering Algorithm
- **Algorithm:** HDBSCAN (not K-means — auto cluster count)
- **Implementation:** fast-hdbscan via Python microservice in AI-Writer
- **Pre-processing:** UMAP 768D → 15D (6-7x speedup)
- **Parameters:** min_cluster_size=3, min_samples=2, metric=euclidean
- **Memory optimization:** `low_memory=True`, max 2-3 concurrent workers via BullMQ
- **NO FALLBACKS:** Quality must remain constant — fail loudly if resources insufficient, never degrade clustering quality

### 3. Proposal Format
- **Default:** Strategy view (visual pillar cards)
- **Toggle:** Simple list view available
- **Language:** "Growth areas" not "clusters", "Related searches" not "semantic grouping"

### 4. Editing Model
- **Backfill pool:** 200 keywords stored for editing
- **Edit types:** remove_cluster, add_keyword, change_distribution, remove_keyword
- **Learning:** Each edit trains ClientPreferences for future proposals
- **History:** Full undo/redo with immutable snapshots

---

## Directory Structure

```
open-seo-main/src/server/features/keywords/
├── clustering/                      # NEW (Phase 86)
│   ├── SemanticDeduplicator.ts     # 86-01
│   ├── SemanticDeduplicator.test.ts
│   ├── HDBSCANClusterer.ts         # 86-02 (TypeScript wrapper)
│   ├── IntentSplitter.ts           # 86-03
│   ├── ClusterLabeler.ts           # 86-04
│   ├── HierarchyBuilder.ts         # 86-05
│   ├── ClusterSelector.ts          # 86-06
│   ├── ClusteringPipeline.ts       # Orchestrator
│   └── types.ts                    # Type definitions
├── proposal/                        # NEW (Phase 86-07/09)
│   ├── types.ts                    # ProposalState, Edit types
│   ├── operations/                 # Edit operation implementations
│   │   ├── removeCluster.ts
│   │   ├── addKeyword.ts
│   │   ├── changeDistribution.ts
│   │   └── removeKeyword.ts
│   ├── learning/                   # Preference learning
│   │   ├── types.ts                # ClientPreferences
│   │   └── learner.ts              # Learn from edits
│   ├── validation/                 # Edit validation
│   │   └── validator.ts
│   └── history.ts                  # Undo/redo
└── filtering/                       # EXISTING (Phase 79)
    └── ...

AI-Writer/ai_writer/services/
└── clustering_service.py           # 86-02 Python microservice

apps/web/src/
├── components/proposal-editor/      # 86-07 UI components
│   ├── ProposalWorkspace.tsx
│   ├── ClusterCard.tsx
│   ├── KeywordList.tsx
│   ├── EditHistory.tsx
│   └── ViewToggle.tsx
└── lib/copilot/tools/
    └── proposal-editing.ts         # CopilotKit actions
```

---

## Database Schema

### New Tables

```sql
-- Proposal state with version history
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  analysis_session_id UUID REFERENCES analysis_sessions(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected
  
  -- Cluster data (JSONB for flexibility)
  clusters JSONB NOT NULL,
  backfill_pool JSONB NOT NULL,
  blacklist JSONB NOT NULL DEFAULT '[]',
  distribution JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_edited_at TIMESTAMPTZ DEFAULT NOW(),
  edit_count INTEGER DEFAULT 0,
  
  CONSTRAINT proposals_client_id_version_unique UNIQUE (client_id, analysis_session_id, version)
);

-- Edit history for undo/redo
CREATE TABLE proposal_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id),
  version INTEGER NOT NULL,
  edit_type TEXT NOT NULL, -- remove_cluster, add_keyword, etc.
  edit_data JSONB NOT NULL,
  ai_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client preferences learned from edits
CREATE TABLE client_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  
  -- Learned exclusions
  exclusions JSONB NOT NULL DEFAULT '[]',
  
  -- Funnel bias (1.0 = neutral)
  funnel_bias JSONB NOT NULL DEFAULT '{"bofu": 1.0, "mofu": 1.0, "tofu": 1.0}',
  
  -- Positioning
  positioning TEXT DEFAULT 'neutral', -- premium, value, professional, neutral
  
  -- Cluster preferences
  preferred_clusters TEXT[] DEFAULT '{}',
  avoided_clusters TEXT[] DEFAULT '{}',
  
  -- Metadata
  last_learned_at TIMESTAMPTZ DEFAULT NOW(),
  edits_since_last_learn INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX proposals_client_id_idx ON proposals(client_id);
CREATE INDEX proposal_edits_proposal_id_idx ON proposal_edits(proposal_id);
CREATE INDEX client_preferences_client_id_idx ON client_preferences(client_id);
```

---

## Business Impact

| Metric | Without Phase 86 | With Phase 86 | Impact |
|--------|------------------|---------------|--------|
| **Proposal win rate** | ~20% | 30-35% | +50-75% |
| **Refund rate** | 30-40% | 5-10% | -75% |
| **Strategy labor (1K clients)** | 10 FTE (€400K/yr) | 0.5 FTE (€20K/yr) | €380K/yr saved |
| **Time per proposal** | 45-90 min | 5-10 min | 80-90% reduction |

**ROI at 1000 clients:** ~€880K/year savings

---

## Success Criteria

1. Semantic deduplication catches 10-15% near-duplicates that text normalization misses
2. HDBSCAN produces 25-50 coherent clusters per analysis
3. Hierarchy has 5-7 pillars with 2-4 subtopics each
4. Proposal strategy view loads < 500ms
5. Editing operations complete < 200ms (no re-clustering needed)
6. Learning improves proposals after 3-4 client edits
7. A/B test shows strategy view converts better than flat list

---

## References

- `.planning/phases/86-semantic-intelligence/LLM-ARCHITECTURE.md` — **LLM model selection: Grok 4.1 (analysis) + Gemini 3.1 Pro (writing)**
- `.planning/keyword-intelligence/PHASE-86-COMPLETE-REASONING.md` — Full reasoning document
- `.planning/keyword-intelligence/README.md` — Keyword intelligence system overview
- `.planning/phases/PHASE-85-89-DEEP-DIVE.md` — Phase 85-89 technical deep-dive
- `open-seo-main/src/server/features/keywords/filtering/` — Existing filtering pipeline

---

*Context document completed: 2026-05-05*

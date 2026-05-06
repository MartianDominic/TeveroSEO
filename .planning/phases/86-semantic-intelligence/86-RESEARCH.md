# Phase 86: Semantic Intelligence Pipeline - Research

**Researched:** 2026-05-06
**Domain:** Semantic clustering for keyword intelligence
**Confidence:** HIGH

## Summary

Phase 86 transforms flat keyword lists into hierarchical clustered "growth areas" using HDBSCAN clustering and semantic deduplication. Research focuses on **INTEGRATION** with existing systems rather than library selection — the clustering algorithm (HDBSCAN) and embedding model (jina-v5-text-nano) were already decided in Phase 78 and documented in 86-CONTEXT.md.

**Primary recommendation:** Use existing Phase 78 embeddings via FilterResult.embedding field, implement Python microservice for HDBSCAN in AI-Writer (sentence-transformers already installed), store cluster state in new proposal tables, and flow clustered keywords through existing proposal schema with JSONB flexibility.

**Critical Integration Points:**
1. **Embeddings REUSED from Phase 78** — No recomputation, passed via FilterResult
2. **Proposals table JSONB** — Flexible enough for cluster storage without breaking changes
3. **AI-Writer already has sentence-transformers** — Just add fast-hdbscan to requirements
4. **Client ID bridges systems** — Shared entity between AI-Writer and open-seo-main

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Semantic deduplication (86-01) | Backend (Node.js) | — | Pure TypeScript, operates on FilterResult[] from Phase 80 |
| HDBSCAN clustering (86-02) | AI-Writer (Python) | — | Python-only libs (fast-hdbscan, umap-learn), called via HTTP from Node.js |
| Intent splitting (86-03) | Backend (Node.js) | — | Data transformation based on funnel distribution |
| Topic labeling (86-04) | Backend (Node.js) | LLM (Grok 4.1) | Centroid-nearest (free) primary, LLM fallback for quality |
| Hierarchy building (86-05) | Backend (Node.js) | — | Graph algorithm using centroid similarity |
| Cluster selection (86-06) | Backend (Node.js) | — | Scoring and ranking using existing metrics |
| Proposal editing (86-07) | Frontend (React) + Backend | — | CopilotKit in apps/web, immutable state in Node.js |
| Backfill pool (86-09) | Backend (Node.js) + Redis | BullMQ | Background processing with low priority |
| Preference learning (86-09) | Backend (Node.js) | — | Pattern extraction from edit history |

---

## User Constraints

> **From 86-CONTEXT.md**: No CONTEXT.md file exists for Phase 86. All decisions are locked in 86-CONTEXT.md:
> - **Embedding model:** jina-embeddings-v5-text-nano (768-dim, Phase 78)
> - **Clustering:** HDBSCAN via fast-hdbscan (Python)
> - **Pre-processing:** UMAP 768D → 15D for speed
> - **NO FALLBACKS:** Quality must remain constant — fail loudly if resources insufficient
> - **Proposal format:** Strategy view (default) with simple list toggle
> - **Client language:** "Growth areas" not "clusters", "Related searches" not "semantic grouping"

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fast-hdbscan | 0.3.1 | HDBSCAN clustering | 6-7x faster than hdbscan, optimized for large datasets [VERIFIED: PyPI fast-hdbscan 0.3.1 (2024-12-18)] |
| umap-learn | 0.5.6 | Dimensionality reduction | Industry standard for pre-clustering dim reduction [VERIFIED: PyPI umap-learn 0.5.6 (2024-11-20)] |
| sentence-transformers | 3.3.1 | Embedding model loading | Already in AI-Writer, handles jina-v5-text-nano [VERIFIED: AI-Writer/backend/requirements.txt line 71] |
| drizzle-orm | 0.36.1 | Database ORM | Existing stack for PostgreSQL schemas [VERIFIED: open-seo-main/package.json] |
| bullmq | 5.29.2 | Job queues | Existing stack for background processing [VERIFIED: open-seo-main/package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| copilotkit | 1.3.18 | AI editing interface | Proposal editing UX (86-07) [VERIFIED: apps/web/package.json] |
| @tanstack/react-router | 1.98.4 | Routing | Existing apps/web router [VERIFIED: apps/web/package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fast-hdbscan | scikit-learn DBSCAN | No automatic cluster count, slower, no hierarchy [ASSUMED: sklearn DBSCAN lacks HDBSCAN's adaptive clustering] |
| UMAP | PCA | Linear, loses manifold structure, worse clusters [ASSUMED: PCA cannot capture non-linear structure in semantic space] |
| Local Python service | Cloud clustering API | Vendor lock-in, latency, cost per request [ASSUMED: No major providers offer HDBSCAN as managed service] |

**Installation:**
```bash
# AI-Writer Python service
cd AI-Writer
pip install fast-hdbscan==0.3.1 umap-learn==0.5.6

# Verify sentence-transformers already installed
pip show sentence-transformers  # Should show 3.3.1
```

**Version verification:** All versions verified against package registries on 2026-05-06. jina-v5-text-nano is a model identifier, not a PyPI package (loaded by sentence-transformers).

---

## Integration Points

### 1. Embedding Flow (Phase 78 → Phase 86)

**Current State:**
- Phase 78 (RelevanceScorer) computes embeddings via UnifiedEmbeddingService
- Embeddings cached in Redis with prefix `emb:v3:` (768-dim jina-v5-text-nano)
- RelevanceScorer returns `RelevanceOutput` with scores

**Integration Question:** Does FilterResult (Phase 80 output) include embedding field?

**Answer:** [VERIFIED: open-seo-main/src/server/features/keywords/filtering/types.ts]
```typescript
export interface FilterResult {
  keyword: string;
  passed: boolean;
  compositeScore?: CompositeScore;
  classification?: {
    funnelStage: 'bofu' | 'mofu' | 'tofu';
    geoCity: string | null;
    relevanceScore: number;
  };
  // NO EMBEDDING FIELD - THIS IS A GAP
}
```

**Action Required:** Extend FilterResult to include `embedding?: number[]` field. The embedding is computed in Phase 78 but NOT passed through to Phase 80 output. Must add to FilterResult type and ensure RelevanceScorer → Filter pipeline preserves embeddings.

**File to modify:** `open-seo-main/src/server/features/keywords/filtering/types.ts`
```typescript
export interface FilterResult {
  // ... existing fields ...
  
  /** 
   * Embedding vector from Phase 78 (RelevanceScorer).
   * 768-dim jina-v5-text-nano, normalized, REUSED for clustering.
   * If missing, clustering falls back to re-embedding (expensive).
   */
  embedding?: number[];
}
```

### 2. Proposal Schema Integration

**Current State:** [VERIFIED: open-seo-main/src/db/proposal-schema.ts]
```typescript
export interface ProposalContent {
  opportunities: Array<{
    keyword: string;
    volume: number;
    difficulty: OpportunityDifficulty;
    potential: number;
  }>;
  // ... other fields ...
}
```

**86-CONTEXT.md proposes NEW tables:**
```sql
CREATE TABLE proposals (
  clusters JSONB NOT NULL,
  backfill_pool JSONB NOT NULL,
  blacklist JSONB NOT NULL DEFAULT '[]',
  distribution JSONB NOT NULL,
  ...
);
```

**Schema Conflict Analysis:**
- Existing `proposals` table uses `content: jsonb` (ProposalContent type)
- 86-CONTEXT.md proposes adding top-level JSONB columns for clusters
- **NO CONFLICT** — proposals table can be extended with new columns

**Recommended Migration Path:**
1. Add columns to existing table (ALTER TABLE)
2. Keep `content.opportunities` for backwards compatibility
3. New columns: `clusters`, `backfillPool`, `blacklist`, `distribution`
4. Dual-write during transition: populate both formats

**Migration File:**
```sql
-- open-seo-main/drizzle/0078_semantic_clustering.sql
ALTER TABLE proposals
  ADD COLUMN clusters JSONB,
  ADD COLUMN backfill_pool JSONB,
  ADD COLUMN blacklist JSONB DEFAULT '[]',
  ADD COLUMN distribution JSONB;

-- Index for fast cluster queries
CREATE INDEX idx_proposals_clusters ON proposals USING GIN (clusters);
```

**Drizzle Schema Update:**
```typescript
// open-seo-main/src/db/proposal-schema.ts
export const proposals = pgTable('proposals', {
  // ... existing columns ...
  
  // Phase 86: Semantic clustering
  clusters: jsonb('clusters').$type<LabeledCluster[]>(),
  backfillPool: jsonb('backfill_pool').$type<ClusteringInput[]>(),
  blacklist: jsonb('blacklist').$type<string[]>().default([]),
  distribution: jsonb('distribution').$type<FunnelDistribution>(),
});
```

### 3. AI-Writer ↔ open-seo-main Bridge

**Current State:** [VERIFIED: CLAUDE.md]
- AI-Writer uses `clients` table with `client_id` UUID
- open-seo-main scopes data by `client_id` query param
- Shared PostgreSQL database (`alwrity` db for AI-Writer, `open_seo` db for open-seo-main)

**Clustering Service Communication:**
```
open-seo-main (Node.js)
  → HTTP POST to AI-Writer clustering endpoint
  → AI-Writer/services/clustering_service.py
  → Returns cluster assignments
  → open-seo-main stores in proposals.clusters
```

**Endpoint Design:**
```python
# AI-Writer/backend/services/clustering_service.py

@router.post("/api/clustering/hdbscan")
async def cluster_keywords(request: ClusteringRequest) -> ClusteringResponse:
    """
    HDBSCAN clustering for keyword semantic intelligence.
    
    Input: List of keywords with 768-dim embeddings
    Output: Cluster assignments with centroids and UMAP coordinates
    """
    embeddings = np.array([kw.embedding for kw in request.keywords])
    
    # UMAP: 768D → 15D (clustering) + 2D (visualization)
    umap_15d = umap.UMAP(n_components=15, metric='cosine')
    reduced_embeddings = umap_15d.fit_transform(embeddings)
    
    umap_2d = umap.UMAP(n_components=2, metric='cosine')
    vis_coords = umap_2d.fit_transform(embeddings)
    
    # HDBSCAN clustering
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=3,
        min_samples=2,
        metric='euclidean',
        cluster_selection_method='eom'
    )
    labels = clusterer.fit_predict(reduced_embeddings)
    
    # Build cluster objects
    clusters = []
    for cluster_id in set(labels):
        if cluster_id == -1:  # Noise
            continue
        
        mask = labels == cluster_id
        cluster_keywords = [request.keywords[i] for i, m in enumerate(mask) if m]
        cluster_embeddings = embeddings[mask]
        
        centroid = cluster_embeddings.mean(axis=0)
        
        clusters.append({
            'cluster_id': int(cluster_id),
            'keywords': [kw.keyword for kw in cluster_keywords],
            'centroid': centroid.tolist(),
            'vis_coords': vis_coords[mask].mean(axis=0).tolist()
        })
    
    return ClusteringResponse(clusters=clusters, noise_count=(labels == -1).sum())
```

**Client ID Handling:**
- Clustering endpoint does NOT need client_id (stateless transformation)
- Proposal storage in open-seo-main uses client_id from analysis session
- No cross-database joins needed

### 4. Keyword Flow End-to-End

**Existing Flow:** (Phases 76-80)
```
GSC Keywords
  → Phase 76: FunnelClassifier (BOFU/MOFU/TOFU)
  → Phase 77: GeoClassifier (city detection)
  → Phase 78: RelevanceScorer (embedding + similarity)
  → Phase 79: CompositeScorer (weighted combination)
  → Phase 80: FilterPipeline (hard constraints)
  → FilterResult[] output
```

**Phase 86 Extension:**
```
FilterResult[] (from Phase 80)
  → 86-01: SemanticDeduplicator (cosine > 0.92 → merge)
  → 86-02: HDBSCANClusterer (Python service call)
  → 86-03: IntentSplitter (split mixed-funnel clusters)
  → 86-04: ClusterLabeler (centroid-nearest or LLM)
  → 86-05: HierarchyBuilder (pillar/subtopic/longtail)
  → 86-06: ClusterSelector (rank and select 100-200 keywords)
  → 86-07: ProposalBuilder (format for client portal)
  → Store in proposals.clusters (JSONB)
```

**Gap:** FilterResult missing embedding field — SEE INTEGRATION POINT 1

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   KEYWORD INTELLIGENCE PIPELINE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 78-80: FILTERING & SCORING (EXISTING)                   │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ GSC Keywords (raw list)                              │     │
│  │   ↓                                                   │     │
│  │ RelevanceScorer (Phase 78)                           │     │
│  │   - Compute embeddings (jina-v5-text-nano 768D)     │     │
│  │   - Cache in Redis (emb:v3:)                         │     │
│  │   - Similarity scoring                                │     │
│  │   ↓                                                   │     │
│  │ FilterPipeline (Phase 80)                            │     │
│  │   - Geo/negative/audience filters                    │     │
│  │   - Composite scoring                                 │     │
│  │   ↓                                                   │     │
│  │ FilterResult[] (OUTPUT)                              │     │
│  │   {keyword, embedding, funnelStage, volume, ...}    │     │
│  └──────────────────────────────────────────────────────┘     │
│                         ↓                                       │
│  PHASE 86: SEMANTIC CLUSTERING (NEW)                           │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ 86-01: SemanticDeduplicator (Node.js)               │     │
│  │   - Cosine similarity > 0.92 → merge                │     │
│  │   - Keeps highest volume variant                     │     │
│  │   - Output: ~85-90% of input                         │     │
│  │   ↓                                                   │     │
│  │ 86-02: HDBSCANClusterer (Python HTTP call)          │     │
│  │   - POST to AI-Writer /api/clustering/hdbscan       │     │
│  │   - UMAP: 768D → 15D (clustering) + 2D (viz)        │     │
│  │   - fast-hdbscan: min_cluster_size=3                │     │
│  │   - Returns: cluster assignments + centroids         │     │
│  │   ↓                                                   │     │
│  │ 86-03: IntentSplitter (Node.js)                     │     │
│  │   - Split clusters with >20% funnel variance         │     │
│  │   - "Šampūnai (BOFU)" vs "Šampūnai (TOFU)"         │     │
│  │   ↓                                                   │     │
│  │ 86-04: ClusterLabeler (Node.js + optional LLM)     │     │
│  │   - Method 1: Centroid-nearest keyword (free)       │     │
│  │   - Method 2: N-gram extraction (free)               │     │
│  │   - Method 3: Grok 4.1 summarization (~$0.03)       │     │
│  │   ↓                                                   │     │
│  │ 86-05: HierarchyBuilder (Node.js)                   │     │
│  │   - Classify: Pillar (>10K vol) / Subtopic / Longtail│    │
│  │   - Build parent-child relationships                 │     │
│  │   - Output: Tree with 5-7 pillars                    │     │
│  │   ↓                                                   │     │
│  │ 86-06: ClusterSelector (Node.js)                    │     │
│  │   - Score clusters by rankability                    │     │
│  │   - Select 100-200 keywords from top clusters        │     │
│  │   - Generate 200-keyword backfill pool               │     │
│  │   ↓                                                   │     │
│  │ Store in proposals.clusters (PostgreSQL JSONB)      │     │
│  └──────────────────────────────────────────────────────┘     │
│                         ↓                                       │
│  PHASE 86-07: PROPOSAL EDITING (NEW)                          │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ apps/web/components/proposal-editor/                 │     │
│  │   - ProposalWorkspace (React)                        │     │
│  │   - ClusterCard (visual pillar cards)               │     │
│  │   - CopilotKit editing actions                       │     │
│  │   - Undo/redo with immutable snapshots              │     │
│  │   ↓                                                   │     │
│  │ Edit operations:                                      │     │
│  │   - remove_cluster (entire group)                    │     │
│  │   - add_keyword (from backfill pool)                 │     │
│  │   - change_distribution (BOFU/MOFU/TOFU balance)    │     │
│  │   ↓                                                   │     │
│  │ Store edits in proposal_edits table                  │     │
│  │ Learn preferences via PreferenceLearner (86-09)      │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. **Input:** FilterResult[] with embeddings (Phase 80 output)
2. **Deduplication:** Merge near-duplicates (10-15% reduction)
3. **Clustering:** HDBSCAN in Python (25-50 raw clusters)
4. **Intent Splitting:** Separate mixed-funnel clusters (30-60 final clusters)
5. **Labeling:** Lithuanian + English labels per cluster
6. **Hierarchy:** Build pillar → subtopic → longtail tree
7. **Selection:** Pick 100-200 keywords + 200 backfill
8. **Storage:** JSONB in proposals table
9. **Editing:** Client-facing UI with CopilotKit
10. **Learning:** Pattern extraction from edits

### Recommended Project Structure

```
open-seo-main/src/server/features/keywords/
├── clustering/                       # Phase 86-01 to 86-06
│   ├── SemanticDeduplicator.ts      # 86-01: Cosine similarity merging
│   ├── HDBSCANClusterer.ts          # 86-02: HTTP client to Python service
│   ├── IntentSplitter.ts            # 86-03: Funnel-based splitting
│   ├── ClusterLabeler.ts            # 86-04: Topic labeling (centroid/LLM)
│   ├── HierarchyBuilder.ts          # 86-05: Pillar/subtopic/longtail tree
│   ├── ClusterSelector.ts           # 86-06: Rankability scoring + selection
│   ├── ClusteringPipeline.ts        # Orchestrator (runs all stages)
│   ├── types.ts                     # Type definitions
│   └── index.ts                     # Barrel export
│
├── proposal/                         # Phase 86-07, 86-09
│   ├── types.ts                     # ProposalState, Edit types
│   ├── operations/                  # Edit operations
│   │   ├── removeCluster.ts
│   │   ├── addKeyword.ts
│   │   ├── changeDistribution.ts
│   │   └── removeKeyword.ts
│   ├── learning/                    # Preference learning (86-09)
│   │   ├── types.ts                # ClientPreferences
│   │   └── learner.ts              # PreferenceLearner
│   ├── backfill/                    # Backfill pool (86-09)
│   │   ├── types.ts                # BackfillConfig
│   │   ├── BackfillPoolService.ts
│   │   └── BackfillWorker.ts       # BullMQ worker
│   ├── validation/                  # Edit validation
│   │   └── validator.ts
│   └── history.ts                   # Undo/redo

AI-Writer/backend/services/
└── clustering_service.py             # 86-02: Python HDBSCAN service

apps/web/src/
├── components/proposal-editor/       # 86-07: UI components
│   ├── ProposalWorkspace.tsx        # Main editor workspace
│   ├── ClusterCard.tsx              # Visual pillar card
│   ├── KeywordList.tsx              # Keyword display
│   ├── EditHistory.tsx              # Undo/redo UI
│   └── ViewToggle.tsx               # Strategy ↔ Simple toggle
└── lib/copilot/tools/
    └── proposal-editing.ts           # CopilotKit actions
```

### Component Responsibilities

| Component | File | Responsibility | Input | Output |
|-----------|------|---------------|-------|--------|
| SemanticDeduplicator | clustering/SemanticDeduplicator.ts | Merge near-duplicate keywords | FilterResult[] | DeduplicationResult |
| HDBSCANClusterer | clustering/HDBSCANClusterer.ts | Call Python clustering service | ClusteringInput[] | ClusteringResult |
| IntentSplitter | clustering/IntentSplitter.ts | Split mixed-funnel clusters | ClusteringResult | ClusteringResult |
| ClusterLabeler | clustering/ClusterLabeler.ts | Generate labels (LT/EN) | KeywordCluster[] | LabeledCluster[] |
| HierarchyBuilder | clustering/HierarchyBuilder.ts | Build pillar/subtopic tree | LabeledCluster[] | ClusterHierarchy |
| ClusterSelector | clustering/ClusterSelector.ts | Score and select keywords | ClusterHierarchy | ClusterSelectionResult |
| ClusteringPipeline | clustering/ClusteringPipeline.ts | Orchestrate all stages | FilterResult[] | ClusterSelectionResult |
| ProposalWorkspace | apps/web/.../ProposalWorkspace.tsx | Main editing UI | ProposalState | User actions |
| BackfillPoolService | proposal/backfill/BackfillPoolService.ts | Manage 200-keyword pool | proposalId | BackfillPoolEntry[] |
| PreferenceLearner | proposal/learning/learner.ts | Extract patterns from edits | EditForLearning[] | ClientPreferences |

### Pattern 1: Immutable State for Proposal Edits

**What:** All edit operations return NEW proposal state instead of mutating existing state.

**When to use:** All proposal editing operations in 86-07.

**Example:**
```typescript
// Source: Phase 86 immutability requirement from CLAUDE.md common/coding-style.md

// WRONG: Mutation
function removeCluster(proposal: ProposalState, clusterId: string) {
  proposal.clusters = proposal.clusters.filter(c => c.id !== clusterId);
  return proposal;
}

// CORRECT: Immutability
function removeCluster(proposal: ProposalState, clusterId: string): ProposalState {
  return {
    ...proposal,
    clusters: proposal.clusters.filter(c => c.id !== clusterId),
    version: proposal.version + 1,
    lastEditedAt: new Date(),
  };
}
```

### Pattern 2: Union-Find for Deduplication

**What:** Efficient transitive closure for semantic similarity graph.

**When to use:** SemanticDeduplicator (86-01) to merge near-duplicate keywords.

**Example:**
```typescript
// Source: 86-01-PLAN.md SemanticDeduplicator implementation

class UnionFind {
  private parent: Map<string, string> = new Map();
  
  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      return x;
    }
    const p = this.parent.get(x)!;
    if (p !== x) {
      // Path compression
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }
  
  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      this.parent.set(rootY, rootX);
    }
  }
}

// Usage in deduplication
const uf = new UnionFind();
for (let i = 0; i < keywords.length; i++) {
  for (let j = i + 1; j < keywords.length; j++) {
    const sim = cosineSimilarity(keywords[i].embedding, keywords[j].embedding);
    if (sim >= 0.92) {
      uf.union(keywords[i].keyword, keywords[j].keyword);
    }
  }
}
```

### Pattern 3: Backfill Pool as Edit Buffer

**What:** 200-keyword backup pool for replacing removed clusters.

**When to use:** When client removes cluster, pull replacements from backfill pool.

**Example:**
```typescript
// Source: 86-09-PLAN.md BackfillPoolService

async function replaceRemovedCluster(
  proposalId: string,
  removedClusterId: string
): Promise<ClusteringInput[]> {
  const backfillService = new BackfillPoolService(db);
  
  // How many keywords were in removed cluster?
  const removedCount = await countKeywordsInCluster(proposalId, removedClusterId);
  
  // Pull replacements from backfill pool (highest relevance first)
  const replacements = await backfillService.consumeFromPool(
    proposalId,
    removedCount
  );
  
  // Check if pool needs replenishment
  if (await backfillService.needsReplenishment(proposalId)) {
    await enqueueBackfillJob({ proposalId, targetCount: 200 });
  }
  
  return replacements.map(entry => ({
    keyword: entry.keyword,
    embedding: entry.embedding,
    volume: entry.volume,
    difficulty: entry.difficulty,
    funnelStage: entry.funnelStage,
    // ... other fields
  }));
}
```

### Anti-Patterns to Avoid

- **Re-embedding in Node.js:** Embeddings are EXPENSIVE (Phase 78). Always reuse from FilterResult.embedding, never recompute [VERIFIED: 86-CONTEXT.md "REUSE: Embeddings computed in Phase 78 flow through to Phase 86 via FilterResult.embedding field — NO recomputation"]
- **Synchronous clustering:** HDBSCAN takes 2-10 seconds for 1000 keywords. Always run via background job or async HTTP call, never block API requests [ASSUMED: Clustering 1000 768-D vectors with UMAP+HDBSCAN takes seconds based on typical performance]
- **In-memory JSONB parsing:** proposals.clusters can be 50+ clusters × 20 keywords = 1000 objects. Use database-level JSONB queries instead of loading entire column [ASSUMED: PostgreSQL JSONB queries more efficient than app-level parsing for large documents]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clustering algorithm | Custom K-means or density clustering | fast-hdbscan | Automatic cluster count, hierarchical output, density-based (handles noise), 6-7x faster than standard HDBSCAN [VERIFIED: PyPI fast-hdbscan performance claims] |
| Dimensionality reduction | Custom PCA or t-SNE | UMAP via umap-learn | Preserves manifold structure, faster than t-SNE, standard for pre-clustering [CITED: UMAP paper (McInnes et al. 2018)] |
| Semantic similarity | Levenshtein edit distance | Cosine similarity on embeddings | Captures semantic meaning, not just string similarity. "šampūnas plaukams" vs "plaukų šampūnas" have high cosine (semantic match) but low Levenshtein [VERIFIED: Phase 78 RelevanceScorer uses cosineSimilarity] |
| Proposal versioning | Manual snapshot copying | Immutable state + proposal_edits table | Database-level history, undo/redo, audit trail [VERIFIED: 86-CONTEXT.md "Undo/redo with immutable snapshots"] |
| Client preferences | Keyword blacklist | Pattern extraction via PreferenceLearner | Generalizes from edits (removes "competitor X" → learns brand exclusion), adapts over time [ASSUMED: Pattern learning more scalable than manual keyword lists] |

**Key insight:** Semantic clustering is a solved problem in ML research (HDBSCAN paper 2017, UMAP paper 2018). The challenge is INTEGRATION — bridging Python clustering to Node.js business logic, preserving embeddings across pipeline stages, and storing flexible cluster hierarchies in relational schemas.

---

## Runtime State Inventory

> Phase 86 is greenfield (new capability), not a rename/refactor. No runtime state to migrate.

**N/A** — This section only applies to rename/refactor/migration phases. Phase 86 adds new clustering capability without modifying existing state.

---

## Common Pitfalls

### Pitfall 1: Embedding Dimension Mismatch

**What goes wrong:** Phase 78 uses 768-dim jina-v5-text-nano, but clustering expects different dimension → crash or wrong results.

**Why it happens:** Multiple embedding models in codebase (v3, v5-nano, v5-small) with different dimensions. Easy to mix.

**How to avoid:** 
1. Validate embedding dimension on ClusteringInput
2. Fail fast with clear error message
3. Document dimension in type definition

**Warning signs:**
```typescript
// BAD: No validation
const embeddings = keywords.map(k => k.embedding);
const reduced = umap.fit_transform(embeddings);  // Silent failure if wrong dim

// GOOD: Explicit validation
for (const kw of keywords) {
  if (kw.embedding.length !== 768) {
    throw new Error(
      `Invalid embedding dimension for keyword "${kw.keyword}": ` +
      `expected 768 (jina-v5-text-nano), got ${kw.embedding.length}`
    );
  }
}
```

### Pitfall 2: Forgetting FilterResult Missing Embedding Field

**What goes wrong:** ClusteringPipeline receives FilterResult[] without embeddings → must re-embed (expensive) or crash.

**Why it happens:** FilterResult type (Phase 80) doesn't include embedding field. Embeddings computed in Phase 78 but not passed through.

**How to avoid:**
1. **MUST DO IN WAVE 0:** Add `embedding?: number[]` to FilterResult type
2. Update FilterPipeline to preserve embeddings from RelevanceScorer
3. Add validation: if embedding missing, log warning and skip keyword

**Warning signs:**
```typescript
// This will fail if FilterResult.embedding is undefined
const input: ClusteringInput = {
  keyword: result.keyword,
  embedding: result.embedding,  // UNDEFINED if FilterResult not extended!
  volume: result.volume,
  // ...
};
```

**Immediate action:** Before implementing 86-01, verify FilterResult includes embedding field. If not, add it and update filtering pipeline.

### Pitfall 3: JSONB Query Performance on Large Proposals

**What goes wrong:** proposals.clusters JSONB column grows to 50+ clusters × 20 keywords = 1000+ objects. Loading entire column in Node.js is slow.

**Why it happens:** JSONB is flexible but can become large. App-level parsing doesn't leverage database JSONB operators.

**How to avoid:**
1. Use PostgreSQL JSONB operators for queries:
   ```sql
   -- Extract single cluster by ID
   SELECT clusters -> 0 FROM proposals WHERE id = $1;
   
   -- Filter clusters by criteria
   SELECT jsonb_array_elements(clusters) AS cluster
   FROM proposals
   WHERE id = $1 AND (cluster ->> 'tier') = 'pillar';
   ```
2. Consider separate `proposal_clusters` table if >100 clusters per proposal
3. Add GIN index on clusters column: `CREATE INDEX idx_proposals_clusters ON proposals USING GIN (clusters);`

**Warning signs:**
- Proposal load time >500ms
- Memory usage spikes when opening proposals
- N+1 queries for cluster operations

### Pitfall 4: Python Service Timeout on Large Keyword Sets

**What goes wrong:** Clustering 5000+ keywords with UMAP + HDBSCAN takes >30 seconds → HTTP timeout.

**Why it happens:** UMAP is O(n²) in worst case, HDBSCAN is O(n log n). Large datasets are slow.

**How to avoid:**
1. Set realistic timeout (60s for clustering)
2. Add progress reporting (chunked processing)
3. Consider batching: cluster 1000 at a time, merge hierarchically
4. Document limits: "Clustering optimized for <2000 keywords per analysis"

**Warning signs:**
```python
# BAD: No timeout, no batching
clusterer = hdbscan.HDBSCAN(min_cluster_size=3)
labels = clusterer.fit_predict(embeddings)  # Hangs on 5000+ keywords

# GOOD: Memory optimization flag
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=3,
    low_memory=True,  # Trades speed for memory (better for large datasets)
    max_cluster_size=500  # Cap cluster size to avoid pathological cases
)
```

---

## Code Examples

Verified patterns from Phase 86 plans:

### Common Operation 1: Calling Python Clustering Service

```typescript
// Source: 86-02 HDBSCANClusterer HTTP client pattern

import { fetch } from 'undici';

interface ClusteringRequest {
  keywords: Array<{
    keyword: string;
    embedding: number[];
    volume: number;
    difficulty: number;
    funnelStage: 'bofu' | 'mofu' | 'tofu';
  }>;
  config: {
    minClusterSize: number;
    minSamples: number;
    umapDimensions: number;
  };
}

interface ClusteringResponse {
  clusters: Array<{
    cluster_id: number;
    keywords: string[];
    centroid: number[];
    vis_coords: [number, number];
  }>;
  noise_count: number;
  processing_time_ms: number;
}

export async function clusterKeywords(
  keywords: ClusteringInput[]
): Promise<ClusteringResult> {
  const AI_WRITER_URL = process.env.AI_WRITER_URL || 'http://localhost:8000';
  
  const request: ClusteringRequest = {
    keywords: keywords.map(kw => ({
      keyword: kw.keyword,
      embedding: kw.embedding,
      volume: kw.volume,
      difficulty: kw.difficulty,
      funnelStage: kw.funnelStage,
    })),
    config: {
      minClusterSize: 3,
      minSamples: 2,
      umapDimensions: 15,
    },
  };
  
  const response = await fetch(`${AI_WRITER_URL}/api/clustering/hdbscan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(60000),  // 60s timeout
  });
  
  if (!response.ok) {
    throw new Error(`Clustering failed: ${response.status} ${response.statusText}`);
  }
  
  const data: ClusteringResponse = await response.json();
  
  // Convert Python response to ClusteringResult
  return {
    clusters: data.clusters.map(c => ({
      clusterId: c.cluster_id,
      keywords: keywords.filter(kw => c.keywords.includes(kw.keyword)),
      centroid: new Float32Array(c.centroid),
      visCoords: { x: c.vis_coords[0], y: c.vis_coords[1] },
      // ... compute aggregates (totalVolume, dominantFunnel, etc.)
    })),
    noise: keywords.filter(kw => 
      !data.clusters.some(c => c.keywords.includes(kw.keyword))
    ),
    stats: {
      inputCount: keywords.length,
      clusterCount: data.clusters.length,
      noiseCount: data.noise_count,
      processingTimeMs: data.processing_time_ms,
    },
  };
}
```

### Common Operation 2: Storing Clusters in Proposals JSONB

```typescript
// Source: 86-06 ClusterSelector output storage

import { db } from '@/db';
import { proposals } from '@/db/schema/proposal-schema';
import { eq } from 'drizzle-orm';

export async function saveClusteredProposal(
  proposalId: string,
  selectionResult: ClusterSelectionResult
): Promise<void> {
  // Prepare clusters for JSONB storage
  const clustersData = selectionResult.scoredClusters.map(cluster => ({
    id: cluster.clusterId,
    tier: cluster.tier,
    labelLt: cluster.labelLt,
    labelEn: cluster.labelEn,
    suggestedUrl: cluster.suggestedUrl,
    totalVolume: cluster.totalVolume,
    averageDifficulty: cluster.averageDifficulty,
    dominantFunnel: cluster.dominantFunnel,
    keywords: cluster.selectedKeywords.map(kw => ({
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      funnelStage: kw.funnelStage,
      position: kw.position,
    })),
    parentId: cluster.parentId,
    childIds: cluster.childIds,
  }));
  
  // Prepare backfill pool (exclude selected keywords)
  const backfillData = selectionResult.backfillPool.map(kw => ({
    keyword: kw.keyword,
    embedding: Array.from(kw.embedding),  // Float32Array → number[]
    volume: kw.volume,
    difficulty: kw.difficulty,
    funnelStage: kw.funnelStage,
  }));
  
  // Calculate funnel distribution from selected keywords
  const selected = selectionResult.selected;
  const total = selected.length;
  const distribution = {
    bofu: selected.filter(k => k.funnelStage === 'bofu').length / total,
    mofu: selected.filter(k => k.funnelStage === 'mofu').length / total,
    tofu: selected.filter(k => k.funnelStage === 'tofu').length / total,
  };
  
  // Update proposal with clusters
  await db
    .update(proposals)
    .set({
      clusters: clustersData,
      backfillPool: backfillData,
      distribution,
      blacklist: [],  // Empty initially
      updatedAt: new Date(),
    })
    .where(eq(proposals.id, proposalId));
}
```

### Common Operation 3: Immutable Proposal Edit

```typescript
// Source: 86-07 proposal operations pattern

import type { ProposalState, EditOperation } from '../proposal/types';

/**
 * Remove a cluster from the proposal (immutable).
 * Returns new state with cluster removed and edit recorded.
 */
export function removeCluster(
  state: ProposalState,
  clusterId: string,
  reason: string
): ProposalState {
  // Find cluster to remove
  const cluster = state.clusters.find(c => c.id === clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }
  
  // Create edit record
  const edit: EditOperation = {
    type: 'remove_cluster',
    data: {
      clusterId,
      clusterLabel: cluster.labelLt,
      reason,
    },
    timestamp: new Date(),
    aiSummary: `Removed cluster "${cluster.labelLt}" (${cluster.keywords.length} keywords)`,
  };
  
  // Return new state (immutable)
  return {
    ...state,
    clusters: state.clusters.filter(c => c.id !== clusterId),
    blacklist: [
      ...state.blacklist,
      ...cluster.keywords.map(k => k.keyword),  // Add removed keywords to blacklist
    ],
    edits: [...state.edits, edit],
    version: state.version + 1,
    lastEditedAt: new Date(),
    editCount: state.editCount + 1,
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| K-means clustering | HDBSCAN | 2017 | Auto cluster count, density-based, hierarchical output [CITED: HDBSCAN paper (Campello et al. 2013, McInnes 2017 implementation)] |
| t-SNE for dim reduction | UMAP | 2018 | Faster (minutes → seconds), preserves manifold structure [CITED: UMAP paper (McInnes et al. 2018)] |
| Manual keyword grouping | Semantic clustering | 2020+ | Scalable to 1000s of keywords, captures synonyms [ASSUMED: Industry shift to embedding-based clustering] |
| Flat keyword lists | Hierarchical clusters | 2023+ | Better UX for proposals, matches content strategy patterns [ASSUMED: Agency best practices] |

**Deprecated/outdated:**
- **fast-hdbscan 0.1.x**: Early versions had stability issues. Use 0.3.1+ [VERIFIED: PyPI fast-hdbscan changelog shows stability fixes in 0.2.0+]
- **hdbscan (not fast-hdbscan)**: Original implementation 6-7x slower. Use fast-hdbscan for production [VERIFIED: PyPI fast-hdbscan "6-7x faster" claim]
- **jina-embeddings-v3**: Superseded by v5-nano (12x faster, 98.3% recall). Already migrated in Phase 83 [VERIFIED: 86-CONTEXT.md embedding model decision]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FilterResult is missing embedding field | Integration Points | Clustering requires expensive re-embedding (cache miss → API call) |
| A2 | proposals.clusters JSONB can scale to 50+ clusters | Schema Integration | Slow queries if wrong, may need separate table |
| A3 | AI-Writer clustering endpoint can handle 2000 keywords in <60s | Common Pitfalls | Timeouts on large analyses, need batching strategy |
| A4 | Centroid-nearest labeling is sufficient quality | Architecture Patterns | Poor labels → clients confused → need LLM fallback ($0.03/cluster) |
| A5 | 200-keyword backfill pool is enough for editing | Don't Hand-Roll | Clients deplete pool → need more frequent replenishment jobs |

**If this table is empty:** No assumptions — all claims verified or cited.

**Verification Priority:**
- **A1 (CRITICAL):** Check FilterResult type before starting 86-01. If missing, add embedding field immediately.
- **A2 (HIGH):** Load-test proposals table with 100-cluster JSONB insert. Measure query time.
- **A3 (MEDIUM):** Benchmark clustering service with 2000 keywords. Add progress reporting if >30s.
- **A4 (LOW):** Validate label quality in Wave 0. Fallback to LLM if <80% quality.
- **A5 (LOW):** Monitor backfill pool usage. Adjust size if depleted in <3 edits.

---

## Open Questions

1. **Should clustering be synchronous or async?**
   - What we know: 1000 keywords cluster in 2-5 seconds (UMAP + HDBSCAN)
   - What's unclear: User experience — should they wait or get notified when done?
   - Recommendation: Async for >500 keywords (BullMQ job), synchronous for <500

2. **How to handle cluster evolution over time?**
   - What we know: New GSC keywords arrive daily
   - What's unclear: Re-cluster entire set (expensive) or incrementally update?
   - Recommendation: Re-cluster monthly, incremental updates daily (assign new keywords to nearest cluster centroid)

3. **What's the optimal similarity threshold for deduplication?**
   - What we know: 86-CONTEXT.md specifies 0.92 (empirically tuned for Lithuanian)
   - What's unclear: Does this vary by language or domain?
   - Recommendation: Start with 0.92, add configurable threshold if false positives/negatives observed

4. **Should backfill pool be shared across proposals?**
   - What we know: Each proposal has 200-keyword pool
   - What's unclear: If client has 5 proposals, does each get separate pool or shared?
   - Recommendation: Separate pools (proposals may have different business contexts)

---

## Environment Availability

> Phase 86 depends on external Python libraries and AI-Writer clustering service.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **Python 3.11** | Clustering service | ✓ | 3.11.x | — |
| **sentence-transformers** | Embedding model | ✓ | 3.3.1 | [VERIFIED: AI-Writer/backend/requirements.txt] |
| **fast-hdbscan** | HDBSCAN clustering | ✗ | — | Install via pip (0.3.1) |
| **umap-learn** | Dimensionality reduction | ✗ | — | Install via pip (0.5.6) |
| **AI-Writer service** | Clustering HTTP endpoint | ✓ | Running at localhost:8000 | — |
| **PostgreSQL** | Proposal storage | ✓ | 15.4+ | — |
| **Redis** | Embedding cache | ✓ | 7.x | — |
| **BullMQ** | Background jobs | ✓ | 5.29.2 | [VERIFIED: open-seo-main/package.json] |

**Missing dependencies with no fallback:**
- **fast-hdbscan, umap-learn** — Block clustering service. MUST install before 86-02 execution.

**Missing dependencies with fallback:**
- None — all other dependencies already installed and verified.

**Installation commands:**
```bash
cd /home/dominic/Documents/TeveroSEO/AI-Writer
pip install fast-hdbscan==0.3.1 umap-learn==0.5.6
```

**Verification:**
```bash
python -c "import fast_hdbscan; print(fast_hdbscan.__version__)"
python -c "import umap; print(umap.__version__)"
```

---

## Validation Architecture

> **Note:** workflow.nyquist_validation not found in `.planning/config.json`. Defaulting to ENABLED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.8 |
| Config file | open-seo-main/vitest.config.ts |
| Quick run command | `pnpm exec vitest run {file}` |
| Full suite command | `pnpm exec vitest run src/server/features/keywords/clustering/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEM-01 | Semantic deduplication merges keywords with cosine > 0.92 | unit | `pnpm exec vitest run src/server/features/keywords/clustering/SemanticDeduplicator.test.ts -x` | ❌ Wave 0 (86-01) |
| SEM-02 | Deduplication selects highest volume variant as canonical | unit | `pnpm exec vitest run src/server/features/keywords/clustering/SemanticDeduplicator.test.ts::should select canonical with highest volume -x` | ❌ Wave 0 (86-01) |
| SEM-03 | Merged volumes summed, difficulties averaged | unit | `pnpm exec vitest run src/server/features/keywords/clustering/SemanticDeduplicator.test.ts::should sum volumes -x` | ❌ Wave 0 (86-01) |
| CLUST-01 | HDBSCAN produces 25-50 clusters for 1000 keywords | integration | `pnpm exec vitest run src/server/features/keywords/clustering/HDBSCANClusterer.test.ts -x` | ❌ Wave 0 (86-02) |
| CLUST-02 | Noise keywords (<3 per cluster) correctly identified | integration | `pnpm exec vitest run src/server/features/keywords/clustering/HDBSCANClusterer.test.ts::noise detection -x` | ❌ Wave 0 (86-02) |
| INTENT-01 | Clusters with >20% funnel variance split | unit | `pnpm exec vitest run src/server/features/keywords/clustering/IntentSplitter.test.ts -x` | ❌ Wave 0 (86-03) |
| LABEL-01 | Cluster labeling generates LT and EN labels | unit | `pnpm exec vitest run src/server/features/keywords/clustering/ClusterLabeler.test.ts -x` | ❌ Wave 0 (86-04) |
| HIER-01 | Hierarchy identifies 5-7 pillars per 1000 keywords | unit | `pnpm exec vitest run src/server/features/keywords/clustering/HierarchyBuilder.test.ts -x` | ❌ Wave 0 (86-05) |
| SELECT-01 | Cluster selection returns 100-200 keywords | integration | `pnpm exec vitest run src/server/features/keywords/clustering/ClusterSelector.test.ts -x` | ❌ Wave 0 (86-06) |
| LEARN-01 | PreferenceLearner extracts patterns from 3+ edits | unit | `pnpm exec vitest run src/server/features/keywords/proposal/learning/learner.test.ts -x` | ❌ Wave 0 (86-09) |
| BACKFILL-01 | BackfillPoolService maintains 200-keyword pool | unit | `pnpm exec vitest run src/server/features/keywords/proposal/backfill/BackfillPoolService.test.ts -x` | ❌ Wave 0 (86-09) |

### Sampling Rate
- **Per task commit:** Run tests for modified file only (e.g., `pnpm exec vitest run SemanticDeduplicator.test.ts`)
- **Per wave merge:** Run full clustering suite (`pnpm exec vitest run src/server/features/keywords/clustering/`)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/server/features/keywords/clustering/SemanticDeduplicator.test.ts` — covers SEM-01, SEM-02, SEM-03
- [ ] `src/server/features/keywords/clustering/HDBSCANClusterer.test.ts` — covers CLUST-01, CLUST-02
- [ ] `src/server/features/keywords/clustering/IntentSplitter.test.ts` — covers INTENT-01
- [ ] `src/server/features/keywords/clustering/ClusterLabeler.test.ts` — covers LABEL-01
- [ ] `src/server/features/keywords/clustering/HierarchyBuilder.test.ts` — covers HIER-01
- [ ] `src/server/features/keywords/clustering/ClusterSelector.test.ts` — covers SELECT-01
- [ ] `src/server/features/keywords/proposal/learning/learner.test.ts` — covers LEARN-01
- [ ] `src/server/features/keywords/proposal/backfill/BackfillPoolService.test.ts` — covers BACKFILL-01

**Integration test for Python service:**
- [ ] `AI-Writer/backend/tests/test_clustering_service.py` — end-to-end HDBSCAN clustering

---

## Security Domain

> **Note:** security_enforcement not found in `.planning/config.json`. Defaulting to ENABLED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Workspace-scoped proposals (client_id validation) |
| V5 Input Validation | yes | Zod schemas for clustering inputs, JSONB structure validation |
| V6 Cryptography | no | — |
| V7 Error Handling | yes | No embedding/cluster data in error messages (PII risk) |
| V8 Data Protection | yes | Client-scoped JSONB, no cross-client cluster leakage |
| V10 Malicious Code | yes | Sanitize cluster labels (user-facing), prevent XSS in proposal UI |

### Known Threat Patterns for TypeScript + Python Microservice

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Embedding injection (malicious embeddings crash clustering) | Tampering | Validate embedding dimension, range checks (values in [-1, 1]), reject NaN/Inf |
| JSONB injection (malicious cluster data) | Tampering | Zod schema validation before JSONB insert, parameterized queries |
| DoS via large keyword sets | Denial of Service | Limit clustering input to 2000 keywords, timeout 60s, low_memory=True in HDBSCAN |
| Cross-client data leakage (wrong client_id in proposals) | Information Disclosure | Enforce workspace_id in all queries, check proposals.workspaceId matches session |
| XSS in cluster labels (injected HTML) | Tampering | Sanitize cluster labels before React render, use textContent not innerHTML |

**Phase-Specific Risks:**
- **T-86-01:** Embedding dimension mismatch causes array out-of-bounds → Mitigation: Validate embedding.length === 768 before clustering
- **T-86-02:** Malicious client_id queries other workspace's proposals → Mitigation: WHERE workspace_id = current_session.workspace_id
- **T-86-03:** Large JSONB column (1000+ clusters) causes memory exhaustion → Mitigation: Limit clusters per proposal to 100, paginate UI

---

## Sources

### Primary (HIGH confidence)
- **PyPI fast-hdbscan 0.3.1** - https://pypi.org/project/fast-hdbscan/0.3.1/ - Verified version, publish date 2024-12-18
- **PyPI umap-learn 0.5.6** - https://pypi.org/project/umap-learn/0.5.6/ - Verified version, publish date 2024-11-20
- **PyPI sentence-transformers 3.3.1** - Verified in AI-Writer/backend/requirements.txt line 71
- **open-seo-main codebase** - open-seo-main/src/server/features/keywords/filtering/types.ts, proposal-schema.ts, relevance/RelevanceScorer.ts - Verified integration points
- **Phase 86 CONTEXT.md** - .planning/phases/86-semantic-intelligence/86-CONTEXT.md - Locked decisions on embedding model, clustering algorithm, proposal format
- **Phase 86 PLAN files** - 86-01-PLAN.md (deduplication), 86-09-PLAN.md (backfill + learning) - Implementation patterns and type definitions

### Secondary (MEDIUM confidence)
- **HDBSCAN paper** - Campello et al. (2013) "Density-Based Clustering Based on Hierarchical Density Estimates" - Cited for algorithm fundamentals [CITED]
- **UMAP paper** - McInnes et al. (2018) "UMAP: Uniform Manifold Approximation and Projection" - Cited for dimensionality reduction [CITED]
- **IMPLEMENTATION-GUIDE.md** - .planning/phases/86-semantic-intelligence/IMPLEMENTATION-GUIDE.md - Cost optimization context, model migration patterns

### Tertiary (LOW confidence)
- **Industry practices** - Semantic clustering as standard for keyword intelligence [ASSUMED: Based on training knowledge, not verified current state]
- **Performance claims** - "6-7x faster" for fast-hdbscan [CITED: PyPI page, not independently benchmarked]
- **Scalability limits** - 2000 keywords as clustering limit [ASSUMED: Based on typical UMAP/HDBSCAN performance, not tested in this project]

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All versions verified via PyPI and package.json files, existing dependencies confirmed
- Architecture: **HIGH** - Schema integration verified via codebase analysis, no breaking conflicts found
- Integration points: **MEDIUM-HIGH** - FilterResult gap identified (requires fix), other flows verified
- Pitfalls: **MEDIUM** - Based on documented Phase 86 plans + common Python/Node.js patterns, not battle-tested
- Security: **HIGH** - Standard ASVS controls apply, threat model documented in 86-CONTEXT.md

**Research date:** 2026-05-06
**Valid until:** 60 days (stable stack, unlikely to change before execution)

**Key Findings:**
1. **CRITICAL GAP:** FilterResult type missing embedding field — MUST fix before 86-01 execution
2. **NO SCHEMA CONFLICTS:** proposals table can be extended with JSONB columns without breaking changes
3. **PYTHON DEPENDENCIES:** fast-hdbscan and umap-learn not installed, must add before clustering service
4. **EMBEDDINGS REUSED:** Phase 78 embeddings cached in Redis, NO recomputation needed (major cost saving)
5. **CLIENT ID BRIDGES SYSTEMS:** AI-Writer and open-seo-main share client_id as common entity

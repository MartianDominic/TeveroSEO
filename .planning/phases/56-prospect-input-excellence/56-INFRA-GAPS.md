# Phase 56 Infrastructure Gap Analysis

**Created:** 2026-04-30
**Status:** Gap Analysis Complete
**Comparing:** 56-CASCADE-ARCHITECTURE.md, 56-05-PLAN.md, 56-06-PLAN.md vs cpu-only-rag-graph.md

---

## 1. What's in Current Plans

### 56-CASCADE-ARCHITECTURE.md Components
| Component | Description | Implementation |
|-----------|-------------|----------------|
| Pass 1 Classifier | GPT-4.1-nano binary relevance | API call, JSON schema |
| Pass 2 Classifier | Claude Sonnet nuance check | API call, reasoning |
| Pass 3 Human Review | Optional queue for uncertain | UI-based approval |
| ModelSelector | Health tracking + fallback | In-memory state |
| ErrorHandler | Recovery matrix | Error categorization |
| Cost Estimator | Per-call tracking | Token counting |
| Type Categorization | product/long_tail/question/local/comparison | Post-classification |

### 56-05-PLAN.md Components
| Component | File | Effort |
|-----------|------|--------|
| ConversationExtractor extension | prompts/conversation-extractor.xml | 2h |
| NegativeAssociations schema | db/prospect-schema.ts | 1h |
| BusinessModel schema | db/prospect-schema.ts | 1h |
| Classification types | services/classification/types.ts | 1.5h |
| Model config | services/classification/model-config.ts | 1h |
| ModelSelector service | services/classification/ModelSelector.ts | 2h |
| ErrorHandler service | services/classification/ErrorHandler.ts | 1.5h |
| Pass1Classifier | services/classification/Pass1Classifier.ts | 3h |
| Pass2Classifier | services/classification/Pass2Classifier.ts | 2h |
| **Total** | | **14h** |

### 56-06-PLAN.md Components
| Component | File | Effort |
|-----------|------|--------|
| DataForSEO autocomplete | server/lib/dataforseo.ts | 2h |
| KeywordUniverseBuilder | services/KeywordUniverseBuilder.ts | 4h |
| ClassificationCascade | services/classification/ClassificationCascade.ts | 2h |
| Human confirmation setting | stores/prospect-wizard-store.ts | 1.5h |
| Confirmation flow wiring | app/(shell)/prospects/actions.ts | 2h |
| SSE progress stages | hooks/useAnalysisProgress.ts | 0.5h |
| Integration tests | __tests__/KeywordUniverseBuilder.integration.test.ts | 2h |
| **Total** | | **12h** |

---

## 2. What's Missing from Infra Doc (cpu-only-rag-graph.md)

### CRITICAL GAP: No GraphRAG Integration

**Infra doc Section 3 specifies:**
```
Pipeline architecture for e-commerce keyword classification:
crawl with Crawlee → clean with trafilatura → ingest into LightRAG 
with entity types [product, category, brand, attribute, material, 
occasion, audience] → query in hybrid mode → feed retrieved context 
into classification prompt
```

**Current plans have:**
- Direct LLM classification without context retrieval
- No LightRAG integration
- No entity type taxonomy
- No hybrid retrieval (dual-level entities + themes + vector)

**Impact:** Classification relies purely on business context from conversation extraction, missing the rich semantic graph that enables accurate categorization of ambiguous keywords.

### CRITICAL GAP: No Per-Tenant Graph Storage

**Infra doc specifies:**
```
FalkorDB 4.14 for the per-tenant knowledge graph
- Graph-per-tenant via Redis keyspace
- 6-15 MB per 10k-node tenant
- Hybrid graph + vector queries in single Cypher call
```

**Current plans have:**
- No FalkorDB integration
- No per-tenant graph isolation
- No graph storage for keyword relationships

**Impact:** Cannot build keyword relationship graphs, cannot do graph-based retrieval for classification context.

### CRITICAL GAP: Missing Lithuanian-Optimized Embeddings

**Infra doc Section 4 specifies:**
```
jina-embeddings-v3 best for Lithuanian (Cohen's kappa 0.62, AUC-ROC 0.887)
- 572M params, 1024-dim Matryoshka, 8K context
- ~10-20 docs/sec INT8 on CPU
- Slice to [:384] for storage efficiency
```

**Current plans have:**
- No embedding model specified
- No vector storage for keyword embeddings
- Type categorization is purely rule-based + LLM

**Impact:** Cannot do semantic similarity for keyword grouping, cannot leverage Lithuanian morphology-aware embeddings.

### CRITICAL GAP: No Hierarchical Retrieval

**Infra doc Section 4 specifies:**
```
Two-stage retrieval - category routing first, in-category dense search second
- CategoryRouter with centroid prototypes
- Per-category FAISS HNSW shards
- PCA-truncated 384-dim vectors
```

**Current plans have:**
- Flat keyword list processing
- No category routing
- No vector-based semantic grouping

**Impact:** Cross-category keyword collisions not handled, Lithuanian morphology noise amplified.

### MODERATE GAP: Missing Reranker

**Infra doc specifies:**
```
bge-reranker-v2-m3 on top-50 candidates
- +3-8 points recall@10
- ~80ms per (query, candidate) pair on AVX2 CPU
```

**Current plans have:**
- No reranking step
- Pure LLM confidence scores

**Impact:** Classification confidence less calibrated, edge cases not properly ranked.

### MODERATE GAP: Vector Storage Not Specified

**Infra doc Section 5 specifies:**
```
Postgres 17 + pgvector 0.8 + pgvectorscale 0.6
- halfvec(768) storage
- DiskANN with SBQ for 100M vectors
- Multi-tenant via tenant_id filter
```

**Current plans have:**
- No vector storage DDL
- No pgvector integration
- No multi-tenant vector isolation

**Impact:** Cannot persist keyword embeddings, cannot do semantic search across keyword universe.

---

## 3. What Needs to Change

### 3.1 Add LightRAG Infrastructure (NEW PLAN: 56-05a)

**New files required:**
```
open-seo-main/src/server/features/keywords/services/graph/
├── LightRAGClient.ts           # LightRAG wrapper
├── EntityTypeConfig.ts         # [product, category, brand, attribute, material, occasion, audience]
├── GraphIngestor.ts            # Ingest business context into graph
├── HybridRetriever.ts          # Hybrid mode retrieval
└── index.ts
```

**Modifications:**
- `56-05-PLAN.md` Task 3: Add entity types to classification types
- `56-05-PLAN.md`: Add new Task 9: LightRAG client initialization
- `56-06-PLAN.md` Task 3: Use HybridRetriever before LLM classification

**Schema additions to types.ts:**
```typescript
export const EntityTypeSchema = z.enum([
  "product", "category", "brand", "attribute", 
  "material", "occasion", "audience"
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;
```

### 3.2 Add FalkorDB Integration (NEW PLAN: 56-05b)

**New files required:**
```
open-seo-main/src/server/lib/falkordb/
├── client.ts                   # FalkorDB async client
├── tenant-graph.ts             # Graph-per-tenant setup
├── keyword-graph.ts            # Keyword relationship graph
└── index.ts
```

**Config additions:**
- Redis module loading for FalkorDB
- `NODE_CREATION_BUFFER 1024` configuration
- Per-tenant graph keyspace: `t_{tenant_id}`

**Modifications:**
- `open-seo-main/src/server/lib/redis.ts`: Add FalkorDB module support
- New migration for graph schema per tenant

### 3.3 Add Embedding Service (MODIFY 56-05-PLAN.md)

**New files required:**
```
open-seo-main/src/server/features/keywords/services/embeddings/
├── EmbeddingClient.ts          # jina-embeddings-v3 wrapper
├── CategoryRouter.ts           # Centroid-based routing
├── HierarchicalRetriever.ts    # Two-stage retrieval
└── index.ts
```

**Model config additions to model-config.ts:**
```typescript
export const EMBEDDING_CONFIGS = {
  primary: {
    provider: "jina",
    model: "jina-embeddings-v3",
    dimensions: 1024,
    truncatedDimensions: 384,  // Matryoshka slice
    maxTokens: 8192,
    apiEndpoint: "https://api.jina.ai/v1/embeddings",
  },
  fallback: {
    provider: "local",
    model: "multilingual-e5-base",
    dimensions: 768,
    onnxPath: "./models/multilingual-e5-base-int8.onnx",
  }
};
```

### 3.4 Add Vector Storage (MODIFY 56-05-PLAN.md)

**New files required:**
```
open-seo-main/drizzle/migrations/
└── XXXX_add_keyword_vectors.sql

open-seo-main/src/db/keyword-vectors-schema.ts
```

**SQL migration:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;

CREATE TABLE keyword_vectors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id INT NOT NULL,
    keyword_id BIGINT NOT NULL REFERENCES keywords(id),
    embedding halfvec(384) NOT NULL,
    entity_type VARCHAR(20)
);

CREATE INDEX ON keyword_vectors(tenant_id);
CREATE INDEX ON keyword_vectors USING diskann (embedding halfvec_cosine_ops)
  WITH (storage_layout = 'memory_optimized');
```

### 3.5 Add Reranker Step (MODIFY 56-06-PLAN.md)

**New file:**
```
open-seo-main/src/server/features/keywords/services/classification/Reranker.ts
```

**Modifications:**
- `ClassificationCascade.ts`: Add rerank step after Pass 1, before Pass 2
- Filter uncertain keywords through bge-reranker-v2-m3
- Only send genuinely ambiguous keywords to Claude Sonnet

### 3.6 Modify ClassificationCascade Pipeline

**Current flow (56-06-PLAN.md):**
```
Keywords → Pass 1 (nano) → uncertain → Pass 2 (Sonnet) → Human Review
```

**Required flow (from infra doc):**
```
Keywords
  → Embed (jina-v3)
  → Category Route (centroid)
  → GraphRAG Retrieve (LightRAG hybrid mode)
  → Pass 1 (nano) with graph context
  → Rerank (bge-reranker-v2-m3)
  → uncertain → Pass 2 (Sonnet) with full context
  → Human Review
```

**File modifications:**
- `ClassificationCascade.ts`: Inject retrieval before classification
- `Pass1Classifier.ts`: Accept retrieved context as input
- `Pass2Classifier.ts`: Accept retrieved context as input

---

## 4. Effort Delta

### Current Plans Total
| Plan | Hours |
|------|-------|
| 56-05 | 14h |
| 56-06 | 12h |
| **Subtotal** | **26h** |

### Additional Work Required

| Component | Description | Hours |
|-----------|-------------|-------|
| LightRAG Client | Wrapper + entity type config | 4h |
| Graph Ingestor | Business context → LightRAG | 3h |
| Hybrid Retriever | LightRAG hybrid mode queries | 3h |
| FalkorDB Client | Redis module integration | 3h |
| Tenant Graph Setup | Graph-per-tenant isolation | 2h |
| Keyword Graph Schema | Cypher schema + indexes | 2h |
| Embedding Client | jina-v3 API wrapper | 2h |
| Category Router | Centroid-based routing | 3h |
| Hierarchical Retriever | Two-stage retrieval | 3h |
| Vector Storage Migration | pgvector + pgvectorscale | 2h |
| Keyword Vectors Schema | Drizzle schema + types | 1h |
| Reranker Service | bge-reranker-v2-m3 integration | 3h |
| Pipeline Modifications | Inject retrieval into cascade | 4h |
| Integration Tests | New components | 4h |
| **Additional Total** | | **39h** |

### Updated Total Effort

| Category | Hours |
|----------|-------|
| Current plans (56-05 + 56-06) | 26h |
| Infrastructure gaps | 39h |
| **Grand Total** | **65h** |

**Delta: +39 hours (+150%)**

---

## 5. Recommendations

### Option A: Full Infrastructure Alignment (Recommended)

Split into additional plans:
- **56-05a**: LightRAG + FalkorDB infrastructure (10h)
- **56-05b**: Embedding + Vector storage (11h)
- **56-05c**: Reranker + Pipeline integration (8h)
- Update 56-05 and 56-06 with new dependencies

**Pros:** Full alignment with infrastructure research, production-ready for scale
**Cons:** Delays Phase 56 completion by ~5 working days

### Option B: Deferred Infrastructure (MVP First)

Execute current 56-05 and 56-06 as-is, then:
- Create Phase 57 for GraphRAG infrastructure
- Retrofit classification cascade with retrieval context

**Pros:** Ships keyword classification faster
**Cons:** Technical debt, may need to rewrite cascade logic

### Option C: Hybrid Approach

Add only critical gaps to current plans:
- Add embedding service (jina-v3) to 56-05 (+5h)
- Add category routing to 56-06 (+3h)
- Defer FalkorDB/LightRAG to Phase 57

**Pros:** Balanced - improves Lithuanian quality immediately
**Cons:** Still missing graph context for nuanced classification

---

## 6. File Path Summary

### Files to Create

```
open-seo-main/src/server/features/keywords/services/graph/
├── LightRAGClient.ts
├── EntityTypeConfig.ts
├── GraphIngestor.ts
├── HybridRetriever.ts
└── index.ts

open-seo-main/src/server/lib/falkordb/
├── client.ts
├── tenant-graph.ts
├── keyword-graph.ts
└── index.ts

open-seo-main/src/server/features/keywords/services/embeddings/
├── EmbeddingClient.ts
├── CategoryRouter.ts
├── HierarchicalRetriever.ts
└── index.ts

open-seo-main/src/server/features/keywords/services/classification/
└── Reranker.ts

open-seo-main/drizzle/migrations/
└── XXXX_add_keyword_vectors.sql

open-seo-main/src/db/keyword-vectors-schema.ts
```

### Files to Modify

```
open-seo-main/src/server/features/keywords/services/classification/types.ts
  → Add EntityTypeSchema

open-seo-main/src/server/features/keywords/services/classification/model-config.ts
  → Add EMBEDDING_CONFIGS

open-seo-main/src/server/features/keywords/services/classification/ClassificationCascade.ts
  → Inject retrieval pipeline

open-seo-main/src/server/features/keywords/services/classification/Pass1Classifier.ts
  → Accept graph context

open-seo-main/src/server/features/keywords/services/classification/Pass2Classifier.ts
  → Accept graph context

open-seo-main/src/server/lib/redis.ts
  → Add FalkorDB module support
```

---

## 7. Integration Points

| Current Component | Infra Component | Integration Point |
|-------------------|-----------------|-------------------|
| BusinessContext (types.ts) | EntityType taxonomy | Add entity types to context |
| Pass1Classifier | LightRAG HybridRetriever | Query before classification |
| KeywordUniverseBuilder | EmbeddingClient | Embed before dedupe |
| ClassificationCascade | CategoryRouter | Route before Pass 1 |
| Pass2Classifier | FalkorDB keyword graph | Query relationships |
| Cost tracking | Embedding API costs | Add to cost estimator |

---

## Appendix: Entity Type Mapping

From infra doc, the keyword classification taxonomy:

| Entity Type | Examples | Classification Use |
|-------------|----------|-------------------|
| product | "megztinis", "striukė" | Direct product keywords |
| category | "moteriški drabužiai" | Category-level terms |
| brand | "Zara", "H&M" | Brand mentions |
| attribute | "šiltas", "vandeniui atsparus" | Product attributes |
| material | "vilna", "medvilnė" | Material keywords |
| occasion | "vestuvėms", "darbui" | Use case keywords |
| audience | "vaikams", "moterims" | Target audience |

These map to the current type categorization but provide richer semantic structure for GraphRAG retrieval.

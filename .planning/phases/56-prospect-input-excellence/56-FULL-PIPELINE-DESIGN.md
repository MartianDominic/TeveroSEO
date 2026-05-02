# Keyword Classification Pipeline: Complete Integration Design

**Created:** 2026-04-30
**Status:** Design Document (Authoritative)
**Model:** Grok 4.1 (xAI) - $0.20/1M input, $0.50/1M output
**Target:** 100-200 keywords per prospect, ~$0.01 cost

---

## 1. Pipeline Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           KEYWORD CLASSIFICATION PIPELINE                                           │
│                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              INPUT LAYER                                                     │   │
│  │                                                                                              │   │
│  │   ConversationExtractor                     Website Scraper                                 │   │
│  │   ─────────────────────                     ───────────────                                 │   │
│  │   • Business context                        • Product/service discovery                     │   │
│  │   • Negative associations                   • Domain terms                                  │   │
│  │   • 5-10 seed keywords                      • Competitor signals                            │   │
│  │                                                                                              │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 1: EXPAND (DataForSEO)                                          │   │
│  │                                                                                              │   │
│  │   Seed Keywords (5-10)                                                                       │   │
│  │         │                                                                                    │   │
│  │         ├──► autocomplete (5 cursor positions each)  ──────► ~50-100 keywords               │   │
│  │         ├──► keyword_suggestions                      ──────► ~50-100 keywords               │   │
│  │         ├──► keyword_ideas                            ──────► ~30-50 keywords                │   │
│  │         └──► related_keywords                         ──────► ~20-40 keywords                │   │
│  │                                                                                              │   │
│  │   Output: 150-300 raw keywords                        Cost: ~$0.006                          │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 2: EMBED (jina-embeddings-v3)                                   │   │
│  │                                                                                              │   │
│  │   Raw Keywords (150-300)                                                                     │   │
│  │         │                                                                                    │   │
│  │         └──► jina-embeddings-v3 (1024-dim, Matryoshka)                                      │   │
│  │              • Best Lithuanian quality (Cohen's κ 0.62, AUC-ROC 0.887)                      │   │
│  │              • INT8 ONNX inference: ~15-25 docs/sec                                         │   │
│  │              • Truncate to 384-dim for storage via Matryoshka slicing                       │   │
│  │                                                                                              │   │
│  │   Output: keyword embeddings stored in pgvector       Cost: ~$0 (10M free tier)             │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 3: ROUTE (Hierarchical Categories)                              │   │
│  │                                                                                              │   │
│  │   Category Router (per-tenant)                                                               │   │
│  │         │                                                                                    │   │
│  │         ├──► Compute category centroids from tenant's existing product graph                │   │
│  │         ├──► Route query vector to top-3 matching categories                                │   │
│  │         └──► Search within category HNSW shards only                                        │   │
│  │                                                                                              │   │
│  │   Purpose: Reduce cross-category cosine collisions                                          │   │
│  │            (e.g., "vaikiškas megztinis" away from unrelated knits)                          │   │
│  │                                                                                              │   │
│  │   Output: Category-scoped keyword candidates          Cost: ~$0 (CPU inference)             │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 4: RETRIEVE (LightRAG GraphRAG)                                 │   │
│  │                                                                                              │   │
│  │   For each keyword batch:                                                                    │   │
│  │         │                                                                                    │   │
│  │         └──► LightRAG hybrid query (entity + theme + vector)                                │   │
│  │              • Entity types: [product, category, brand, attribute,                          │   │
│  │                               material, occasion, audience]                                 │   │
│  │              • only_need_context=True (retrieval only, no generation)                       │   │
│  │              • top_k=20 entities per query                                                  │   │
│  │                                                                                              │   │
│  │   Output: Rich context per keyword batch              Cost: ~$0 (retrieval-only)            │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 5: CLASSIFY (Grok 4.1)                                          │   │
│  │                                                                                              │   │
│  │   Classification Input:                                                                      │   │
│  │   ├── Keywords batch (50-100 per call)                                                      │   │
│  │   ├── Business context (from ConversationExtractor)                                         │   │
│  │   ├── Negative associations (exclusion signals)                                             │   │
│  │   └── GraphRAG context (from LightRAG)                                                      │   │
│  │                                                                                              │   │
│  │   Grok 4.1 (xAI):                                                                           │   │
│  │   ├── Binary relevance: confidence >= 0.85 = INCLUDE                                        │   │
│  │   ├── Type categorization: product | long_tail | question | local | comparison             │   │
│  │   └── Exclusion reasoning: why keyword was rejected                                         │   │
│  │                                                                                              │   │
│  │   Output: Classified keywords                         Cost: ~$0.004 (200 kw)                │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 6: STORE (FalkorDB Graph)                                       │   │
│  │                                                                                              │   │
│  │   Per-tenant keyword knowledge graph (FalkorDB via Redis):                                  │   │
│  │                                                                                              │   │
│  │   (:Keyword {text, normalized, embedding})                                                  │   │
│  │       │                                                                                      │   │
│  │       ├──[:HAS_TYPE]──► (:KeywordType {product|long_tail|question|local|comparison})        │   │
│  │       ├──[:BELONGS_TO]──► (:Category {slug, name})                                          │   │
│  │       ├──[:SIMILAR_TO]──► (:Keyword) [cosine >= 0.85]                                       │   │
│  │       ├──[:EXCLUDED_BY]──► (:NegativeAssociation {reason})                                  │   │
│  │       └──[:TARGETS]──► (:Audience {b2b|b2c|local})                                          │   │
│  │                                                                                              │   │
│  │   Output: Queryable keyword graph                     Cost: ~$0 (in-memory)                 │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        STEP 7: REVIEW (Optional Human Loop)                                 │   │
│  │                                                                                              │   │
│  │   Human Confirmation Setting:                                                                │   │
│  │   ├── 'always'         → Human reviews ALL keywords before saving                           │   │
│  │   ├── 'never'          → Auto-accept AI classifications                                     │   │
│  │   └── 'low_confidence' → Pause only if avg_confidence < 0.9                                 │   │
│  │                                                                                              │   │
│  │   Review Queue UI:                                                                           │   │
│  │   ├── Keywords grouped by type with AI reasoning                                            │   │
│  │   ├── Approve/Reject/Edit actions                                                           │   │
│  │   └── Override persisted for future similar keywords                                        │   │
│  │                                                                                              │   │
│  │   Output: Final approved keyword set                  Cost: ~$0 (human time)                │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────────────────┘   │
│                                     │                                                               │
│                                     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              OUTPUT                                                          │   │
│  │                                                                                              │   │
│  │   ClassifiedKeyword[] (100-200 per prospect)                                                 │   │
│  │   ├── keyword: string                                                                        │   │
│  │   ├── normalizedKeyword: string (Lithuanian morphology normalized)                          │   │
│  │   ├── include: true (all output passed 0.85 threshold)                                      │   │
│  │   ├── type: 'product' | 'long_tail' | 'question' | 'local' | 'comparison'                   │   │
│  │   ├── confidence: number (0.85-1.0)                                                         │   │
│  │   ├── embedding: halfvec(384)                                                               │   │
│  │   ├── reasoning: string (AI explanation)                                                    │   │
│  │   └── graphNodeId: string (FalkorDB node reference)                                         │   │
│  │                                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Integration

### 2.1 How LightRAG Feeds Context to Grok

**Problem:** Raw keyword classification without context produces semantic matches that are contextually wrong (the embroidery problem).

**Solution:** LightRAG retrieves tenant-specific entity context before classification.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     LIGHTRAG → GROK INTEGRATION                          │
│                                                                          │
│   ┌─────────────┐          ┌─────────────────┐         ┌─────────────┐  │
│   │   Keyword   │──query──►│    LightRAG     │──ctx───►│   Grok 4.1  │  │
│   │   Batch     │          │   hybrid mode   │         │  Classifier │  │
│   └─────────────┘          └─────────────────┘         └─────────────┘  │
│                                     │                                    │
│                                     │                                    │
│                    ┌────────────────┼────────────────┐                   │
│                    ▼                ▼                ▼                   │
│              ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│              │ Entities │    │  Themes  │    │ Vectors  │               │
│              │ (graph)  │    │ (high-   │    │ (dense)  │               │
│              │          │    │  level)  │    │          │               │
│              └──────────┘    └──────────┘    └──────────┘               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Configuration:**

```typescript
// LightRAG initialization per tenant
const rag = new LightRAG({
  working_dir: `./lightrag/${tenant_id}`,
  llm_model_func: gpt_4o_mini_complete,  // For indexing only
  embedding_func: jina_embed_v3,
  graph_storage: 'PGGraphStorage',        // AGE on Postgres
  vector_storage: 'PGVectorStorage',      // pgvector
  chunk_token_size: 1200,
  chunk_overlap_token_size: 100,
  enable_llm_cache: true,
  addon_params: {
    entity_types: [
      'product',
      'category', 
      'brand',
      'attribute',
      'material',
      'occasion',
      'audience'
    ]
  }
});

// Context retrieval (no LLM cost - retrieval only)
async function getClassificationContext(
  keywords: string[],
  tenantId: string
): Promise<string> {
  const rag = await getTenantRAG(tenantId);
  
  // Batch query for context
  const contexts = await Promise.all(
    keywords.slice(0, 10).map(kw =>  // Sample 10 for context
      rag.aquery(kw, {
        mode: 'hybrid',
        only_need_context: true,  // No LLM generation
        top_k: 20
      })
    )
  );
  
  return deduplicateContext(contexts);
}
```

### 2.2 How FalkorDB Stores Keyword Graphs

**Architecture:** One graph keyspace per tenant in Redis, eliminating multi-tenant leakage by construction.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      FALKORDB KEYWORD GRAPH                              │
│                                                                          │
│   Redis Keyspace: t_{tenant_id}                                          │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                        GRAPH SCHEMA                              │   │
│   │                                                                  │   │
│   │   (:Keyword)                                                     │   │
│   │   ├── text: string                                               │   │
│   │   ├── normalized: string (Lithuanian morphology)                 │   │
│   │   ├── embedding: vector(384)                                     │   │
│   │   ├── type: enum                                                 │   │
│   │   ├── confidence: float                                          │   │
│   │   ├── source: 'autocomplete' | 'suggestions' | 'ideas' | 'paa'   │   │
│   │   └── created_at: timestamp                                      │   │
│   │                                                                  │   │
│   │   (:Category)                                                    │   │
│   │   ├── slug: string                                               │   │
│   │   ├── name: string                                               │   │
│   │   └── centroid: vector(384)                                      │   │
│   │                                                                  │   │
│   │   (:NegativeAssociation)                                         │   │
│   │   ├── pattern: string                                            │   │
│   │   ├── reason: string                                             │   │
│   │   └── exclusion_count: int                                       │   │
│   │                                                                  │   │
│   │   RELATIONSHIPS:                                                 │   │
│   │   [:BELONGS_TO] - Keyword to Category                            │   │
│   │   [:SIMILAR_TO {score}] - Keyword to Keyword (cosine >= 0.85)    │   │
│   │   [:EXCLUDED_BY] - Keyword to NegativeAssociation                │   │
│   │   [:TARGETS] - Keyword to Audience segment                       │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// FalkorDB integration
import { FalkorDB } from 'falkordb';
import { BlockingConnectionPool } from 'redis';

const pool = new BlockingConnectionPool({
  host: '127.0.0.1',
  port: 6379,
  max_connections: 64
});
const db = new FalkorDB({ connection_pool: pool });

async function storeClassifiedKeywords(
  tenantId: string,
  keywords: ClassifiedKeyword[]
): Promise<void> {
  const graph = db.select_graph(`t_${tenantId}`);
  
  // Batch insert with UNWIND
  await graph.query(`
    UNWIND $keywords AS kw
    MERGE (k:Keyword {text: kw.text})
    SET k.normalized = kw.normalized,
        k.embedding = vecf32(kw.embedding),
        k.type = kw.type,
        k.confidence = kw.confidence,
        k.source = kw.source,
        k.created_at = timestamp()
    WITH k, kw
    MATCH (c:Category {slug: kw.categorySlug})
    MERGE (k)-[:BELONGS_TO]->(c)
  `, { keywords });
}

// Similarity graph construction (post-classification)
async function buildSimilarityEdges(tenantId: string): Promise<void> {
  const graph = db.select_graph(`t_${tenantId}`);
  
  await graph.query(`
    CALL db.idx.vector.queryNodes('Keyword', 'embedding', 10, k.embedding)
      YIELD node AS similar, score
    WHERE score >= 0.85 AND k <> similar
    MERGE (k)-[:SIMILAR_TO {score: score}]->(similar)
  `);
}
```

### 2.3 How jina-embeddings-v3 Enables Semantic Search

**Why jina-v3:** Best Lithuanian quality per published benchmark (arXiv 2604.14907: Cohen's kappa 0.62, AUC-ROC 0.887).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    JINA-V3 EMBEDDING PIPELINE                            │
│                                                                          │
│   ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐  │
│   │   Keyword   │────►│  jina-v3 ONNX    │────►│   Matryoshka Slice  │  │
│   │   (text)    │     │  INT8 inference  │     │   1024 → 384 dim    │  │
│   └─────────────┘     └──────────────────┘     └─────────────────────┘  │
│                              │                           │               │
│                              │                           │               │
│                              ▼                           ▼               │
│                    ┌──────────────────┐       ┌──────────────────────┐  │
│                    │  Full 1024-dim   │       │  Truncated 384-dim   │  │
│                    │  (category       │       │  (storage in         │  │
│                    │   routing)       │       │   pgvector halfvec)  │  │
│                    └──────────────────┘       └──────────────────────┘  │
│                                                                          │
│   Throughput: ~15-25 docs/sec INT8 on 4 vCPU                            │
│   RAM: ~1.5 GB model + inference buffer                                  │
│   Cost: $0 (self-hosted or 10M token free tier via Jina API)            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Jina-v3 embedding service
import { SentenceTransformer } from 'sentence-transformers';

class JinaEmbeddingService {
  private model: SentenceTransformer;
  
  constructor() {
    // Load ONNX INT8 model
    this.model = new SentenceTransformer(
      'jinaai/jina-embeddings-v3',
      {
        device: 'cpu',
        model_kwargs: { onnx_file: 'model_int8.onnx' }
      }
    );
  }
  
  async embed(texts: string[]): Promise<number[][]> {
    // Full 1024-dim embeddings
    const fullEmbeddings = await this.model.encode(texts, {
      normalize_embeddings: true,
      convert_to_numpy: true
    });
    
    // Matryoshka slicing to 384-dim for storage
    return fullEmbeddings.map(e => e.slice(0, 384));
  }
  
  async embedForRouting(text: string): Promise<number[]> {
    // Keep full 1024-dim for category routing
    const [embedding] = await this.model.encode([text], {
      normalize_embeddings: true
    });
    return embedding;
  }
}
```

### 2.4 How pgvector Stores Vectors

**Architecture:** Single multi-tenant table with DiskANN index and halfvec for 50% storage reduction.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     PGVECTOR STORAGE SCHEMA                              │
│                                                                          │
│   CREATE EXTENSION IF NOT EXISTS vector;                                 │
│   CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;                    │
│                                                                          │
│   CREATE TABLE keyword_embeddings (                                      │
│       id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,       │
│       tenant_id   INT NOT NULL,                                          │
│       keyword_id  BIGINT REFERENCES keywords(id),                        │
│       keyword     TEXT NOT NULL,                                         │
│       normalized  TEXT NOT NULL,                                         │
│       embedding   halfvec(384) NOT NULL,  -- Matryoshka truncated        │
│       created_at  TIMESTAMPTZ DEFAULT NOW()                              │
│   );                                                                     │
│                                                                          │
│   -- Tenant filter index                                                 │
│   CREATE INDEX ON keyword_embeddings(tenant_id);                         │
│                                                                          │
│   -- DiskANN vector index with SBQ                                       │
│   CREATE INDEX ON keyword_embeddings                                     │
│       USING diskann (embedding halfvec_cosine_ops)                       │
│       WITH (storage_layout = 'memory_optimized');                        │
│                                                                          │
│   -- Storage estimate: 100K keywords × 384 × 2 bytes = ~77 MB            │
│   -- With DiskANN overhead: ~100-150 MB per 100K keywords                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Complete Step-by-Step Flow

```
INPUT: Seed keywords from ConversationExtractor
       Example: ["darbo striukės", "uniformos įmonėms", "drabužiai su logotipu"]

───────────────────────────────────────────────────────────────────────────
STEP 1: EXPAND VIA DATAFORSEO (existing integration)
───────────────────────────────────────────────────────────────────────────

   Seed: "darbo striukės"
         │
         ├──► autocomplete (5 cursor positions)
         │    └──► "darbo striukės moterims", "darbo striukės žiemai", 
         │         "darbo striukės su logotipu", ...
         │
         ├──► keyword_suggestions
         │    └──► "striukės darbui", "darbo apranga", "darbo drabužiai", ...
         │
         ├──► keyword_ideas (semantically related)
         │    └──► "įmonių apranga", "uniformos", "drabužiai personalui", ...
         │
         └──► related_keywords (clusters)
              └──► "apsauginė apranga", "šiltos striukės", ...

   Output: ~150-300 raw keywords
   Cost: 5 seeds × 4 endpoints × $0.0008 = ~$0.016

───────────────────────────────────────────────────────────────────────────
STEP 2: EMBED WITH JINA-V3
───────────────────────────────────────────────────────────────────────────

   Raw Keywords → jina-embeddings-v3 (INT8 ONNX)
         │
         └──► 384-dim halfvec embeddings
              • Self-hosted: ~$0 (CPU inference)
              • API fallback: ~$0.006 for 300 keywords

   Output: Embedded keywords ready for routing and storage

───────────────────────────────────────────────────────────────────────────
STEP 3: ROUTE TO CATEGORIES (hierarchical retrieval)
───────────────────────────────────────────────────────────────────────────

   Purpose: Reduce cross-category false positives

   Tenant's Category Graph (FalkorDB):
   ├── Darbo drabužiai (work clothing)
   │   └── centroid: [0.23, -0.15, ...]
   ├── Apsauginė apranga (protective wear)
   │   └── centroid: [0.31, -0.08, ...]
   └── Akcesories (accessories)
       └── centroid: [-0.12, 0.45, ...]

   For keyword "darbo striukės žiemai":
   ├── Route to: "Darbo drabužiai" (cosine 0.89)
   ├── Secondary: "Apsauginė apranga" (cosine 0.72)
   └── Skip: "Akcesorai" (cosine 0.23)

   Output: Category-scoped keyword batches

───────────────────────────────────────────────────────────────────────────
STEP 4: RETRIEVE GRAPHRAG CONTEXT (LightRAG)
───────────────────────────────────────────────────────────────────────────

   For batch ["darbo striukės", "uniformos įmonėms"]:
         │
         └──► LightRAG hybrid query
              │
              ├── Entities retrieved:
              │   • Product: "Darbo striukė PREMIUM"
              │   • Brand: "Signet"
              │   • Attribute: "šilta", "vandeniui atspari"
              │   • Material: "poliesteris", "nailonas"
              │   • Audience: "B2B", "gamyklos"
              │
              └── Themes retrieved:
                  • "Darbo saugos reikalavimai"
                  • "Įmonių prekės ženklinimas"

   Output: Contextual knowledge for classification
   Cost: ~$0 (retrieval only, no LLM generation)

───────────────────────────────────────────────────────────────────────────
STEP 5: CLASSIFY WITH GROK 4.1
───────────────────────────────────────────────────────────────────────────

   Input to Grok:
   ├── Keywords batch (50-100)
   ├── Business context:
   │   {
   │     "name": "StriukėsTau",
   │     "industry": "darbo drabužiai",
   │     "services": ["darbo striukės", "uniformos", "logotipų siuvimas"],
   │     "businessModel": { "b2b": true, "ecommerce": true },
   │     "negativeAssociations": {
   │       "notServices": ["siuvinėjimo paslaugos", "logotipų dizainas"],
   │       "competitors": ["siuvinėjimo studija"],
   │       "adjacentVerticals": ["siuvinėjimas", "marškinėlių spauda"],
   │       "wrongIntent": ["nemokamai", "DIY", "kaip siuvinėti"]
   │     }
   │   }
   └── GraphRAG context (from Step 4)

   Grok 4.1 classification output:
   [
     {
       "keyword": "darbo striukės su logotipu",
       "include": true,
       "confidence": 0.95,
       "type": "product",
       "reasoning": "Direct product match with purchase intent"
     },
     {
       "keyword": "siuvinėjimo paslaugos Vilniuje",
       "include": false,
       "confidence": 0.92,
       "type": null,
       "reasoning": "Matches negativeAssociations.adjacentVerticals - 
                     they BUY embroidery, not SELL embroidery services"
     },
     {
       "keyword": "kaip užsakyti darbo striukes įmonei",
       "include": true,
       "confidence": 0.88,
       "type": "question",
       "reasoning": "B2B purchase intent question"
     }
   ]

   Output: Classified keywords with reasoning
   Cost: 200 kw × ~20 tokens/kw × ($0.20 + $0.50)/1M = ~$0.003

───────────────────────────────────────────────────────────────────────────
STEP 6: STORE IN FALKORDB GRAPH
───────────────────────────────────────────────────────────────────────────

   For each included keyword:
   
   Cypher operations:
   1. CREATE (:Keyword {text, normalized, embedding, type, confidence})
   2. MATCH category by embedding similarity
   3. CREATE [:BELONGS_TO] relationship
   4. CREATE [:SIMILAR_TO] edges for cosine >= 0.85
   
   For excluded keywords:
   1. Store in exclusion log (for learning)
   2. Link to NegativeAssociation nodes
   3. Increment exclusion_count for pattern analysis

   Output: Persisted keyword graph
   Cost: ~$0 (in-memory Redis operation)

───────────────────────────────────────────────────────────────────────────
STEP 7: HUMAN REVIEW QUEUE (optional)
───────────────────────────────────────────────────────────────────────────

   Trigger conditions:
   ├── human_confirmation = 'always' → Show all 100-200 keywords
   ├── human_confirmation = 'low_confidence' → Show only if avg < 0.9
   └── human_confirmation = 'never' → Skip to output

   Review UI features:
   ├── Grouped by keyword type (product, long_tail, question, ...)
   ├── AI reasoning visible for each classification
   ├── Bulk approve/reject per group
   └── Individual override with reason capture

   Output: Human-approved final keyword set

───────────────────────────────────────────────────────────────────────────
OUTPUT: Classified Keywords
───────────────────────────────────────────────────────────────────────────

   ClassifiedKeyword[] (100-200 per prospect):
   [
     {
       "keyword": "darbo striukės su logotipu",
       "normalizedKeyword": "darbo striukė logotipas",
       "include": true,
       "type": "product",
       "confidence": 0.95,
       "embedding": [0.23, -0.15, ...],  // halfvec(384)
       "reasoning": "Direct product match",
       "graphNodeId": "t_123:kw_456"
     },
     ...
   ]
```

---

## 4. Cost Model

### 4.1 Per-Step Token/API Costs

| Step | Component | API/Model | Units | Unit Cost | Step Cost |
|------|-----------|-----------|-------|-----------|-----------|
| 1 | Autocomplete | DataForSEO | 5 seeds × 5 cursor | $0.002/req | $0.050 |
| 1 | Keyword Suggestions | DataForSEO | 5 seeds | $0.0008/req | $0.004 |
| 1 | Keyword Ideas | DataForSEO | 3 seeds | $0.0008/req | $0.002 |
| 1 | Related Keywords | DataForSEO | 2 seeds | $0.0008/req | $0.002 |
| 2 | Embeddings | jina-v3 API | 300 kw × 15 tok | $0.02/1M | $0.000 |
| 3 | Routing | CPU inference | - | $0 | $0.000 |
| 4 | GraphRAG | LightRAG | retrieval only | $0 | $0.000 |
| 5 | Classification | Grok 4.1 | 4K in + 3K out | $0.20/$0.50 | $0.002 |
| 6 | Graph Storage | FalkorDB | in-memory | $0 | $0.000 |
| 7 | Human Review | UI | optional | $0 | $0.000 |

**Note:** Step 1 (DataForSEO) costs are high. Optimization: Use autocomplete/task_post (queued) at $0.0006/req instead of live.

### 4.2 Total Per-Prospect Estimate

| Scenario | DataForSEO | Embeddings | Grok 4.1 | Total |
|----------|------------|------------|----------|-------|
| **Optimized (queued)** | $0.003 | $0.000 | $0.002 | **$0.005** |
| **Standard (live)** | $0.058 | $0.000 | $0.002 | **$0.060** |
| **Conservative** | $0.058 | $0.001 | $0.004 | **$0.063** |

**Recommendation:** Use queued DataForSEO endpoints to hit ~$0.01 target.

### 4.3 Cost Optimization Strategies

1. **Batch autocomplete requests** - Queue 24h jobs for 50% discount
2. **Cache common keywords** - Redis TTL 7 days for repeated seeds
3. **Deduplicate before classification** - Fuzzy match removes ~30%
4. **Category routing reduces scope** - Only classify category-relevant keywords
5. **Skip re-classification** - Check FalkorDB before calling Grok

---

## 5. File Structure

### 5.1 New Files to Create

```
open-seo-main/src/server/features/keywords/
├── classification/
│   ├── types.ts                      # Zod schemas for classification
│   ├── config.ts                     # Model configs, thresholds
│   ├── ClassificationPipeline.ts     # Main orchestrator
│   ├── GrokClassifier.ts             # Grok 4.1 integration
│   ├── prompts/
│   │   └── keyword-classifier.xml    # Classification prompt template
│   └── index.ts
│
├── embedding/
│   ├── JinaEmbeddingService.ts       # jina-v3 ONNX inference
│   ├── CategoryRouter.ts             # Hierarchical category routing
│   └── index.ts
│
├── graph/
│   ├── FalkorDBKeywordStore.ts       # Graph storage operations
│   ├── KeywordGraphBuilder.ts        # Similarity edge construction
│   └── index.ts
│
├── retrieval/
│   ├── LightRAGContextProvider.ts    # GraphRAG context retrieval
│   └── index.ts
│
├── universe/
│   ├── KeywordUniverseBuilder.ts     # DataForSEO orchestration
│   ├── AutocompleteExpander.ts       # Cursor-based expansion
│   └── index.ts
│
└── review/
    ├── HumanReviewQueue.ts           # Review queue management
    ├── types.ts                      # Review UI types
    └── index.ts

apps/web/src/
├── components/keywords/
│   ├── KeywordReviewPanel.tsx        # Human review UI
│   ├── KeywordTypeSelector.tsx       # Type filter UI
│   └── ClassificationProgress.tsx    # SSE progress display
│
└── app/api/keywords/
    ├── classify/route.ts             # POST /api/keywords/classify
    ├── review/route.ts               # GET/POST /api/keywords/review
    └── stream/route.ts               # SSE progress endpoint
```

### 5.2 Existing Files to Modify

| File | Modification |
|------|--------------|
| `dataforseo.ts` | Add `fetchAutocomplete()` wrapper with cursor support |
| `prospect-schema.ts` | Extend `ExtractedProspectData` with negativeAssociations, businessModel |
| `ConversationExtractor.ts` | Update prompt to extract negative associations |
| `prospect-wizard-store.ts` | Add `keyword_confirmation` setting |
| `KeywordIntelligenceService.ts` | Integrate new classification pipeline |

---

## 6. Implementation Sequence

### Phase 1: Foundation (Days 1-2)

| Order | Component | Depends On | Effort | Deliverable |
|-------|-----------|------------|--------|-------------|
| 1.1 | Classification types & schemas | None | 2h | `types.ts`, Zod schemas |
| 1.2 | Grok API client | 1.1 | 3h | `GrokClassifier.ts` |
| 1.3 | Classification prompt | 1.1 | 2h | `keyword-classifier.xml` |
| 1.4 | Unit tests for classifier | 1.2, 1.3 | 2h | Test suite |

**Milestone:** Grok classification working in isolation

### Phase 2: Embedding & Routing (Days 3-4)

| Order | Component | Depends On | Effort | Deliverable |
|-------|-----------|------------|--------|-------------|
| 2.1 | Jina embedding service | None | 3h | `JinaEmbeddingService.ts` |
| 2.2 | Category router | 2.1 | 3h | `CategoryRouter.ts` |
| 2.3 | pgvector schema migration | None | 1h | Migration file |
| 2.4 | Integration tests | 2.1-2.3 | 2h | Test suite |

**Milestone:** Hierarchical embedding routing working

### Phase 3: Graph Storage (Days 5-6)

| Order | Component | Depends On | Effort | Deliverable |
|-------|-----------|------------|--------|-------------|
| 3.1 | FalkorDB keyword store | None | 4h | `FalkorDBKeywordStore.ts` |
| 3.2 | Similarity graph builder | 3.1, 2.1 | 3h | `KeywordGraphBuilder.ts` |
| 3.3 | LightRAG context provider | 3.1 | 3h | `LightRAGContextProvider.ts` |
| 3.4 | Integration tests | 3.1-3.3 | 2h | Test suite |

**Milestone:** Per-tenant keyword graphs operational

### Phase 4: DataForSEO Expansion (Days 7-8)

| Order | Component | Depends On | Effort | Deliverable |
|-------|-----------|------------|--------|-------------|
| 4.1 | Autocomplete wrapper | None | 2h | Update `dataforseo.ts` |
| 4.2 | Keyword universe builder | 4.1 | 4h | `KeywordUniverseBuilder.ts` |
| 4.3 | Deduplication integration | 4.2 | 2h | Wire existing deduplicator |
| 4.4 | E2E tests | 4.1-4.3 | 2h | Test suite |

**Milestone:** Full keyword expansion working

### Phase 5: Pipeline Orchestration (Days 9-10)

| Order | Component | Depends On | Effort | Deliverable |
|-------|-----------|------------|--------|-------------|
| 5.1 | Pipeline orchestrator | 1-4 | 4h | `ClassificationPipeline.ts` |
| 5.2 | ConversationExtractor updates | None | 3h | Negative association extraction |
| 5.3 | API routes | 5.1 | 2h | REST endpoints |
| 5.4 | SSE progress streaming | 5.1 | 2h | Real-time progress |
| 5.5 | E2E pipeline tests | 5.1-5.4 | 3h | Full flow tests |

**Milestone:** Complete pipeline operational

### Phase 6: Human Review UI (Days 11-12)

| Order | Component | Depends On | Effort | Deliverable |
|-------|-----------|------------|--------|-------------|
| 6.1 | Review queue service | 5.1 | 3h | `HumanReviewQueue.ts` |
| 6.2 | Review panel component | 6.1 | 4h | `KeywordReviewPanel.tsx` |
| 6.3 | Wizard store updates | 6.1 | 2h | `keyword_confirmation` setting |
| 6.4 | UI tests | 6.2-6.3 | 2h | Component tests |

**Milestone:** Human-in-the-loop complete

### Total Implementation: ~60 hours (12 days)

---

## 7. Entity Types Reference

| Entity Type | Description | Example (Lithuanian) |
|-------------|-------------|---------------------|
| `product` | Physical product or service | "darbo striukė", "uniforma" |
| `category` | Product category/taxonomy | "darbo drabužiai", "apsauginė apranga" |
| `brand` | Brand or manufacturer | "Signet", "3M", "Pesso" |
| `attribute` | Product characteristic | "vandeniui atsparus", "atspindintis" |
| `material` | Material type | "poliesteris", "nailonas", "medvilnė" |
| `occasion` | Use case or context | "statybos darbai", "sandėlio darbas" |
| `audience` | Target customer segment | "statybininkai", "gamyklos darbuotojai" |

---

## 8. Keyword Type Categorization Rules

| Type | Heuristic | Example |
|------|-----------|---------|
| `product` | Default; matches product/service | "darbo striukės su logotipu" |
| `long_tail` | 4+ words, specific intent | "šiltos darbo striukės statybininkams žiemai" |
| `question` | Contains `?` or starts with kaip/kodėl/kas/kur | "kaip išsirinkti darbo striukes" |
| `local` | Contains location (Vilnius, Kaunas, etc.) | "darbo drabužiai Vilniuje" |
| `comparison` | Contains "vs", "ar", "palyginti" | "darbo striukės vs liemenės" |

---

## 9. Negative Association Filtering

### The Embroidery Problem

**Business:** B2B jacket company that BUYS embroidery services to add logos to jackets
**Wrong keyword:** "siuvinėjimo paslaugos" (embroidery services)
**Why wrong:** They are BUYERS not SELLERS of embroidery

### Negative Association Schema

```typescript
interface NegativeAssociations {
  // Things they explicitly DO NOT sell/provide
  notServices: string[];
  // Example: ["siuvinėjimo paslaugos", "logotipų dizainas"]
  
  // Known competitor business types
  competitors: string[];
  // Example: ["siuvinėjimo studija", "reklamos agentūra"]
  
  // Related but wrong verticals (semantic neighbors, wrong context)
  adjacentVerticals: string[];
  // Example: ["siuvinėjimas", "marškinėlių spauda", "reklaminiai gaminiai"]
  
  // Intent signals that indicate wrong audience
  wrongIntent: string[];
  // Example: ["nemokamai", "DIY", "kaip siuvinėti", "pamoka"]
}
```

### Extraction Prompt Update

```xml
<negative-associations-extraction>
  Based on the business description, extract:
  
  1. notServices: What does this business explicitly NOT do?
     - Services they consume but don't sell
     - Adjacent services customers might confuse them with
  
  2. competitors: Who competes with them?
     - Direct competitor business types
     - Services that overlap with theirs
  
  3. adjacentVerticals: What related verticals are NOT their business?
     - Industries that share vocabulary but different intent
     - Upstream/downstream services they don't provide
  
  4. wrongIntent: What intent signals indicate wrong audience?
     - DIY/tutorial intent for B2B businesses
     - Free/cheap signals for premium providers
     - Wrong geographic scope
</negative-associations-extraction>
```

---

## 10. Business Model Awareness

### Business Model Schema

```typescript
interface BusinessModel {
  b2b: boolean;      // Sells to businesses
  b2c: boolean;      // Sells to consumers
  ecommerce: boolean; // Online sales
  serviceProvider: boolean; // Provides services
  manufacturer: boolean;    // Makes products
  reseller: boolean;        // Resells others' products
}
```

### How Business Model Affects Classification

| Keyword | B2B Context | B2C Context |
|---------|-------------|-------------|
| "darbo striukės" | INCLUDE (product) | INCLUDE (product) |
| "darbo striukės kaina" | INCLUDE (commercial) | INCLUDE (commercial) |
| "kaip siūti striukes" | EXCLUDE (DIY intent) | INCLUDE (if DIY supplier) |
| "striukės didmeninė" | INCLUDE (B2B signal) | EXCLUDE (wrong model) |
| "pigios striukės" | Depends on positioning | INCLUDE (price-conscious) |

### Business Model in Classification Prompt

```xml
<business-model-context>
  This business is:
  {{#if businessModel.b2b}}B2B (sells to businesses){{/if}}
  {{#if businessModel.b2c}}B2C (sells to consumers){{/if}}
  {{#if businessModel.ecommerce}}E-commerce (online sales){{/if}}
  
  Classification rules:
  - If B2B only: EXCLUDE DIY/tutorial keywords
  - If B2B only: INCLUDE "didmeninė", "įmonėms", "verslo" keywords
  - If ecommerce: INCLUDE "pirkti", "kaina", "pristatymas" keywords
  - If manufacturer: INCLUDE "gamyba", "gamintojas" keywords
  - If reseller: EXCLUDE "gamyba", "gamintojas" keywords
</business-model-context>
```

---

## Appendix A: Grok 4.1 Classification Prompt

```xml
<?xml version="1.0" encoding="UTF-8"?>
<classification-prompt>
  <system>
    You are an expert keyword classifier for Lithuanian e-commerce and B2B businesses.
    Your task is to determine which keywords are relevant for the given business.
    
    CRITICAL: A keyword that is semantically similar but contextually WRONG must be EXCLUDED.
    Example: "embroidery services" is EXCLUDE for a company that BUYS embroidery, not SELLS it.
  </system>
  
  <business-context>
    <name>{{businessName}}</name>
    <industry>{{industry}}</industry>
    <services>{{services | join(", ")}}</services>
    <target-audience>{{targetAudience}}</target-audience>
    
    <business-model>
      {{#each businessModel}}
      <{{@key}}>{{this}}</{{@key}}>
      {{/each}}
    </business-model>
    
    <negative-associations>
      <not-services>{{negativeAssociations.notServices | join(", ")}}</not-services>
      <competitors>{{negativeAssociations.competitors | join(", ")}}</competitors>
      <adjacent-verticals>{{negativeAssociations.adjacentVerticals | join(", ")}}</adjacent-verticals>
      <wrong-intent>{{negativeAssociations.wrongIntent | join(", ")}}</wrong-intent>
    </negative-associations>
  </business-context>
  
  <graphrag-context>
    {{graphRAGContext}}
  </graphrag-context>
  
  <classification-rules>
    <relevance-threshold>0.85</relevance-threshold>
    
    <include-if>
      - Direct product/service match AND purchase/commercial intent
      - Audience matches business model (B2B keywords for B2B business)
      - No match with any negative association
    </include-if>
    
    <exclude-if>
      - Matches negativeAssociations (any category)
      - Wrong business model (DIY for B2B, wholesale for B2C-only)
      - Competitor keyword or competitor service
      - Wrong intent (informational for transactional business)
    </exclude-if>
  </classification-rules>
  
  <keyword-types>
    <type name="product">Direct product or service - default type</type>
    <type name="long_tail">4+ words with specific intent</type>
    <type name="question">Contains ? or starts with kaip/kodėl/kas/kur</type>
    <type name="local">Contains location (Vilnius, Kaunas, etc.)</type>
    <type name="comparison">Contains vs, ar, palyginti</type>
  </keyword-types>
  
  <keywords-to-classify>
    {{#each keywords}}
    <keyword id="{{@index}}">{{this}}</keyword>
    {{/each}}
  </keywords-to-classify>
  
  <output-format>
    Return JSON array:
    [
      {
        "keyword": "exact keyword text",
        "include": true/false,
        "confidence": 0.0-1.0,
        "type": "product|long_tail|question|local|comparison" (only if include=true),
        "reasoning": "Brief explanation"
      }
    ]
    
    IMPORTANT:
    - include=true ONLY if confidence >= 0.85
    - type is REQUIRED for include=true, null for include=false
    - reasoning must explain the decision in 10-20 words
  </output-format>
</classification-prompt>
```

---

## Appendix B: FalkorDB Schema DDL

```cypher
// Initialize tenant graph schema
// Run once per tenant: t_{tenant_id}

// Create indexes
CREATE INDEX FOR (k:Keyword) ON (k.text)
CREATE INDEX FOR (k:Keyword) ON (k.normalized)
CREATE INDEX FOR (c:Category) ON (c.slug)
CREATE INDEX FOR (n:NegativeAssociation) ON (n.pattern)

// Create vector indexes
CREATE VECTOR INDEX FOR (k:Keyword) ON (k.embedding)
  OPTIONS {dimension:384, similarityFunction:'cosine', M:16, efConstruction:200}

CREATE VECTOR INDEX FOR (c:Category) ON (c.centroid)
  OPTIONS {dimension:384, similarityFunction:'cosine', M:8, efConstruction:100}

// Keyword type enum constraint
CREATE CONSTRAINT FOR (t:KeywordType) REQUIRE t.name IN 
  ['product', 'long_tail', 'question', 'local', 'comparison']

// Audience segment constraint
CREATE CONSTRAINT FOR (a:Audience) REQUIRE a.name IN 
  ['b2b', 'b2c', 'local', 'ecommerce']
```

---

## Appendix C: Cost Comparison Summary

| Approach | Per Prospect | 200 Prospects/mo | Notes |
|----------|--------------|------------------|-------|
| **This Design (Grok 4.1)** | ~$0.01 | ~$2.00 | Queued DataForSEO, self-hosted jina |
| Previous Design (Claude Sonnet) | ~$0.04 | ~$8.00 | Single-pass classification |
| GPT-4.1-nano Cascade | ~$0.01 | ~$2.30 | Alternative to Grok |
| Full Claude Opus | ~$0.20 | ~$40.00 | Overkill for classification |

**Recommended:** Grok 4.1 with queued DataForSEO achieves the ~$0.01 target.

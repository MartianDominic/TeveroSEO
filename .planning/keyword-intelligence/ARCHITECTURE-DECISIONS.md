# Architecture Decision Records (ADR)

> **Location:** `.planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md`  
> **Created:** 2026-04-26  
> **Status:** Approved  
> **Related:** [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md), [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md)

This document records key architectural decisions for the Keyword Intelligence System, following the ADR format (Context/Decision/Consequences).

---

## ADR-001: Graph Storage Strategy

### Status
Approved

### Context
The system requires two distinct graph workloads:
1. **Product Catalog Graph** - Per-tenant, real-time, keyword classification queries (1-3 hop traversals)
2. **LightRAG Entity Graph** - Per-tenant, entity extraction, knowledge graph for GraphRAG

Initial confusion arose because multiple docs referenced different technologies:
- `cpu-only-rag-graph.md` recommends FalkorDB (Redis module)
- `LIGHTRAG-INTEGRATION.md` references PGGraphStorage (PostgreSQL + AGE)
- `CRAWL-TO-GRAPH-PIPELINE.md` shows FalkorDB Cypher schema

See [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md) Issue #5.

### Decision
**Use FalkorDB for product catalog graphs, NetworkX for LightRAG entity graphs.**

| Component | Technology | Isolation | Use Case |
|-----------|------------|-----------|----------|
| Product Catalog Graph | FalkorDB 4.14 | Graph-per-tenant via Redis keyspace (`kg:{tenant_id}`) | Keyword classification, product/category traversals |
| LightRAG Entity Graph | NetworkX + NanoVectorDB | Per-tenant working directory | Entity extraction, GraphRAG queries |
| Vector Storage | PostgreSQL 17 + pgvector 0.8 + DiskANN | Single table with `tenant_id` filter | 100M vectors, multi-tenant search |

### Rationale
- **FalkorDB**: GraphBLAS sparse-matrix execution delivers sub-10ms traversals for 10k-node graphs. Redis-native ops (keyspace isolation, `GRAPH.MEMORY USAGE`). Vendor benchmarks: p50 ~36ms on Pokec vs Neo4j's 469ms.
- **NetworkX for LightRAG**: Sufficient for <50k entities per tenant. Simpler than PostgreSQL + AGE. LightRAG's default backend, proven stable.
- **Not AGE**: While Apache AGE 1.5 added RLS, 1-3 hop traversals run 20-200ms (3-5x slower than FalkorDB). Reserve for analytical workloads only.

### Consequences
**Positive:**
- Zero tenant leakage by construction (graph-per-tenant)
- Sub-10ms traversals for keyword classification
- No new infrastructure (FalkorDB runs as Redis module)

**Negative:**
- Two graph systems to maintain
- FalkorDB's SSPLv1 license requires care for DB-as-a-service resale
- Memory budget: 6-15 MB per tenant = 8-15 GB for 1000 tenants

### Configuration
```python
# services/storage.py
class StorageConfig:
    # FalkorDB for product catalog graphs
    FALKORDB_HOST = "localhost"
    FALKORDB_PORT = 6379
    FALKORDB_GRAPH_PREFIX = "kg"  # kg:{tenant_id}
    
    # LightRAG uses local storage per tenant
    LIGHTRAG_BASE_DIR = "./data/lightrag"
    LIGHTRAG_STORAGE = "NetworkXStorage"  # NOT PGGraphStorage
```

---

## ADR-002: Embedding Model Selection

### Status
Approved

### Context
Multiple documents specified different embedding dimensions and models:

| Document | Dimension | Model |
|----------|-----------|-------|
| CRAWL-TO-GRAPH schema | 384 | unspecified |
| HIERARCHICAL-EMBEDDING | 768 (truncated to 384) | multilingual-e5-base |
| LIGHTRAG-INTEGRATION | 1536 | OpenAI text-embedding-3-small |
| RAG infra doc | 768 or 1024 | e5-base or jina-v3 |

This caused schema incompatibility and wasted storage. See [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md) Issue #2.

Additionally, Lithuanian language quality varies significantly across embedding models. Standard MMTEB averages are misleading for Baltic languages.

### Decision
**Use jina-embeddings-v3 with Matryoshka truncation to 384-dim for storage.**

| Setting | Value | Rationale |
|---------|-------|-----------|
| Model | `jinaai/jina-embeddings-v3` | Best Lithuanian quality (Cohen's kappa 0.62, AUC-ROC 0.887 on LtHate benchmark) |
| Native dimension | 1024 | jina-v3 native output |
| Storage dimension | 384 | Matryoshka truncation for storage efficiency |
| Query dimension | 768 (optional) | Full precision for queries if needed |
| Quantization | INT8 ONNX | CPU-optimized inference |
| Fallback | `intfloat/multilingual-e5-base` | Proven fallback, slightly lower Lithuanian quality |

### Rationale
- **Lithuanian quality matters**: The only published controlled Lithuanian benchmark (arXiv 2604.14907, LtHate) found jina-embeddings-v3 best. EmbeddingGemma underperforms despite high MMTEB averages.
- **Matryoshka truncation**: jina-v3 supports native dimension slicing - no PCA fitting required. Slice `[:384]` directly.
- **Single source of truth**: All components (LightRAG, FalkorDB vector index, pgvector) use the same model and dimension.

### Consequences
**Positive:**
- Best-in-class Lithuanian language quality
- No dimension mismatches across system
- Storage-efficient (384-dim vs 1024/1536)
- Native Matryoshka support eliminates PCA overhead

**Negative:**
- Larger model (572M params) than e5-base (278M)
- ~15-25 docs/sec INT8 vs ~80 docs/sec for e5-base
- CC-BY-NC-4.0 license for weights (commercial use via API is fine)

### Configuration
```python
EMBEDDING_CONFIG = {
    "model": "jinaai/jina-embeddings-v3",
    "model_fallback": "intfloat/multilingual-e5-base",
    "native_dim": 1024,
    "storage_dim": 384,
    "query_prefix": "query: ",
    "passage_prefix": "passage: ",
    "device": "cpu",
    "quantization": "int8",
}
```

---

## ADR-003: Task Routing Strategy

### Status
Approved

### Context
The system initially assumed all keyword data required crawling. The infrastructure research doc (`cpu-only-rag-graph.md`) explicitly states:
> "60-70% of workload should never touch your crawler at all"

Crawling competitors costs $0.30-0.75 per site. DataForSEO Labs API costs $0.01-0.05 for equivalent data - a 6-15x savings.

See [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md) Issue #6.

### Decision
**Route 60-70% of tasks to DataForSEO APIs. Crawl only client sites.**

| Task Type | Data Source | Cost | Volume % |
|-----------|-------------|------|----------|
| Client site audit | Crawl | $0.024/500 products | 5-10% |
| Competitor keywords | DataForSEO Labs API | $0.01-0.05 | 35-45% |
| SERP analysis | DataForSEO SERP API | $0.006 | 15-20% |
| Backlink audit | DataForSEO Backlinks API | $0.02-0.05 | 10-15% |
| Cached queries | Redis cache | $0 | 20-30% |

### Rationale
- **Client sites require crawl**: Only way to get their actual product catalog, categories, and content.
- **Competitor data from APIs**: DataForSEO maintains crawl infrastructure, caches data globally, charges per-query. 10x cheaper than self-crawl.
- **SERP data is standardized**: No need to parse Google ourselves - API provides structured data.
- **Cache flywheel**: Cross-tenant caching means subsequent clients pay near-zero for common queries.

### Consequences
**Positive:**
- 10x cost reduction on competitor/SERP tasks
- Simpler infrastructure (less crawl volume)
- Faster time-to-insight (API response vs crawl queue)
- DataForSEO handles anti-bot, rate limits, parsing

**Negative:**
- External API dependency for competitor data
- DataForSEO rate limits apply
- API data may be 24-72h stale (acceptable for SEO analysis)

### Configuration
```python
class TaskRouter:
    ROUTING_TABLE = {
        "client_audit": DataSource.CRAWL,           # Must crawl
        "competitor_gap": DataSource.DATAFORSEO_LABS,
        "keyword_research": DataSource.DATAFORSEO_LABS,
        "serp_analysis": DataSource.DATAFORSEO_SERP,
        "backlink_audit": DataSource.DATAFORSEO_BACKLINKS,
    }
```

### Cost Impact
| Task Type | Before (Crawl) | After (API) | Savings |
|-----------|----------------|-------------|---------|
| Competitor gap | $0.50 | $0.05 | 10x |
| Keyword research | $0.30 | $0.03 | 10x |
| SERP analysis | $0.20 | $0.006 | 33x |
| **Blended 5000 tasks/day** | $1,500/day | $150/day | **10x** |

---

## Decision Summary

| ADR | Decision | Primary Technology | Alternative |
|-----|----------|-------------------|-------------|
| ADR-001 | Graph Storage | FalkorDB + NetworkX | PostgreSQL + AGE |
| ADR-002 | Embeddings | jina-embeddings-v3 @ 384-dim | multilingual-e5-base |
| ADR-003 | Task Routing | 60-70% to DataForSEO APIs | Self-crawl everything |

---

## References

- [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md) - Original gap analysis
- [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md) - Concrete code solutions
- [cpu-only-rag-graph.md](../../docs/infra-research/cpu-only-rag-graph.md) - Infrastructure research
- [COST-MODEL.md](COST-MODEL.md) - Detailed cost breakdown

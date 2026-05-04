---
phase: 73
name: Infrastructure Optimization
milestone: v8.0 SaaS Hardening
status: planning
created: 2026-05-04
estimated_duration: 2 weeks
depends_on: [64, 65]
---

# Phase 73: Infrastructure Optimization

## Origin

This phase closes implementation gaps identified by 5-agent verification of:
- `docs/infra-research/crawling-10-5000-tasks-day.md`
- `docs/infra-research/cpu-only-rag-graph.md`

## Verification Summary (2026-05-04)

| Domain | Implementation | Gap Severity |
|--------|---------------|--------------|
| Crawling Infrastructure | 64% | HIGH (DRR missing) |
| Delta Crawling & Caching | 85% | LOW-MEDIUM |
| Graph Database (FalkorDB) | 100% | NONE |
| RAG Pipeline (LightRAG) | 90% | MEDIUM |
| Vector Storage (pgvector+DiskANN) | 95% | LOW-MEDIUM |

## What's Already Implemented

### Fully Implemented (No Action Needed)

1. **FalkorDB graph-per-tenant** - `kg:{tenantId}` keyspace, NODE_CREATION_BUFFER 1024, HNSW indexes
2. **LightRAG 1.4.10** - PGGraphStorage, hybrid mode, GPT-4o-mini extraction
3. **pgvector + pgvectorscale** - DiskANN indexes, halfvec(768/384)
4. **jina-embeddings-v3** - Query/passage prefixes, Matryoshka truncation
5. **Redis singleflight** - SET NX EX atomic, pub/sub completion
6. **DataForSEO integration** - Full API client, Lithuanian locale, metering
7. **Delta cascade L0-L1** - Sitemap lastmod, conditional GET with ETag

### Gaps to Close

| Priority | Gap | Impact | Plan |
|----------|-----|--------|------|
| HIGH | DRR Fair Queuing | Multi-tenant fairness | 73-01 |
| MEDIUM | L2 Template-aware Hash | +15% delta savings | 73-02 |
| MEDIUM | BGE Reranker | +3-8 recall@10 | 73-03 |
| MEDIUM | Hierarchical Retrieval | Better category search | 73-03 |
| MEDIUM | RAG-Classification Integration | Context-aware classification | 73-04 |
| LOW | Proxy Tier Abstraction | DEFERRED - DataForSEO OnPage covers this |
| LOW | ONNX INT8 Inference | DEFERRED - API approach is valid |

## Why Proxy Tier is Deferred

Per research analysis:
- DataForSEO handles 60-70% of workload via APIs (no crawling needed)
- DataForSEO OnPage with `enable_browser_rendering` handles protected sites
- Lithuanian SMB e-commerce doesn't block datacenter IPs
- BrightData available for edge cases if needed
- Current scale (<500 tasks/day) doesn't justify proxy infrastructure

**Trigger to revisit**: Regular failures on UK/DE/PL targets OR volume >5M pages/year

## Plans

| Plan | Name | Focus |
|------|------|-------|
| 73-01 | DRR Fair Queuing | Queue fairness for multi-tenant workloads |
| 73-02 | Template-aware Delta Hash | Selectolax-based DYNAMIC_BLOCKS pattern |
| 73-03 | Retrieval Quality | BGE reranker + hierarchical category routing |
| 73-04 | RAG-Classification Integration | Wire LightRAG context to ClassificationPipeline |

## Success Criteria

1. No single client can consume >30% of queue throughput
2. Delta crawl savings reach 65-80% (up from 50-70%)
3. Retrieval recall@10 improves by +3-8 points
4. Classification uses RAG context for taxonomy selection

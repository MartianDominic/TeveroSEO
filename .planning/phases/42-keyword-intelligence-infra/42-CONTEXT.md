# Phase 42: Keyword Intelligence Infrastructure

> **Status:** Planning  
> **Estimated Hours:** 20  
> **Dependencies:** None (foundational)  
> **Milestone:** v5.1

## Goal

Build the foundational infrastructure for intelligent keyword-to-page matching:
- Knowledge graph for product catalogs (FalkorDB)
- GraphRAG for entity extraction (LightRAG)
- Hierarchical embeddings for semantic matching (jina-v3)
- High-performance crawler with delta sync

## Business Context

This infrastructure enables:
1. **95%+ matching accuracy** (vs 85% with rule-based only)
2. **$0.01/prospect** at scale (vs $0.07 without cache flywheel)
3. **Sub-10ms traversals** for real-time keyword classification
4. **Multi-tenant isolation** with shared cache benefits

## Technical Decisions (from ADRs)

| Decision | Choice | Reference |
|----------|--------|-----------|
| Graph Storage | FalkorDB (product catalog) + NetworkX (LightRAG) | ADR-001 |
| Embeddings | jina-embeddings-v3 @ 384-dim (Matryoshka) | ADR-002 |
| Task Routing | 60-70% to DataForSEO APIs, crawl only client sites | ADR-003 |

## Sub-Plans

| Plan | Focus | Hours | Output |
|------|-------|-------|--------|
| 42-01 | FalkorDB + Graph Schema | 4h | Product catalog graph per tenant |
| 42-02 | LightRAG + Entity Extraction | 6h | GraphRAG pipeline |
| 42-03 | Hierarchical Embeddings + DiskANN | 5h | Vector search infrastructure |
| 42-04 | Crawler + Delta Sync | 5h | Crawlee + aiohttp hybrid |

## Success Criteria

- [ ] FalkorDB graph queries return in <10ms for 10k-node graphs
- [ ] LightRAG extracts entities from 500-page site in <5 minutes
- [ ] Embedding similarity search returns in <50ms for 100k vectors
- [ ] Crawler processes 500 products in <2 minutes
- [ ] Delta sync skips 80%+ unchanged pages
- [ ] Multi-tenant isolation verified (no cross-tenant data leakage)

## Source Documents

| Document | Purpose |
|----------|---------|
| `.planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md` | ADR-001, ADR-002, ADR-003 |
| `.planning/keyword-intelligence/IMPLEMENTATION-FIXES.md` | Solutions for 10 identified gaps |
| `.planning/keyword-intelligence/COST-MODEL.md` | Cache flywheel economics |
| `docs/infra-research/cpu-only-rag-graph.md` | RAG+Graph infrastructure |
| `docs/infra-research/crawling-10-5000-tasks-day.md` | Crawler architecture |

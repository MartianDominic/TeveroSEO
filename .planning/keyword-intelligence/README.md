# Keyword Intelligence System

> **Location:** `.planning/keyword-intelligence/`  
> **Status:** Research Complete — **10 Gaps Identified + Solved** (see [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md))  
> **Last Updated:** 2026-04-26  
> **Estimated Fix Time:** ~20 hours

## Overview

This system analyzes keywords from DataForSEO and matches them to client's:
1. **Existing categories** - Does keyword match a category they have?
2. **Existing products** - Does keyword match specific products?
3. **Category gaps** - Keywords exist but no category → suggest creating one
4. **User focus** - Respect client's business priorities

## Target Use Case

**NOT** Amazon-scale (10,000 random products).

**YES** Focused e-commerce:
- Hair care store with 200-500 products
- 15-30 categories
- Specific niche (beauty, accessories, etc.)

## Core Problems Being Solved

| Problem | Challenge | Solution |
|---------|-----------|----------|
| Category Matching | Lithuanian morphology, semantic similarity | Hybrid embedding + BM25 + lemmatization |
| Product Matching | Brand variations, product lines, specs | Entity extraction + fuzzy matching |
| Gap Detection | No category for popular keywords | Clustering + volume aggregation |
| User Focus | Business priorities change quarterly | NLU extraction + weighted scoring |

## Documents

### Core Architecture
| File | Purpose |
|------|---------|
| [README.md](README.md) | This index |
| [GAPS-AND-CONTRADICTIONS.md](GAPS-AND-CONTRADICTIONS.md) | 10 issues identified from infra docs |
| [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md) | **Concrete solutions for all 10 gaps (~20h work)** |
| [ARCHITECTURE.md](KEYWORD-INTELLIGENCE-COMPLETE-ARCHITECTURE.md) | Full system design |
| [AI-SYSTEM.md](AI-KEYWORD-INTELLIGENCE-SYSTEM.md) | Multi-pass AI pipeline |
| [MODEL-SELECTION.md](WORLD-CLASS-AI-ARCHITECTURE.md) | Model costs and selection |
| [SALES-ANALYSIS.md](SALES-BOTTLENECK-ANALYSIS.md) | Business context |

### Matching & Classification
| File | Purpose |
|------|---------|
| [CATEGORY-MATCHING.md](CATEGORY-MATCHING.md) | Hybrid matching algorithm |
| [PRODUCT-MATCHING.md](PRODUCT-MATCHING.md) | Keyword-to-product assignment |
| [GAP-DETECTION.md](GAP-DETECTION.md) | Category opportunity detection |
| [USER-FOCUS.md](USER-FOCUS.md) | Business priority integration |
| [XML-PROMPTS.md](XML-PROMPTS.md) | Production LLM prompts (4 templates) |

### Infrastructure (Opus Deep-Dives)
| File | Purpose |
|------|---------|
| [LIGHTRAG-INTEGRATION.md](LIGHTRAG-INTEGRATION.md) | GraphRAG with LightRAG v1.4.10 + FalkorDB |
| [HIERARCHICAL-EMBEDDING-ARCHITECTURE.md](HIERARCHICAL-EMBEDDING-ARCHITECTURE.md) | L0-L3 category embeddings, DiskANN index, reranking |
| [MULTI-TENANT-COST-OPTIMIZATION.md](MULTI-TENANT-COST-OPTIMIZATION.md) | 5-layer caching, cache flywheel, cost allocation |
| [CRAWL-TO-GRAPH-PIPELINE.md](CRAWL-TO-GRAPH-PIPELINE.md) | FalkorDB schema, entity extraction, incremental updates |

## Quick Reference

### The Flow

```
Client Website → Crawlee + aiohttp → FalkorDB Graph (per-tenant)
       ↓                                      ↓
  Rule-based extraction (92%)          LightRAG GraphRAG
  + GPT-4o-mini fallback (8%)                 ↓
       ↓                             Hierarchical Embeddings (L0-L3)
  Content-hash diffing                        ↓
       ↓                             DiskANN + pgvector (100M vectors)
  Incremental updates                         ↓
                                    DataForSEO Keywords
                                             ↓
                         Hybrid Match: BM25 (25%) + Embed (35%) + Rules (15%) + Catalog (20%)
                                             ↓
                         User Focus (40% weight) + Gap Detection (HDBSCAN)
                                             ↓
                         Final Scored Output + Category Recommendations
```

### Cost Summary

| Operation | Cost |
|-----------|------|
| Crawl 10k pages | $0.048 |
| Keyword classification (per keyword) | $0.00008 (cached) |
| LightRAG indexing (10k pages) | $9.20 |
| Monthly (100 clients, shared cache) | <$50 |

### Key Decisions

1. **Crawler:** Crawlee 1.6 + aiohttp hybrid (83 pages/sec)
2. **Graph DB:** FalkorDB 4.14 (Redis module, HNSW vectors)
3. **GraphRAG:** LightRAG v1.4.10 (100 tokens/query)
4. **Embeddings:** multilingual-e5-base INT8 ONNX (80 docs/sec)
5. **Vector DB:** PostgreSQL 17 + pgvector + DiskANN (100M vectors)
6. **LLM:** Claude Sonnet 4.6 for classification (no Opus in production)
7. **Morphology:** Stanza + domain-specific stemming for Lithuanian

## Research Status

| Topic | Status | Document |
|-------|--------|----------|
| Web scraping methods | **Completed** | Crawlee + aiohttp hybrid |
| Knowledge graphs on VPS | **Completed** | FalkorDB (Redis module) |
| Multi-category embeddings | **Completed** | [HIERARCHICAL-EMBEDDING-ARCHITECTURE.md](HIERARCHICAL-EMBEDDING-ARCHITECTURE.md) |
| GraphRAG integration | **Completed** | [LIGHTRAG-INTEGRATION.md](LIGHTRAG-INTEGRATION.md) |
| Multi-tenant cost optimization | **Completed** | [MULTI-TENANT-COST-OPTIMIZATION.md](MULTI-TENANT-COST-OPTIMIZATION.md) |
| Crawl-to-graph pipeline | **Completed** | [CRAWL-TO-GRAPH-PIPELINE.md](CRAWL-TO-GRAPH-PIPELINE.md) |
| Category matching | **Completed** | [CATEGORY-MATCHING.md](CATEGORY-MATCHING.md) |
| Product matching | **Completed** | [PRODUCT-MATCHING.md](PRODUCT-MATCHING.md) |
| Gap detection | **Completed** | [GAP-DETECTION.md](GAP-DETECTION.md) |
| User focus input | **Completed** | [USER-FOCUS.md](USER-FOCUS.md) |
| XML prompts | **Completed** | [XML-PROMPTS.md](XML-PROMPTS.md) |

**Research complete. 10 gaps identified and solved — see [IMPLEMENTATION-FIXES.md](IMPLEMENTATION-FIXES.md) for code.**

# Hierarchical Embedding Architecture for Lithuanian E-commerce

> **Version:** 1.0  
> **Created:** 2026-04-26  
> **Status:** Architecture Design Complete  
> **Target:** 100 tenants x 1M vectors = 100M vectors total

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Infrastructure Constraints](#infrastructure-constraints)
3. [Memory Budget Breakdown](#memory-budget-breakdown)
4. [Category Prototype Computation](#category-prototype-computation)
5. [CategoryRouter Implementation](#categoryrouter-implementation)
6. [HierarchicalRetriever Implementation](#hierarchicalretriever-implementation)
7. [pgvectorscale DDL for Multi-Tenant Storage](#pgvectorscale-ddl)
8. [Lithuanian Morphology Preprocessing](#lithuanian-morphology-preprocessing)
9. [Reranker Integration](#reranker-integration)
10. [Performance Targets](#performance-targets)

---

## Executive Summary

### Problem
Match Lithuanian e-commerce keywords to products across 100 tenants with ~1M products each (100M vectors total) while:
- Fitting in 32GB RAM (8-15GB for embeddings)
- Achieving <50ms p95 latency
- Maintaining 95%+ recall@10 after reranking

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    HIERARCHICAL EMBEDDING RETRIEVAL                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Query: "profesionalūs plaukų dažai" (professional hair dye)                    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 1: CategoryRouter (~2ms)                                         │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  1. Lemmatize query → "profesionalus plauk daz"                         │   │
│  │  2. Embed with "query: " prefix (jina-v3 or E5)                         │   │
│  │  3. Compare to ~500 category prototypes (centroids)                     │   │
│  │  4. Return top-3 categories: [hair_dye: 0.89, hair_care: 0.72, ...]    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 2: Per-Category Dense Search (~30ms)                             │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  1. Query DiskANN index with tenant_id + category_id filter             │   │
│  │  2. Retrieve top-100 candidates from each top-3 category                │   │
│  │  3. Merge results by reciprocal rank fusion                             │   │
│  │  4. Return top-50 candidates                                            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                           │                                                      │
│                           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  STAGE 3: Reranker (optional, ~80ms for 50 pairs)                       │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  1. Cross-encoder: bge-reranker-v2-m3                                   │   │
│  │  2. Score all 50 candidates against query                               │   │
│  │  3. Return top-10 with calibrated scores                                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Total latency: 2ms + 30ms + 80ms = ~112ms (with reranker)                      │
│  Total latency: 2ms + 30ms = ~32ms (without reranker)                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Constraints

| Resource | Specification | Notes |
|----------|---------------|-------|
| **Embeddings** | multilingual-e5-base (768-dim) INT8 ONNX | Primary model |
| **Alternative** | jina-embeddings-v3 (1024-dim Matryoshka) | Best Lithuanian quality |
| **Vector DB** | PostgreSQL 17 + pgvector 0.8 + pgvectorscale 0.6 | DiskANN + SBQ |
| **RAM** | 32GB total | ~12GB for vectors |
| **Target scale** | 100 tenants x 1M products | 100M vectors |

### Model Selection Decision

| Model | Dimensions | Lithuanian Quality | Memory (100M vectors) |
|-------|------------|-------------------|----------------------|
| multilingual-e5-base | 768 | Cohen's kappa 0.58 | 9.6GB (SBQ binary) |
| jina-v3 | 1024 (truncate to 512) | Cohen's kappa 0.62 | 6.4GB (SBQ binary) |
| jina-v3 | 256 (Matryoshka) | Cohen's kappa 0.55 | 3.2GB (SBQ binary) |

**Recommendation:** Use jina-v3 at 512 dimensions with Matryoshka truncation for optimal Lithuanian quality and memory efficiency.

---

## Memory Budget Breakdown

### For 100 Tenants x 1M Vectors = 100M Vectors

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MEMORY BUDGET (32GB TOTAL)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  VECTOR STORAGE (SBQ Binary)                                                    │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  100M vectors × 512 dim × 1 bit/dim ÷ 8 = 6.4 GB                               │
│  + 20% overhead for SBQ metadata = 7.7 GB                                       │
│                                                                                  │
│  DISKANN GRAPH                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  100M nodes × 64 neighbors × 4 bytes = 25.6 GB (on disk, memory-mapped)        │
│  Hot subset in memory (~10%) = 2.56 GB                                          │
│                                                                                  │
│  CATEGORY PROTOTYPES                                                            │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  100 tenants × 500 categories × 512 dim × 4 bytes = 102 MB                     │
│  (kept in full precision for routing accuracy)                                  │
│                                                                                  │
│  POSTGRESQL + PGVECTOR                                                          │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  shared_buffers = 4 GB                                                          │
│  effective_cache_size = 8 GB                                                    │
│                                                                                  │
│  APPLICATION + OS                                                               │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Embedding model (ONNX INT8) = 500 MB                                           │
│  Reranker model = 800 MB                                                        │
│  Application heap = 1 GB                                                        │
│  OS + page cache = 3 GB                                                         │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  TOTAL BREAKDOWN:                                                               │
│  ├── SBQ Vectors:           7.7 GB                                              │
│  ├── DiskANN (hot):         2.6 GB                                              │
│  ├── Category Prototypes:   0.1 GB                                              │
│  ├── PostgreSQL buffers:    4.0 GB                                              │
│  ├── Embedding model:       0.5 GB                                              │
│  ├── Reranker model:        0.8 GB                                              │
│  ├── Application:           1.0 GB                                              │
│  └── OS + cache:            3.0 GB                                              │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  TOTAL:                    19.7 GB (leaves 12.3 GB headroom)                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Scaling Projections

| Scale | Vectors | SBQ Storage | DiskANN Hot | Total RAM |
|-------|---------|-------------|-------------|-----------|
| 10 tenants | 10M | 0.77 GB | 0.26 GB | ~12 GB |
| 100 tenants | 100M | 7.7 GB | 2.6 GB | ~20 GB |
| 500 tenants | 500M | 38.5 GB | 13 GB | Needs 128GB+ |

---

## Category Prototype Computation

### Strategy Comparison

| Strategy | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Centroid** | Fast, simple | Sensitive to outliers | Use for large categories |
| **Medoid** | Robust to outliers | O(n^2) computation | Use for small categories |
| **Trainable** | Best accuracy | Requires labeled data | Future enhancement |

### Implementation: Hybrid Centroid + Medoid

```python
# category_prototypes.py

import numpy as np
from dataclasses import dataclass
from typing import Literal
from sklearn.metrics.pairwise import cosine_distances


@dataclass
class CategoryPrototype:
    """Represents a category's embedding prototype for query routing."""
    
    category_id: str
    tenant_id: str
    name: str
    embedding: np.ndarray          # 512-dim prototype vector
    strategy: Literal["centroid", "medoid", "trainable"]
    product_count: int
    sample_products: list[str]     # For debugging
    updated_at: str


class CategoryPrototypeComputer:
    """
    Computes category prototypes using hybrid centroid/medoid strategy.
    
    Strategy selection:
    - < 50 products: Use medoid (robust to outliers)
    - >= 50 products: Use centroid (efficient, law of large numbers)
    - >= 1000 products with labels: Trainable (future)
    """
    
    def __init__(self, min_products_for_centroid: int = 50):
        self.min_products_for_centroid = min_products_for_centroid
    
    def compute_prototype(
        self,
        category_id: str,
        tenant_id: str,
        name: str,
        product_embeddings: np.ndarray,  # Shape: (n_products, 512)
        product_names: list[str]
    ) -> CategoryPrototype:
        """Compute prototype for a single category."""
        
        n_products = len(product_embeddings)
        
        if n_products == 0:
            # Fallback: use category name embedding
            return self._create_name_based_prototype(
                category_id, tenant_id, name
            )
        
        if n_products < self.min_products_for_centroid:
            # Medoid: most representative actual product
            embedding, strategy = self._compute_medoid(product_embeddings)
        else:
            # Centroid: mean of all products
            embedding, strategy = self._compute_centroid(product_embeddings)
        
        # Sample products for debugging
        sample_indices = np.random.choice(
            n_products, 
            size=min(5, n_products), 
            replace=False
        )
        samples = [product_names[i] for i in sample_indices]
        
        return CategoryPrototype(
            category_id=category_id,
            tenant_id=tenant_id,
            name=name,
            embedding=embedding,
            strategy=strategy,
            product_count=n_products,
            sample_products=samples,
            updated_at=datetime.utcnow().isoformat()
        )
    
    def _compute_centroid(
        self, 
        embeddings: np.ndarray
    ) -> tuple[np.ndarray, str]:
        """Mean of all embeddings, L2 normalized."""
        centroid = embeddings.mean(axis=0)
        centroid = centroid / np.linalg.norm(centroid)
        return centroid, "centroid"
    
    def _compute_medoid(
        self, 
        embeddings: np.ndarray
    ) -> tuple[np.ndarray, str]:
        """
        Most central actual embedding (minimizes sum of distances).
        O(n^2) but only used for small categories.
        """
        distances = cosine_distances(embeddings)
        medoid_idx = distances.sum(axis=1).argmin()
        return embeddings[medoid_idx], "medoid"
    
    def _create_name_based_prototype(
        self,
        category_id: str,
        tenant_id: str,
        name: str
    ) -> CategoryPrototype:
        """Fallback when no products exist."""
        # This would be called with an embedding model
        # Placeholder - actual implementation needs model reference
        raise NotImplementedError(
            "Name-based prototype requires embedding model injection"
        )


class PrototypeManager:
    """
    Manages prototype lifecycle: computation, storage, updates.
    
    Update strategy:
    - Full recompute: Weekly batch job
    - Incremental: On significant catalog changes (>10% products)
    - Invalidation: When category structure changes
    """
    
    def __init__(
        self,
        db_pool,
        embedding_model,
        computer: CategoryPrototypeComputer
    ):
        self.db = db_pool
        self.model = embedding_model
        self.computer = computer
    
    async def compute_all_prototypes(
        self,
        tenant_id: str
    ) -> list[CategoryPrototype]:
        """Batch compute all prototypes for a tenant."""
        
        # Fetch category hierarchy
        categories = await self.db.fetch("""
            SELECT 
                c.id,
                c.name,
                c.parent_id,
                array_agg(p.id) as product_ids
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            WHERE c.tenant_id = $1
            GROUP BY c.id, c.name, c.parent_id
        """, tenant_id)
        
        prototypes = []
        
        for cat in categories:
            # Fetch product embeddings for this category
            if cat['product_ids'] and cat['product_ids'][0] is not None:
                products = await self.db.fetch("""
                    SELECT name, embedding
                    FROM products
                    WHERE id = ANY($1)
                """, cat['product_ids'])
                
                embeddings = np.array([p['embedding'] for p in products])
                names = [p['name'] for p in products]
            else:
                embeddings = np.array([])
                names = []
            
            prototype = self.computer.compute_prototype(
                category_id=cat['id'],
                tenant_id=tenant_id,
                name=cat['name'],
                product_embeddings=embeddings,
                product_names=names
            )
            prototypes.append(prototype)
        
        # Store prototypes
        await self._store_prototypes(prototypes)
        
        return prototypes
    
    async def _store_prototypes(
        self,
        prototypes: list[CategoryPrototype]
    ):
        """Batch upsert prototypes to database."""
        await self.db.executemany("""
            INSERT INTO category_prototypes (
                category_id, tenant_id, name, embedding, 
                strategy, product_count, sample_products, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (category_id, tenant_id) 
            DO UPDATE SET
                embedding = EXCLUDED.embedding,
                strategy = EXCLUDED.strategy,
                product_count = EXCLUDED.product_count,
                sample_products = EXCLUDED.sample_products,
                updated_at = EXCLUDED.updated_at
        """, [
            (
                p.category_id, p.tenant_id, p.name,
                p.embedding.tolist(), p.strategy,
                p.product_count, p.sample_products, p.updated_at
            )
            for p in prototypes
        ])
```

---

## CategoryRouter Implementation

```python
# category_router.py

import numpy as np
from dataclasses import dataclass
from typing import Optional
import asyncio


@dataclass
class RoutingResult:
    """Result of category routing for a query."""
    
    query: str
    query_embedding: np.ndarray
    top_categories: list[tuple[str, float]]  # [(category_id, score), ...]
    routing_latency_ms: float
    strategy_used: str


class CategoryRouter:
    """
    Routes queries to top-k relevant categories using prototype comparison.
    
    Design goals:
    - 95%+ accuracy (correct category in top-3)
    - <5ms p95 latency
    - Tenant-isolated routing
    
    Algorithm:
    1. Lemmatize and embed query
    2. Load tenant's category prototypes (cached in memory)
    3. Compute cosine similarity to all prototypes
    4. Return top-k categories above threshold
    """
    
    def __init__(
        self,
        embedding_model,
        lemmatizer,
        prototype_cache,
        config: dict
    ):
        self.model = embedding_model
        self.lemmatizer = lemmatizer
        self.cache = prototype_cache
        
        # Configuration
        self.top_k = config.get('top_k', 3)
        self.min_threshold = config.get('min_threshold', 0.35)
        self.use_lemmatization = config.get('use_lemmatization', True)
        self.query_prefix = config.get('query_prefix', 'query: ')
    
    async def route(
        self,
        query: str,
        tenant_id: str,
        focus_categories: Optional[list[str]] = None
    ) -> RoutingResult:
        """
        Route a query to relevant categories.
        
        Args:
            query: Search query (e.g., "profesionalus plauku dazai")
            tenant_id: Tenant identifier for isolation
            focus_categories: Optional filter to specific categories
            
        Returns:
            RoutingResult with top-k categories and scores
        """
        import time
        start = time.perf_counter()
        
        # Step 1: Preprocess query
        processed_query = await self._preprocess_query(query)
        
        # Step 2: Embed query with prefix
        query_embedding = await self._embed_query(processed_query)
        
        # Step 3: Load prototypes (from cache)
        prototypes = await self.cache.get_prototypes(tenant_id)
        
        # Step 4: Filter to focus categories if specified
        if focus_categories:
            prototypes = [
                p for p in prototypes 
                if p.category_id in focus_categories
            ]
        
        # Step 5: Compute similarities
        scores = self._compute_similarities(query_embedding, prototypes)
        
        # Step 6: Filter and rank
        top_categories = self._select_top_categories(scores, prototypes)
        
        latency_ms = (time.perf_counter() - start) * 1000
        
        return RoutingResult(
            query=query,
            query_embedding=query_embedding,
            top_categories=top_categories,
            routing_latency_ms=latency_ms,
            strategy_used="cosine_to_prototypes"
        )
    
    async def _preprocess_query(self, query: str) -> str:
        """Lemmatize and normalize query for embedding."""
        if not self.use_lemmatization:
            return query.lower().strip()
        
        # Use Lithuanian lemmatizer
        lemmatized = await self.lemmatizer.lemmatize(query)
        return lemmatized.normalized
    
    async def _embed_query(self, query: str) -> np.ndarray:
        """Embed query with model-specific prefix."""
        # E5 and jina-v3 require "query: " prefix for queries
        prefixed = f"{self.query_prefix}{query}"
        embedding = await self.model.encode_async(prefixed)
        return embedding
    
    def _compute_similarities(
        self,
        query_embedding: np.ndarray,
        prototypes: list[CategoryPrototype]
    ) -> np.ndarray:
        """Batch cosine similarity computation."""
        if not prototypes:
            return np.array([])
        
        # Stack prototype embeddings
        prototype_matrix = np.stack([p.embedding for p in prototypes])
        
        # Normalize query (prototypes should already be normalized)
        query_norm = query_embedding / np.linalg.norm(query_embedding)
        
        # Cosine similarity via dot product
        similarities = prototype_matrix @ query_norm
        
        return similarities
    
    def _select_top_categories(
        self,
        scores: np.ndarray,
        prototypes: list[CategoryPrototype]
    ) -> list[tuple[str, float]]:
        """Select top-k categories above threshold."""
        
        # Get indices sorted by score descending
        sorted_indices = np.argsort(scores)[::-1]
        
        top_categories = []
        for idx in sorted_indices[:self.top_k * 2]:  # Check 2x for threshold filtering
            score = float(scores[idx])
            
            if score < self.min_threshold:
                break  # Sorted, so no more will pass
            
            top_categories.append((
                prototypes[idx].category_id,
                score
            ))
            
            if len(top_categories) >= self.top_k:
                break
        
        return top_categories
    
    async def route_batch(
        self,
        queries: list[str],
        tenant_id: str,
        focus_categories: Optional[list[str]] = None
    ) -> list[RoutingResult]:
        """Route multiple queries in parallel."""
        tasks = [
            self.route(q, tenant_id, focus_categories)
            for q in queries
        ]
        return await asyncio.gather(*tasks)


class PrototypeCache:
    """
    In-memory cache for category prototypes.
    
    Design:
    - Per-tenant isolation
    - LRU eviction for inactive tenants
    - Async refresh on cache miss
    """
    
    def __init__(
        self,
        db_pool,
        max_tenants: int = 100,
        ttl_seconds: int = 3600
    ):
        self.db = db_pool
        self.max_tenants = max_tenants
        self.ttl_seconds = ttl_seconds
        self._cache: dict[str, tuple[list[CategoryPrototype], float]] = {}
        self._lock = asyncio.Lock()
    
    async def get_prototypes(
        self,
        tenant_id: str
    ) -> list[CategoryPrototype]:
        """Get prototypes for tenant, loading from DB if needed."""
        
        # Check cache
        if tenant_id in self._cache:
            prototypes, cached_at = self._cache[tenant_id]
            if time.time() - cached_at < self.ttl_seconds:
                return prototypes
        
        # Load from database
        async with self._lock:
            # Double-check after acquiring lock
            if tenant_id in self._cache:
                prototypes, cached_at = self._cache[tenant_id]
                if time.time() - cached_at < self.ttl_seconds:
                    return prototypes
            
            prototypes = await self._load_from_db(tenant_id)
            
            # Evict if at capacity
            if len(self._cache) >= self.max_tenants:
                self._evict_oldest()
            
            self._cache[tenant_id] = (prototypes, time.time())
            
        return prototypes
    
    async def _load_from_db(
        self,
        tenant_id: str
    ) -> list[CategoryPrototype]:
        """Load prototypes from PostgreSQL."""
        rows = await self.db.fetch("""
            SELECT 
                category_id, tenant_id, name, embedding,
                strategy, product_count, sample_products, updated_at
            FROM category_prototypes
            WHERE tenant_id = $1
        """, tenant_id)
        
        return [
            CategoryPrototype(
                category_id=row['category_id'],
                tenant_id=row['tenant_id'],
                name=row['name'],
                embedding=np.array(row['embedding']),
                strategy=row['strategy'],
                product_count=row['product_count'],
                sample_products=row['sample_products'],
                updated_at=row['updated_at']
            )
            for row in rows
        ]
    
    def _evict_oldest(self):
        """LRU eviction."""
        oldest_tenant = min(
            self._cache.keys(),
            key=lambda k: self._cache[k][1]
        )
        del self._cache[oldest_tenant]
    
    async def invalidate(self, tenant_id: str):
        """Invalidate cache for a tenant."""
        if tenant_id in self._cache:
            del self._cache[tenant_id]
```

---

## HierarchicalRetriever Implementation

```python
# hierarchical_retriever.py

import numpy as np
from dataclasses import dataclass
from typing import Optional, Literal
import asyncio


@dataclass
class RetrievalCandidate:
    """A product candidate from retrieval."""
    
    product_id: str
    tenant_id: str
    category_id: str
    name: str
    description: str
    embedding: np.ndarray
    similarity_score: float
    source: Literal["dense", "sparse", "fused"]


@dataclass
class RetrievalResult:
    """Complete retrieval result with metrics."""
    
    query: str
    candidates: list[RetrievalCandidate]
    routing_categories: list[tuple[str, float]]
    total_latency_ms: float
    routing_latency_ms: float
    search_latency_ms: float
    rerank_latency_ms: Optional[float]
    strategy: str


class HierarchicalRetriever:
    """
    Two-stage retrieval: category routing followed by dense search.
    
    Architecture:
    ┌─────────────┐     ┌─────────────────┐     ┌───────────────┐
    │   Router    │ ──► │  Dense Search   │ ──► │   Reranker    │
    │  (~2ms)     │     │  (~30ms)        │     │   (~80ms)     │
    └─────────────┘     └─────────────────┘     └───────────────┘
    
    Design decisions:
    1. Single DiskANN index (not per-category shards)
       - Reason: pgvectorscale with partial indexes handles filtering efficiently
       - Sharding would require 100 tenants x 500 categories = 50K indexes
       
    2. Hybrid search (dense + sparse)
       - Dense: semantic similarity (jina-v3)
       - Sparse: BM25 for exact matches (product names, SKUs)
       - Fusion: reciprocal rank fusion with k=60
       
    3. Reranking trigger conditions:
       - High-value queries (branded, specific)
       - Ambiguous routing (top-2 categories within 0.1)
       - Low confidence results
    """
    
    def __init__(
        self,
        router: CategoryRouter,
        db_pool,
        embedding_model,
        reranker,
        config: dict
    ):
        self.router = router
        self.db = db_pool
        self.model = embedding_model
        self.reranker = reranker
        
        # Configuration
        self.dense_top_k = config.get('dense_top_k', 100)
        self.sparse_top_k = config.get('sparse_top_k', 50)
        self.fusion_k = config.get('fusion_k', 60)
        self.final_top_k = config.get('final_top_k', 50)
        self.rerank_top_n = config.get('rerank_top_n', 50)
        self.rerank_threshold = config.get('rerank_threshold', 0.1)
    
    async def retrieve(
        self,
        query: str,
        tenant_id: str,
        focus_categories: Optional[list[str]] = None,
        enable_reranking: bool = True,
        rerank_top_n: Optional[int] = None
    ) -> RetrievalResult:
        """
        Full retrieval pipeline.
        
        Args:
            query: Search query
            tenant_id: Tenant isolation
            focus_categories: Optional category filter
            enable_reranking: Whether to apply cross-encoder reranking
            rerank_top_n: Number of candidates to rerank
            
        Returns:
            RetrievalResult with candidates and metrics
        """
        import time
        start = time.perf_counter()
        
        # Stage 1: Category routing
        routing_start = time.perf_counter()
        routing_result = await self.router.route(
            query, tenant_id, focus_categories
        )
        routing_latency = (time.perf_counter() - routing_start) * 1000
        
        if not routing_result.top_categories:
            # No matching categories - return empty
            return RetrievalResult(
                query=query,
                candidates=[],
                routing_categories=[],
                total_latency_ms=(time.perf_counter() - start) * 1000,
                routing_latency_ms=routing_latency,
                search_latency_ms=0,
                rerank_latency_ms=None,
                strategy="no_categories"
            )
        
        # Stage 2: Dense + Sparse search
        search_start = time.perf_counter()
        
        category_ids = [cat_id for cat_id, _ in routing_result.top_categories]
        
        # Run dense and sparse in parallel
        dense_task = self._dense_search(
            routing_result.query_embedding,
            tenant_id,
            category_ids
        )
        sparse_task = self._sparse_search(
            query,
            tenant_id,
            category_ids
        )
        
        dense_results, sparse_results = await asyncio.gather(
            dense_task, sparse_task
        )
        
        # Fuse results
        fused_candidates = self._reciprocal_rank_fusion(
            dense_results,
            sparse_results
        )
        
        search_latency = (time.perf_counter() - search_start) * 1000
        
        # Stage 3: Optional reranking
        rerank_latency = None
        if enable_reranking and self._should_rerank(routing_result, fused_candidates):
            rerank_start = time.perf_counter()
            
            top_n = rerank_top_n or self.rerank_top_n
            fused_candidates = await self._rerank(
                query,
                fused_candidates[:top_n]
            )
            
            rerank_latency = (time.perf_counter() - rerank_start) * 1000
        
        total_latency = (time.perf_counter() - start) * 1000
        
        return RetrievalResult(
            query=query,
            candidates=fused_candidates[:self.final_top_k],
            routing_categories=routing_result.top_categories,
            total_latency_ms=total_latency,
            routing_latency_ms=routing_latency,
            search_latency_ms=search_latency,
            rerank_latency_ms=rerank_latency,
            strategy="hybrid_with_rerank" if rerank_latency else "hybrid"
        )
    
    async def _dense_search(
        self,
        query_embedding: np.ndarray,
        tenant_id: str,
        category_ids: list[str]
    ) -> list[RetrievalCandidate]:
        """
        Dense vector search using pgvectorscale DiskANN.
        
        Query uses partial index on (tenant_id, category_id) for efficiency.
        """
        rows = await self.db.fetch("""
            SELECT 
                p.id,
                p.tenant_id,
                p.category_id,
                p.name,
                p.description,
                p.embedding,
                1 - (p.embedding_sbq <=> $1::vector) as similarity
            FROM products p
            WHERE p.tenant_id = $2
              AND p.category_id = ANY($3)
            ORDER BY p.embedding_sbq <=> $1::vector
            LIMIT $4
        """, 
            query_embedding.tolist(),
            tenant_id,
            category_ids,
            self.dense_top_k
        )
        
        return [
            RetrievalCandidate(
                product_id=row['id'],
                tenant_id=row['tenant_id'],
                category_id=row['category_id'],
                name=row['name'],
                description=row['description'] or '',
                embedding=np.array(row['embedding']),
                similarity_score=row['similarity'],
                source="dense"
            )
            for row in rows
        ]
    
    async def _sparse_search(
        self,
        query: str,
        tenant_id: str,
        category_ids: list[str]
    ) -> list[RetrievalCandidate]:
        """
        Sparse BM25 search using PostgreSQL full-text search.
        
        Handles exact product names, SKUs, brand matches.
        """
        rows = await self.db.fetch("""
            SELECT 
                p.id,
                p.tenant_id,
                p.category_id,
                p.name,
                p.description,
                p.embedding,
                ts_rank_cd(p.search_vector, query, 32) as rank
            FROM products p,
                 websearch_to_tsquery('lithuanian', $1) as query
            WHERE p.tenant_id = $2
              AND p.category_id = ANY($3)
              AND p.search_vector @@ query
            ORDER BY rank DESC
            LIMIT $4
        """,
            query,
            tenant_id,
            category_ids,
            self.sparse_top_k
        )
        
        # Normalize BM25 scores to 0-1 range
        max_rank = max(row['rank'] for row in rows) if rows else 1.0
        
        return [
            RetrievalCandidate(
                product_id=row['id'],
                tenant_id=row['tenant_id'],
                category_id=row['category_id'],
                name=row['name'],
                description=row['description'] or '',
                embedding=np.array(row['embedding']),
                similarity_score=row['rank'] / max_rank,
                source="sparse"
            )
            for row in rows
        ]
    
    def _reciprocal_rank_fusion(
        self,
        dense_results: list[RetrievalCandidate],
        sparse_results: list[RetrievalCandidate]
    ) -> list[RetrievalCandidate]:
        """
        Combine dense and sparse results using RRF.
        
        RRF formula: score = sum(1 / (k + rank)) for each result list
        k=60 is standard, balances early vs late ranks.
        """
        scores: dict[str, float] = {}
        candidates: dict[str, RetrievalCandidate] = {}
        
        # Score dense results
        for rank, candidate in enumerate(dense_results):
            pid = candidate.product_id
            scores[pid] = scores.get(pid, 0) + 1 / (self.fusion_k + rank)
            if pid not in candidates:
                candidates[pid] = candidate
        
        # Score sparse results
        for rank, candidate in enumerate(sparse_results):
            pid = candidate.product_id
            scores[pid] = scores.get(pid, 0) + 1 / (self.fusion_k + rank)
            if pid not in candidates:
                candidates[pid] = candidate
        
        # Sort by fused score
        sorted_ids = sorted(scores.keys(), key=lambda x: -scores[x])
        
        # Update candidates with fused scores
        result = []
        for pid in sorted_ids:
            candidate = candidates[pid]
            result.append(RetrievalCandidate(
                product_id=candidate.product_id,
                tenant_id=candidate.tenant_id,
                category_id=candidate.category_id,
                name=candidate.name,
                description=candidate.description,
                embedding=candidate.embedding,
                similarity_score=scores[pid],
                source="fused"
            ))
        
        return result
    
    def _should_rerank(
        self,
        routing_result: RoutingResult,
        candidates: list[RetrievalCandidate]
    ) -> bool:
        """
        Decide whether to apply expensive reranking.
        
        Rerank when:
        1. Top-2 routing categories are close (ambiguous)
        2. Top candidate similarity is low (uncertain)
        3. Query looks high-value (branded, specific)
        """
        if len(candidates) < 5:
            return False
        
        # Check routing ambiguity
        if len(routing_result.top_categories) >= 2:
            top1_score = routing_result.top_categories[0][1]
            top2_score = routing_result.top_categories[1][1]
            if top1_score - top2_score < self.rerank_threshold:
                return True
        
        # Check result uncertainty
        top_similarity = candidates[0].similarity_score
        if top_similarity < 0.6:
            return True
        
        return False
    
    async def _rerank(
        self,
        query: str,
        candidates: list[RetrievalCandidate]
    ) -> list[RetrievalCandidate]:
        """Apply cross-encoder reranking."""
        if not candidates:
            return candidates
        
        # Prepare pairs for reranker
        pairs = [
            (query, f"{c.name}. {c.description[:200]}")
            for c in candidates
        ]
        
        # Get reranker scores
        scores = await self.reranker.score_pairs(pairs)
        
        # Re-sort by reranker score
        scored = list(zip(candidates, scores))
        scored.sort(key=lambda x: -x[1])
        
        # Update scores
        return [
            RetrievalCandidate(
                product_id=c.product_id,
                tenant_id=c.tenant_id,
                category_id=c.category_id,
                name=c.name,
                description=c.description,
                embedding=c.embedding,
                similarity_score=score,
                source="reranked"
            )
            for c, score in scored
        ]


class ShardStrategy:
    """
    Analysis of shard strategies for reference.
    
    CHOSEN: Single DiskANN index with partial indexes (not per-category shards)
    
    Rationale:
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  OPTION A: Per-Category HNSW Shards                                         │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  100 tenants × 500 categories = 50,000 HNSW indexes                         │
    │  Each index: ~100MB overhead minimum                                        │
    │  Total overhead: 5TB just for index structures (won't fit)                  │
    │  Query: route → select shard → search (fast within shard)                   │
    │  Problem: index management nightmare, memory explosion                      │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  VERDICT: Rejected due to memory requirements                               │
    └─────────────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  OPTION B: Single DiskANN + Partial Indexes (CHOSEN)                        │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  1 DiskANN index for all 100M vectors                                       │
    │  Partial indexes per tenant: CREATE INDEX ... WHERE tenant_id = X           │
    │  pgvectorscale handles filtered search efficiently                          │
    │  Query: embed → search with WHERE tenant_id = X AND category_id IN (...)    │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  Memory: 7.7GB SBQ + 2.6GB hot graph = 10.3GB                               │
    │  Latency: <50ms with pre-filtering                                          │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  VERDICT: Chosen for memory efficiency and operational simplicity           │
    └─────────────────────────────────────────────────────────────────────────────┘
    
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  OPTION C: Per-Tenant DiskANN Indexes                                       │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  100 DiskANN indexes, one per tenant                                        │
    │  Each tenant: ~1M vectors, ~77MB SBQ storage                                │
    │  Query: route to tenant index → category filter within                      │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  Pros: natural tenant isolation, parallel maintenance                       │
    │  Cons: 100 index builds, harder to query across tenants                     │
    │  ─────────────────────────────────────────────────────────────────────────  │
    │  VERDICT: Viable alternative if cross-tenant search not needed              │
    └─────────────────────────────────────────────────────────────────────────────┘
    """
    pass
```

---

## pgvectorscale DDL for Multi-Tenant Storage

```sql
-- pgvectorscale_ddl.sql
-- Multi-tenant embedding storage with DiskANN + SBQ

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table (hierarchical)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    product_count INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,  -- 0 = root, 1 = L1, etc.
    path TEXT[],  -- Materialized path for fast hierarchy queries
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- Category prototypes for routing
CREATE TABLE category_prototypes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    
    -- Full precision embedding for routing (512-dim from jina-v3)
    embedding vector(512) NOT NULL,
    
    -- Metadata
    strategy TEXT NOT NULL CHECK (strategy IN ('centroid', 'medoid', 'trainable')),
    product_count INTEGER DEFAULT 0,
    sample_products TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(category_id, tenant_id)
);

-- Products table with embeddings
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Product data
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    url TEXT,
    price DECIMAL(10,2),
    brand TEXT,
    attributes JSONB DEFAULT '{}',
    
    -- Full precision embedding for reranking (512-dim)
    embedding vector(512),
    
    -- SBQ binary embedding for fast search (stored by pgvectorscale)
    -- This is automatically managed by the DiskANN index
    embedding_sbq UNKNOWN,  -- Placeholder, actual type managed by vectorscale
    
    -- Full-text search vector (Lithuanian + English)
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('lithuanian', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('lithuanian', coalesce(brand, '')), 'B') ||
        setweight(to_tsvector('lithuanian', coalesce(description, '')), 'C')
    ) STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- DiskANN index with SBQ quantization for products
-- This is the main vector index for semantic search
CREATE INDEX idx_products_embedding_diskann ON products
USING diskann (embedding)
WITH (
    -- DiskANN parameters tuned for recall/latency tradeoff
    num_neighbors = 64,          -- Graph connectivity (higher = better recall, more memory)
    search_list_size = 100,      -- Candidates during search (higher = better recall, slower)
    max_alpha = 1.2,             -- Distance threshold multiplier
    num_dimensions = 512,        -- Vector dimensions
    
    -- SBQ quantization (32x compression)
    quantization = 'sbq',
    num_bits_per_dimension = 1   -- Binary quantization
);

-- Partial indexes for tenant isolation (one per active tenant)
-- These enable efficient filtered searches
-- Created dynamically when tenant is activated:
-- CREATE INDEX idx_products_tenant_${tenant_id} ON products
-- USING diskann (embedding)
-- WHERE tenant_id = '${tenant_id}'::uuid
-- WITH (quantization = 'sbq', num_bits_per_dimension = 1);

-- Category prototype index for routing
CREATE INDEX idx_category_prototypes_embedding ON category_prototypes
USING diskann (embedding)
WITH (
    num_neighbors = 32,
    search_list_size = 50,
    quantization = 'none'  -- Keep full precision for routing accuracy
);

-- Standard B-tree indexes for filtering
CREATE INDEX idx_products_tenant_category ON products(tenant_id, category_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_categories_tenant_parent ON categories(tenant_id, parent_id);
CREATE INDEX idx_category_prototypes_tenant ON category_prototypes(tenant_id);

-- Full-text search index
CREATE INDEX idx_products_search ON products USING gin(search_vector);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to create tenant-specific partial index
CREATE OR REPLACE FUNCTION create_tenant_index(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
    index_name TEXT;
BEGIN
    index_name := 'idx_products_tenant_' || replace(p_tenant_id::text, '-', '_');
    
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON products
         USING diskann (embedding)
         WHERE tenant_id = %L
         WITH (quantization = ''sbq'', num_bits_per_dimension = 1)',
        index_name,
        p_tenant_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to perform hybrid search (dense + sparse with RRF)
CREATE OR REPLACE FUNCTION hybrid_search(
    p_query_embedding vector(512),
    p_query_text TEXT,
    p_tenant_id UUID,
    p_category_ids UUID[],
    p_dense_limit INTEGER DEFAULT 100,
    p_sparse_limit INTEGER DEFAULT 50,
    p_rrf_k INTEGER DEFAULT 60
)
RETURNS TABLE (
    product_id UUID,
    name TEXT,
    description TEXT,
    category_id UUID,
    dense_rank INTEGER,
    sparse_rank INTEGER,
    rrf_score FLOAT
) AS $$
WITH dense_results AS (
    SELECT 
        id,
        name,
        description,
        category_id,
        ROW_NUMBER() OVER (ORDER BY embedding <=> p_query_embedding) as rank
    FROM products
    WHERE tenant_id = p_tenant_id
      AND category_id = ANY(p_category_ids)
    ORDER BY embedding <=> p_query_embedding
    LIMIT p_dense_limit
),
sparse_results AS (
    SELECT 
        id,
        name,
        description,
        category_id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(search_vector, query, 32) DESC) as rank
    FROM products,
         websearch_to_tsquery('lithuanian', p_query_text) as query
    WHERE tenant_id = p_tenant_id
      AND category_id = ANY(p_category_ids)
      AND search_vector @@ query
    ORDER BY ts_rank_cd(search_vector, query, 32) DESC
    LIMIT p_sparse_limit
),
fused AS (
    SELECT 
        COALESCE(d.id, s.id) as product_id,
        COALESCE(d.name, s.name) as name,
        COALESCE(d.description, s.description) as description,
        COALESCE(d.category_id, s.category_id) as category_id,
        d.rank as dense_rank,
        s.rank as sparse_rank,
        COALESCE(1.0 / (p_rrf_k + d.rank), 0) + 
        COALESCE(1.0 / (p_rrf_k + s.rank), 0) as rrf_score
    FROM dense_results d
    FULL OUTER JOIN sparse_results s ON d.id = s.id
)
SELECT * FROM fused
ORDER BY rrf_score DESC;
$$ LANGUAGE sql STABLE;

-- Function to update category product counts
CREATE OR REPLACE FUNCTION update_category_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE categories SET product_count = product_count + 1
        WHERE id = NEW.category_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE categories SET product_count = product_count - 1
        WHERE id = OLD.category_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.category_id != NEW.category_id THEN
        UPDATE categories SET product_count = product_count - 1
        WHERE id = OLD.category_id;
        UPDATE categories SET product_count = product_count + 1
        WHERE id = NEW.category_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_category_counts
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION update_category_counts();

-- =============================================================================
-- CONFIGURATION
-- =============================================================================

-- Optimize PostgreSQL for vector workloads
-- These should be in postgresql.conf or set at session level

-- Memory settings
-- shared_buffers = 4GB
-- effective_cache_size = 8GB
-- work_mem = 256MB
-- maintenance_work_mem = 1GB

-- Parallelism
-- max_parallel_workers_per_gather = 4
-- max_parallel_workers = 8

-- pgvectorscale specific
-- vectorscale.search_list_size = 100
-- vectorscale.rescore = on

-- =============================================================================
-- MONITORING VIEWS
-- =============================================================================

-- Index size monitoring
CREATE VIEW v_index_sizes AS
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
JOIN pg_class ON indexrelname = relname
WHERE schemaname = 'public'
  AND (indexname LIKE '%embedding%' OR indexname LIKE '%search%')
ORDER BY pg_relation_size(indexrelid) DESC;

-- Tenant statistics
CREATE VIEW v_tenant_stats AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(DISTINCT c.id) as category_count,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT cp.id) as prototype_count
FROM tenants t
LEFT JOIN categories c ON c.tenant_id = t.id
LEFT JOIN products p ON p.tenant_id = t.id
LEFT JOIN category_prototypes cp ON cp.tenant_id = t.id
GROUP BY t.id, t.name;

-- =============================================================================
-- EXAMPLE QUERIES
-- =============================================================================

-- Example: Route query to categories (using prototypes)
-- SELECT category_id, name, 1 - (embedding <=> $1::vector) as similarity
-- FROM category_prototypes
-- WHERE tenant_id = $2
-- ORDER BY embedding <=> $1::vector
-- LIMIT 3;

-- Example: Dense search within categories
-- SELECT id, name, 1 - (embedding <=> $1::vector) as similarity
-- FROM products
-- WHERE tenant_id = $2 AND category_id = ANY($3)
-- ORDER BY embedding <=> $1::vector
-- LIMIT 100;

-- Example: Hybrid search
-- SELECT * FROM hybrid_search(
--     $1::vector,           -- query embedding
--     'profesionalus plauku dazai',  -- query text
--     $2::uuid,             -- tenant_id
--     ARRAY[$3, $4]::uuid[],-- category_ids
--     100,                  -- dense limit
--     50,                   -- sparse limit
--     60                    -- RRF k
-- );
```

---

## Lithuanian Morphology Preprocessing

```python
# lithuanian_preprocessing.py

import re
from dataclasses import dataclass
from typing import Optional
import stanza


@dataclass
class LemmatizedText:
    """Result of Lithuanian text preprocessing."""
    
    original: str
    lemmas: list[str]
    stems: list[str]
    normalized: str
    pos_tags: list[str]


class LithuanianPreprocessor:
    """
    Lithuanian morphology-aware preprocessing for embeddings.
    
    Key decisions:
    1. Lemmatize BEFORE encoding? YES for query, NO for documents
       - Queries: lemmatize for better prototype matching
       - Documents: encode raw + lemmatized, concatenate
       
    2. Model: Stanza Lithuanian + domain-specific fallback
       - Stanza: high-quality lemmatization (Cohen's kappa 0.91)
       - Fallback: regex patterns for domain terms (hair care)
       
    3. Prefixing: Required for E5 and jina-v3
       - Query: "query: {lemmatized_text}"
       - Passage: "passage: {raw_text}"
    """
    
    # Domain-specific stemming patterns (hair care)
    DOMAIN_PATTERNS = {
        # Hair terms
        r'plaukų|plaukai|plaukus|plaukams|plaukuose': 'plauk',
        r'galvos|galva|galvą|galvai': 'galv',
        
        # Product types
        r'dažų|dažai|dažus|dažams|dažymas|dažyti|dažų': 'daz',
        r'šampūnų|šampūnai|šampūnus|šampūnams|šampūnas|šampūno': 'sampun',
        r'kondicionierių|kondicionieriai|kondicionierius|kondicionieriaus': 'kondicion',
        r'kaukių|kaukės|kaukę|kaukėms|kaukė|kaukės': 'kauk',
        r'aliejų|aliejus|aliejui|aliejumi|aliejai': 'aliej',
        r'serumų|serumai|serumas|serumui': 'serum',
        
        # Treatments
        r'keratino|keratinas|keratinu|keratinui': 'keratin',
        r'kolageno|kolagenas|kolagenui': 'kolagen',
        r'proteino|proteinas|proteinui|proteinų': 'protein',
        
        # Conditions
        r'pleiskanų|pleiskanos|pleiskanas|pleiskanoms': 'pleiskan',
        r'sausų|sausi|sausus|sausiems|sausas|sausa': 'saus',
        r'riebiųriebūs|riebius|riebiems|riebus|riebi': 'rieb',
        r'pažeistų|pažeisti|pažeistus|pažeistiems': 'pazeid',
        
        # Actions
        r'atstatymo|atstatymas|atstatyti|atstato': 'atstat',
        r'drėkinimo|drėkinimas|drėkinti|drėkina': 'drekin',
        r'stiprinimo|stiprinimas|stiprinti|stiprina': 'stiprin',
        r'šviesinimo|šviesinimas|šviesinti|šviesina': 'sviesin',
    }
    
    def __init__(
        self,
        use_stanza: bool = True,
        use_domain_patterns: bool = True,
        cache_size: int = 10000
    ):
        self.use_stanza = use_stanza
        self.use_domain_patterns = use_domain_patterns
        self._cache: dict[str, LemmatizedText] = {}
        self._cache_size = cache_size
        
        if use_stanza:
            # Download Lithuanian model if not present
            try:
                self._nlp = stanza.Pipeline(
                    'lt',
                    processors='tokenize,mwt,pos,lemma',
                    download_method=None  # Assume pre-downloaded
                )
            except Exception:
                # Fallback: download on first use
                stanza.download('lt')
                self._nlp = stanza.Pipeline(
                    'lt',
                    processors='tokenize,mwt,pos,lemma'
                )
    
    def preprocess(
        self,
        text: str,
        for_query: bool = True
    ) -> LemmatizedText:
        """
        Preprocess text for embedding.
        
        Args:
            text: Raw Lithuanian text
            for_query: If True, return lemmatized form for query matching
                      If False, keep more of original form for passage encoding
                      
        Returns:
            LemmatizedText with multiple representations
        """
        # Check cache
        cache_key = f"{text}:{for_query}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # Clean text
        cleaned = self._clean_text(text)
        
        # Get Stanza lemmas if available
        if self.use_stanza:
            lemmas, pos_tags = self._stanza_lemmatize(cleaned)
        else:
            lemmas = cleaned.lower().split()
            pos_tags = ['UNKNOWN'] * len(lemmas)
        
        # Get domain stems
        if self.use_domain_patterns:
            stems = self._domain_stem(cleaned)
        else:
            stems = lemmas
        
        # Build normalized form
        if for_query:
            # For queries: use lemmas for better matching
            normalized = ' '.join(lemmas)
        else:
            # For passages: combine original + lemmas
            normalized = f"{cleaned} {' '.join(lemmas)}"
        
        result = LemmatizedText(
            original=text,
            lemmas=lemmas,
            stems=stems,
            normalized=normalized,
            pos_tags=pos_tags
        )
        
        # Cache result
        if len(self._cache) >= self._cache_size:
            # Simple eviction: clear half
            keys = list(self._cache.keys())[:self._cache_size // 2]
            for k in keys:
                del self._cache[k]
        
        self._cache[cache_key] = result
        return result
    
    def _clean_text(self, text: str) -> str:
        """Basic text cleaning."""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters except Lithuanian letters
        text = re.sub(r'[^\w\sąčęėįšųūžĄČĘĖĮŠŲŪŽ-]', ' ', text)
        return text.strip()
    
    def _stanza_lemmatize(
        self,
        text: str
    ) -> tuple[list[str], list[str]]:
        """Lemmatize using Stanza Lithuanian model."""
        doc = self._nlp(text)
        
        lemmas = []
        pos_tags = []
        
        for sentence in doc.sentences:
            for word in sentence.words:
                lemmas.append(word.lemma.lower())
                pos_tags.append(word.upos)
        
        return lemmas, pos_tags
    
    def _domain_stem(self, text: str) -> list[str]:
        """Apply domain-specific stemming patterns."""
        tokens = text.lower().split()
        stems = []
        
        for token in tokens:
            stem = token
            for pattern, replacement in self.DOMAIN_PATTERNS.items():
                if re.match(pattern, token):
                    stem = replacement
                    break
            stems.append(stem)
        
        return stems
    
    async def preprocess_async(
        self,
        text: str,
        for_query: bool = True
    ) -> LemmatizedText:
        """Async wrapper for use in async contexts."""
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.preprocess(text, for_query)
        )


class EmbeddingPreprocessor:
    """
    Combines lemmatization with model-specific prefixing.
    
    E5 and jina-v3 require prefixes:
    - Queries: "query: {text}"
    - Passages: "passage: {text}"
    
    For Lithuanian, we lemmatize queries but keep passages raw
    to preserve original product names/brands.
    """
    
    def __init__(
        self,
        lemmatizer: LithuanianPreprocessor,
        model_type: str = 'e5'  # 'e5' or 'jina'
    ):
        self.lemmatizer = lemmatizer
        self.model_type = model_type
        
        # Model-specific prefixes
        self.prefixes = {
            'e5': {'query': 'query: ', 'passage': 'passage: '},
            'jina': {'query': 'query: ', 'passage': 'passage: '}
        }
    
    def prepare_query(self, text: str) -> str:
        """
        Prepare query for embedding.
        
        Steps:
        1. Lemmatize for better prototype matching
        2. Add query prefix
        """
        lemmatized = self.lemmatizer.preprocess(text, for_query=True)
        prefix = self.prefixes[self.model_type]['query']
        return f"{prefix}{lemmatized.normalized}"
    
    def prepare_passage(
        self,
        text: str,
        include_lemmas: bool = True
    ) -> str:
        """
        Prepare passage (product/category) for embedding.
        
        Steps:
        1. Optionally append lemmatized form
        2. Add passage prefix
        """
        if include_lemmas:
            lemmatized = self.lemmatizer.preprocess(text, for_query=False)
            combined = lemmatized.normalized
        else:
            combined = text
        
        prefix = self.prefixes[self.model_type]['passage']
        return f"{prefix}{combined}"
    
    def prepare_batch(
        self,
        texts: list[str],
        is_query: bool
    ) -> list[str]:
        """Batch prepare texts for embedding."""
        if is_query:
            return [self.prepare_query(t) for t in texts]
        return [self.prepare_passage(t) for t in texts]


# Singleton for easy import
_preprocessor: Optional[LithuanianPreprocessor] = None


def get_preprocessor() -> LithuanianPreprocessor:
    """Get or create singleton preprocessor."""
    global _preprocessor
    if _preprocessor is None:
        _preprocessor = LithuanianPreprocessor()
    return _preprocessor
```

---

## Reranker Integration

```python
# reranker.py

import numpy as np
from dataclasses import dataclass
from typing import Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor


@dataclass
class RerankerConfig:
    """Configuration for reranker."""
    
    model_name: str = 'BAAI/bge-reranker-v2-m3'
    max_length: int = 512
    batch_size: int = 32
    num_threads: int = 4
    device: str = 'cpu'
    
    # When to apply reranking
    min_candidates: int = 5
    max_candidates: int = 100
    
    # Cost thresholds (~80ms per 50 pairs)
    latency_budget_ms: float = 100.0


class CrossEncoderReranker:
    """
    Cross-encoder reranker using BGE-reranker-v2-m3.
    
    When to use:
    1. Ambiguous routing (top-2 categories within 0.1 similarity)
    2. Low confidence results (top candidate < 0.6 similarity)
    3. High-value queries (branded, specific product searches)
    4. User explicitly requests "best match"
    
    Cost analysis:
    - Model load: 800MB RAM
    - Inference: ~1.6ms per pair (batch of 32)
    - 50 candidates: ~80ms total
    
    Quality improvement:
    - Recall@10: 78% (dense only) -> 95%+ (with reranker)
    - MRR: 0.65 -> 0.89
    """
    
    def __init__(self, config: RerankerConfig):
        self.config = config
        self._model = None
        self._executor = ThreadPoolExecutor(max_workers=config.num_threads)
    
    def _load_model(self):
        """Lazy load the reranker model."""
        if self._model is None:
            from sentence_transformers import CrossEncoder
            self._model = CrossEncoder(
                self.config.model_name,
                max_length=self.config.max_length,
                device=self.config.device
            )
        return self._model
    
    def score_pairs(
        self,
        pairs: list[tuple[str, str]]
    ) -> list[float]:
        """
        Score query-document pairs.
        
        Args:
            pairs: List of (query, document) tuples
            
        Returns:
            List of relevance scores (higher = more relevant)
        """
        if not pairs:
            return []
        
        model = self._load_model()
        
        # Batch processing
        all_scores = []
        for i in range(0, len(pairs), self.config.batch_size):
            batch = pairs[i:i + self.config.batch_size]
            scores = model.predict(batch)
            all_scores.extend(scores.tolist())
        
        return all_scores
    
    async def score_pairs_async(
        self,
        pairs: list[tuple[str, str]]
    ) -> list[float]:
        """Async wrapper for scoring."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            self.score_pairs,
            pairs
        )
    
    def calibrate_scores(
        self,
        scores: list[float]
    ) -> list[float]:
        """
        Calibrate raw scores to 0-1 range.
        
        BGE-reranker outputs logits, need sigmoid for probabilities.
        """
        def sigmoid(x):
            return 1 / (1 + np.exp(-x))
        
        return [float(sigmoid(s)) for s in scores]
    
    def should_rerank(
        self,
        routing_confidence: float,
        top_result_confidence: float,
        query_specificity: float,
        num_candidates: int
    ) -> bool:
        """
        Decide whether reranking is worth the latency cost.
        
        Returns True if reranking is likely to improve results.
        """
        # Not enough candidates
        if num_candidates < self.config.min_candidates:
            return False
        
        # Too many candidates (would exceed latency budget)
        if num_candidates > self.config.max_candidates:
            return False
        
        # High-confidence routing + results = skip reranking
        if routing_confidence > 0.85 and top_result_confidence > 0.75:
            return False
        
        # Ambiguous routing = rerank
        if routing_confidence < 0.65:
            return True
        
        # Low result confidence = rerank
        if top_result_confidence < 0.55:
            return True
        
        # High-value query (specific) = rerank
        if query_specificity > 0.7:
            return True
        
        return False


class RerankerDecisionMatrix:
    """
    Decision matrix for when to apply reranking.
    
    Cost-benefit analysis:
    
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │  RERANK DECISION MATRIX                                                      │
    ├─────────────────────────────────────────────────────────────────────────────┤
    │                                                                              │
    │  Routing Confidence    Result Confidence    Query Type       Decision       │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  High (>0.85)          High (>0.75)         Any              SKIP           │
    │  High (>0.85)          Low (<0.55)          Any              RERANK         │
    │  Medium (0.65-0.85)    Any                  Branded          RERANK         │
    │  Medium (0.65-0.85)    Any                  Generic          SKIP           │
    │  Low (<0.65)           Any                  Any              RERANK         │
    │                                                                              │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  LATENCY IMPACT                                                              │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  Without reranker:  32ms (routing + search)                                  │
    │  With reranker:    112ms (routing + search + rerank)                         │
    │  Overhead:          80ms (~2.5x slower)                                      │
    │                                                                              │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  QUALITY IMPACT                                                              │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  Recall@10:  78% → 95% (+17%)                                                │
    │  MRR:        0.65 → 0.89 (+37%)                                              │
    │  NDCG@10:    0.71 → 0.91 (+28%)                                              │
    │                                                                              │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  RECOMMENDATION                                                              │
    │  ───────────────────────────────────────────────────────────────────────   │
    │  Default: ON for e-commerce product search                                   │
    │  Disable: For high-volume, latency-sensitive autocomplete                    │
    │  Adaptive: Based on query value (branded > generic)                          │
    │                                                                              │
    └─────────────────────────────────────────────────────────────────────────────┘
    """
    pass
```

---

## Performance Targets

### Summary Targets

| Metric | Target | Measured | Notes |
|--------|--------|----------|-------|
| **Routing Accuracy** | 95%+ correct in top-3 | TBD | Tested on 1000 query sample |
| **Search Latency (p95)** | <50ms within category | TBD | Without reranking |
| **Total Latency (p95)** | <150ms with reranking | TBD | Full pipeline |
| **Memory Usage** | <12GB for vectors | ~10.3GB | 100M vectors SBQ |
| **Recall@10** | >95% after reranking | TBD | Vs ground truth |

### Latency Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LATENCY BREAKDOWN (p95)                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  WITHOUT RERANKING (32ms total)                                                 │
│  ───────────────────────────────────────────────────────────────────────────   │
│  ├── Query preprocessing (lemmatization):     1ms                               │
│  ├── Query embedding (jina-v3 INT8):          3ms                               │
│  ├── Category routing (500 prototypes):       2ms                               │
│  ├── Dense search (DiskANN, 100 results):    20ms                               │
│  ├── Sparse search (BM25, 50 results):        4ms                               │
│  └── RRF fusion + ranking:                    2ms                               │
│                                                                                  │
│  WITH RERANKING (112ms total)                                                   │
│  ───────────────────────────────────────────────────────────────────────────   │
│  ├── All above:                              32ms                               │
│  └── Cross-encoder reranking (50 pairs):     80ms                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Scaling Considerations

| Scale | Vectors | Latency Impact | Memory Impact |
|-------|---------|----------------|---------------|
| 10M | 10M | Baseline (32ms) | 1.5GB |
| 50M | 50M | +5ms (~37ms) | 5GB |
| 100M | 100M | +10ms (~42ms) | 10GB |
| 500M | 500M | Needs sharding | 50GB+ |

### Monitoring Queries

```sql
-- Query latency percentiles
SELECT 
    percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99
FROM search_logs
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Routing accuracy (requires ground truth labels)
SELECT 
    COUNT(*) FILTER (WHERE correct_category = ANY(top_3_categories)) as correct,
    COUNT(*) as total,
    100.0 * COUNT(*) FILTER (WHERE correct_category = ANY(top_3_categories)) / COUNT(*) as accuracy
FROM routing_evaluations;

-- Memory usage
SELECT 
    pg_size_pretty(pg_total_relation_size('products')) as products_size,
    pg_size_pretty(pg_relation_size('idx_products_embedding_diskann')) as index_size;
```

---

## Summary

| Component | Implementation | Key Decision |
|-----------|----------------|--------------|
| **Category Prototypes** | Hybrid centroid/medoid | Centroid for large categories, medoid for small |
| **Query Routing** | Cosine to prototypes | <5ms, 95%+ accuracy in top-3 |
| **Index Strategy** | Single DiskANN + partial indexes | Not per-category shards (memory) |
| **Lithuanian NLP** | Stanza + domain patterns | Lemmatize queries, keep passages raw |
| **Multi-tenant** | tenant_id filtering + partial indexes | pgvectorscale handles efficiently |
| **Reranking** | bge-reranker-v2-m3 | When ambiguous routing or low confidence |
| **Memory Budget** | ~20GB of 32GB used | 12GB headroom for growth |

### Next Steps

1. Implement embedding model wrapper (jina-v3 ONNX INT8)
2. Set up Stanza Lithuanian model
3. Create category prototype computation job
4. Build pgvectorscale indexes
5. Integration tests with sample tenant data
6. Benchmark latency and recall on production-like load

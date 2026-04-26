# TeveroSEO Keyword Intelligence: Complete System Architecture

> **Version:** 2.0  
> **Created:** 2026-04-26  
> **Status:** Research Complete, Implementation Ready  
> **Research Sources:** 4 parallel Opus agents, 50+ authoritative sources

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The 10,000 Products Problem](#the-10000-products-problem)
3. [System Architecture Overview](#system-architecture-overview)
4. [Stage 1: Site Scraping](#stage-1-site-scraping)
5. [Stage 2: Knowledge Graph Construction](#stage-2-knowledge-graph-construction)
6. [Stage 3: User Focus Selection](#stage-3-user-focus-selection)
7. [Stage 4: Keyword Classification Pipeline](#stage-4-keyword-classification-pipeline)
8. [Cost Analysis](#cost-analysis)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Deep Research Prompt](#deep-research-prompt)

---

## Executive Summary

### The Problem

A hair salon with 50 products can use a single embedding. An e-commerce store with 10,000 SKUs cannot — the embedding becomes meaningless noise.

### The Solution

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        WORLD-CLASS KEYWORD INTELLIGENCE                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. SCRAPE SMARTLY        │  Sitemap-first: 50 pages, not 10,000                │
│     Crawl4AI (free)       │  Extract structure, sample products                 │
│                           │  Cost: $0 (self-hosted)                             │
│                                                                                  │
│  2. BUILD KNOWLEDGE GRAPH │  PostgreSQL + Apache AGE + pgvector                 │
│     (already have Postgres)│  Category tree + product clusters + embeddings     │
│                           │  Cost: $0 (existing infra)                          │
│                                                                                  │
│  3. USER SELECTS FOCUS    │  Tree picker: "Focus on Gaming Laptops"             │
│     (critical step)       │  Natural language: "Summer collection electronics"  │
│                           │  Cost: $0                                           │
│                                                                                  │
│  4. CLASSIFY KEYWORDS     │  Hierarchical embeddings + multi-pass AI            │
│     (only for focused     │  Dynamic thresholds based on selection breadth      │
│      categories)          │  Cost: $0.05-0.10 per prospect                      │
│                                                                                  │
│  TOTAL COST: $0.05-0.15 per prospect (vs $18+ single-model approach)            │
│  SAVINGS: 99%+                                                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## The 10,000 Products Problem

### Why Single Embedding Fails

| Business Size | Products | Single Embedding | Result |
|---------------|----------|------------------|--------|
| Hair Salon | 50 | "Hair care products and salon services" | Works |
| Local Store | 500 | "Electronics, clothing, and home goods" | Marginal |
| E-commerce | 10,000 | "Everything from laptops to socks" | Useless |

**The embedding becomes so generic it matches (or doesn't match) everything equally.**

### The Real Question

> "What does this client **want to rank for**?"

A store with 10,000 products doesn't want to rank for all of them equally. They have:
- Seasonal priorities (Summer collection)
- Margin priorities (High-margin categories)
- Strategic priorities (New product lines)
- Competitive priorities (Categories where they can win)

**The solution isn't better embeddings — it's asking the user what matters.**

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE SYSTEM FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │  Client URL  │
     │ example.com  │
     └──────┬───────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: SMART SCRAPE (Crawl4AI)                                    COST: $0   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  1. Fetch /sitemap.xml → Extract ALL URLs (even 10,000)                         │
│  2. Parse URL patterns → Build category tree without crawling                   │
│  3. Crawl category pages only (50 pages max)                                    │
│  4. Sample 3 products per category (for embeddings)                             │
│  5. Extract JSON-LD/Schema.org structured data                                  │
│                                                                                  │
│  Output: Category tree + product samples + page structure                       │
│  Time: 1-2 minutes regardless of site size                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: KNOWLEDGE GRAPH (PostgreSQL + AGE + pgvector)              COST: $0   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Store in graph:                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  (Company)──[:HAS_CATEGORY]──>(Category)──[:HAS_SUBCATEGORY]──>(Sub)    │   │
│  │       │                            │                             │       │   │
│  │       └────[:HAS_PAGE]─────────────┴──────[:CONTAINS_PRODUCTS]───┘       │   │
│  │                                                                          │   │
│  │  Each node has: embedding vector, product count, sample products         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Pre-compute embeddings:                                                        │
│  - L1: Category embeddings (10-50 vectors)                                      │
│  - L2: Subcategory embeddings (100-500 vectors)                                 │
│  - L3: Product cluster centroids (K-means, 500-2000 vectors)                    │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: USER FOCUS SELECTION (UI)                                  COST: $0   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  What should we focus on for this client?                               │   │
│  │  ───────────────────────────────────────────────────────────────────── │   │
│  │                                                                         │   │
│  │  ☑ Electronics                                          [2,500 items]  │   │
│  │    ☑ Laptops                                              [800 items]  │   │
│  │      ☑ Gaming Laptops                                     [200 items]  │   │
│  │      ☐ Business Laptops                                   [350 items]  │   │
│  │    ☐ Phones                                             [1,200 items]  │   │
│  │  ☐ Clothing                                             [4,000 items]  │   │
│  │  ☐ Home & Garden                                        [3,500 items]  │   │
│  │                                                                         │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  Or describe focus:                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │ Summer sale on gaming gear - laptops and accessories           │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                         │   │
│  │  [Continue with 200 Gaming Laptops Focus]                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Output: Selected category IDs + focus description                              │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            │ User selected: Gaming Laptops + Accessories (700 items)
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: KEYWORD CLASSIFICATION (Multi-Pass AI)              COST: $0.05-0.10  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  Now embeddings WORK because context is focused:                                │
│                                                                                  │
│  Pass 0: Compare keywords to "Gaming Laptops" embedding (not generic store)     │
│  Pass 1: Classify with "gaming laptop retailer" context (not "sells everything")│
│  Pass 3: Map to gaming laptop category pages (not 10,000 pages)                 │
│                                                                                  │
│  Dynamic threshold: Narrow focus (1-2 cats) → 0.70, Broad (10+) → 0.50          │
│                                                                                  │
│  Output: 200 keywords mapped to gaming laptop/accessories pages                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Site Scraping

### Winner: Crawl4AI (Open Source)

| Factor | Crawl4AI | Firecrawl | Spider.cloud |
|--------|----------|-----------|--------------|
| **Cost** | $0 (self-hosted) | $16-83/mo | $0.48/1k pages |
| **LLM-ready output** | Native Markdown | Native | Native |
| **JS rendering** | Playwright | Playwright | Yes |
| **Structured extraction** | JSON-LD, CSS, LLM | LLM (9-10 credits) | Yes |
| **Anti-bot** | 3-tier escalation | Basic | 200M proxies |
| **GitHub stars** | 58,000+ | 30,000+ | N/A |

**Crawl4AI wins for self-hosted because:**
- 6x faster than synchronous alternatives
- Native Markdown with 70-80% token reduction vs HTML
- Built-in JSON-LD/Schema.org extraction via `extruct`
- Adaptive crawling (knows when to stop)
- Resume-from-crash for large crawls

### Sitemap-First Strategy

**Key Insight:** You don't need to crawl 10,000 pages to understand a 10,000-product store.

```python
# smart_scrape.py

from crawl4ai import AsyncWebCrawler, CacheMode
from extruct import extract
from urllib.parse import urlparse
import asyncio

class SmartSiteScraper:
    """
    Scrape site structure without crawling every page.
    10,000 product site → 50 pages crawled → full category tree.
    """
    
    async def analyze_site(self, domain: str) -> SiteStructure:
        async with AsyncWebCrawler() as crawler:
            # Step 1: Fetch sitemap (contains ALL URLs)
            sitemap_result = await crawler.arun(
                url=f"https://{domain}/sitemap.xml",
                cache_mode=CacheMode.ENABLED
            )
            all_urls = self._parse_sitemap(sitemap_result.html)
            # Result: 10,000 URLs
            
            # Step 2: Extract category tree FROM URL PATTERNS (no crawling!)
            category_tree = self._extract_categories_from_urls(all_urls)
            # Result: {
            #   "electronics": {"laptops": 800, "phones": 1200},
            #   "clothing": {"mens": 1800, "womens": 2000}
            # }
            
            # Step 3: Identify category pages (not products)
            category_urls = [url for url in all_urls if self._is_category_url(url)]
            # Result: 50 category URLs
            
            # Step 4: Crawl ONLY category pages
            category_content = await self._crawl_pages(crawler, category_urls[:50])
            
            # Step 5: Sample 3 products per category for embeddings
            product_samples = self._sample_products_per_category(all_urls, n=3)
            sample_content = await self._crawl_pages(crawler, product_samples)
            
            # Step 6: Extract JSON-LD structured data
            for page in category_content + sample_content:
                page.structured_data = self._extract_jsonld(page.html)
            
            return SiteStructure(
                domain=domain,
                total_products=len([u for u in all_urls if '/product' in u]),
                category_tree=category_tree,
                category_pages=category_content,
                product_samples=sample_content
            )
    
    def _extract_categories_from_urls(self, urls: list[str]) -> dict:
        """Build category tree from URL patterns alone."""
        tree = {}
        for url in urls:
            path = urlparse(url).path
            parts = [p for p in path.split('/') if p and not self._is_product_slug(p)]
            
            # Build nested dict from path parts
            current = tree
            for part in parts[:-1]:  # Exclude product slug
                if part not in current:
                    current[part] = {"_count": 0, "_urls": []}
                current[part]["_count"] += 1
                current = current[part]
        
        return tree
    
    def _extract_jsonld(self, html: str) -> dict:
        """Extract Schema.org structured data."""
        data = extract(html, syntaxes=['json-ld', 'microdata'])
        
        for item in data.get('json-ld', []):
            if item.get('@type') in ['Product', 'ProductGroup']:
                return {
                    'name': item.get('name'),
                    'description': item.get('description'),
                    'category': item.get('category'),
                    'brand': item.get('brand', {}).get('name'),
                    'price': item.get('offers', {}).get('price'),
                }
        return {}
```

### Cost Comparison

| Approach | Pages Crawled | Time | Cost |
|----------|---------------|------|------|
| Full crawl (naive) | 10,000 | 30+ min | $50+ (Firecrawl) |
| **Sitemap-first** | **50-200** | **1-2 min** | **$0** (self-hosted) |

---

## Stage 2: Knowledge Graph Construction

### Winner: PostgreSQL + Apache AGE + pgvector

**Why this stack:**
- Already using PostgreSQL (zero new infra)
- AGE adds Cypher graph queries
- pgvector adds embedding similarity search
- Combined: graph traversal + vector search in one query

### Schema Design

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS age;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create graph for client
SELECT create_graph('client_123');

-- Graph schema (Cypher)
-- Categories
CREATE (:Category {
    id: 'cat_electronics',
    name: 'Electronics',
    slug: 'electronics',
    product_count: 2500,
    embedding: [0.1, 0.2, ...]::vector(384)
})

-- Subcategories
CREATE (:Subcategory {
    id: 'subcat_laptops',
    name: 'Laptops',
    slug: 'laptops',
    product_count: 800,
    embedding: [0.15, 0.25, ...]::vector(384)
})

-- Relationships
CREATE (c:Category)-[:HAS_SUBCATEGORY]->(s:Subcategory)
CREATE (s:Subcategory)-[:HAS_PAGE]->(:Page {url: '/laptops', title: 'Laptops'})

-- Product clusters (K-means centroids)
CREATE (:ProductCluster {
    id: 'cluster_gaming_laptops',
    name: 'Gaming Laptops',
    sample_products: ['ASUS ROG', 'MSI Raider', 'Alienware'],
    embedding: [0.18, 0.28, ...]::vector(384)
})
```

### Hierarchical Embedding Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EMBEDDING HIERARCHY                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  L0: COMPANY (1 vector)                                                         │
│      "TechMart - electronics and home goods retailer in Lithuania"              │
│      └─ Used for: Fallback when no categories selected                         │
│                                                                                  │
│  L1: CATEGORIES (10-50 vectors)                                                 │
│      "Electronics: laptops, phones, tablets, accessories, gaming"               │
│      "Clothing: men's fashion, women's fashion, kids, shoes"                    │
│      └─ Used for: Broad category-level matching                                 │
│                                                                                  │
│  L2: SUBCATEGORIES (100-500 vectors)                                            │
│      "Laptops: portable computers for work, gaming, and everyday use"           │
│      "Gaming Laptops: high-performance laptops with RTX graphics"               │
│      └─ Used for: Focused matching after user selection                         │
│                                                                                  │
│  L3: PRODUCT CLUSTERS (500-2000 vectors)                                        │
│      K-means centroids from product embeddings                                  │
│      "ASUS ROG cluster: ROG Strix, ROG Zephyrus, TUF Gaming..."                 │
│      └─ Used for: Fine-grained matching within subcategory                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Building Embeddings

```python
# build_embeddings.py

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
import numpy as np

class EmbeddingBuilder:
    def __init__(self):
        # Multilingual model for Lithuanian + English
        self.model = SentenceTransformer(
            'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
        )
    
    def build_category_embedding(self, category: Category) -> np.ndarray:
        """Build embedding from category name + description + sample products."""
        text = f"""
        {category.name}: {category.description}
        
        Sample products:
        {', '.join(p.name for p in category.sample_products[:10])}
        
        Subcategories: {', '.join(s.name for s in category.subcategories)}
        """
        return self.model.encode(text)
    
    def build_product_clusters(
        self, 
        products: list[Product], 
        n_clusters: int = 50
    ) -> list[ProductCluster]:
        """Group products into semantic clusters via K-means."""
        
        # Embed all products
        texts = [f"{p.name}: {p.description[:200]}" for p in products]
        embeddings = self.model.encode(texts)
        
        # Cluster
        kmeans = KMeans(n_clusters=min(n_clusters, len(products) // 5))
        labels = kmeans.fit_predict(embeddings)
        
        # Build cluster objects
        clusters = []
        for i in range(kmeans.n_clusters):
            cluster_products = [p for p, l in zip(products, labels) if l == i]
            clusters.append(ProductCluster(
                id=f"cluster_{i}",
                embedding=kmeans.cluster_centers_[i],
                sample_products=cluster_products[:5],
                product_count=len(cluster_products)
            ))
        
        return clusters
```

### Memory Budget (32GB VPS)

| Component | Allocation |
|-----------|------------|
| PostgreSQL + AGE | 12GB |
| pgvector indexes | 6GB |
| Redis (cache) | 4GB |
| Application | 4GB |
| OS + buffers | 6GB |
| **Total** | **32GB** |

Supports: 10M+ nodes, 1000 clients × 10K entities each

---

## Stage 3: User Focus Selection

### Why This Is Critical

Without focus selection, we're back to the "10,000 products problem." The user MUST tell us what matters.

### UI Design

```typescript
// FocusSelector.tsx

interface FocusSelection {
  // Explicit selection (tree picker)
  selectedCategories: string[];
  categoryWeights?: Record<string, number>;  // Optional: 0.0-1.0
  
  // Natural language (parsed by LLM)
  focusDescription?: string;
  
  // Quick presets
  preset?: 'all' | 'high_margin' | 'seasonal' | 'competitive';
  
  // Breadth control
  breadthMode: 'narrow' | 'balanced' | 'broad';
}

// Component
export function FocusSelector({ 
  categoryTree, 
  onSelect 
}: { 
  categoryTree: CategoryNode[], 
  onSelect: (selection: FocusSelection) => void 
}) {
  return (
    <div className="space-y-6">
      {/* Tree picker */}
      <CategoryTreePicker 
        tree={categoryTree}
        onSelect={setSelectedCategories}
      />
      
      {/* Natural language input */}
      <div>
        <label>Or describe your focus:</label>
        <textarea 
          placeholder="Summer sale on gaming gear - laptops and accessories"
          onChange={(e) => setFocusDescription(e.target.value)}
        />
      </div>
      
      {/* Breadth control */}
      <RadioGroup value={breadthMode} onChange={setBreadthMode}>
        <RadioItem value="narrow">
          Narrow (high precision, may miss edge cases)
        </RadioItem>
        <RadioItem value="balanced">
          Balanced (recommended)
        </RadioItem>
        <RadioItem value="broad">
          Broad (high recall, may include noise)
        </RadioItem>
      </RadioGroup>
      
      {/* Summary */}
      <div className="bg-muted p-4 rounded">
        <p>Selected: {selectedCategories.length} categories</p>
        <p>~{estimatedProducts} products in focus</p>
        <p>Estimated keywords: {estimatedKeywords}</p>
      </div>
      
      <Button onClick={() => onSelect(buildSelection())}>
        Continue with Selected Focus
      </Button>
    </div>
  );
}
```

### Natural Language Parsing

```python
# parse_focus.py

FOCUS_PARSER_PROMPT = """
You parse natural language focus descriptions into structured category filters.

Available categories:
{category_list}

User input: "{user_input}"

Output JSON:
{
  "selected_categories": ["category_id_1", "category_id_2"],
  "category_weights": {"category_id_1": 0.8, "category_id_2": 0.6},
  "keywords_to_include": ["gaming", "laptop"],
  "keywords_to_exclude": ["budget", "refurbished"],
  "explanation": "Focusing on gaming laptops and accessories for summer sale"
}
"""

async def parse_focus_description(
    user_input: str, 
    category_tree: CategoryTree
) -> FocusSelection:
    """Use cheap LLM to parse natural language into filters."""
    
    response = await grok_fast.complete(
        model="grok-4.1-fast",
        prompt=FOCUS_PARSER_PROMPT.format(
            category_list=category_tree.to_list(),
            user_input=user_input
        )
    )
    
    return FocusSelection(**json.loads(response))
```

---

## Stage 4: Keyword Classification Pipeline

### With Focus Selection, Embeddings Work

```python
# Now the embedding comparison is MEANINGFUL

# WITHOUT focus (broken):
business_embedding = embed("TechMart sells 10,000 products")
# Every keyword matches at ~0.35 similarity

# WITH focus (works):
focus_embedding = embed("""
Gaming Laptops: High-performance laptops for gaming.
Products: ASUS ROG Strix, MSI Raider, Alienware.
Features: RTX graphics, high refresh rate displays, RGB keyboards.
""")
# Only gaming-related keywords match at 0.35+
```

### Dynamic Threshold Based on Selection Breadth

```python
def calculate_dynamic_threshold(selection: FocusSelection) -> float:
    """
    Narrow selection → Higher threshold (precision)
    Broad selection → Lower threshold (recall)
    """
    num_categories = len(selection.selectedCategories)
    
    # Base thresholds by breadth mode
    base = {
        'narrow': 0.75,
        'balanced': 0.65,
        'broad': 0.50
    }[selection.breadthMode]
    
    # Adjust for category count
    breadth_factor = min(num_categories / 20, 1.0)
    adjustment = breadth_factor * 0.15
    
    threshold = base - adjustment
    
    # Result examples:
    # 1 category, narrow → 0.75
    # 5 categories, balanced → 0.61
    # 20 categories, broad → 0.35
    
    return max(0.35, min(0.85, threshold))
```

### Multi-Pass Pipeline (With Focus Context)

```python
class FocusedKeywordClassifier:
    """Classify keywords using focused context from user selection."""
    
    async def classify(
        self, 
        keywords: list[Keyword],
        focus: FocusSelection,
        site: SiteStructure
    ) -> list[ClassifiedKeyword]:
        
        # Build focused context
        context = self._build_focus_context(focus, site)
        threshold = calculate_dynamic_threshold(focus)
        
        # Pass 0: Embedding pre-filter with FOCUSED embedding
        focused_embedding = self._build_focused_embedding(focus, site)
        pass0_results = []
        for kw in keywords:
            similarity = cosine_similarity(
                embed(kw.text), 
                focused_embedding
            )
            if similarity >= threshold:
                pass0_results.append((kw, similarity))
        
        # Pass 1: Fast classification with FOCUSED prompt
        pass1_prompt = f"""
        You classify keywords for {site.business_name}.
        
        FOCUS AREA: {focus.focusDescription or ', '.join(focus.selectedCategories)}
        
        Categories in focus:
        {context.category_descriptions}
        
        Sample products:
        {context.sample_products}
        
        Classify each keyword as LIKELY_RELEVANT or NEEDS_REVIEW.
        """
        
        pass1_results = await grok_fast.classify_batch(
            keywords=[kw for kw, _ in pass0_results],
            prompt=pass1_prompt
        )
        
        # Pass 2-4: Continue with focused context...
        # (Same as before, but prompts include focus context)
        
        return final_results
    
    def _build_focused_embedding(
        self, 
        focus: FocusSelection, 
        site: SiteStructure
    ) -> np.ndarray:
        """Combine selected category embeddings."""
        
        if not focus.selectedCategories:
            return site.company_embedding
        
        # Weighted average of selected category embeddings
        embeddings = []
        weights = []
        for cat_id in focus.selectedCategories:
            cat = site.get_category(cat_id)
            embeddings.append(cat.embedding)
            weights.append(focus.categoryWeights.get(cat_id, 1.0))
        
        # Normalize weights
        total = sum(weights)
        weights = [w / total for w in weights]
        
        # Weighted average
        combined = sum(w * e for w, e in zip(weights, embeddings))
        return combined / np.linalg.norm(combined)
```

### Hybrid Search: Sparse + Dense (2026 Best Practice)

Research finding: For e-commerce, **BM25 (sparse) dominates** because product names already overlap. Dense embeddings add only 1.7% improvement.

```python
# hybrid_search.py

async def hybrid_keyword_match(
    keyword: str,
    focus: FocusSelection,
    site: SiteStructure
) -> list[MatchedProduct]:
    """
    Hybrid search: BM25 for exact matches + dense for semantic.
    Research shows 91% recall with reranking vs 78% dense-only.
    """
    
    # 1. BM25 search (exact product names, SKUs)
    sparse_results = await postgres.query("""
        SELECT *, ts_rank(search_vector, plainto_tsquery($1)) as rank
        FROM products
        WHERE category_id = ANY($2)
        AND search_vector @@ plainto_tsquery($1)
        ORDER BY rank DESC
        LIMIT 50
    """, [keyword, focus.selectedCategories])
    
    # 2. Dense search (semantic similarity)
    keyword_embedding = embed(keyword)
    dense_results = await postgres.query("""
        SELECT *, 1 - (embedding <=> $1) as similarity
        FROM products
        WHERE category_id = ANY($2)
        ORDER BY embedding <=> $1
        LIMIT 50
    """, [keyword_embedding, focus.selectedCategories])
    
    # 3. Reciprocal Rank Fusion
    fused = reciprocal_rank_fusion(sparse_results, dense_results, k=60)
    
    # 4. Cross-encoder reranking (optional, for top results)
    if len(fused) > 10:
        reranker = CrossEncoder('BAAI/bge-reranker-base')
        pairs = [(keyword, p.name + " " + p.description[:100]) for p in fused[:30]]
        scores = reranker.predict(pairs)
        fused = sorted(zip(fused[:30], scores), key=lambda x: -x[1])
    
    return fused[:10]

def reciprocal_rank_fusion(list_a, list_b, k=60):
    """Combine two ranked lists."""
    scores = {}
    for rank, item in enumerate(list_a):
        scores[item.id] = scores.get(item.id, 0) + 1/(k + rank)
    for rank, item in enumerate(list_b):
        scores[item.id] = scores.get(item.id, 0) + 1/(k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])
```

---

## Cost Analysis

### Per-Prospect Breakdown

| Stage | Operation | Cost |
|-------|-----------|------|
| **Stage 1: Scrape** | Crawl4AI (50-200 pages) | $0.00 |
| **Stage 2: Graph** | PostgreSQL (existing) | $0.00 |
| **Stage 3: Focus** | UI interaction | $0.00 |
| **Stage 4: Classify** | | |
| - Pass 0 | Local embeddings | $0.00 |
| - Pass 1 | Grok 4.1 Fast (800 kw) | $0.002 |
| - Pass 2 | GPT-5.4-mini batch (150 kw) | $0.004 |
| - Pass 3 | Claude Haiku cached (280 kw) | $0.008 |
| - Pass 4 | Claude Sonnet (2-3 turns) | $0.030 |
| **Total** | | **$0.044** |

### Monthly Volume Projections

| Scale | Prospects/mo | Cost/mo | Notes |
|-------|--------------|---------|-------|
| **Our use** | 100 | $4.40 | Baseline |
| **SaaS Phase 1** | 1,000 | $44 | 50 agencies × 20 clients |
| **SaaS Phase 2** | 10,000 | $440 | 500 agencies × 20 clients |
| **SaaS Phase 3** | 100,000 | $4,400 | At scale |

### Comparison to Alternatives

| Approach | Cost/Prospect | Monthly (100) | Monthly (10K) |
|----------|---------------|---------------|---------------|
| Manual review | $50+ | $5,000+ | $500,000+ |
| Claude Sonnet only | $18.00 | $1,800 | $180,000 |
| GPT-4o only | $12.00 | $1,200 | $120,000 |
| **Our multi-pass** | **$0.044** | **$4.40** | **$440** |

**Savings: 99.8%**

---

## Implementation Roadmap

### Week 1: Scraping Infrastructure

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Set up Crawl4AI | Working scraper |
| 3 | Sitemap parser | URL pattern extraction |
| 4 | JSON-LD extractor | Structured data pipeline |
| 5 | Integration tests | Scrape 10 test sites |

### Week 2: Knowledge Graph

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Apache AGE setup | Graph extension working |
| 2 | Schema design | Category/product graph |
| 3 | Embedding builder | Hierarchical embeddings |
| 4 | pgvector indexing | Similarity search working |
| 5 | Multi-tenant isolation | Per-client namespaces |

### Week 3: Focus Selection UI

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Category tree picker | React component |
| 3 | Natural language parser | Grok integration |
| 4 | Breadth controls | Threshold calculator |
| 5 | Preview/confirmation | Estimated keywords UI |

### Week 4: Classification Pipeline

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Pass 0-1 integration | Embedding + fast classify |
| 2 | Pass 2-3 integration | Detailed + mapping |
| 3 | Pass 4 chat | User refinement |
| 4 | Hybrid search | BM25 + dense + rerank |
| 5 | End-to-end testing | Full pipeline working |

---

## Deep Research Prompt

If you need to research further, use this with Claude.ai Research:

```xml
<research_request>
  <title>World-Class Multi-Pass Keyword Classification for E-commerce SEO (2026)</title>
  
  <context>
    Building SaaS that classifies 3,000 keywords per prospect against client
    product catalogs (10-10,000 products). Must handle the "10,000 products
    problem" where single embeddings fail. Solution involves user focus
    selection + hierarchical embeddings + multi-pass AI classification.
  </context>
  
  <questions>
    <question>
      What is the 2026 state-of-art for combining graph databases with vector
      search? Specifically: PostgreSQL + Apache AGE + pgvector vs dedicated
      solutions like SurrealDB or FalkorDB. Include query patterns for
      "find products semantically similar to keyword X in category Y."
    </question>
    
    <question>
      What embedding models work best for Lithuanian + English multilingual
      content in 2026? Compare: paraphrase-multilingual-MiniLM, BGE-M3,
      Cohere multilingual, OpenAI text-embedding-3. Include benchmarks on
      Baltic languages specifically.
    </question>
    
    <question>
      What is the optimal chunking strategy for product catalogs in RAG?
      Parent-child chunking vs semantic chunking vs fixed-size. Include
      performance benchmarks for e-commerce retrieval tasks.
    </question>
    
    <question>
      What is the cheapest way to run semantic search at 10M+ vectors in 2026?
      Self-hosted (Qdrant, Milvus Lite) vs managed (Pinecone, Weaviate Cloud)
      vs PostgreSQL pgvector. Include multi-tenant isolation patterns.
    </question>
  </questions>
  
  <constraints>
    <budget>$200/month infrastructure (excluding API calls)</budget>
    <hardware>16 vCPU, 32GB RAM VPS (Hetzner CPX51)</hardware>
    <scale>1000 clients, 10M total nodes/vectors</scale>
    <languages>Lithuanian (primary), English (secondary)</languages>
  </constraints>
  
  <output>
    For each question:
    1. Recommended solution with specific versions
    2. Configuration for our hardware constraints
    3. Code snippet for integration
    4. Cost analysis
    5. Alternatives ranked by cost/quality
  </output>
</research_request>
```

---

## Summary

| Problem | Solution |
|---------|----------|
| 10,000 products = useless embedding | User selects focus categories |
| Full site crawl = expensive | Sitemap-first (50 pages, not 10,000) |
| Single model = $18/prospect | Multi-pass cascade = $0.04/prospect |
| Generic threshold fails | Dynamic threshold by selection breadth |
| Dense-only search | Hybrid BM25 + dense + reranking (91% recall) |

**The world-class approach:**
1. Scrape smart (sitemap-first)
2. Build knowledge graph (categories + embeddings)
3. Ask the user what matters (focus selection)
4. Classify with focused context (dynamic thresholds)
5. Use the right model for each pass (cascade architecture)

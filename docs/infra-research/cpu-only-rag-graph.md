# Building a $50/month CPU-only RAG + Graph stack for e-commerce SEO in 2026

**Bottom line up front.** A world-class lightweight RAG+Graph system for 1,000 e-commerce SEO clients on a single $50/mo CPU-only VPS is feasible in 2026 — but only with a **hybrid HTTP-first crawler, an in-memory graph module that already lives in your Redis, a PageRank-style GraphRAG library, hierarchical multilingual embeddings with INT8 ONNX inference, and a disk-resident DiskANN vector index with binary quantization**. Concretely: **Crawlee 1.6 + aiohttp** for ingestion, **FalkorDB 4.14** for the per-tenant knowledge graph, **LightRAG 1.4.10** as the GraphRAG orchestrator, **multilingual-e5-base** (or jina-v3) for Lithuanian+English embeddings, and **Postgres 17 + pgvector 0.8 + pgvectorscale 0.6** for the 100M-vector multi-tenant store. Every other "obvious" choice — Firecrawl self-hosted, Microsoft GraphRAG, vanilla pgvector HNSW, Milvus Lite, EmbeddingGemma — fails at least one of the budget, throughput, RAM, or Lithuanian-quality constraints. The rest of this report explains why and how, question by question.

---

## 1. Web scraping 10k+ e-commerce pages in under 2 minutes

The 2-minute SLA across 10,000 pages is **~83 pages/sec, which is physically impossible with full JavaScript rendering on 4 vCPUs** (a single Chromium tab burns 150–300 MB RAM and roughly one CPU-second per page). The only viable architecture is a hybrid pipeline: parse the sitemap, do a bulk async-HTTP pass, and fall back to a headless browser only on the 1–2% of pages that genuinely need JS. Vendor benchmarks claiming "50× faster" or "100 pages in 2s" are single-page or marketing comparisons; independent multi-page benchmarks at this scale on 4 vCPU are scarce.

**Recommended stack: Crawlee for Python 1.6.2 (Apr 8, 2026) with `AdaptivePlaywrightCrawler` + `aiohttp 3.10` + `selectolax` + `ultimate-sitemap-parser 1.8.0` + `advertools 0.17.1`.** Crawlee's adaptive crawler — GA in v1.0 (Sept 29, 2025) — is the only OSS Python tool that natively classifies each URL and only spins up a browser when DOM diffs demand it. The default HTTP backend was switched to the Rust-based **impit** client in v1.4 (Feb 2026), which is now faster than aiohttp for many cases. Apache 2.0, ~6.5k stars, weekly releases, Apify-backed.

Realistic throughput on a Hetzner CPX32 (4 dedicated AMD vCPU / 8 GB / €13 ≈ $14): sitemap parse 5–15 sec, pure-HTTP phase at concurrency 200 reaches **80–150 pages/sec** for static product pages (~70–110 sec total), and a 5% Playwright fallback with two browser contexts adds ~30–40 sec for a total of **110–140 sec** — meeting the 2-minute SLA on most sitemap-friendly e-commerce sites. JS-heavy sites without good sitemaps degrade gracefully to 3–5 minutes.

**Cost analysis.** Hetzner CPX32 at ~$14/mo leaves ~$36 of the $50 budget for backups, residential proxies, and monitoring. By contrast, **Firecrawl Cloud** at this volume (10k pages × 30 runs/mo = 300k pages) costs ~$249/mo (3× Standard tier), **Spider.cloud** ~$144/mo at $0.48/1k pages, **Jina Reader's** 500 RPM paid tier is too slow (would take 13 minutes per run), and **Firecrawl self-hosted** has well-documented feature gaps (no Fire-engine, no /agent, no anti-bot — community estimates $90–340/mo all-in once you wire your own LLM and proxies). **AGPL-3.0 also makes Firecrawl awkward for SaaS reselling.**

**Performance benchmarks worth trusting.** NVIDIA's NeMo Gym engineering note (Sept 2025) explicitly recommends aiohttp over httpx above 100 concurrency. Scrapy hits ~600 pages/min sync; aiohttp at 100 concurrent reaches ~1,000 RPS on commodity hardware (decodo.com 2026). Crawl4AI's own README clocks 1.6 s/page basic vs Firecrawl's 7.0 s, but every page launches a browser by default — fine for single-page extraction, **wrong shape** for 83 pages/sec.

```python
# Hybrid crawler core (FastAPI-friendly, full code in subagent output)
import asyncio, aiohttp
from selectolax.parser import HTMLParser
from usp.tree import sitemap_tree_for_homepage
from crawlee.crawlers import AdaptivePlaywrightCrawler

async def http_phase(session, urls, conc=200):
    sem = asyncio.Semaphore(conc)
    async def one(u):
        async with sem, session.get(u, allow_redirects=True) as r:
            html = await r.text(errors="replace")
            tree = HTMLParser(html)
            needs_js = len(html) < 2000 or "/checkout" in u
            return u, {"title": tree.css_first("title").text(strip=True),
                       "needs_js": needs_js}, r.status
    return await asyncio.gather(*(one(u) for u in urls))

async def js_phase(urls):
    crawler = AdaptivePlaywrightCrawler.with_beautifulsoup_static_parser(
        max_requests_per_crawl=len(urls),
        concurrency_settings={"max_concurrency": 4})
    captured = []
    @crawler.router.default_handler
    async def h(ctx): captured.append({"url": ctx.request.url, "rendered": True})
    await crawler.run(urls); return captured
```

**Alternatives ranked.** (1) Crawlee Python + aiohttp hybrid — best fit. (2) DIY aiohttp + selectolax + ultimate-sitemap-parser — leanest, no JS fallback. (3) Crawl4AI 0.7.x (58k★, Apache 2.0, very active) with `LXMLWebScrapingStrategy` — good if site is JS-heavy and 4-minute SLA acceptable. (4) Firecrawl self-hosted — overkill, feature-handicapped, AGPL-3.0. (5) Jina Reader — fallback-only at 1–2% of URLs.

---

## 2. Lightweight graph database for 10M nodes and 1,000 isolated tenants

The "1000 tenants × ~10k nodes each" shape is FalkorDB's documented sweet spot, and FalkorDB ships as a Redis module — meaning it adds **zero new infrastructure** to a stack that already runs Redis. Per-tenant isolation is by Redis keyspace (one graph keyspace per tenant), which makes leakage physically impossible — there is no `WHERE tenant_id = ...` to forget.

**Recommended: FalkorDB 4.14.10+ (Redis module) with `falkordb-py 1.6.0` (Feb 21, 2026, Python ≥3.10).** Engine license is SSPLv1 (acceptable for SaaS unless reselling DB-as-a-service); Python client is MIT. **GraphBLAS sparse-matrix execution** delivers vendor-published p50 ~36 ms / p99 ~83 ms on Pokec (1.6M nodes / 30M edges) versus Neo4j's 469 ms / 41,157 ms on the same hardware — independently corroborated by Zep/Graphiti's "496× faster p99" report and Securin's 7-hop AI-security agent (0.3 s on complex queries that previously timed out). For 10k-node tenant graphs, 1–3 hop traversals are comfortably **sub-10 ms**. HNSW vector indexes are built in (any dimensionality, cosine/euclidean), enabling hybrid graph+vector queries in a single Cypher call.

**Critical configuration.** Setting `NODE_CREATION_BUFFER 1024` (down from default 16,384) is essential — the default reserves matrix slots per graph, which silently consumes multi-GB across 1,000 tenants. With this tweak, typical 10k-node tenants land at **6–15 MB resident each**, putting all 1,000 tenants in **8–15 GB of RAM** with comfortable headroom on a 32 GB VPS. Disk-side, ~50–150 GB realistic; the theoretical 1 TB worst case (every tenant maxes the 1 GB cap) **does not fit** — enforce caps via `GRAPH.MEMORY USAGE`.

**KuzuDB is gone.** The original repo was archived October 9, 2025 after the Apple acquisition (last release v0.11.3). The community fork **LadybugDB v0.15** (Mar 2026, MIT, `pip install real_ladybug`) is the only viable continuation and added Bolt protocol Nov 2025, but has no corporate backing — production risk is real per ArcadeDB and gdotv coverage. Use it only for embedded analytical workloads where database-file-per-tenant is desirable. **SurrealDB 3.0** is faster than 2.x (graph queries 8–22×, HNSW vector 8×) but BSL 1.1 license and mixed real-world performance reports keep it off the recommendation list. **SQLite + recursive CTEs** falls apart at 10k nodes/tenant (community benchmarks show 7+ seconds for sum-of-descendants on a 1M-node tree).

**Apache AGE 1.5.0 (Jan 21, 2026) on PostgreSQL 17** is the safe alternative if you want zero new infra and a true Apache-2.0 license. Crucially, AGE 1.5/1.7 finally added native **Row-Level Security** plus indexes on id columns. Multi-tenant pattern: single graph with `tenant_id` property + RLS policy. Tradeoff: 1–3 hop traversals on tenant subsets typically run 20–200 ms (3–5× slower than FalkorDB) and jsonb agtype overhead bloats disk to ~500 MB–1.5 GB per million nodes versus FalkorDB's 150–500 MB. Pair with `pgvector 0.8` in the same DB for embeddings.

**Multi-tenant isolation patterns ranked.** Graph-per-tenant via Redis keyspace (FalkorDB) is the clear winner — zero leakage by construction, per-tenant `GRAPH.MEMORY USAGE`, trivial copy/delete. DB-file-per-tenant (LadybugDB) is best for OLAP/cold-tenant workloads. Shared graph + RLS (AGE) is best when the stack is already Postgres-heavy. Schema-per-tenant strains Postgres catalog at 1,000 schemas. Label-per-tenant in one graph is an anti-pattern.

```python
# FalkorDB graph-per-tenant with hybrid graph + vector query
from falkordb.asyncio import FalkorDB
from redis.asyncio import BlockingConnectionPool

pool = BlockingConnectionPool(host="127.0.0.1", port=6379, max_connections=64)
db = FalkorDB(connection_pool=pool)

async def setup_tenant(tid: str):
    g = db.select_graph(f"t_{tid}")
    await g.query("CREATE INDEX FOR (p:Product) ON (p.sku)")
    await g.query("""CREATE VECTOR INDEX FOR (p:Product) ON (p.embedding)
                     OPTIONS {dimension:768, similarityFunction:'cosine',
                              M:16, efConstruction:200}""")

async def hybrid_search(tid: str, cat: str, qvec: list[float], k: int = 10):
    g = db.select_graph(f"t_{tid}")
    res = await g.query("""
        CALL db.idx.vector.queryNodes('Product','embedding',$k,vecf32($v))
          YIELD node AS p, score
        MATCH (p)-[:IN_CATEGORY]->(:Category {slug:$cat})
        RETURN p.sku, p.name, score ORDER BY score
    """, {"k": k*4, "v": qvec, "cat": cat})
    return res.result_set[:k]
```

**Alternatives ranked.** (1) FalkorDB 4.14 — best fit. (2) Postgres 17 + AGE 1.5 + pgvector 0.8 — Apache-2.0 fallback, no new infra. (3) LadybugDB per-tenant file — embedded/analytical. (4) SurrealDB 3.0 — multi-model bet. (5) Memgraph — fast but BSL+pricey, confirmed scaling pain on shared graphs (Feb 2026 Medium migration story). (6) ArcadeDB — true Apache-2.0 multi-model with MCP. (7) SQLite — too slow above 1k nodes/tenant. Avoid Neo4j Community for this density.

---

## 3. State of GraphRAG on a CPU-only VPS in 2026

**Microsoft GraphRAG (v3.0.9, Apr 13, 2026, 31.3k★) is still the reference but still expensive** — community-summarization at scale runs $200–$1,000+ to index a 10k-page e-commerce site with GPT-4o (LearnOpenCV's 32k-word book ran $6–7 with GPT-4o; scaling 156× lands in the $900–1,100 zone). DRIFT search and migration notebooks have improved, but minor-version bumps still require `--force` config resets. **LazyGraphRAG**, announced June 5, 2025 with claims of **0.1% of full GraphRAG indexing cost and 4% of query cost while outperforming on local+global**, is a real breakthrough — but **as of April 2026 it's only available inside Azure (Microsoft Discovery / Azure Local)**, not as a drop-in mode in the open-source `graphrag` PyPI package. Watch the repo, but don't plan around it yet.

**The right answer for a $50/mo CPU VPS is LightRAG v1.4.10 (HKUDS, 34.2k★, last commit Apr 24, 2026, EMNLP 2025 paper).** Its retrieval algorithm uses ~100 tokens and one API call per query versus GraphRAG's `n_communities × tokens_per_community`. Native incremental insert/delete with **automatic KG regeneration** (added Aug 2025) means indexing is fully resumable. Built-in reranker mode (Aug 2025), citation support (Mar 2025), document deletion, workspace isolation. Default backends are NetworkX + NanoVectorDB (works on CPU); for >50k entities switch to PostgreSQL + Apache AGE + pgvector via `PGGraphStorage`/`PGVectorStorage`.

**Indexing cost for 10k pages on LightRAG with GPT-4o-mini ($0.15/$0.60 per 1M tokens) is $8–14 one-time** — assuming ~5M corpus tokens (5,500 chunks at 1,200-token chunk size, 1.3× extraction multiplier). Embeddings via text-embedding-3-small (1536-dim) add $0.15. Steady state: $30 VPS (Hetzner CPX41, 8 vCPU/16 GB) + $5–15/mo LLM for ~5,000 keyword classifications. A full re-index every six months is rarely needed thanks to incremental updates.

**Alternatives.** **fast-graphrag (circlemind-ai, 3.6k★)** uses PageRank-style traversal — vendor benchmarks claim **6× cheaper indexing, 27× faster queries, and 96.1% perfect retrieval on 2WikiMultihopQA** (independent confirmation thin; treat as marketing). Maintenance has slowed (issues open since Feb 2025). **Neo4j GraphRAG v1.15 (Apr 23, 2026)** is excellent if you already speak Cypher and want explainable Text2Cypher retrievers, but Neo4j adds 2–4 GB RAM. **nano-graphrag is effectively unmaintained** (last release Oct 2024) — useful as pedagogical reference (~800 LOC), not production. **GraphRAG-Local-UI** is just a wrapper around Microsoft GraphRAG and inherits its cost problem. **TigerGraph CoPilot** requires TigerGraph server — eliminated by budget.

**Pipeline architecture for e-commerce keyword classification:** crawl with Crawlee (Q1) → clean with trafilatura → ingest into LightRAG with entity types `[product, category, brand, attribute, material, occasion, audience]` → query in `hybrid` mode (dual-level low-level entities + high-level themes + vector) → feed retrieved context into a strict-JSON GPT-4o-mini classification prompt that outputs `{primary_category, keywords[12], confidence}`. Optionally rerank with **bge-reranker-v2-m3** on CPU (~80–150 ms per pair). The published academic pattern (KG-HTC, arXiv 2505.05583 — and Shopify's published pipeline) confirms this two-stage approach: GraphRAG retrieves a candidate sub-tree of the taxonomy, a smaller LLM picks the leaf.

```python
# LightRAG e-commerce keyword classification (abbreviated)
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

rag = LightRAG(working_dir="./store",
    llm_model_func=gpt_4o_mini_complete, embedding_func=openai_embed,
    graph_storage="PGGraphStorage", vector_storage="PGVectorStorage",
    chunk_token_size=1200, chunk_overlap_token_size=100, enable_llm_cache=True,
    addon_params={"entity_types": ["product","category","brand",
                                   "attribute","material","occasion","audience"]})
await rag.initialize_storages()
ctx = await rag.aquery(page_text[:1500],
    param=QueryParam(mode="hybrid", only_need_context=True, top_k=20))
# ...feed ctx + page into JSON-strict gpt-4o-mini classifier
```

**Critical caveat.** Local LLMs on CPU (Qwen3-30B-A3B, Llama-3.1-8B via Ollama) work for orchestration but **indexing 10k pages would take 2–5 days wall clock**. Use cloud LLM APIs for entity extraction and keep the VPS busy with crawling, storage, retrieval, and reranking. Also: LightRAG silently fails when the LLM context is below 32k — Ollama's default 8k breaks it. Set context explicitly in the Modelfile.

---

## 4. Hierarchical multilingual embeddings for Lithuanian + English

A flat embedding index over 10,000+ heterogeneous products is too coarse: cross-category cosine collisions dominate the noise floor (e.g. "vaikiškas megztinis" can land near unrelated knits), and **Lithuanian's seven-case morphology amplifies lexical noise**. Two-stage retrieval — category routing first, in-category dense search second — is the published industry pattern (Best Buy, JD.com UniERF, Taobao ULIM, eBay CoT-BFS, the CHARM paper arXiv 2501.18707).

**Recommended stack: `intfloat/multilingual-e5-base` (278M params, 768-dim, MIT) in INT8 ONNX**, with category-centroid prototypes (arXiv 2510.21711 "Trainable Category Prototypes") routing queries into per-category FAISS HNSW shards, vectors PCA-truncated to 384 dims for storage. Throughput on a 4 vCPU VPS lands at **~80 docs/sec INT8** at ~1.2 GB RAM, leaving headroom for FAISS, Postgres, and the FastAPI server. For higher Lithuanian quality at the same hardware, swap to **`jinaai/jina-embeddings-v3`** (572M, 1024-dim Matryoshka, 8K context) at ~10–20 docs/sec INT8 — and slice `[:384]` natively rather than fitting PCA.

**Lithuanian quality is not what the multilingual-MTEB averages suggest.** The only published controlled Lithuanian benchmark — **arXiv 2604.14907 (LtHate, 12k Lithuanian comments, hate-speech retrieval)** — found **jina-embeddings-v3 best (Cohen's κ 0.62, AUC-ROC 0.887)**, with multilingual-e5-large-instruct, BGE-M3, and Snowflake Arctic close behind. **EmbeddingGemma-300m, despite being SOTA on MMTEB averages, performs surprisingly poorly on Lithuanian** — outperformed by the tiny Potion model. **SPLADE v3 is English-centric** and a poor fit. **ColBERT v2 / RAGatouille** is English-strong (use JinaColBERT v2 for multilingual), but multi-vector storage bloats 10× — reserve for top-N rerank rather than primary retrieval.

**Cost analysis is essentially noise at this scale.** Embedding 10,000 products × ~200 tokens = 2M tokens runs $0.04 (OpenAI text-embedding-3-small) to $0.36 worst case (OpenAI text-embedding-3-large). **Voyage AI's 200M-token free tier and Jina v3's 10M-token free tier mean indexing is effectively $0 from any modern API.** The decision is therefore not about indexing price but about **query-time CPU pressure** and **Lithuanian quality**. The hybrid pattern: index once via Jina v3 free API (or self-hosted weights), then run only the query encoder locally via ONNX so the hot path doesn't depend on a third party.

| Provider/model | Cost / 1M tokens | Lithuanian | Notes |
|---|---|---|---|
| Self-host multilingual-e5-base (INT8) | $0 | Good | ~80 docs/s, 1.2 GB RAM |
| Self-host jina-embeddings-v3 | $0 | **Best** | ~15-25 docs/s INT8, CC-BY-NC-4.0 weights |
| Voyage 4-lite / 3.5 API | Free up to 200M | Good | Best free-tier value |
| Jina embeddings v3 API | $0.02 (10M free) | **Best** | Matches local model |
| Cohere embed-multilingual-v3 / v4 | $0.10 / $0.12 | Good | 100+ langs |
| OpenAI text-embedding-3-small | $0.02 | Weak | Convenient but mediocre LT |
| Mistral embed | $0.10 | Undocumented | Skip |
| Anthropic | n/a | n/a | No embedding API; recommends Voyage |

```python
# Hierarchical retriever core (full code in subagent output)
from sentence_transformers import SentenceTransformer
import numpy as np, faiss

class CategoryRouter:
    def fit(self, vecs_by_cat):
        self.cats = list(vecs_by_cat); self.C = np.stack([
            (m := np.mean(np.stack(v), 0)) / (np.linalg.norm(m)+1e-9)
            for v in vecs_by_cat.values()]).astype(np.float32)
    def route(self, qvec, k=3):
        idx = np.argpartition(-(self.C @ qvec), k)[:k]
        return [self.cats[i] for i in idx]

class HierarchicalRetriever:
    def __init__(self):
        self.enc = SentenceTransformer("intfloat/multilingual-e5-base", device="cpu")
        self.shards = {}
    def encode(self, texts, kind="passage"):
        return self.enc.encode([f"{kind}: {t}" for t in texts],
                               normalize_embeddings=True).astype(np.float32)
    # ...build per-category HNSW shards on truncated 384-dim vectors,
    # route at full 768-dim, search in truncated space inside top-3 shards.
```

**Alternatives ranked.** (1) multilingual-e5-base + FAISS + hierarchical router — best fit. (2) jina-embeddings-v3 (open weights or free API) — best Lithuanian quality. (3) BGE-M3 dense+sparse hybrid — morphology-friendly, 8K ctx. (4) Voyage-3.5 / 4-lite API — zero ops, free tier. (5) Cohere v3/v4 API — convenient. (6) multilingual-e5-large — borderline RAM. (7) **Avoid for Lithuanian:** EmbeddingGemma, SPLADE v3, OpenAI text-embedding-3-large, Mistral embed.

**Mandatory implementation detail.** E5 models require `"query: "` and `"passage: "` prefixes; omitting them drops accuracy 5–10%. Add `bge-reranker-v2-m3` on top-50 candidates for an extra +3–8 points recall@10 at ~80 ms per (query, candidate) pair on AVX2 CPU. MTEB rankings shift monthly — verify the live leaderboard before final selection; April 2026's MMTEB leaders (NVIDIA llama-embed-nemotron-8B, Qwen3-Embedding-8B, Microsoft Harrier-OSS-v1) all need GPU and are out of reach on this VPS.

---

## 5. Cheapest 100M-vector multi-tenant search at scale

**Honest math first.** 100M vectors × 768 dim × 4 bytes = **307 GB raw float32**; at 1536 dim, 614 GB. There is no universe in which this fits in 32 GB of RAM uncompressed. The $50/mo VPS is feasible **only with disk-resident indexes plus aggressive quantization**. Anything that tries to keep full-precision HNSW in RAM (vanilla pgvector HNSW, Chroma, Milvus Standalone, Weaviate without offloading) **will not fit**. Most "100M-vector low-latency" benchmarks circulating in 2026 come from cloud clusters with 256+ GB total RAM — vendor numbers will not match a single 32 GB box.

**Recommended: Postgres 17 + pgvector 0.8 + pgvectorscale 0.6+ (StreamingDiskANN with Statistical Binary Quantization), `halfvec(768)` storage, single multi-tenant table keyed by `tenant_id`, on Hetzner CX52 (16 vCPU shared / 32 GB / 320 GB NVMe / €32 ≈ $35/mo).** This stack reuses the Postgres + Redis + Python you already run, adds zero new services, and is the only OSS path that matches Pinecone-class latency at \<\$50. The Timescale benchmark (50M Cohere 768d) reports **471 QPS at 99% recall, 28× lower p95 than Pinecone s1, 75% cheaper self-hosted on AWS**. SBQ provides ~32× compression with reranking via on-disk full-precision vectors. pgvector 0.8 added **iterative scans** (critical for filtered multi-tenant queries) and `halfvec` (50% storage reduction with near-zero recall loss on normalized embeddings).

**Storage math at 100M vectors.** Raw float32 768d: 307 GB ❌. halfvec 768d: 154 GB ❌ in RAM but ✅ on 320 GB SSD. SBQ binary: 9.6 GB at 768d / 19.2 GB at 1536d — fits in RAM. **Total disk footprint with pgvectorscale SBQ + halfvec on disk + DiskANN graph: ~25–40 GB (768d) or ~50–70 GB (1536d).** Comfortable on CX52. If embeddings are 1536d and not Matryoshka-truncatable, verify your VPS has ≥320 GB SSD.

**Multi-tenant pattern.** All 100 tenants are similar size (~1M each, no whales) — so the optimal pattern is **single collection + `tenant_id` filter with partial DiskANN indexes (or label-based filtered DiskANN built on Microsoft's research)**. Don't bother with per-tenant collections or sharding complexity. The Qdrant equivalent is `is_tenant=true` keyword payload index with `m=0, payload_m=16` HNSW config (the official "many small/medium tenants" recipe).

**Qdrant 1.16 (Nov 2025) is the strong runner-up** with the new **Tiered Multitenancy + ACORN filtered HNSW**. Memory at 100M × 768d with binary quantization + `on_disk=True` + `always_ram=True` (only quantized vectors in RAM): ~10–12 GB quantized + a few GB HNSW graph + originals on disk = **fits in 32 GB**. Apache 2.0, 25k★, 1.5/2-bit BQ added in 1.16. Pick this if you outgrow Postgres or need named multi-vector / hybrid sparse-dense.

**LanceDB embedded with IVF_PQ, one Lance dataset per tenant** is the third viable path — pure mmap/disk, "no RAM ceiling," verified at 700M vectors in production on modest hardware (sprytnyk.dev 2025). 2026 brought SDK 1.0 GA and Lance format v2.2 (50% storage cut). With 100 tenants × 1M vectors, each tenant becomes its own folder on disk that loads lazily on query — perfect compliance/isolation story. Self-hosted is free; LanceDB Cloud is usage-based with no monthly minimum but quickly exceeds $50 at this volume.

**Eliminated options.** Milvus Lite is officially capped at "less than a million vectors"; full Milvus Standalone realistically needs ≥64 GB RAM. Chroma is "out of its depth at 100M vectors" per multiple 2026 reviews. Weaviate's RQ default still lands ~100 GB/100M @ 1024d in RAM — only viable with S3 tenant offloading and a $80+/mo box, with cold-tenant rehydration latency. Pinecone Serverless costs ≥$165/mo just for storage at 100M. Turbopuffer's $64 entry tier is over budget but architecturally ideal — add to the roadmap. Neon's pg_embedding has been effectively abandoned (Neon themselves now recommend pgvector + halfvec).

```sql
-- pgvector + pgvectorscale multi-tenant DDL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;

CREATE TABLE chunks (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id INT  NOT NULL,
    doc_id    BIGINT, content TEXT,
    embedding halfvec(768) NOT NULL);
CREATE INDEX ON chunks(tenant_id);
CREATE INDEX ON chunks USING diskann (embedding halfvec_cosine_ops)
  WITH (storage_layout = 'memory_optimized');

-- Postgres tuning on 32 GB box
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
ALTER SYSTEM SET maintenance_work_mem = '6GB';   -- bump while building DiskANN
```

```python
def search(tenant_id, qvec, k=10):
    sql = """SET LOCAL diskann.query_rescore = 50;
             SELECT id, doc_id, content, 1 - (embedding <=> %s::halfvec) AS score
             FROM chunks WHERE tenant_id = %s
             ORDER BY embedding <=> %s::halfvec LIMIT %s;"""
    with get_conn() as c, c.cursor() as cur:
        cur.execute(sql, (qvec.astype('float16'), tenant_id,
                          qvec.astype('float16'), k))
        return cur.fetchall()
```

**Alternatives ranked.** (1) Postgres + pgvector + pgvectorscale + halfvec + SBQ — best fit, $35/mo. (2) Qdrant self-hosted + BQ + on_disk + payload MT — $35–45/mo, best filtered HNSW. (3) LanceDB embedded dataset-per-tenant — $25–35/mo, weaker concurrent QPS. (4) Weaviate + RQ + S3 offloading — $50/mo total, excellent MT semantics, JVM tuning required. (5) pgvector HNSW alone (no scale) — borderline; recall struggles at 100M. (6) Turbopuffer managed — $64+, ideal architecture, over budget. Eliminated: Milvus Lite, Chroma, Pinecone.

**Critical caveats.** DiskANN index *build* is RAM-heavy — set `maintenance_work_mem ≥ 6GB` and expect several hours for 100M vectors; build incrementally per tenant. NVMe is mandatory (never network EBS or spinning disk). For sustained >100 QPS or 1536d non-truncatable embeddings, plan to ~double the budget to $80–150/mo (CCX33 or AX42). Qdrant 1.16's Tiered Multitenancy is the future-proof choice if tenant sizes become skewed.

---

## Putting it all together: a concrete reference architecture

A single Hetzner-class VPS in 2026 can host the whole pipeline if responsibilities are split deliberately. **Crawler box (Hetzner CPX32, $14/mo)** runs Crawlee + aiohttp and dumps clean text into a queue. **Main box (Hetzner CX52, $35/mo)** runs Postgres 17 (pgvector 0.8 + pgvectorscale 0.6 + Apache AGE 1.5), Redis with the FalkorDB module, FastAPI/uvicorn, and ONNX-INT8 multilingual-e5-base for query-time encoding. LightRAG orchestrates the GraphRAG indexing pipeline calling GPT-4o-mini for entity extraction. Total infrastructure: **~$49/mo, inside the budget** with roughly $5–15/mo of LLM API spend per active client. Per-tenant cost works out to **~$0.05/tenant/month** of infrastructure at full 1,000-tenant utilization.

The three architectural commitments that make this work are non-obvious and worth restating: (1) **HTTP-first crawling with adaptive JS fallback** is the only way to hit the 2-minute SLA on CPU; (2) **graph-per-tenant via Redis keyspace** eliminates an entire class of multi-tenant bugs while costing 8–15 GB of RAM total; and (3) **disk-resident DiskANN with binary quantization** is the only OSS path to 100M vectors on 32 GB. Every other lever — embedding API choice, GraphRAG library, hierarchical routing — is tunable; these three are load-bearing.

## Conclusion: what's changed since 2024

Two years of GraphRAG hype have produced a clear winner for cost-sensitive deployments — **LightRAG, not Microsoft GraphRAG** — and Microsoft's own LazyGraphRAG announcement quietly concedes that the original community-summarization approach was 1,000× over-priced. The Kuzu archival in October 2025 was the year's biggest stability surprise; FalkorDB has emerged as the practical default for graph-per-tenant SaaS thanks to GraphBLAS performance and Redis-native ops. On the vector side, **pgvectorscale's StreamingDiskANN with SBQ has effectively closed the cost gap with Pinecone Serverless** — at 75% lower cost on the same recall — making Postgres-resident vector search the new default rather than a compromise. For Lithuanian and other low-resource languages, MMTEB averages remain dangerously misleading: **jina-embeddings-v3 dominates** the only published Lithuanian benchmark while EmbeddingGemma underperforms tiny Potion. And throughout, the most impactful 2025–2026 architectural lever has been **quantization + disk-residency + adaptive routing** rather than bigger models or more RAM — exactly the right shape for a $50/month CPU-only VPS.
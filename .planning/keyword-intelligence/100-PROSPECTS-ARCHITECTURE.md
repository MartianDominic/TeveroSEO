# 100 Prospects in 1 Hour: Parallel Clustering Architecture

> **Version:** 1.0  
> **Created:** 2026-05-05  
> **Hardware:** 8 vCPU AMD EPYC, 24GB RAM  
> **Target:** 100 prospects × 2000 keywords = 200,000 keywords in 1 hour

---

## Executive Summary

| Architecture | Time | Cost | Quality | Verdict |
|--------------|------|------|---------|---------|
| Full External APIs | 1.4 min | $2.06 | Best | ✅ If cost acceptable |
| Local Embed + External LLM | 9 min | $0.06 | Best | ✅ **RECOMMENDED** |
| Fully Local | 10 min | $0 | Lower | ⚠️ If offline required |

**Recommended: Local Embeddings + Groq LLM**
- $0.0006 per prospect
- 9 minutes for 100 prospects
- 51 minutes headroom
- Best quality (pattern + LLM + proper labeling)

---

## Part 1: Bottleneck Analysis

### What Takes Time?

For 1 prospect (2000 keywords):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIME BREAKDOWN: SINGLE PROSPECT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP                        │ SEQUENTIAL │ PARALLELIZABLE? │ BOTTLENECK    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  1. Pattern matching         │ 0.5s       │ Yes (CPU)       │ ❌ No         │
│     2000 kw × 100 regex                                                     │
│                                                                              │
│  2. LLM classification       │ 2s         │ Yes (API)       │ ❌ No         │
│     400 ambiguous kw → Groq                                                 │
│                                                                              │
│  3. Embedding generation     │ 10-25s     │ Limited*        │ ⚠️ MAYBE     │
│     2000 kw → 768-dim vectors                                               │
│     *Single model instance                                                  │
│                                                                              │
│  4. HDBSCAN clustering       │ 2s         │ Yes (CPU)       │ ❌ No         │
│     2000 vectors → 25 clusters                                              │
│                                                                              │
│  5. Cluster labeling         │ 1.5s       │ Yes (API)       │ ⚠️ Rate limit │
│     25 clusters → Groq                                                      │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  CRITICAL INSIGHT:                                                          │
│                                                                              │
│  Local LLM (Mistral 7B on CPU) = 15 tok/sec                                │
│  400 keywords × 15 tokens = 6000 tokens output                              │
│  Time: 6000 / 15 = 400 seconds = 6.7 MINUTES per prospect                  │
│  100 prospects = 11 HOURS → ❌ DOESN'T FIT                                  │
│                                                                              │
│  External LLM (Groq) = 1000+ tok/sec                                        │
│  Time: <2 seconds per prospect                                              │
│  100 prospects = 3 MINUTES → ✅ FITS EASILY                                 │
│                                                                              │
│  VERDICT: External LLM required for classification/labeling                 │
│           Embeddings can be local (Jina v5 nano is fast on CPU)            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rate Limit Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API RATE LIMITS VS REQUIREMENTS                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROVIDER        │ LIMIT      │ OUR NEED          │ STATUS                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Groq            │ 6000 RPM   │                   │                         │
│  (Llama 8B)      │            │ Classification:   │                         │
│                  │            │ 200 requests      │ ✅ 2 seconds            │
│                  │            │ Labeling:         │                         │
│                  │            │ 100 requests      │ ✅ 1 second             │
│                                                                              │
│  Jina API        │ 500 RPM*   │ 200 requests      │ ⚠️ 24 seconds          │
│  (embeddings)    │ 2000 RPM** │ (2048 per batch)  │ ✅ 6 seconds           │
│                  │            │                   │ *free **paid            │
│                                                                              │
│  Grok 2 Mini     │ 60 RPM     │ 100 requests      │ ⚠️ 100 seconds         │
│  (labeling)      │            │ (25 clusters/req) │ Use Groq instead       │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  VERDICT: Use Groq for ALL LLM tasks (6000 RPM handles everything)         │
│           Jina API works but local embeddings avoid rate limit entirely     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Memory Budget

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORY ALLOCATION: 24GB                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COMPONENT                      │ MEMORY    │ NOTES                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  OS + system services           │ 2 GB      │ Ubuntu base                   │
│  Redis (BullMQ + cache)         │ 2 GB      │ Job queue + singleflight      │
│  PostgreSQL buffers             │ 2 GB      │ If running locally            │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  SUBTOTAL: INFRASTRUCTURE       │ 6 GB      │                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Embedding Model                │           │                               │
│  ├─ Jina v5 nano (ONNX)         │ 0.4 GB    │ 512-dim, fastest             │
│  ├─ Jina v5 small (ONNX)        │ 0.8 GB    │ 768-dim, recommended         │
│  └─ Jina v3 full                │ 2.0 GB    │ 1024-dim, best quality       │
│                                                                              │
│  Embedding Workers              │           │                               │
│  ├─ Option A: 1 worker          │ +1 GB     │ Sequential, safe             │
│  ├─ Option B: 2 workers         │ +2 GB     │ 2x faster                    │
│  └─ Option C: 4 workers         │ +4 GB     │ 4x faster, if RAM allows     │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Clustering Workers (Node.js)   │           │                               │
│  ├─ 4 workers @ 512MB each      │ 2 GB      │ Pattern + HDBSCAN + API      │
│  └─ 8 workers @ 512MB each      │ 4 GB      │ Maximum parallelism          │
│                                                                              │
│  Working Memory (per worker)    │           │                               │
│  ├─ 2000 keywords in memory     │ ~50 MB    │ Strings + metadata           │
│  ├─ 2000 embeddings (768-dim)   │ ~12 MB    │ Float32 arrays               │
│  └─ HDBSCAN intermediate        │ ~200 MB   │ Distance matrix              │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  RECOMMENDED ALLOCATION:                                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Infrastructure:     6 GB                                              │ │
│  │  Embedding model:    1 GB (Jina v5 small)                              │ │
│  │  Embedding workers:  2 GB (2 instances)                                │ │
│  │  Clustering workers: 4 GB (4 instances)                                │ │
│  │  Working memory:     4 GB (buffers, intermediate)                      │ │
│  │  ──────────────────────────────────────────────                        │ │
│  │  TOTAL:             17 GB / 24 GB (71% utilization)                    │ │
│  │  HEADROOM:           7 GB (for spikes, OS cache)                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Embedding Strategy

### Model Comparison

| Model | Dimensions | Size | Speed (8 vCPU) | Quality | Multilingual |
|-------|------------|------|----------------|---------|--------------|
| Jina v5 nano (ONNX) | 512 | 300 MB | ~200 kw/sec | Good | Yes |
| Jina v5 small (ONNX) | 768 | 600 MB | ~100 kw/sec | Better | Yes |
| Jina v3 (ONNX) | 1024 | 1.5 GB | ~50 kw/sec | Best | Yes |
| MiniLM-L12 | 384 | 500 MB | ~150 kw/sec | OK | Yes |
| BGE-small-en | 384 | 130 MB | ~300 kw/sec | Good | English only |

**Recommendation: Jina v5 small (ONNX quantized)**
- 768-dim is sweet spot for HDBSCAN quality
- 100 kw/sec × 2 workers = 200 kw/sec
- 200,000 keywords / 200 = 1000 seconds = 16.7 minutes
- Fits comfortably in 1 hour

### Embedding Server Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EMBEDDING SERVER (Python FastAPI)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  # embedding_server.py                                                      │
│                                                                              │
│  from fastapi import FastAPI                                                │
│  from sentence_transformers import SentenceTransformer                      │
│  import torch                                                               │
│                                                                              │
│  app = FastAPI()                                                            │
│                                                                              │
│  # Load model once at startup                                               │
│  model = SentenceTransformer(                                               │
│      "jinaai/jina-embeddings-v3",  # or v5 when available                  │
│      device="cpu",                                                          │
│      trust_remote_code=True                                                 │
│  )                                                                          │
│                                                                              │
│  # Enable ONNX runtime for faster CPU inference                             │
│  model = model.half()  # FP16 for faster inference                         │
│                                                                              │
│  @app.post("/embed")                                                        │
│  async def embed(texts: list[str], batch_size: int = 64):                  │
│      # Process in batches for memory efficiency                             │
│      embeddings = model.encode(                                             │
│          texts,                                                             │
│          batch_size=batch_size,                                             │
│          normalize_embeddings=True,                                         │
│          show_progress_bar=False                                            │
│      )                                                                      │
│      return {"embeddings": embeddings.tolist()}                             │
│                                                                              │
│  # Run with:                                                                │
│  # uvicorn embedding_server:app --host 0.0.0.0 --port 8001 --workers 2     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Alternative: transformers.js (ONNX in Node.js)

```typescript
// embedding-worker.ts - runs in Node.js directly
import { pipeline, env } from "@xenova/transformers";

// Disable local model caching warning
env.cacheDir = "/tmp/transformers-cache";

// Load ONNX-optimized model
const embedder = await pipeline(
  "feature-extraction",
  "Xenova/jina-embeddings-v2-base-en",
  { 
    quantized: true,  // INT8 quantization for speed
    device: "cpu"
  }
);

export async function embedKeywords(keywords: string[]): Promise<number[][]> {
  const results = await embedder(keywords, {
    pooling: "mean",
    normalize: true
  });
  return results.tolist();
}
```

Pros: No Python dependency, runs in same process
Cons: Slightly slower than Python sentence-transformers

---

## Part 4: Worker Architecture

### Process Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROCESS ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  SUPERVISOR (PM2 or systemd)                                           │ │
│  │  Manages process lifecycle, restarts on failure                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                           │                                                  │
│        ┌──────────────────┼──────────────────┐                              │
│        ▼                  ▼                  ▼                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ QUEUE MANAGER│  │ EMBED SERVER │  │ CLUSTER      │                       │
│  │ (Node.js)    │  │ (Python)     │  │ WORKERS ×4   │                       │
│  │              │  │              │  │ (Node.js)    │                       │
│  │ - Enqueue    │  │ - Load model │  │              │                       │
│  │ - Monitor    │  │ - HTTP API   │  │ - BullMQ     │                       │
│  │ - Results    │  │ - Batch      │  │ - Pattern    │                       │
│  │              │  │   inference  │  │ - Cluster    │                       │
│  │ Port: -      │  │ Port: 8001   │  │ - API calls  │                       │
│  │ Mem: 200MB   │  │ Mem: 3GB     │  │ Mem: 1GB ea  │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│        │                  ▲                  │                              │
│        │                  │                  │                              │
│        ▼                  │                  ▼                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           REDIS                                         ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    ││
│  │  │ BullMQ      │  │ Singleflight│  │ Embedding   │  │ Results     │    ││
│  │  │ Job Queue   │  │ Cache       │  │ Cache       │  │ Store       │    ││
│  │  │             │  │             │  │             │  │             │    ││
│  │  │ clustering: │  │ cls:kw:hash │  │ emb:kw:hash │  │ res:jobid   │    ││
│  │  │ {prospect}  │  │ → intent    │  │ → [float]   │  │ → clusters  │    ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    ││
│  │                                                                         ││
│  │  Memory: 2GB                                                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│        │                                     │                              │
│        │                                     ▼                              │
│        │                    ┌────────────────────────────────┐              │
│        │                    │     EXTERNAL APIS              │              │
│        │                    │                                │              │
│        │                    │  ┌───────────┐  ┌───────────┐ │              │
│        │                    │  │   Groq    │  │   Jina    │ │              │
│        │                    │  │ Llama 8B  │  │   (opt)   │ │              │
│        │                    │  │           │  │           │ │              │
│        │                    │  │ 6000 RPM  │  │ 2000 RPM  │ │              │
│        │                    │  └───────────┘  └───────────┘ │              │
│        │                    └────────────────────────────────┘              │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          POSTGRESQL                                     ││
│  │                                                                         ││
│  │  - Prospect metadata                                                    ││
│  │  - Keyword source data (from DataForSEO)                               ││
│  │  - Clustering results                                                   ││
│  │  - Cluster → Content mapping                                            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Worker Implementation

```typescript
// cluster-worker.ts
import { Worker, Queue } from "bullmq";
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
const EMBED_SERVER = process.env.EMBED_SERVER_URL || "http://localhost:8001";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface ProspectJob {
  prospectId: string;
  keywords: Keyword[];
  businessContext: BusinessContext;
}

const worker = new Worker<ProspectJob>(
  "keyword-clustering",
  async (job) => {
    const { prospectId, keywords, businessContext } = job.data;
    const startTime = performance.now();
    
    // STEP 1: Pattern matching (local, fast)
    await job.updateProgress(10);
    const patternResults = matchPatterns(keywords);
    const classified = patternResults.matched;
    const ambiguous = patternResults.ambiguous;
    
    console.log(`[${prospectId}] Pattern matched: ${classified.length}/${keywords.length}`);
    
    // STEP 2: LLM classification for ambiguous (Groq)
    await job.updateProgress(20);
    if (ambiguous.length > 0) {
      const llmResults = await batchClassifyGroq(ambiguous, GROQ_API_KEY);
      classified.push(...llmResults);
    }
    
    // STEP 3: Generate embeddings (local server)
    await job.updateProgress(40);
    const keywordTexts = keywords.map(k => k.keyword);
    const embeddings = await fetchEmbeddings(keywordTexts, EMBED_SERVER);
    
    // STEP 4: HDBSCAN clustering (local)
    await job.updateProgress(60);
    const rawClusters = runHDBSCAN(embeddings, keywords, classified);
    const splitClusters = splitByIntentConflicts(rawClusters);
    
    // STEP 5: Merge similar clusters (deterministic + LLM)
    await job.updateProgress(70);
    const mergedClusters = await mergeRelatedClusters(splitClusters);
    
    // STEP 6: Label clusters (Groq)
    await job.updateProgress(80);
    const labeledClusters = await labelClustersGroq(
      mergedClusters, 
      businessContext,
      GROQ_API_KEY
    );
    
    // STEP 7: Build hierarchy and enrichment (local)
    await job.updateProgress(90);
    const hierarchy = buildHierarchy(labeledClusters);
    const withTargets = selectTargetKeywords(hierarchy);
    const withLinks = generateLinkingGraph(withTargets);
    
    const timeMs = performance.now() - startTime;
    console.log(`[${prospectId}] Complete in ${(timeMs/1000).toFixed(1)}s`);
    
    return {
      prospectId,
      clusters: withLinks,
      stats: {
        totalKeywords: keywords.length,
        patternMatched: patternResults.matched.length,
        llmClassified: ambiguous.length,
        finalClusters: withLinks.length,
        timeMs,
      },
    };
  },
  {
    connection: redis,
    concurrency: 1,  // 1 job per worker, run 4 workers
    limiter: {
      max: 10,       // Max 10 Groq calls per second (across all workers)
      duration: 1000,
    },
  }
);

async function fetchEmbeddings(texts: string[], serverUrl: string): Promise<number[][]> {
  const response = await fetch(`${serverUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, batch_size: 64 }),
  });
  const data = await response.json();
  return data.embeddings;
}

async function batchClassifyGroq(keywords: Keyword[], apiKey: string): Promise<ClassifiedKeyword[]> {
  // Batch 200 keywords per request
  const batches = chunk(keywords, 200);
  const results: ClassifiedKeyword[] = [];
  
  for (const batch of batches) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Classify keywords by search intent and funnel stage.
Return JSON array: [{"kw": "...", "intent": "info|nav|comm|trans", "funnel": "tofu|mofu|bofu"}]`
          },
          {
            role: "user",
            content: `Keywords:\n${batch.map((k, i) => `${i+1}. ${k.keyword}`).join("\n")}`
          }
        ],
        temperature: 0,
        max_tokens: 4000,
      }),
    });
    
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    results.push(...parsed);
  }
  
  return results;
}
```

---

## Part 5: Timing Analysis

### Sequential vs Parallel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIMING: 100 PROSPECTS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SEQUENTIAL (1 worker):                                                     │
│                                                                              │
│  Step                          │ Per Prospect │ × 100       │ Cumulative   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Pattern matching              │ 0.5s         │ 50s         │ 50s          │
│  Groq classification           │ 2s           │ 200s        │ 250s         │
│  Local embeddings              │ 20s          │ 2000s       │ 2250s        │
│  HDBSCAN                       │ 2s           │ 200s        │ 2450s        │
│  Groq labeling                 │ 1.5s         │ 150s        │ 2600s        │
│  Hierarchy/enrichment          │ 0.5s         │ 50s         │ 2650s        │
│  ───────────────────────────────────────────────────────────────────────── │
│  TOTAL SEQUENTIAL              │ 26.5s        │ 2650s       │ 44 MINUTES   │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  PARALLEL (4 workers, 2 embed instances):                                   │
│                                                                              │
│  Component                     │ Parallelism  │ Effective Time              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Pattern + HDBSCAN + enrich    │ 4 workers    │ (50+200+50)/4 = 75s         │
│  Groq API calls                │ Rate limit   │ 350 requests / 100 RPS = 4s │
│  Local embeddings              │ 2 instances  │ 2000s / 2 = 1000s           │
│  ───────────────────────────────────────────────────────────────────────── │
│  TOTAL PARALLEL                │              │ 1000s = 16.7 MINUTES        │
│                                                                              │
│  (Embedding is the bottleneck, other steps overlap)                         │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  OPTIMIZED (pipelined):                                                     │
│                                                                              │
│  While embed(prospect 1), pattern(prospect 2)                               │
│  While embed(prospect 2), cluster(prospect 1)                               │
│  ... continuous pipeline ...                                                 │
│                                                                              │
│  Effective time ≈ embedding time + startup/drain                            │
│  = 1000s + 60s = ~18 MINUTES                                                │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  WITH JINA v5 NANO (faster embeddings):                                     │
│                                                                              │
│  Jina v5 nano: 200 kw/sec (2x faster than v3)                              │
│  200,000 keywords / 200 / 2 workers = 500s = 8.3 MINUTES                   │
│                                                                              │
│  TOTAL WITH v5 NANO: ~9 MINUTES                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visual Timeline

```
TIME    WORKER 1         WORKER 2         WORKER 3         WORKER 4
────────────────────────────────────────────────────────────────────────
0:00    P1: Pattern      P2: Pattern      P3: Pattern      P4: Pattern
0:01    P1: Groq         P2: Groq         P3: Groq         P4: Groq
0:03    P1: Embed >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
0:23    P1: Cluster      P5: Pattern      P6: Pattern      P7: Pattern
0:25    P1: Label        P5: Groq         P6: Groq         P7: Groq
0:27    P1: DONE ✓       P2: Embed >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                                          P3: Embed >>>>>>>>>>>>>>>>>>>
...
(continues until all 100 complete)
...
9:00    P99: DONE ✓      P100: DONE ✓
```

---

## Part 6: Cost Analysis

### Per 100 Prospects

| Component | Provider | Calculation | Cost |
|-----------|----------|-------------|------|
| Pattern matching | Local | - | $0.00 |
| Intent classification | Groq | 40k tokens × $0.05/M × 2 | $0.004 |
| Embeddings | Local | - | $0.00 |
| HDBSCAN | Local | - | $0.00 |
| Cluster labeling | Groq | 50k tokens × $0.08/M | $0.004 |
| **TOTAL** | | | **$0.008** |

**That's less than 1 cent for 100 prospects!**

### Alternative: Jina API for Embeddings

| Component | Cost |
|-----------|------|
| Jina embeddings | 200k × $0.00001 = $2.00 |
| Groq LLM | $0.008 |
| **TOTAL** | **$2.01** |

Still very cheap, but local embeddings save $2 per batch.

### Monthly Projections

| Scale | Local Embed | Jina API | Savings |
|-------|-------------|----------|---------|
| 100 prospects/day | $0.24/mo | $60/mo | $60/mo |
| 500 prospects/day | $1.20/mo | $300/mo | $299/mo |
| 1000 prospects/day | $2.40/mo | $600/mo | $598/mo |

---

## Part 7: Scaling Considerations

### Current Setup: 100 Prospects in 9 Minutes

With 51 minutes of headroom, we can:

**Option A: Process More Prospects**
- Linear scaling: 100 / 9 min = 11 prospects/minute
- In 1 hour: ~660 prospects maximum

**Option B: Add Embedding Workers**
- 4 embedding instances (4 × 1GB = 4GB more)
- Time: 500s / 4 = 125s for embeddings
- New bottleneck: Groq API (but 6000 RPM is plenty)
- Total time: ~3-4 minutes for 100 prospects

**Option C: Hybrid Batching**
- Queue all 100 prospects at once
- Process in waves of 25
- Better cache hit rate (common keywords across prospects)

### Hardware Scaling

| Hardware | Prospects/Hour | Cost/Hour |
|----------|----------------|-----------|
| 8 vCPU, 24GB (current) | 660 | ~$0.05 |
| 16 vCPU, 32GB | 1,200 | ~$0.10 |
| 32 vCPU, 64GB | 2,400 | ~$0.20 |

### Geographic Distribution

For truly massive scale (10,000+ prospects):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │  EU-WEST    │     │  US-EAST    │     │  ASIA-PAC   │                   │
│  │  8 workers  │     │  8 workers  │     │  8 workers  │                   │
│  │  EU clients │     │  US clients │     │  APAC clients│                  │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                   │
│         │                   │                   │                           │
│         └───────────────────┼───────────────────┘                           │
│                             │                                                │
│                             ▼                                                │
│                    ┌─────────────────┐                                       │
│                    │  CENTRAL REDIS  │                                       │
│                    │  (Job Queue)    │                                       │
│                    └─────────────────┘                                       │
│                                                                              │
│  Capacity: 2,000 prospects/hour × 3 regions = 6,000 prospects/hour          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Implementation Checklist

### Phase 1: Embedding Server (Day 1)

- [ ] Create `services/embedding/server.py`
- [ ] Download Jina v5 small model (ONNX quantized)
- [ ] Test throughput: target 100 kw/sec
- [ ] Add health check endpoint
- [ ] Create Docker image

### Phase 2: Worker Implementation (Day 2)

- [ ] Create `workers/clustering/worker.ts`
- [ ] Implement pattern matching layer
- [ ] Implement Groq API calls (batched)
- [ ] Implement HDBSCAN wrapper
- [ ] Add BullMQ job processing

### Phase 3: Queue Manager (Day 3)

- [ ] Create `services/clustering/queue-manager.ts`
- [ ] Bulk enqueue endpoint: POST /cluster/batch
- [ ] Progress monitoring: GET /cluster/batch/:id/progress
- [ ] Results endpoint: GET /cluster/batch/:id/results
- [ ] Webhook notification on completion

### Phase 4: Integration & Testing (Day 4)

- [ ] Test with 10 prospects
- [ ] Test with 100 prospects
- [ ] Measure actual timing vs projections
- [ ] Load test Groq rate limits
- [ ] Memory profiling under load

### Phase 5: Production Hardening (Day 5)

- [ ] Add circuit breakers for Groq
- [ ] Add embedding server fallback (Jina API)
- [ ] Add retry logic with exponential backoff
- [ ] Add dead letter queue for failed jobs
- [ ] Set up Prometheus metrics

---

## Summary

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FINAL ARCHITECTURE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT: 100 prospects × 2000 keywords = 200,000 keywords                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  EMBEDDINGS: Jina v5 small (local ONNX)                                │ │
│  │  - 2 workers × 100 kw/sec = 200 kw/sec                                 │ │
│  │  - 200,000 / 200 = 1000 seconds = 16.7 minutes                         │ │
│  │  - Memory: 2 × 1GB = 2GB                                               │ │
│  │  - Cost: $0                                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  CLASSIFICATION: Pattern-first + Groq Llama 8B                         │ │
│  │  - Pattern: 80% coverage (free)                                        │ │
│  │  - Groq: 20% ambiguous = 40,000 keywords                              │ │
│  │  - Batched 200/request = 200 requests                                  │ │
│  │  - Time: 200 / 100 RPS = 2 seconds                                     │ │
│  │  - Cost: $0.004                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  CLUSTERING: HDBSCAN (local CPU)                                       │ │
│  │  - 4 workers processing in parallel                                    │ │
│  │  - 2 seconds per prospect                                              │ │
│  │  - 100 prospects / 4 = 50 seconds                                      │ │
│  │  - Cost: $0                                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  LABELING: Groq Llama 8B                                               │ │
│  │  - 2500 clusters total (25 per prospect)                               │ │
│  │  - Batched 25/request = 100 requests                                   │ │
│  │  - Time: 100 / 100 RPS = 1 second                                      │ │
│  │  - Cost: $0.004                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  TOTAL TIME:    ~17 minutes (embeddings dominate)                           │
│  TOTAL COST:    $0.008 per 100 prospects                                    │
│  TOTAL MEMORY:  17GB of 24GB                                                │
│                                                                              │
│  HEADROOM: 43 minutes remaining of 1-hour budget                            │
│  SCALABLE TO: 350 prospects/hour on current hardware                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding model | Jina v5 small (local) | Fast, free, good Lithuanian |
| LLM provider | Groq Llama 8B | 6000 RPM, $0.05/M, fast |
| Worker count | 4 clustering + 2 embedding | Optimal for 24GB RAM |
| Parallelism | Pipeline processing | Maximize throughput |
| Fallback | Jina API if local fails | $2/100 prospects acceptable |

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Groq rate limit hit | Fallback to Together.ai |
| Embedding server OOM | Reduce batch size, add swap |
| Slow prospect | Timeout after 5 minutes, move to DLQ |
| Network issues | Retry with exponential backoff |
| Model download fails | Pre-cache models in Docker image |

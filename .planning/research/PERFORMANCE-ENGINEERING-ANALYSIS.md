# Performance Engineering Analysis

**Analyst**: Opus 4.5 Performance Engineer
**Analysis Date**: 2026-05-04
**Focus**: Sub-second perceived response, 10K+ keyword batch handling, streaming optimization
**Current State**: 8-stage sequential pipeline, ~510ms total (stubs), SSE streaming with 15s heartbeat

**Related Document**: WORLD-CLASS-KEYWORD-ANALYSIS.md (Section 7)

---

## 1. Current Architecture Analysis

### Pipeline Execution Flow (Sequential)

```
Stage                          | Current Delay | Dependencies
-------------------------------|---------------|---------------
1. extracting_constraints      |    100ms      | conversation only
2. classifying_funnel          |     80ms      | keywords + constraints
3. classifying_geo             |     60ms      | keywords + constraints
4. scoring_relevance           |      0ms      | (no emit, internal)
5. filtering                   |     70ms      | keywords + constraints
6. selecting                   |     60ms      | passed count + target
7. discovering_pseo            |     80ms      | selected keywords
8. discovering_side_keywords   |     60ms      | constraints only
-------------------------------|---------------|---------------
TOTAL SEQUENTIAL               |   ~510ms      |
```

**Critical Observation**: The stub implementation uses `await delay(ms)` sequentially. When real services are wired (LLM calls, DB queries, API calls), expect **3-8 seconds per analysis** without optimization.

---

## 2. Pipeline Parallelization Opportunities

### Dependency Graph

```
                    +-----------------------+
                    |    Conversation       |
                    |      (input)          |
                    +-----------+-----------+
                                |
                                v
                    +-----------+-----------+
                    | Stage 1: Constraints  |  <-- LLM call (blocking)
                    | extractConstraints()  |
                    +-----------+-----------+
                                |
           +--------------------+--------------------+
           |                    |                    |
           v                    v                    v
+----------+----------+ +-------+-------+ +----------+----------+
| Stage 2: Funnel     | | Stage 3: Geo  | | Stage 8: Side KWs   |
| classifyFunnel()    | | classifyGeo() | | discoverSideKWs()   |
+----------+----------+ +-------+-------+ +----------+----------+
           |                    |                    |
           +--------------------+                    |
                                |                    |
                                v                    |
                    +-----------+-----------+        |
                    | Stage 4: Relevance    |        |
                    | scoreRelevance()      |        |
                    +-----------+-----------+        |
                                |                    |
                                v                    |
                    +-----------+-----------+        |
                    | Stage 5: Filtering    |        |
                    +-----------+-----------+        |
                                |                    |
                                v                    |
                    +-----------+-----------+        |
                    | Stage 6: Selection    |        |
                    +-----------+-----------+        |
                                |                    |
                                v                    |
                    +-----------+-----------+        |
                    | Stage 7: pSEO Detect  |<-------+
                    +-----------+-----------+
                                |
                                v
                    +-----------+-----------+
                    |       COMPLETE        |
                    +-----------------------+
```

### Parallel Execution Groups

| Group | Stages | Can Run In Parallel After |
|-------|--------|---------------------------|
| A | extractConstraints | (first, sequential) |
| B | classifyFunnel, classifyGeo, discoverSideKeywords | Group A |
| C | scoreRelevance | Group B (funnel + geo) |
| D | filter | Group C |
| E | select | Group D |
| F | detectPSEO | Group E |

**Impact**: Parallelizing Group B saves **max(80, 60, 60) - 80 = 80ms** in stub timing. With real services (LLM calls), this becomes **critical**:

```typescript
// MISSING: Parallel execution pattern
async runParallelGroup(request: AnalyzeRequest, constraints: AnalysisConstraints) {
  const [funnelBreakdown, geoBreakdown, sideKeywords] = await Promise.all([
    this.classifyFunnel(request.keywords, constraints),
    this.classifyGeo(request.keywords, constraints),
    this.discoverSideKeywords(constraints),
  ]);
  
  // Stream partials as each resolves
  await Promise.all([
    this.emitter.partial({ funnelBreakdown }),
    this.emitter.partial({ geoBreakdown }),
    this.emitter.partial({ sideKeywords }),
  ]);
  
  return { funnelBreakdown, geoBreakdown, sideKeywords };
}
```

---

## 3. MISSING Performance Optimizations (Ranked by Impact)

### P0: CRITICAL (50%+ latency reduction potential)

| ID | Optimization | Current State | Target State | Est. Latency Impact |
|----|--------------|---------------|--------------|---------------------|
| PERF-01 | **Parallel Stage Execution** | Sequential await chain | Promise.all for independent stages | -200-400ms (33%) |
| PERF-02 | **Conversation Constraint Cache** | No caching | Redis cache by conversation hash | -100ms (LLM skip) |
| PERF-03 | **Keyword Batch Chunking** | Single array processing | Chunked processing with early results | -500ms for 10K keywords |
| PERF-04 | **Optimistic First Result** | Wait for complete | Stream top-10 immediately | 0ms to first render |

### P1: HIGH (30% latency reduction)

| ID | Optimization | Current State | Target State | Est. Latency Impact |
|----|--------------|---------------|--------------|---------------------|
| PERF-05 | **Worker Thread Pool** | Main thread processing | Worker threads for CPU-bound stages | -100-200ms |
| PERF-06 | **Client-Side Prediction** | Wait for server | Show predicted funnel distribution | 0ms perceived |
| PERF-07 | **Embedding Pre-computation** | Compute on demand | Background job pre-embeds keywords | -150ms |
| PERF-08 | **Connection Pooling** | Per-request connections | Shared connection pool | -50ms TCP overhead |

### P2: MEDIUM (20% latency reduction)

| ID | Optimization | Current State | Target State | Est. Latency Impact |
|----|--------------|---------------|--------------|---------------------|
| PERF-09 | **Stale-While-Revalidate** | No SWR | Show cached, refresh background | 0ms if cached |
| PERF-10 | **Progressive Result Streaming** | Batch partials | Stream keyword-by-keyword | Perceived instant |
| PERF-11 | **SSE Compression** | Uncompressed JSON | gzip SSE events | -30% bandwidth |
| PERF-12 | **Request Deduplication** | Allow duplicate requests | Dedupe by conversation hash | Save wasted compute |

---

## 4. Streaming Optimization Analysis

### Current SSE Implementation Issues

```typescript
// apps/web/src/app/api/keyword-chat/analyze/route.ts
// PROBLEMS:
// 1. 15-second heartbeat is too slow for connection keep-alive
// 2. No compression on SSE events
// 3. No batching of rapid partial updates

heartbeatInterval = setInterval(() => {
  controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
}, 15000);  // <-- TOO SLOW for aggressive proxy timeouts
```

### Recommended SSE Optimizations

```typescript
// PERF-13: Fast heartbeat + event batching
const HEARTBEAT_INTERVAL_MS = 5000;  // 5s, not 15s
const BATCH_WINDOW_MS = 16;  // ~60fps, batch rapid partials

let pendingPartials: Partial<AnalysisResult>[] = [];
let batchTimeout: NodeJS.Timeout | null = null;

function flushPartials(controller: ReadableStreamDefaultController) {
  if (pendingPartials.length === 0) return;
  
  const merged = mergePartials(pendingPartials);
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'partial', data: merged })}\n\n`));
  pendingPartials = [];
}

// Batch rapid partial updates
function queuePartial(partial: Partial<AnalysisResult>) {
  pendingPartials.push(partial);
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      flushPartials(controller);
      batchTimeout = null;
    }, BATCH_WINDOW_MS);
  }
}
```

### Client-Side Buffering (Missing)

```typescript
// PERF-14: Missing in useKeywordAnalysis.ts
// Problem: No buffering of rapid SSE events, causes render thrashing

// Current: Immediate state update on every event
setState((prev) => ({
  ...prev,
  partials: [...prev.partials, eventData.data],
}));

// Recommended: RAF-based batching
const partialBuffer = useRef<Partial<AnalysisResult>[]>([]);
const rafId = useRef<number | null>(null);

function handlePartialEvent(data: Partial<AnalysisResult>) {
  partialBuffer.current.push(data);
  
  if (!rafId.current) {
    rafId.current = requestAnimationFrame(() => {
      setState((prev) => ({
        ...prev,
        partials: [...prev.partials, ...partialBuffer.current],
      }));
      partialBuffer.current = [];
      rafId.current = null;
    });
  }
}
```

---

## 5. Caching Strategy

### Hot Path Identification

| Data | Frequency | TTL | Cache Location | Invalidation |
|------|-----------|-----|----------------|--------------|
| Conversation constraints | Per-conversation | 24h | Redis L2 + Memory L1 | On conversation edit |
| Funnel classification | Per-keyword | 7d | Redis | On model update |
| Geo classification | Per-keyword | 30d | Redis | Never (stable) |
| pSEO patterns | Per-client | 1h | Memory | On new keywords |
| Embedding vectors | Per-keyword | 90d | PostgreSQL + Redis | On model update |

### Predictive Pre-computation

```typescript
// PERF-15: Missing background pre-computation

// When client uploads keywords:
async function onKeywordUpload(clientId: string, keywords: string[]) {
  // 1. Immediately respond to user
  
  // 2. Background: Pre-compute embeddings
  await bullmq.add('precompute-embeddings', {
    clientId,
    keywords,
    priority: 'low',
  });
  
  // 3. Background: Pre-compute funnel classification
  await bullmq.add('precompute-funnel', {
    clientId,
    keywords,
    priority: 'low',
  });
}

// When analysis runs, hits warm cache instead of cold compute
```

### Stale-While-Revalidate Pattern

```typescript
// PERF-09 Implementation

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { staleMs: number; maxAgeMs: number }
): Promise<{ data: T; isStale: boolean }> {
  const cached = await redis.get(key);
  
  if (cached) {
    const entry = JSON.parse(cached) as CacheEntry<T>;
    const age = Date.now() - entry.timestamp;
    
    if (age < options.staleMs) {
      return { data: entry.data, isStale: false };
    }
    
    if (age < options.maxAgeMs) {
      // Return stale, revalidate in background
      setImmediate(() => revalidate(key, fetcher));
      return { data: entry.data, isStale: true };
    }
  }
  
  // Cache miss or expired
  const data = await fetcher();
  await redis.setex(key, options.maxAgeMs / 1000, JSON.stringify({
    data,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  }));
  
  return { data, isStale: false };
}
```

---

## 6. Scale Handling: 10,000 Keyword Batches

### Current Limitations

1. **Memory**: 10K keywords * avg 50 chars = 500KB string data
2. **Processing**: Sequential classification = O(n) with high constant factor
3. **Response**: Full result set transmitted at once

### Chunked Processing Architecture

```typescript
// PERF-03: Chunked batch processing

const CHUNK_SIZE = 500;
const CONCURRENT_CHUNKS = 4;

async function processLargeKeywordBatch(
  keywords: string[],
  constraints: AnalysisConstraints,
  emitter: StageEmitter
) {
  const chunks = chunkArray(keywords, CHUNK_SIZE);
  const totalChunks = chunks.length;
  let processedChunks = 0;
  
  // Process chunks in parallel pools
  for (let i = 0; i < chunks.length; i += CONCURRENT_CHUNKS) {
    const pool = chunks.slice(i, i + CONCURRENT_CHUNKS);
    
    const results = await Promise.all(
      pool.map(async (chunk, idx) => {
        const chunkResult = await processChunk(chunk, constraints);
        processedChunks++;
        
        // Stream intermediate progress
        await emitter.partial({
          selection: {
            selected: chunkResult.selected.slice(0, 10),
            breakdown: {
              total: chunkResult.selected.length,
              byStage: chunkResult.funnelCounts,
              averageScore: chunkResult.avgScore,
            },
          },
        });
        
        await emitter.progress(
          'selecting',
          `Processed ${processedChunks * CHUNK_SIZE}/${keywords.length} keywords`
        );
        
        return chunkResult;
      })
    );
  }
  
  // Merge all chunk results
  return mergeChunkResults(results);
}
```

### Concurrent User Analysis

| Load Level | Approach | Max Concurrent | Memory Budget |
|------------|----------|----------------|---------------|
| Light (<10 req/min) | In-process | 10 | 100MB |
| Medium (<100 req/min) | Worker pool | 50 | 500MB |
| Heavy (>100 req/min) | BullMQ queue | 500 | External workers |

```typescript
// PERF-16: Adaptive concurrency control

class AnalysisConcurrencyManager {
  private activeRequests = 0;
  private readonly maxConcurrent = parseInt(process.env.MAX_CONCURRENT_ANALYSES ?? '20', 10);
  private readonly queueThreshold = parseInt(process.env.QUEUE_THRESHOLD ?? '10', 10);
  
  async acquire(): Promise<'immediate' | 'queued' | 'rejected'> {
    if (this.activeRequests < this.queueThreshold) {
      this.activeRequests++;
      return 'immediate';
    }
    
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return 'queued';  // Higher latency but allowed
    }
    
    return 'rejected';  // 503 Service Unavailable
  }
  
  release(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }
}
```

---

## 7. Memory Optimization

### Current Memory Profile (10K keywords)

| Component | Size | Duration | Risk |
|-----------|------|----------|------|
| Raw keywords array | 500KB | Request lifetime | LOW |
| Parsed/classified keywords | 2MB | Request lifetime | MEDIUM |
| Embedding vectors (if loaded) | 40MB | Request lifetime | HIGH |
| SSE response buffer | 200KB | Request lifetime | LOW |

### Memory-Efficient Processing

```typescript
// PERF-17: Generator-based streaming to reduce peak memory

async function* classifyKeywordsStream(
  keywords: string[],
  constraints: AnalysisConstraints
): AsyncGenerator<ClassifiedKeyword> {
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);
    const classified = await classifyBatch(batch, constraints);
    
    for (const kw of classified) {
      yield kw;  // Stream one at a time, GC can collect processed
    }
  }
}

// Consumer only holds current batch in memory
async function selectTopKeywords(
  stream: AsyncGenerator<ClassifiedKeyword>,
  limit: number
): Promise<SelectedKeyword[]> {
  const heap = new MinHeap<ClassifiedKeyword>((a, b) => a.score - b.score);
  
  for await (const kw of stream) {
    if (heap.size < limit) {
      heap.push(kw);
    } else if (kw.score > heap.peek()!.score) {
      heap.pop();
      heap.push(kw);
    }
    // Processed keywords can be GC'd immediately
  }
  
  return heap.toSortedArray();
}
```

---

## 8. Perceived Performance Optimizations

### Instant Feedback (0ms perceived latency)

| Technique | Implementation | User Impact |
|-----------|----------------|-------------|
| Optimistic UI | Show "Analyzing..." skeleton immediately | Feels instant |
| Predicted results | Show estimated funnel distribution | Builds trust |
| Progressive disclosure | Show first 10 results, lazy-load rest | Fast first paint |
| Skeleton loaders | Animate during actual processing | Reduces perceived wait |

### Progressive Disclosure Implementation

```typescript
// PERF-18: Progressive result rendering

// Server: Stream preview + full results separately
await emitter.partial({
  selection: {
    preview: selectedKeywords.slice(0, 20),  // Immediate
    totalCount: selectedKeywords.length,
    breakdown: breakdown,
  },
});

// Client: Render preview immediately, request full list on demand
const [previewResults, setPreviewResults] = useState<SelectedKeyword[]>([]);
const [fullResults, setFullResults] = useState<SelectedKeyword[] | null>(null);
const [loadingFull, setLoadingFull] = useState(false);

// Show preview immediately
useEffect(() => {
  if (partials.length > 0) {
    const latest = partials[partials.length - 1];
    if (latest.selection?.preview) {
      setPreviewResults(latest.selection.preview);
    }
  }
}, [partials]);

// Load full results on demand
const loadFullResults = async () => {
  setLoadingFull(true);
  const full = await fetchFullResults(sessionId);
  setFullResults(full);
  setLoadingFull(false);
};
```

### Skeleton Loading States

```typescript
// PERF-19: Missing skeleton states in AnalysisProgress.tsx

function AnalysisProgressSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {/* Stage indicator skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full bg-[var(--surface-2)]" />
        <div className="h-4 w-48 bg-[var(--surface-2)] rounded" />
      </div>
      
      {/* Progress bar skeleton */}
      <div className="h-2 w-full bg-[var(--surface-2)] rounded-full" />
      
      {/* Results preview skeleton */}
      <div className="grid grid-cols-3 gap-4 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 bg-[var(--surface-2)] rounded" />
            <div className="h-4 w-24 bg-[var(--surface-2)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 9. Performance Benchmarks & Targets

### Current Benchmarks (Stub Implementation)

| Metric | Current | Notes |
|--------|---------|-------|
| Time to First Byte (TTFB) | ~50ms | SSE connection established |
| Time to First Partial | ~150ms | After constraint extraction |
| Time to Complete | ~510ms | All 8 stages sequential |
| Memory Peak (1K keywords) | ~10MB | Acceptable |
| Memory Peak (10K keywords) | ~100MB | Needs optimization |

### Target Benchmarks (Production)

| Metric | Target | Stretch Goal | Rationale |
|--------|--------|--------------|-----------|
| TTFB | <30ms | <15ms | Edge/CDN optimization |
| Time to First Partial | <100ms | <50ms | Optimistic updates |
| Time to Complete (100 kw) | <1s | <500ms | Perceived instant |
| Time to Complete (1K kw) | <3s | <2s | Batch chunking |
| Time to Complete (10K kw) | <15s | <10s | Parallel + stream |
| Memory Peak (10K kw) | <50MB | <30MB | Generator streaming |
| Cache Hit Rate | >60% | >80% | Warm path optimization |
| Concurrent Users | 50 | 100 | Connection pooling |

---

## 10. Implementation Roadmap

### Week 1: Critical Path (PERF-01 to PERF-04)

```
Day 1-2: PERF-01 Parallel Stage Execution
  - Refactor pipeline to use Promise.all for parallel groups
  - Add dependency injection for stage ordering
  - Unit tests for parallel execution

Day 3: PERF-02 Conversation Constraint Cache
  - Add Redis cache layer for constraints
  - Hash conversation for cache key
  - 24h TTL with version invalidation

Day 4-5: PERF-03 + PERF-04 Batch Chunking + Early Results
  - Implement chunked processing
  - Stream top-10 results immediately
  - Memory optimization for 10K batches
```

### Week 2: High Priority (PERF-05 to PERF-08)

```
Day 1-2: PERF-05 Worker Thread Pool
  - Evaluate piscina for CPU-bound stages
  - Move embedding computation to workers
  - Benchmark improvement

Day 3: PERF-06 Client-Side Prediction
  - Pre-calculate funnel distribution estimates
  - Optimistic UI updates
  - Confidence intervals

Day 4-5: PERF-07 + PERF-08 Background Pre-computation
  - BullMQ job for embedding pre-compute
  - Connection pooling optimization
  - Integration testing
```

### Week 3: Polish (PERF-09 to PERF-12)

```
- SWR caching patterns
- Progressive streaming refinement
- SSE compression
- Request deduplication
- Load testing at scale
```

---

## 11. Monitoring & Observability

### Required Metrics

```typescript
// PERF-20: Missing performance metrics

interface AnalysisMetrics {
  // Latency
  timeToFirstPartialMs: number;
  timeToCompleteMs: number;
  stageLatencies: Record<AnalysisStage, number>;
  
  // Throughput
  keywordsPerSecond: number;
  concurrentAnalyses: number;
  
  // Cache
  cacheHitRate: number;
  cacheMissLatencyMs: number;
  
  // Memory
  peakMemoryMb: number;
  
  // Errors
  errorRate: number;
  timeoutRate: number;
}

// Prometheus-style metrics
const analysisLatencyHistogram = new Histogram({
  name: 'keyword_analysis_duration_seconds',
  help: 'Keyword analysis duration by stage',
  labelNames: ['stage', 'client_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

const analysisThroughputGauge = new Gauge({
  name: 'keyword_analysis_keywords_per_second',
  help: 'Keywords processed per second',
});
```

---

## 12. Summary: Top 5 Performance Wins

| Rank | Optimization | Impact | Effort | Priority |
|------|--------------|--------|--------|----------|
| 1 | **Parallel Stage Execution** | 33% latency reduction | Medium | P0 |
| 2 | **Conversation Cache** | Skip LLM on repeat | Low | P0 |
| 3 | **Chunked Batch Processing** | 10K keyword support | Medium | P0 |
| 4 | **Optimistic UI + Skeleton** | 0ms perceived latency | Low | P0 |
| 5 | **Worker Thread Pool** | CPU-bound stage offload | High | P1 |

**Bottom Line**: The current sequential pipeline will be unacceptable when real LLM/API calls are wired. Parallelization is mandatory. Caching is essential for repeat conversations. Chunking is required for agency-scale batches (10K keywords).

---

## 13. Bottleneck Analysis Summary

```
+---------------------------+--------+------------------+--------------+
| Bottleneck                | Type   | Current Impact   | Fix Priority |
+---------------------------+--------+------------------+--------------+
| Sequential stage chain    | CPU    | 200-400ms waste  | P0           |
| No constraint caching     | I/O    | LLM call/request | P0           |
| Single-batch processing   | Memory | 100MB for 10K    | P0           |
| 15s heartbeat             | Net    | Proxy timeout    | P1           |
| No embedding cache        | I/O    | 150ms/batch      | P1           |
| Per-event render updates  | UI     | Jank at 60fps    | P2           |
| Uncompressed SSE          | Net    | 30% extra bytes  | P2           |
+---------------------------+--------+------------------+--------------+
```

---

## 14. Files to Modify for Performance

| File | Changes |
|------|---------|
| `apps/web/src/lib/keyword-chat/analysis-pipeline.ts` | Add parallel execution, chunking |
| `apps/web/src/app/api/keyword-chat/analyze/route.ts` | Reduce heartbeat, add concurrency control |
| `apps/web/src/hooks/useKeywordAnalysis.ts` | Add RAF batching for partials |
| `apps/web/src/components/keyword-analysis/AnalysisProgress.tsx` | Add skeleton states |
| `open-seo-main/src/server/lib/cache/keyword-cache.ts` | NEW: Keyword analysis caching layer |
| `open-seo-main/src/server/features/keywords/workers/` | NEW: Worker thread pool for CPU work |

---

*Analysis completed: 2026-05-04*
*Agent: Performance Engineering Specialist*

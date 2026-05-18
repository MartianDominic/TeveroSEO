# RESEARCH-01: Keyword Scraping Architecture

**Phase 99 Research Document**  
**Date:** 2026-05-11  
**Status:** Complete

---

## Executive Summary

This document defines the world-class keyword scraping pipeline for TeveroSEO Phase 99, covering prospect/competitor keyword discovery through to proposal-ready output. The architecture leverages existing Phase 92/95 tiered scraping infrastructure while adding keyword-specific optimizations.

**Key Findings:**
1. **Optimal flow:** DataForSEO Keywords API (primary) + Ahrefs MCP (gap fill) + direct scraping (fallback)
2. **Cost target:** $0.015/keyword at 3000+ scale via Standard Queue batching
3. **Deduplication:** Bloom filter + normalized key (lowercase, stemmed, diacritics-stripped)
4. **Batch strategy:** 100 keywords/API call, webhook-based result collection

---

## 1. Keyword Scraping Flow Architecture

### 1.1 High-Level Pipeline

```
                    KEYWORD SCRAPING PIPELINE
                    
Input Sources                  Processing                      Output
+------------------+          +------------------+          +------------------+
|                  |          |                  |          |                  |
| Prospect Domain  |--+       | Source Router    |          | Deduplicated     |
| (from proposal)  |  |       |                  |          | Keywords         |
+------------------+  |       | DataForSEO ───┐  |          | - keyword        |
                      +------>| Ahrefs MCP ───┼──+--------->| - volume         |
+------------------+  |       | Direct SERP ──┘  |          | - difficulty     |
| Competitor Sites |  |       |                  |          | - intent         |
| (detected)       |--+       +------------------+          | - cpc            |
+------------------+  |              │                      | - source         |
                      |              ▼                      +------------------+
+------------------+  |       +------------------+                 │
| Seed Keywords    |--+       | Deduplication    |                 ▼
| (from client)    |          | & Normalization  |          +------------------+
+------------------+          +------------------+          | Classification   |
                                     │                      | (Phase 98)       |
                                     ▼                      | - funnel stage   |
                              +------------------+          | - geo filter     |
                              | Cost Tracking    |          | - relevance      |
                              | $0.015/kw target |          +------------------+
                              +------------------+
```

### 1.2 Source Priority Order

| Priority | Source | Cost | Use Case | Rate Limit |
|----------|--------|------|----------|------------|
| 1 | DataForSEO Keywords API | $0.01 + $0.0001/kw | Primary bulk discovery | 2000 tasks/day Standard |
| 2 | DataForSEO SERP Organic | $0.0006/query | Competitor ranking keywords | 20K/day |
| 3 | Ahrefs MCP (if available) | Variable | Gap filling, historical data | API-dependent |
| 4 | Direct SERP scrape | $0.000015-0.00125/pg | Fallback, real-time validation | Tiered |

---

## 2. DataForSEO Integration (Primary Source)

### 2.1 Keyword Discovery Endpoints

```typescript
/**
 * DataForSEO Keyword endpoints for discovery
 */
interface DataForSEOKeywordEndpoints {
  // Bulk keyword data - $0.01 base + $0.0001/keyword
  keywordsForSite: '/keywords_data/google/keywords_for_site/task_post';
  
  // Related keywords - $0.01 base + $0.0001/keyword  
  relatedKeywords: '/keywords_data/google/related_keywords/task_post';
  
  // Keyword suggestions - $0.01 + $0.0001/keyword
  keywordSuggestions: '/keywords_data/google/keyword_suggestions/task_post';
  
  // Search volume for known keywords - $0.0001/keyword
  searchVolume: '/keywords_data/google/search_volume/task_post';
  
  // Organic competitors - $0.0006/query (SERP-based)
  organicCompetitors: '/serp/google/organic/task_post';
}
```

### 2.2 Cost-Optimized Batching Strategy

```typescript
/**
 * Batch configuration for 3000+ keywords
 */
const BATCH_CONFIG = {
  // Standard Queue is 70% cheaper than Live
  useStandardQueue: true,
  
  // Max keywords per API call
  keywordsPerTask: 1000,  // DFS limit
  
  // Max tasks per POST request
  tasksPerRequest: 100,
  
  // Webhook for async result collection
  usePingback: true,
  
  // Cost breakdown at 3000 keywords:
  // - keywords_for_site: $0.01 + (3000 * $0.0001) = $0.31
  // - search_volume refresh: 3000 * $0.0001 = $0.30
  // - Total: ~$0.61 for 3000 keywords = $0.0002/keyword
};

/**
 * Batch keyword discovery for a prospect domain
 */
async function discoverKeywords(domain: string, options: {
  maxKeywords?: number;
  location?: number;
  language?: string;
}): Promise<KeywordBatch> {
  const { maxKeywords = 3000, location = 2440, language = 'lt' } = options;
  
  // Create task for keywords_for_site
  const task = {
    target: domain,
    location_code: location,
    language_code: language,
    include_serp_info: true,  // Get ranking positions
    include_seed_keyword: true,
    limit: maxKeywords,
    pingback_url: `${WEBHOOK_BASE}/dataforseo/keywords/${jobId}`,
  };
  
  // Submit to Standard Queue
  const response = await dataForSeoClient.post(
    '/keywords_data/google/keywords_for_site/task_post',
    [task]
  );
  
  // Track cost
  await costTracker.record({
    jobId,
    endpoint: 'keywords_for_site',
    estimatedCost: 0.01 + (maxKeywords * 0.0001),
    taskId: response.tasks[0].id,
  });
  
  return {
    jobId,
    taskId: response.tasks[0].id,
    status: 'pending',
    estimatedKeywords: maxKeywords,
  };
}
```

### 2.3 Webhook Result Handler

```typescript
/**
 * Webhook handler for DataForSEO Standard Queue results
 */
app.post('/api/webhooks/dataforseo/keywords/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const results = req.body;
  
  // Validate webhook signature (if configured)
  if (!validateDfsWebhook(req)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process keyword results
  const keywords = results.tasks?.[0]?.result || [];
  
  // Normalize and deduplicate
  const normalized = await deduplicateKeywords(keywords.map(kw => ({
    keyword: kw.keyword,
    searchVolume: kw.search_volume,
    cpc: kw.cpc,
    competition: kw.competition,
    competitionLevel: kw.competition_level,
    keywordDifficulty: kw.keyword_info?.keyword_difficulty,
    intent: kw.keyword_info?.search_intent_info?.main_intent,
    serpFeatures: kw.serp_info?.serp_item_types,
    source: 'dataforseo_keywords_for_site',
  })));
  
  // Store to database
  await keywordRepository.bulkInsert(jobId, normalized);
  
  // Update job status
  await jobQueue.updateStatus(jobId, 'keywords_ready', {
    totalKeywords: normalized.length,
    duplicatesRemoved: keywords.length - normalized.length,
  });
  
  res.status(200).send('OK');
});
```

---

## 3. Competitor Detection and Keyword Scraping

### 3.1 Competitor Detection Flow

```
                    COMPETITOR DETECTION
                    
+------------------+          +------------------+          +------------------+
| Prospect Domain  |          | SERP Analysis    |          | Competitor List  |
| example.lt       |--------->| (seed keywords)  |--------->| competitor1.lt   |
+------------------+          |                  |          | competitor2.lt   |
                              | DataForSEO SERP  |          | competitor3.lt   |
                              | $0.0006/query    |          +------------------+
                              +------------------+                 │
                                                                   ▼
                                                          +------------------+
                                                          | For each:        |
                                                          | keywords_for_site|
                                                          | $0.01 + 0.0001/kw|
                                                          +------------------+
```

### 3.2 Competitor Detection Implementation

```typescript
/**
 * Detect competitors by analyzing SERP overlap
 */
async function detectCompetitors(
  domain: string,
  seedKeywords: string[],
  options: { maxCompetitors?: number; location?: number }
): Promise<CompetitorAnalysis> {
  const { maxCompetitors = 10, location = 2440 } = options;
  
  // Sample up to 20 seed keywords for SERP analysis
  const sampleKeywords = seedKeywords.slice(0, 20);
  
  // Batch SERP queries
  const serpTasks = sampleKeywords.map(keyword => ({
    keyword,
    location_code: location,
    language_code: 'lt',
    device: 'desktop',
    depth: 20,  // Top 20 results
  }));
  
  const serpResults = await dataForSeoClient.post(
    '/serp/google/organic/task_post',
    serpTasks
  );
  
  // Aggregate competitor domains
  const competitorScores = new Map<string, {
    domain: string;
    overlappingKeywords: number;
    avgPosition: number;
    keywords: string[];
  }>();
  
  for (const task of serpResults.tasks) {
    const items = task.result?.[0]?.items || [];
    
    for (const item of items) {
      if (item.type !== 'organic') continue;
      
      const compDomain = normalizeDomain(item.domain);
      if (compDomain === normalizeDomain(domain)) continue;  // Skip self
      
      const existing = competitorScores.get(compDomain) || {
        domain: compDomain,
        overlappingKeywords: 0,
        avgPosition: 0,
        keywords: [],
      };
      
      existing.overlappingKeywords++;
      existing.avgPosition = (existing.avgPosition * (existing.overlappingKeywords - 1) + item.rank_absolute) / existing.overlappingKeywords;
      existing.keywords.push(task.data.keyword);
      
      competitorScores.set(compDomain, existing);
    }
  }
  
  // Sort by overlap and return top N
  const competitors = Array.from(competitorScores.values())
    .sort((a, b) => b.overlappingKeywords - a.overlappingKeywords)
    .slice(0, maxCompetitors);
  
  return {
    primaryDomain: domain,
    competitors,
    seedKeywordsAnalyzed: sampleKeywords.length,
    serpQueriesCost: sampleKeywords.length * 0.0006,
  };
}
```

### 3.3 Competitor Keyword Scraping

```typescript
/**
 * Scrape keywords from detected competitors
 */
async function scrapeCompetitorKeywords(
  competitors: Competitor[],
  options: { maxKeywordsPerCompetitor?: number; dedupeWithProspect?: string[] }
): Promise<CompetitorKeywordResult> {
  const { maxKeywordsPerCompetitor = 1000, dedupeWithProspect = [] } = options;
  
  // Create Bloom filter for prospect keywords
  const prospectBloom = new BloomFilter(dedupeWithProspect.length * 2, 0.001);
  for (const kw of dedupeWithProspect) {
    prospectBloom.add(normalizeKeyword(kw));
  }
  
  const results: CompetitorKeywordResult = {
    competitors: [],
    totalKeywords: 0,
    uniqueKeywords: 0,
    costUsd: 0,
  };
  
  // Process competitors in parallel (max 3 concurrent)
  const batches = chunk(competitors, 3);
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (competitor) => {
        const keywords = await discoverKeywords(competitor.domain, {
          maxKeywords: maxKeywordsPerCompetitor,
        });
        
        // Filter out keywords already in prospect set
        const uniqueKeywords = keywords.filter(kw => 
          !prospectBloom.has(normalizeKeyword(kw.keyword))
        );
        
        return {
          domain: competitor.domain,
          totalKeywords: keywords.length,
          uniqueKeywords: uniqueKeywords.length,
          keywords: uniqueKeywords,
        };
      })
    );
    
    for (const result of batchResults) {
      results.competitors.push(result);
      results.totalKeywords += result.totalKeywords;
      results.uniqueKeywords += result.uniqueKeywords;
      results.costUsd += 0.01 + (result.totalKeywords * 0.0001);
    }
  }
  
  return results;
}
```

---

## 4. Proxy Escalation for Keyword Discovery

### 4.1 Reusing Existing Tiered Infrastructure

The keyword scraping system leverages the existing Phase 92/95 `TieredFetcher` infrastructure:

**Existing Code References:**
- `/open-seo-main/src/server/features/scraping/TieredFetcher.ts` - Main orchestrator
- `/open-seo-main/src/server/features/scraping/DomainLearningService.ts` - Per-domain tier memory
- `/open-seo-main/src/db/domain-scrape-learning-schema.ts` - Schema for tier configs

### 4.2 Tier Escalation for Keyword-Specific Use Cases

```
                    KEYWORD SCRAPING TIER ESCALATION
                    
+------------------------------------------------------------------+
| TIER 0: DataForSEO Keywords API (Primary)                        |
| Cost: $0.01 + $0.0001/keyword                                    |
| Use: Bulk keyword discovery, search volume, difficulty           |
| Capacity: Unlimited with Standard Queue                          |
+------------------------------------------------------------------+
                              │
                              │ API rate limit hit OR
                              │ need real-time SERP data
                              ▼
+------------------------------------------------------------------+
| TIER 1: DataForSEO SERP API                                      |
| Cost: $0.0006/query (Standard) or $0.002/query (Live)            |
| Use: Competitor ranking positions, SERP features                 |
| Capacity: 20K queries/day Standard Queue                         |
+------------------------------------------------------------------+
                              │
                              │ Need page content for
                              │ keyword extraction
                              ▼
+------------------------------------------------------------------+
| TIER 2: Tiered Page Scraping (from Phase 95)                     |
| Cost: $0.000015 - $0.00425/page (see TieredFetcher)              |
| Use: Extract keywords from page content, meta tags               |
| Flow: Direct -> Webshare -> Geonode -> DFS Basic -> DFS Browser  |
+------------------------------------------------------------------+
                              │
                              │ Need JS rendering for
                              │ SPA content
                              ▼
+------------------------------------------------------------------+
| TIER 3: Camoufox / DFS Browser                                   |
| Cost: $0.000077 (Camoufox) or $0.00425 (DFS Browser)             |
| Use: SPA sites, heavy anti-bot protection                        |
| Capacity: Limited by proxy bandwidth                             |
+------------------------------------------------------------------+
```

### 4.3 Cost Comparison Matrix

| Source | Cost/Keyword | Best For | Limitations |
|--------|--------------|----------|-------------|
| DFS Keywords API | $0.0001 | Bulk discovery | No real-time SERP |
| DFS SERP API | $0.0006 | Ranking data | Query-based, not bulk |
| Page Scrape + Extract | $0.00003 | Content keywords | Requires parsing |
| Ahrefs MCP | Variable | Historical data | Rate limited |

---

## 5. Keyword Deduplication and Normalization

### 5.1 Normalization Pipeline

```typescript
/**
 * Keyword normalization for consistent deduplication
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    // Lowercase
    .toLowerCase()
    // Remove diacritics (Lithuanian: ą->a, č->c, ę->e, etc.)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Remove common punctuation
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    // Sort words for permutation matching (optional)
    // .split(' ').sort().join(' ')
    ;
}

/**
 * Lithuanian-specific normalization
 */
const LITHUANIAN_DIACRITICS: Record<string, string> = {
  'ą': 'a', 'č': 'c', 'ę': 'e', 'ė': 'e', 'į': 'i',
  'š': 's', 'ų': 'u', 'ū': 'u', 'ž': 'z',
  'Ą': 'A', 'Č': 'C', 'Ę': 'E', 'Ė': 'E', 'Į': 'I',
  'Š': 'S', 'Ų': 'U', 'Ū': 'U', 'Ž': 'Z',
};

function normalizeLithuanian(text: string): string {
  return text.replace(
    /[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g,
    (char) => LITHUANIAN_DIACRITICS[char] || char
  );
}
```

### 5.2 Bloom Filter Deduplication

```typescript
import { BloomFilter } from 'bloom-filters';

/**
 * Bloom filter configuration for keyword deduplication
 * 
 * At 10,000 keywords with 0.1% false positive rate:
 * - Memory: ~18KB
 * - Lookup: O(k) where k = number of hash functions
 */
const BLOOM_CONFIG = {
  expectedItems: 100_000,  // Support up to 100K keywords
  falsePositiveRate: 0.001,  // 0.1% false positives OK
};

class KeywordDeduplicator {
  private bloom: BloomFilter;
  private exactSet: Set<string>;  // For verification on bloom hits
  
  constructor() {
    this.bloom = new BloomFilter(
      BLOOM_CONFIG.expectedItems,
      BLOOM_CONFIG.falsePositiveRate
    );
    this.exactSet = new Set();
  }
  
  /**
   * Check if keyword is duplicate
   */
  isDuplicate(keyword: string): boolean {
    const normalized = normalizeKeyword(keyword);
    
    // Bloom says "definitely not seen" - fast path
    if (!this.bloom.has(normalized)) {
      return false;
    }
    
    // Bloom says "maybe seen" - verify with exact set
    return this.exactSet.has(normalized);
  }
  
  /**
   * Add keyword to dedup set
   */
  add(keyword: string): void {
    const normalized = normalizeKeyword(keyword);
    this.bloom.add(normalized);
    this.exactSet.add(normalized);
  }
  
  /**
   * Deduplicate a batch of keywords
   */
  deduplicate<T extends { keyword: string }>(keywords: T[]): T[] {
    const unique: T[] = [];
    
    for (const kw of keywords) {
      if (!this.isDuplicate(kw.keyword)) {
        this.add(kw.keyword);
        unique.push(kw);
      }
    }
    
    return unique;
  }
}
```

### 5.3 Cross-Source Deduplication

```typescript
/**
 * Merge keywords from multiple sources with deduplication
 */
async function mergeKeywordSources(
  sources: KeywordSource[]
): Promise<MergedKeywords> {
  const deduplicator = new KeywordDeduplicator();
  const merged: EnrichedKeyword[] = [];
  const duplicatesBySource: Record<string, number> = {};
  
  // Process sources in priority order
  for (const source of sources) {
    let duplicates = 0;
    
    for (const kw of source.keywords) {
      if (deduplicator.isDuplicate(kw.keyword)) {
        duplicates++;
        continue;
      }
      
      deduplicator.add(kw.keyword);
      merged.push({
        ...kw,
        source: source.name,
        sourceRank: source.priority,
      });
    }
    
    duplicatesBySource[source.name] = duplicates;
  }
  
  return {
    keywords: merged,
    totalFromSources: sources.reduce((sum, s) => sum + s.keywords.length, 0),
    uniqueCount: merged.length,
    duplicatesBySource,
  };
}
```

---

## 6. Batch Processing Strategy for 3000+ Keywords

### 6.1 Processing Pipeline

```
                    BATCH PROCESSING PIPELINE (3000+ Keywords)
                    
Phase 1: Discovery          Phase 2: Enrichment         Phase 3: Classification
+------------------+        +------------------+        +------------------+
| DataForSEO       |        | Search Volume    |        | Funnel Stage     |
| keywords_for_site|------->| Refresh (batch)  |------->| Classification   |
| ~10 seconds      |        | ~5 seconds       |        | (Phase 98)       |
+------------------+        +------------------+        +------------------+
        │                          │                          │
        ▼                          ▼                          ▼
+------------------+        +------------------+        +------------------+
| Standard Queue   |        | 1000 kw/request  |        | LLM batches of   |
| Webhook delivery |        | Webhook delivery |        | 50-100 keywords  |
| Cost: $0.31      |        | Cost: $0.30      |        | Cost: ~$0.02     |
+------------------+        +------------------+        +------------------+
                                                               │
                                                               ▼
                                                        +------------------+
                                                        | Proposal-Ready   |
                                                        | Keywords (100)   |
                                                        | Total: ~$0.63    |
                                                        +------------------+
```

### 6.2 BullMQ Job Configuration

```typescript
/**
 * BullMQ queue configuration for keyword processing
 */
import { Queue, Worker, Job } from 'bullmq';

const keywordQueue = new Queue('keyword-discovery', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

/**
 * Job types for keyword processing pipeline
 */
type KeywordJobData = 
  | { type: 'discover'; domain: string; maxKeywords: number; jobId: string }
  | { type: 'enrich'; keywords: string[]; jobId: string }
  | { type: 'classify'; keywordIds: number[]; jobId: string }
  | { type: 'merge'; sources: string[]; jobId: string };

/**
 * Worker for keyword processing
 */
const keywordWorker = new Worker<KeywordJobData>(
  'keyword-discovery',
  async (job: Job<KeywordJobData>) => {
    switch (job.data.type) {
      case 'discover':
        return handleDiscover(job.data);
      case 'enrich':
        return handleEnrich(job.data);
      case 'classify':
        return handleClassify(job.data);
      case 'merge':
        return handleMerge(job.data);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,  // Process 5 jobs in parallel
    limiter: {
      max: 10,       // Max 10 jobs per duration
      duration: 1000, // Per second
    },
  }
);
```

### 6.3 Chunked Processing for Large Batches

```typescript
/**
 * Process large keyword batches in chunks
 */
async function processLargeKeywordBatch(
  keywords: string[],
  options: { chunkSize?: number; concurrency?: number }
): Promise<ProcessingResult> {
  const { chunkSize = 1000, concurrency = 3 } = options;
  
  const chunks = chunk(keywords, chunkSize);
  const results: ChunkResult[] = [];
  
  // Process chunks with controlled concurrency
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (chunkKeywords, idx) => {
        const chunkIndex = i + idx;
        
        // Submit to DataForSEO Standard Queue
        const task = await submitSearchVolumeTask(chunkKeywords);
        
        // Wait for webhook callback (or poll)
        const result = await waitForTaskCompletion(task.id, {
          maxWaitMs: 60_000,
          pollIntervalMs: 2_000,
        });
        
        return {
          chunkIndex,
          keywords: result.keywords,
          cost: 0.0001 * chunkKeywords.length,
        };
      })
    );
    
    results.push(...batchResults);
    
    // Progress update
    console.log(`Processed ${Math.min((i + concurrency) * chunkSize, keywords.length)} / ${keywords.length} keywords`);
  }
  
  return {
    totalKeywords: keywords.length,
    chunks: results.length,
    totalCost: results.reduce((sum, r) => sum + r.cost, 0),
  };
}
```

---

## 7. Cost Estimates

### 7.1 Per-Proposal Cost Breakdown

| Operation | Volume | Unit Cost | Total |
|-----------|--------|-----------|-------|
| Prospect keyword discovery | 3000 kw | $0.01 + $0.0001/kw | $0.31 |
| Competitor detection (SERP) | 20 queries | $0.0006/query | $0.012 |
| Competitor keyword scrape (5 competitors) | 5000 kw | $0.05 + $0.0005/kw | $0.55 |
| Search volume refresh | 5000 kw | $0.0001/kw | $0.50 |
| **Total per proposal** | | | **~$1.37** |

### 7.2 Monthly Cost at Scale

| Scale | Proposals/Month | Keyword Operations | Estimated Cost |
|-------|-----------------|-------------------|----------------|
| Small agency | 10 | 30K keywords | ~$15 |
| Medium agency | 50 | 150K keywords | ~$70 |
| Large agency | 200 | 600K keywords | ~$280 |

### 7.3 Cost Optimization Levers

1. **Caching:** Cache keyword data for 7 days (common competitor overlap)
2. **Batch consolidation:** Combine similar-domain requests
3. **Standard Queue:** Always use Standard Queue (70% cheaper than Live)
4. **Selective enrichment:** Only enrich keywords that pass initial filters

---

## 8. Existing Code References

### 8.1 Reusable Infrastructure

| Component | Path | Reuse For |
|-----------|------|-----------|
| TieredFetcher | `/open-seo-main/src/server/features/scraping/TieredFetcher.ts` | Page scraping for content extraction |
| DomainLearningService | `/open-seo-main/src/server/features/scraping/DomainLearningService.ts` | Domain tier caching |
| Domain scrape schema | `/open-seo-main/src/db/domain-scrape-learning-schema.ts` | Tier config storage |
| DataForSEO client | `/open-seo-main/src/server/lib/dataforseo-organic.ts` | SERP API calls |
| DataForSEO schemas | `/open-seo-main/src/server/lib/dataforseoSchemas.ts` | Response types |
| Redis caching | `/open-seo-main/src/server/lib/redis.ts` | Keyword cache |
| BullMQ queues | `/open-seo-main/src/server/queues/` | Job processing |

### 8.2 New Components Needed

| Component | Purpose | Priority |
|-----------|---------|----------|
| `KeywordDiscoveryService` | Orchestrate keyword discovery pipeline | P0 |
| `KeywordDeduplicator` | Bloom filter + normalization | P0 |
| `CompetitorDetector` | SERP-based competitor analysis | P1 |
| `KeywordBatchProcessor` | BullMQ job handlers | P1 |
| `keyword-schema.ts` | Drizzle schema for keywords table | P0 |
| `KeywordWebhookHandler` | DataForSEO webhook endpoint | P1 |

---

## 9. Implementation Gaps

### 9.1 Missing Infrastructure

| Gap | Current State | Required | Effort |
|-----|---------------|----------|--------|
| Keywords table | None | Drizzle schema with indexes | 2h |
| DataForSEO Keywords API client | Only SERP/OnPage | Keywords endpoints | 4h |
| Webhook handler | None | Express/Hono endpoint | 2h |
| Bloom filter integration | None | npm package + wrapper | 2h |
| Lithuanian normalization | Basic | Full diacritic handling | 1h |

### 9.2 Integration Points

| Integration | With | Status | Notes |
|-------------|------|--------|-------|
| Phase 98 classification | World-Class Architecture | Ready | Interface defined |
| Phase 95 scraping | TieredFetcher | Ready | Reuse existing |
| CopilotKit chat | Phase 98 | Planned | Tool registration needed |
| Proposal generator | TeveroSEO proposals | Planned | Export format needed |

---

## 10. Recommended Implementation Order

1. **Week 1: Foundation**
   - Create `keywords` table schema
   - Implement DataForSEO Keywords API client
   - Build `KeywordDeduplicator` with Bloom filter

2. **Week 2: Pipeline**
   - Implement `KeywordDiscoveryService`
   - Add webhook handler for Standard Queue
   - Build BullMQ job handlers

3. **Week 3: Integration**
   - Connect to Phase 98 classification
   - Add competitor detection
   - Implement cost tracking

4. **Week 4: Optimization**
   - Add caching layer
   - Performance testing at scale
   - Cost monitoring dashboard

---

## Document History

- **2026-05-11:** Initial research document created

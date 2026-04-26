# Multi-Tenant Cost Optimization Layer for Keyword Intelligence

> **Version:** 1.0  
> **Created:** 2026-04-26  
> **Status:** Design Complete  
> **Target:** 1000 clients, <$0.001/classification at scale

---

## Executive Summary

This design transforms the keyword intelligence system from a per-client cost model to a shared-infrastructure flywheel where more clients = lower per-client costs.

**Key Metrics:**
- Cache hit rate: >70% on keyword embeddings across clients
- Cost per classification: <$0.001 at scale (vs $0.01 naive)
- Per-client attribution accuracy: 99%+
- Cache staleness: <24 hours for competitor data

**Core Insight:** 50 clients targeting Lithuanian e-commerce share ONE classification for "varle.lt kaina" (varle.lt price). The first client pays, the rest get it free.

---

## Table of Contents

1. [Cache Architecture](#1-cache-architecture)
2. [Cost Tracker](#2-cost-tracker)
3. [Batch Optimizer](#3-batch-optimizer)
4. [Redis Key Schemas](#4-redis-key-schemas)
5. [Cache Invalidation Strategy](#5-cache-invalidation-strategy)
6. [Business Model](#6-business-model)
7. [Implementation Code](#7-implementation-code)

---

## 1. Cache Architecture

### Layered Caching Strategy

```
                           CACHE LAYER HIERARCHY                                  
                                                                                  
  L1: KEYWORD EMBEDDING CACHE (Global, Permanent)                                
  -----------------------------------------------------------------------        
  Key: kw:emb:{hash(keyword)}                                                    
  Value: Float32Array[384] (serialized embedding)                                
  TTL: Never expires (embeddings don't change)                                   
  Hit Rate Target: 85%+ (finite keyword universe)                                
  Sharing: 100% cross-client (same keyword = same embedding)                     
                                                                                  
  L2: CATEGORY CLASSIFICATION CACHE (Global, 7 days)                             
  -----------------------------------------------------------------------        
  Key: kw:cat:{hash(keyword)}:{vertical}                                         
  Value: {category, confidence, intent, reasoning}                               
  TTL: 7 days (categories don't change often)                                    
  Hit Rate Target: 70%+ (common keywords in same vertical)                       
  Sharing: Cross-client within same vertical (e-commerce, SaaS, local)           
                                                                                  
  L3: COMPETITOR CATALOG CACHE (Global, 24 hours)                                
  -----------------------------------------------------------------------        
  Key: comp:catalog:{domain}                                                     
  Value: {categories: [...], products: [...], priceRanges: {...}}                
  TTL: 24 hours (competitor data changes daily)                                  
  Hit Rate Target: 90%+ (limited Lithuanian e-commerce landscape)                
  Sharing: 100% cross-client (same competitor = same catalog)                    
                                                                                  
  L4: LLM RESPONSE CACHE (Global, 7 days)                                        
  -----------------------------------------------------------------------        
  Key: llm:{model}:{hash(prompt)}                                                
  Value: {response, tokens, cost, timestamp}                                     
  TTL: 7 days (deterministic prompts = deterministic outputs)                    
  Hit Rate Target: 60%+ (similar prompts across clients)                         
  Sharing: Cross-client for identical prompts                                    
                                                                                  
  L5: CLIENT-SPECIFIC CACHE (Per-Client, Session)                                
  -----------------------------------------------------------------------        
  Key: client:{clientId}:session:{sessionId}                                     
  Value: {focusSelection, mappedKeywords, refinements}                           
  TTL: 24 hours (session data)                                                   
  Hit Rate Target: N/A (unique per session)                                      
  Sharing: None (client-specific)                                                
```

### Cache Flow Diagram

```
                     +-------------------+
                     | Keyword: "varle   |
                     | kainos"           |
                     +---------+---------+
                               |
                               v
+-------------------------------------------------------------------------+
|  L1: EMBEDDING CACHE                                                     |
|  -------------------                                                     |
|  Check: kw:emb:{hash("varle kainos")}                                    |
|                                                                          |
|  HIT (85%): Return embedding in 0.1ms                                    |
|  MISS (15%): Compute embedding -> Store -> 50ms                          |
+-------------------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------------------+
|  L2: CATEGORY CACHE                                                      |
|  ------------------                                                      |
|  Check: kw:cat:{hash("varle kainos")}:ecommerce                          |
|                                                                          |
|  HIT (70%): Return {category: "Price Comparison", intent: "commercial"}  |
|  MISS (30%): Run LLM classification -> Check L4 first                    |
+-------------------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------------------+
|  L4: LLM RESPONSE CACHE (on miss from L2)                                |
|  ----------------------------------------                                |
|  Check: llm:grok-fast:{hash(classification_prompt)}                      |
|                                                                          |
|  HIT (60%): Return cached LLM response                                   |
|  MISS (40%): Call LLM API -> Store response -> Update L2                 |
+-------------------------------------------------------------------------+
```

### CacheArchitecture Class

```typescript
// src/server/features/keyword-intelligence/services/CacheArchitecture.ts

import { Redis } from "ioredis";
import { createHash } from "crypto";

interface CacheConfig {
  /** L1: Keyword embeddings - never expire */
  embeddingTTL: number;
  /** L2: Category classifications - 7 days */
  categoryTTL: number;
  /** L3: Competitor catalogs - 24 hours */
  competitorTTL: number;
  /** L4: LLM responses - 7 days */
  llmResponseTTL: number;
  /** L5: Client sessions - 24 hours */
  sessionTTL: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  bytesSaved: number;
  costSaved: number;
}

type CacheLayer = "embedding" | "category" | "competitor" | "llm" | "session";

export class CacheArchitecture {
  private redis: Redis;
  private config: CacheConfig;
  private stats: Map<CacheLayer, CacheStats>;

  constructor(redis: Redis, config?: Partial<CacheConfig>) {
    this.redis = redis;
    this.config = {
      embeddingTTL: -1, // Never expire
      categoryTTL: 7 * 24 * 60 * 60, // 7 days
      competitorTTL: 24 * 60 * 60, // 24 hours
      llmResponseTTL: 7 * 24 * 60 * 60, // 7 days
      sessionTTL: 24 * 60 * 60, // 24 hours
      ...config,
    };
    this.stats = new Map();
    this.initStats();
  }

  private initStats(): void {
    const layers: CacheLayer[] = [
      "embedding",
      "category",
      "competitor",
      "llm",
      "session",
    ];
    for (const layer of layers) {
      this.stats.set(layer, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        bytesSaved: 0,
        costSaved: 0,
      });
    }
  }

  // --------------------------------------------------------------------------
  // L1: KEYWORD EMBEDDING CACHE
  // --------------------------------------------------------------------------

  /**
   * Get or compute keyword embedding.
   * Global cache - same keyword = same embedding regardless of client.
   */
  async getOrComputeEmbedding(
    keyword: string,
    computeFn: () => Promise<Float32Array>
  ): Promise<Float32Array> {
    const key = this.buildEmbeddingKey(keyword);

    // Check cache
    const cached = await this.redis.getBuffer(key);
    if (cached) {
      this.recordHit("embedding", cached.length);
      return new Float32Array(cached.buffer);
    }

    // Compute and cache
    const embedding = await computeFn();
    const buffer = Buffer.from(embedding.buffer);

    // Store with no expiry (embeddings never change)
    await this.redis.set(key, buffer);
    this.recordMiss("embedding");

    return embedding;
  }

  /**
   * Batch get/compute embeddings for multiple keywords.
   * Optimized for high throughput - uses pipeline.
   */
  async batchGetOrComputeEmbeddings(
    keywords: string[],
    computeFn: (keywords: string[]) => Promise<Map<string, Float32Array>>
  ): Promise<Map<string, Float32Array>> {
    const results = new Map<string, Float32Array>();
    const missingKeywords: string[] = [];

    // Pipeline cache reads
    const pipeline = this.redis.pipeline();
    const keyMap = new Map<string, string>(); // key -> keyword

    for (const keyword of keywords) {
      const key = this.buildEmbeddingKey(keyword);
      keyMap.set(key, keyword);
      pipeline.getBuffer(key);
    }

    const pipelineResults = await pipeline.exec();
    if (!pipelineResults) {
      throw new Error("Pipeline execution failed");
    }

    // Process results
    let keyIndex = 0;
    for (const [key] of keyMap) {
      const [err, cached] = pipelineResults[keyIndex] as [Error | null, Buffer | null];
      const keyword = keyMap.get(key)!;

      if (!err && cached) {
        results.set(keyword, new Float32Array(cached.buffer));
        this.recordHit("embedding", cached.length);
      } else {
        missingKeywords.push(keyword);
      }
      keyIndex++;
    }

    // Compute missing embeddings in batch
    if (missingKeywords.length > 0) {
      const computed = await computeFn(missingKeywords);

      // Pipeline cache writes
      const writePipeline = this.redis.pipeline();
      for (const [keyword, embedding] of computed) {
        const key = this.buildEmbeddingKey(keyword);
        const buffer = Buffer.from(embedding.buffer);
        writePipeline.set(key, buffer);
        results.set(keyword, embedding);
        this.recordMiss("embedding");
      }
      await writePipeline.exec();
    }

    return results;
  }

  private buildEmbeddingKey(keyword: string): string {
    const hash = this.hashString(keyword);
    return `kw:emb:${hash}`;
  }

  // --------------------------------------------------------------------------
  // L2: CATEGORY CLASSIFICATION CACHE
  // --------------------------------------------------------------------------

  /**
   * Get or compute category classification.
   * Shared within same vertical (e-commerce clients share classifications).
   */
  async getOrComputeCategory(
    keyword: string,
    vertical: string,
    computeFn: () => Promise<CategoryClassification>
  ): Promise<CategoryClassification> {
    const key = this.buildCategoryKey(keyword, vertical);

    // Check cache
    const cached = await this.redis.get(key);
    if (cached) {
      this.recordHit("category", cached.length);
      return JSON.parse(cached);
    }

    // Compute and cache
    const classification = await computeFn();
    const serialized = JSON.stringify(classification);

    await this.redis.setex(key, this.config.categoryTTL, serialized);
    this.recordMiss("category");

    return classification;
  }

  /**
   * Batch category lookups with singleflight pattern.
   * Prevents duplicate API calls when multiple clients request same keyword.
   */
  async batchGetOrComputeCategories(
    keywords: string[],
    vertical: string,
    computeFn: (keywords: string[]) => Promise<Map<string, CategoryClassification>>
  ): Promise<Map<string, CategoryClassification>> {
    const results = new Map<string, CategoryClassification>();
    const missingKeywords: string[] = [];

    // Check cache for all keywords
    const pipeline = this.redis.pipeline();
    for (const keyword of keywords) {
      pipeline.get(this.buildCategoryKey(keyword, vertical));
    }

    const pipelineResults = await pipeline.exec();
    if (!pipelineResults) {
      throw new Error("Pipeline execution failed");
    }

    // Process results
    for (let i = 0; i < keywords.length; i++) {
      const [err, cached] = pipelineResults[i] as [Error | null, string | null];
      if (!err && cached) {
        results.set(keywords[i], JSON.parse(cached));
        this.recordHit("category", cached.length);
      } else {
        missingKeywords.push(keywords[i]);
      }
    }

    // Compute missing with singleflight deduplication
    if (missingKeywords.length > 0) {
      const computed = await this.withSingleflight(
        `cat:${vertical}:batch`,
        () => computeFn(missingKeywords)
      );

      // Cache results
      const writePipeline = this.redis.pipeline();
      for (const [keyword, classification] of computed) {
        const key = this.buildCategoryKey(keyword, vertical);
        writePipeline.setex(key, this.config.categoryTTL, JSON.stringify(classification));
        results.set(keyword, classification);
        this.recordMiss("category");
      }
      await writePipeline.exec();
    }

    return results;
  }

  private buildCategoryKey(keyword: string, vertical: string): string {
    const hash = this.hashString(keyword);
    return `kw:cat:${hash}:${vertical}`;
  }

  // --------------------------------------------------------------------------
  // L3: COMPETITOR CATALOG CACHE
  // --------------------------------------------------------------------------

  /**
   * Get or crawl competitor catalog.
   * 100% shared - varle.lt catalog is the same for all clients.
   */
  async getOrCrawlCompetitorCatalog(
    domain: string,
    crawlFn: () => Promise<CompetitorCatalog>
  ): Promise<CompetitorCatalog> {
    const key = this.buildCompetitorKey(domain);

    // Check cache
    const cached = await this.redis.get(key);
    if (cached) {
      this.recordHit("competitor", cached.length);
      return JSON.parse(cached);
    }

    // Use singleflight to prevent duplicate crawls
    const catalog = await this.withSingleflight(`crawl:${domain}`, crawlFn);
    const serialized = JSON.stringify(catalog);

    await this.redis.setex(key, this.config.competitorTTL, serialized);
    this.recordMiss("competitor");

    return catalog;
  }

  private buildCompetitorKey(domain: string): string {
    return `comp:catalog:${domain}`;
  }

  // --------------------------------------------------------------------------
  // L4: LLM RESPONSE CACHE
  // --------------------------------------------------------------------------

  /**
   * Get or compute LLM response.
   * Shared for identical prompts across clients.
   */
  async getOrComputeLLMResponse(
    model: string,
    prompt: string,
    computeFn: () => Promise<{ response: string; tokens: { input: number; output: number }; cost: number }>
  ): Promise<LLMCacheEntry> {
    const key = this.buildLLMKey(model, prompt);

    // Check cache
    const cached = await this.redis.get(key);
    if (cached) {
      this.recordHit("llm", cached.length);
      const entry = JSON.parse(cached) as LLMCacheEntry;
      // Track cost saved
      this.stats.get("llm")!.costSaved += entry.cost;
      return entry;
    }

    // Compute and cache
    const result = await computeFn();
    const entry: LLMCacheEntry = {
      ...result,
      model,
      cachedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(entry);

    await this.redis.setex(key, this.config.llmResponseTTL, serialized);
    this.recordMiss("llm");

    return entry;
  }

  private buildLLMKey(model: string, prompt: string): string {
    const hash = this.hashString(prompt);
    return `llm:${model}:${hash}`;
  }

  // --------------------------------------------------------------------------
  // L5: CLIENT SESSION CACHE
  // --------------------------------------------------------------------------

  /**
   * Get or create client session.
   * NOT shared - client-specific data.
   */
  async getOrCreateSession(
    clientId: string,
    sessionId: string,
    createFn: () => Promise<SessionData>
  ): Promise<SessionData> {
    const key = this.buildSessionKey(clientId, sessionId);

    // Check cache
    const cached = await this.redis.get(key);
    if (cached) {
      const session = JSON.parse(cached) as SessionData;
      // Update last active
      session.lastActive = new Date().toISOString();
      await this.redis.setex(key, this.config.sessionTTL, JSON.stringify(session));
      return session;
    }

    // Create new session
    const session = await createFn();
    await this.redis.setex(key, this.config.sessionTTL, JSON.stringify(session));

    return session;
  }

  async updateSession(clientId: string, sessionId: string, update: Partial<SessionData>): Promise<void> {
    const key = this.buildSessionKey(clientId, sessionId);
    const cached = await this.redis.get(key);

    if (!cached) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = JSON.parse(cached) as SessionData;
    const updated = {
      ...session,
      ...update,
      lastActive: new Date().toISOString(),
    };

    await this.redis.setex(key, this.config.sessionTTL, JSON.stringify(updated));
  }

  private buildSessionKey(clientId: string, sessionId: string): string {
    return `client:${clientId}:session:${sessionId}`;
  }

  // --------------------------------------------------------------------------
  // SINGLEFLIGHT PATTERN
  // --------------------------------------------------------------------------

  private inflight = new Map<string, Promise<any>>();

  /**
   * Singleflight pattern: Coalesce duplicate requests.
   * If 50 clients request varle.lt catalog simultaneously, only ONE crawl happens.
   */
  async withSingleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check if request is already in flight
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    // Start new request
    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Redis-based singleflight for distributed systems.
   * Uses SET NX EX pattern with pub/sub for completion notification.
   */
  async withDistributedSingleflight<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttl?: number; timeout?: number } = {}
  ): Promise<T> {
    const { ttl = 300, timeout = 30000 } = options;
    const lockKey = `singleflight:lock:${key}`;
    const resultKey = `singleflight:result:${key}`;
    const channelKey = `singleflight:done:${key}`;

    // Try to acquire lock
    const acquired = await this.redis.set(lockKey, "1", "EX", ttl, "NX");

    if (acquired) {
      // We're the leader - execute the function
      try {
        const result = await fn();
        const serialized = JSON.stringify(result);

        // Store result and notify waiters
        await this.redis.setex(resultKey, ttl, serialized);
        await this.redis.publish(channelKey, "done");

        return result;
      } catch (error) {
        // Release lock on error
        await this.redis.del(lockKey);
        throw error;
      }
    } else {
      // We're a follower - wait for result
      return new Promise((resolve, reject) => {
        const subscriber = this.redis.duplicate();
        let resolved = false;

        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            subscriber.unsubscribe(channelKey);
            subscriber.quit();
          }
        };

        // Timeout handler
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Singleflight timeout waiting for ${key}`));
        }, timeout);

        // Subscribe to completion
        subscriber.subscribe(channelKey, async () => {
          const result = await this.redis.get(resultKey);
          if (result) {
            clearTimeout(timer);
            cleanup();
            resolve(JSON.parse(result));
          }
        });

        // Also poll for result (in case we missed the notification)
        const poll = async () => {
          const result = await this.redis.get(resultKey);
          if (result && !resolved) {
            clearTimeout(timer);
            cleanup();
            resolve(JSON.parse(result));
          }
        };

        // Poll immediately and every 100ms
        poll();
        const pollInterval = setInterval(() => {
          if (!resolved) poll();
          else clearInterval(pollInterval);
        }, 100);
      });
    }
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  private hashString(input: string): string {
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
  }

  private recordHit(layer: CacheLayer, bytes: number): void {
    const stats = this.stats.get(layer)!;
    stats.hits++;
    stats.bytesSaved += bytes;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);
  }

  private recordMiss(layer: CacheLayer): void {
    const stats = this.stats.get(layer)!;
    stats.misses++;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);
  }

  getStats(): Map<CacheLayer, CacheStats> {
    return new Map(this.stats);
  }

  async getGlobalStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRateByLayer: Record<CacheLayer, number>;
    costSavedTotal: number;
  }> {
    const info = await this.redis.info("memory");
    const memoryMatch = info.match(/used_memory_human:(\S+)/);

    const hitRateByLayer: Record<CacheLayer, number> = {} as any;
    let costSavedTotal = 0;

    for (const [layer, stats] of this.stats) {
      hitRateByLayer[layer] = stats.hitRate;
      costSavedTotal += stats.costSaved;
    }

    return {
      totalKeys: await this.redis.dbsize(),
      memoryUsage: memoryMatch ? memoryMatch[1] : "unknown",
      hitRateByLayer,
      costSavedTotal,
    };
  }
}

// Type definitions
interface CategoryClassification {
  category: string;
  subcategory?: string;
  confidence: number;
  intent: "transactional" | "commercial" | "informational" | "navigational";
  reasoning: string;
}

interface CompetitorCatalog {
  domain: string;
  categories: Array<{
    name: string;
    productCount: number;
    priceRange: { min: number; max: number };
  }>;
  topProducts: Array<{
    name: string;
    category: string;
    price: number;
  }>;
  crawledAt: string;
  nextCrawl: string;
}

interface LLMCacheEntry {
  response: string;
  tokens: { input: number; output: number };
  cost: number;
  model: string;
  cachedAt: string;
}

interface SessionData {
  clientId: string;
  focusSelection: {
    categories: string[];
    weights: Record<string, number>;
  };
  mappedKeywords: Array<{
    keyword: string;
    targetPage: string;
    confidence: number;
  }>;
  refinements: string[];
  createdAt: string;
  lastActive: string;
}
```

---

## 2. Cost Tracker

### Per-Client Attribution

```typescript
// src/server/features/keyword-intelligence/services/CostTracker.ts

import { Redis } from "ioredis";
import { db } from "@/db";
import { costLedger, clientUsage } from "@/db/schema";

interface CostEvent {
  clientId: string;
  eventType:
    | "embedding_compute"
    | "embedding_cache_hit"
    | "category_classify"
    | "category_cache_hit"
    | "competitor_crawl"
    | "competitor_cache_hit"
    | "llm_call"
    | "llm_cache_hit";
  model?: string;
  tokens?: { input: number; output: number };
  cost: number;
  cacheHit: boolean;
  sharedCost?: number; // Cost that would have been paid if not cached
  timestamp: Date;
}

interface ClientCostSummary {
  clientId: string;
  period: "day" | "week" | "month";
  totalCost: number;
  costByType: Record<string, number>;
  cacheHitRate: number;
  costSaved: number;
  effectiveCostPerKeyword: number;
  keywordsProcessed: number;
}

interface AllocationModel {
  /** How to split shared costs */
  method: "equal" | "proportional" | "first_pays" | "pool";
  /** Minimum cost per operation (for pool method) */
  minimumCost?: number;
  /** Pool size for amortization */
  poolSize?: number;
}

export class CostTracker {
  private redis: Redis;
  private allocationModel: AllocationModel;

  constructor(redis: Redis, allocationModel?: AllocationModel) {
    this.redis = redis;
    this.allocationModel = allocationModel || {
      method: "first_pays",
    };
  }

  // --------------------------------------------------------------------------
  // COST TRACKING
  // --------------------------------------------------------------------------

  /**
   * Track a cost event for a client.
   * Records both actual cost and "would-be" cost (for cache hits).
   */
  async trackCost(event: CostEvent): Promise<void> {
    const dayKey = this.getDayKey(event.timestamp);
    const monthKey = this.getMonthKey(event.timestamp);

    // Update real-time counters in Redis
    const pipeline = this.redis.pipeline();

    // Daily counters
    pipeline.hincrby(`cost:daily:${dayKey}:${event.clientId}`, "total", Math.round(event.cost * 1000000));
    pipeline.hincrby(`cost:daily:${dayKey}:${event.clientId}`, event.eventType, Math.round(event.cost * 1000000));
    pipeline.hincrby(`cost:daily:${dayKey}:${event.clientId}`, "count", 1);

    if (event.cacheHit) {
      pipeline.hincrby(`cost:daily:${dayKey}:${event.clientId}`, "cache_hits", 1);
      pipeline.hincrby(`cost:daily:${dayKey}:${event.clientId}`, "cost_saved", Math.round((event.sharedCost || 0) * 1000000));
    }

    // Monthly counters
    pipeline.hincrby(`cost:monthly:${monthKey}:${event.clientId}`, "total", Math.round(event.cost * 1000000));

    // Global counters
    pipeline.hincrby(`cost:global:${dayKey}`, "total", Math.round(event.cost * 1000000));
    pipeline.hincrby(`cost:global:${dayKey}`, event.eventType, Math.round(event.cost * 1000000));

    // Expire daily keys after 90 days
    pipeline.expire(`cost:daily:${dayKey}:${event.clientId}`, 90 * 24 * 60 * 60);
    pipeline.expire(`cost:global:${dayKey}`, 90 * 24 * 60 * 60);

    await pipeline.exec();

    // Queue for batch persistence to database
    await this.queueForPersistence(event);
  }

  /**
   * Track embedding computation cost.
   * Cost model: Free (local compute), but track for usage limits.
   */
  async trackEmbeddingCost(
    clientId: string,
    keywordCount: number,
    cacheHit: boolean
  ): Promise<void> {
    // Local embeddings are free, but we track for usage analytics
    const costPerKeyword = 0; // Free
    const wouldBeCost = 0.00002; // OpenAI ada-002 equivalent

    await this.trackCost({
      clientId,
      eventType: cacheHit ? "embedding_cache_hit" : "embedding_compute",
      cost: costPerKeyword * keywordCount,
      cacheHit,
      sharedCost: cacheHit ? wouldBeCost * keywordCount : undefined,
      timestamp: new Date(),
    });
  }

  /**
   * Track category classification cost.
   * Cost model: $0.20/1M input, $0.50/1M output (Grok Fast).
   */
  async trackCategoryClassificationCost(
    clientId: string,
    tokens: { input: number; output: number },
    cacheHit: boolean
  ): Promise<void> {
    const inputCost = (tokens.input / 1_000_000) * 0.2;
    const outputCost = (tokens.output / 1_000_000) * 0.5;
    const totalCost = cacheHit ? 0 : inputCost + outputCost;

    await this.trackCost({
      clientId,
      eventType: cacheHit ? "category_cache_hit" : "category_classify",
      model: "grok-4.1-fast",
      tokens,
      cost: totalCost,
      cacheHit,
      sharedCost: inputCost + outputCost,
      timestamp: new Date(),
    });
  }

  /**
   * Track competitor catalog crawl cost.
   * Cost model: $0 (self-hosted Crawl4AI), but track API calls avoided.
   */
  async trackCompetitorCrawlCost(
    clientId: string,
    domain: string,
    pagesCount: number,
    cacheHit: boolean
  ): Promise<void> {
    // Crawling is free, but we track "would-be" cost if using paid API
    const wouldBeCost = pagesCount * 0.001; // $0.001 per page (Firecrawl equivalent)

    await this.trackCost({
      clientId,
      eventType: cacheHit ? "competitor_cache_hit" : "competitor_crawl",
      cost: 0,
      cacheHit,
      sharedCost: wouldBeCost,
      timestamp: new Date(),
    });
  }

  /**
   * Track LLM API call cost.
   * Supports multiple models with different pricing.
   */
  async trackLLMCost(
    clientId: string,
    model: string,
    tokens: { input: number; output: number },
    cacheHit: boolean
  ): Promise<void> {
    const pricing = this.getModelPricing(model);
    const inputCost = (tokens.input / 1_000_000) * pricing.input;
    const outputCost = (tokens.output / 1_000_000) * pricing.output;
    const totalCost = cacheHit ? 0 : inputCost + outputCost;

    await this.trackCost({
      clientId,
      eventType: cacheHit ? "llm_cache_hit" : "llm_call",
      model,
      tokens,
      cost: totalCost,
      cacheHit,
      sharedCost: inputCost + outputCost,
      timestamp: new Date(),
    });
  }

  private getModelPricing(model: string): { input: number; output: number } {
    const pricing: Record<string, { input: number; output: number }> = {
      "grok-4.1-fast": { input: 0.2, output: 0.5 },
      "gpt-5.4-mini": { input: 0.75, output: 4.5 },
      "claude-haiku-4.5": { input: 1.0, output: 5.0 },
      "claude-sonnet-4.6": { input: 3.0, output: 15.0 },
      "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
    };
    return pricing[model] || { input: 1.0, output: 5.0 };
  }

  // --------------------------------------------------------------------------
  // COST ALLOCATION
  // --------------------------------------------------------------------------

  /**
   * Allocate shared cost to clients.
   * Multiple models supported based on business requirements.
   */
  allocateSharedCost(
    totalCost: number,
    beneficiaries: Array<{ clientId: string; weight: number }>
  ): Map<string, number> {
    const allocations = new Map<string, number>();

    switch (this.allocationModel.method) {
      case "equal":
        // Equal split among all beneficiaries
        const equalShare = totalCost / beneficiaries.length;
        for (const { clientId } of beneficiaries) {
          allocations.set(clientId, equalShare);
        }
        break;

      case "proportional":
        // Weighted by usage/size
        const totalWeight = beneficiaries.reduce((sum, b) => sum + b.weight, 0);
        for (const { clientId, weight } of beneficiaries) {
          allocations.set(clientId, (weight / totalWeight) * totalCost);
        }
        break;

      case "first_pays":
        // First requester pays full cost, others get free
        // This is the simplest model for cache sharing
        allocations.set(beneficiaries[0].clientId, totalCost);
        for (let i = 1; i < beneficiaries.length; i++) {
          allocations.set(beneficiaries[i].clientId, 0);
        }
        break;

      case "pool":
        // Pool model: all clients pay minimum, excess goes to pool
        const minimum = this.allocationModel.minimumCost || 0.0001;
        const poolContribution = minimum * beneficiaries.length;

        if (poolContribution >= totalCost) {
          // Pool covers the cost
          for (const { clientId } of beneficiaries) {
            allocations.set(clientId, minimum);
          }
        } else {
          // First payer covers deficit
          allocations.set(beneficiaries[0].clientId, totalCost - poolContribution + minimum);
          for (let i = 1; i < beneficiaries.length; i++) {
            allocations.set(beneficiaries[i].clientId, minimum);
          }
        }
        break;
    }

    return allocations;
  }

  // --------------------------------------------------------------------------
  // REPORTING
  // --------------------------------------------------------------------------

  /**
   * Get cost summary for a client.
   */
  async getClientCostSummary(
    clientId: string,
    period: "day" | "week" | "month"
  ): Promise<ClientCostSummary> {
    const keys = this.getKeysForPeriod(clientId, period);

    // Aggregate costs from Redis
    let totalCost = 0;
    let totalOperations = 0;
    let cacheHits = 0;
    let costSaved = 0;
    const costByType: Record<string, number> = {};

    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (!data) continue;

      totalCost += parseInt(data.total || "0") / 1000000;
      totalOperations += parseInt(data.count || "0");
      cacheHits += parseInt(data.cache_hits || "0");
      costSaved += parseInt(data.cost_saved || "0") / 1000000;

      // Aggregate by type
      for (const [k, v] of Object.entries(data)) {
        if (!["total", "count", "cache_hits", "cost_saved"].includes(k)) {
          costByType[k] = (costByType[k] || 0) + parseInt(v) / 1000000;
        }
      }
    }

    return {
      clientId,
      period,
      totalCost,
      costByType,
      cacheHitRate: totalOperations > 0 ? cacheHits / totalOperations : 0,
      costSaved,
      effectiveCostPerKeyword:
        totalOperations > 0 ? totalCost / totalOperations : 0,
      keywordsProcessed: totalOperations,
    };
  }

  /**
   * Get global platform cost summary.
   */
  async getGlobalCostSummary(period: "day" | "week" | "month"): Promise<{
    totalCost: number;
    totalOperations: number;
    avgCostPerOperation: number;
    cacheHitRate: number;
    costSavedByCache: number;
    topClients: Array<{ clientId: string; cost: number }>;
  }> {
    // Aggregate from global keys
    const keys = await this.redis.keys(`cost:global:*`);

    let totalCost = 0;
    let totalOperations = 0;

    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (!data) continue;

      totalCost += parseInt(data.total || "0") / 1000000;
      totalOperations += parseInt(data.count || "0");
    }

    // Get top clients
    const clientCosts = new Map<string, number>();
    const clientKeys = await this.redis.keys(`cost:daily:*`);

    for (const key of clientKeys) {
      const match = key.match(/cost:daily:\d+:(\w+)/);
      if (match) {
        const clientId = match[1];
        const data = await this.redis.hgetall(key);
        const cost = parseInt(data?.total || "0") / 1000000;
        clientCosts.set(clientId, (clientCosts.get(clientId) || 0) + cost);
      }
    }

    const topClients = Array.from(clientCosts.entries())
      .map(([clientId, cost]) => ({ clientId, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    return {
      totalCost,
      totalOperations,
      avgCostPerOperation: totalOperations > 0 ? totalCost / totalOperations : 0,
      cacheHitRate: 0, // Would need separate tracking
      costSavedByCache: 0,
      topClients,
    };
  }

  // --------------------------------------------------------------------------
  // PERSISTENCE
  // --------------------------------------------------------------------------

  private async queueForPersistence(event: CostEvent): Promise<void> {
    // Add to persistence queue (processed by worker)
    await this.redis.lpush("cost:persistence:queue", JSON.stringify(event));
  }

  /**
   * Persist queued events to database (called by worker).
   */
  async persistQueuedEvents(batchSize: number = 100): Promise<number> {
    const events: CostEvent[] = [];

    for (let i = 0; i < batchSize; i++) {
      const eventJson = await this.redis.rpop("cost:persistence:queue");
      if (!eventJson) break;
      events.push(JSON.parse(eventJson));
    }

    if (events.length === 0) return 0;

    // Batch insert to database
    await db.insert(costLedger).values(
      events.map((e) => ({
        clientId: e.clientId,
        eventType: e.eventType,
        model: e.model,
        inputTokens: e.tokens?.input,
        outputTokens: e.tokens?.output,
        costUsd: e.cost,
        cacheHit: e.cacheHit,
        sharedCostUsd: e.sharedCost,
        timestamp: e.timestamp,
      }))
    );

    return events.length;
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  private getDayKey(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }

  private getMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7).replace(/-/g, "");
  }

  private getKeysForPeriod(clientId: string, period: "day" | "week" | "month"): string[] {
    const now = new Date();
    const keys: string[] = [];

    switch (period) {
      case "day":
        keys.push(`cost:daily:${this.getDayKey(now)}:${clientId}`);
        break;
      case "week":
        for (let i = 0; i < 7; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          keys.push(`cost:daily:${this.getDayKey(date)}:${clientId}`);
        }
        break;
      case "month":
        keys.push(`cost:monthly:${this.getMonthKey(now)}:${clientId}`);
        break;
    }

    return keys;
  }
}
```

---

## 3. Batch Optimizer

### Grouping Similar Requests

```typescript
// src/server/features/keyword-intelligence/services/BatchOptimizer.ts

import { Redis } from "ioredis";
import { Job, Queue, Worker } from "bullmq";

interface KeywordClassificationRequest {
  requestId: string;
  clientId: string;
  keyword: string;
  vertical: string;
  priority: "high" | "normal" | "low";
  createdAt: Date;
  deadline?: Date;
}

interface BatchedRequest {
  batchId: string;
  keywords: string[];
  vertical: string;
  clientIds: string[]; // For cost attribution
  requestIds: string[]; // For response mapping
}

interface BatchConfig {
  /** Minimum keywords to form a batch */
  minBatchSize: number;
  /** Maximum keywords per batch */
  maxBatchSize: number;
  /** Maximum wait time before processing small batch (ms) */
  maxWaitTime: number;
  /** Group by vertical for better cache hits */
  groupByVertical: boolean;
}

export class BatchOptimizer {
  private redis: Redis;
  private config: BatchConfig;
  private queue: Queue;
  private pendingRequests: Map<string, KeywordClassificationRequest[]>;

  constructor(redis: Redis, config?: Partial<BatchConfig>) {
    this.redis = redis;
    this.config = {
      minBatchSize: 50,
      maxBatchSize: 500,
      maxWaitTime: 5000, // 5 seconds
      groupByVertical: true,
      ...config,
    };
    this.pendingRequests = new Map();

    this.queue = new Queue("keyword-classification", {
      connection: redis,
    });
  }

  // --------------------------------------------------------------------------
  // REQUEST QUEUING
  // --------------------------------------------------------------------------

  /**
   * Add keyword classification request to batch queue.
   * Returns immediately - caller receives result via callback/webhook.
   */
  async queueRequest(request: KeywordClassificationRequest): Promise<string> {
    const groupKey = this.config.groupByVertical
      ? request.vertical
      : "default";

    // Add to Redis sorted set (score = timestamp for ordering)
    const score = request.createdAt.getTime();
    await this.redis.zadd(
      `batch:pending:${groupKey}`,
      score,
      JSON.stringify(request)
    );

    // Schedule batch processing
    await this.scheduleBatchCheck(groupKey);

    return request.requestId;
  }

  /**
   * Queue multiple keywords from same client.
   * More efficient than individual requests.
   */
  async queueBulkRequest(
    clientId: string,
    keywords: string[],
    vertical: string,
    priority: "high" | "normal" | "low" = "normal"
  ): Promise<string[]> {
    const requestIds: string[] = [];
    const now = new Date();

    const pipeline = this.redis.pipeline();
    const groupKey = this.config.groupByVertical ? vertical : "default";

    for (const keyword of keywords) {
      const request: KeywordClassificationRequest = {
        requestId: `${clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        clientId,
        keyword,
        vertical,
        priority,
        createdAt: now,
      };

      requestIds.push(request.requestId);
      pipeline.zadd(
        `batch:pending:${groupKey}`,
        now.getTime(),
        JSON.stringify(request)
      );
    }

    await pipeline.exec();
    await this.scheduleBatchCheck(groupKey);

    return requestIds;
  }

  // --------------------------------------------------------------------------
  // BATCH PROCESSING
  // --------------------------------------------------------------------------

  /**
   * Check if batch is ready to process.
   * Triggers when: batch size reached OR max wait time exceeded.
   */
  private async scheduleBatchCheck(groupKey: string): Promise<void> {
    const lockKey = `batch:check:${groupKey}`;

    // Prevent multiple checks for same group
    const acquired = await this.redis.set(lockKey, "1", "EX", 1, "NX");
    if (!acquired) return;

    const pendingCount = await this.redis.zcard(`batch:pending:${groupKey}`);

    if (pendingCount >= this.config.maxBatchSize) {
      // Batch is full - process immediately
      await this.processBatch(groupKey);
    } else if (pendingCount >= this.config.minBatchSize) {
      // Check oldest request age
      const oldest = await this.redis.zrange(`batch:pending:${groupKey}`, 0, 0);
      if (oldest.length > 0) {
        const request = JSON.parse(oldest[0]) as KeywordClassificationRequest;
        const age = Date.now() - request.createdAt.getTime();

        if (age >= this.config.maxWaitTime) {
          // Waited long enough - process
          await this.processBatch(groupKey);
        } else {
          // Schedule delayed check
          await this.queue.add(
            "batch-check",
            { groupKey },
            { delay: this.config.maxWaitTime - age }
          );
        }
      }
    } else if (pendingCount > 0) {
      // Not enough for batch yet - schedule check at maxWaitTime
      await this.queue.add(
        "batch-check",
        { groupKey },
        { delay: this.config.maxWaitTime }
      );
    }
  }

  /**
   * Process a batch of keyword classification requests.
   */
  private async processBatch(groupKey: string): Promise<void> {
    // Atomically pop batch from queue
    const batchSize = Math.min(
      this.config.maxBatchSize,
      await this.redis.zcard(`batch:pending:${groupKey}`)
    );

    if (batchSize === 0) return;

    // Get and remove items atomically
    const items = await this.redis.zpopmin(
      `batch:pending:${groupKey}`,
      batchSize
    );

    if (!items || items.length === 0) return;

    // Parse requests
    const requests: KeywordClassificationRequest[] = [];
    for (let i = 0; i < items.length; i += 2) {
      requests.push(JSON.parse(items[i] as string));
    }

    // Deduplicate keywords (same keyword might be requested by multiple clients)
    const keywordMap = new Map<string, string[]>(); // keyword -> requestIds[]
    const clientMap = new Map<string, Set<string>>(); // keyword -> clientIds

    for (const request of requests) {
      if (!keywordMap.has(request.keyword)) {
        keywordMap.set(request.keyword, []);
        clientMap.set(request.keyword, new Set());
      }
      keywordMap.get(request.keyword)!.push(request.requestId);
      clientMap.get(request.keyword)!.add(request.clientId);
    }

    // Create optimized batch
    const batch: BatchedRequest = {
      batchId: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      keywords: Array.from(keywordMap.keys()),
      vertical: groupKey,
      clientIds: Array.from(new Set(requests.map((r) => r.clientId))),
      requestIds: requests.map((r) => r.requestId),
    };

    // Queue for processing
    await this.queue.add("process-batch", batch, {
      priority: this.getBatchPriority(requests),
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  }

  private getBatchPriority(
    requests: KeywordClassificationRequest[]
  ): number {
    // Lower number = higher priority
    const hasHigh = requests.some((r) => r.priority === "high");
    const hasNormal = requests.some((r) => r.priority === "normal");

    if (hasHigh) return 1;
    if (hasNormal) return 5;
    return 10;
  }

  // --------------------------------------------------------------------------
  // RESULT DISTRIBUTION
  // --------------------------------------------------------------------------

  /**
   * Distribute batch results to individual requesters.
   */
  async distributeBatchResults(
    batchId: string,
    results: Map<string, any>
  ): Promise<void> {
    // Get batch metadata
    const batchData = await this.redis.get(`batch:meta:${batchId}`);
    if (!batchData) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const batch = JSON.parse(batchData) as BatchedRequest;

    // Store results for each requester
    const pipeline = this.redis.pipeline();

    for (const [keyword, result] of results) {
      const requestIds = batch.requestIds.filter((rid) => rid.includes(keyword));

      for (const requestId of requestIds) {
        pipeline.set(
          `result:${requestId}`,
          JSON.stringify(result),
          "EX",
          3600 // 1 hour TTL
        );
        // Publish to channel for real-time notification
        pipeline.publish(`result:ready:${requestId}`, JSON.stringify(result));
      }
    }

    await pipeline.exec();
  }

  /**
   * Get result for a specific request.
   */
  async getResult(requestId: string): Promise<any | null> {
    const result = await this.redis.get(`result:${requestId}`);
    return result ? JSON.parse(result) : null;
  }

  /**
   * Wait for result with timeout.
   */
  async waitForResult(
    requestId: string,
    timeout: number = 30000
  ): Promise<any> {
    // Check if already available
    const existing = await this.getResult(requestId);
    if (existing) return existing;

    // Subscribe and wait
    return new Promise((resolve, reject) => {
      const subscriber = this.redis.duplicate();
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          subscriber.unsubscribe(`result:ready:${requestId}`);
          subscriber.quit();
        }
      };

      // Timeout
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for result: ${requestId}`));
      }, timeout);

      // Subscribe
      subscriber.subscribe(`result:ready:${requestId}`, (err) => {
        if (err) {
          cleanup();
          reject(err);
        }
      });

      subscriber.on("message", (channel, message) => {
        if (channel === `result:ready:${requestId}`) {
          clearTimeout(timer);
          cleanup();
          resolve(JSON.parse(message));
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // OPTIMIZATION METRICS
  // --------------------------------------------------------------------------

  /**
   * Get batch optimization statistics.
   */
  async getOptimizationStats(): Promise<{
    avgBatchSize: number;
    deduplicationRate: number;
    avgWaitTime: number;
    batchesProcessed: number;
    keywordsProcessed: number;
    uniqueKeywords: number;
  }> {
    const stats = await this.redis.hgetall("batch:stats:global");

    const batchesProcessed = parseInt(stats?.batches || "0");
    const keywordsProcessed = parseInt(stats?.keywords || "0");
    const uniqueKeywords = parseInt(stats?.unique || "0");
    const totalWaitTime = parseInt(stats?.wait_time || "0");

    return {
      avgBatchSize: batchesProcessed > 0 ? keywordsProcessed / batchesProcessed : 0,
      deduplicationRate:
        keywordsProcessed > 0
          ? (keywordsProcessed - uniqueKeywords) / keywordsProcessed
          : 0,
      avgWaitTime: batchesProcessed > 0 ? totalWaitTime / batchesProcessed : 0,
      batchesProcessed,
      keywordsProcessed,
      uniqueKeywords,
    };
  }
}
```

---

## 4. Redis Key Schemas

### Complete Key Schema Reference

```typescript
// src/server/features/keyword-intelligence/redis-keys.ts

/**
 * Redis Key Schema for Keyword Intelligence System
 * 
 * Naming Convention: {module}:{type}:{identifier}
 * 
 * Memory Budget (4GB Redis allocation):
 * - L1 Embeddings: 2GB (5M keywords x 384 floats x 4 bytes / compression)
 * - L2 Categories: 500MB
 * - L3 Competitors: 200MB
 * - L4 LLM Cache: 500MB
 * - L5 Sessions: 300MB
 * - Operational: 500MB
 */

export const REDIS_KEYS = {
  // --------------------------------------------------------------------------
  // L1: KEYWORD EMBEDDING CACHE (Global, Permanent)
  // --------------------------------------------------------------------------
  
  /**
   * Keyword embedding vector.
   * Key: kw:emb:{sha256(keyword)[0:16]}
   * Value: Binary Float32Array (384 * 4 = 1536 bytes)
   * TTL: Never expires
   * Example: kw:emb:a1b2c3d4e5f6g7h8
   */
  embedding: (keywordHash: string) => `kw:emb:${keywordHash}`,

  /**
   * Embedding metadata (model version, computed date).
   * Key: kw:emb:meta:{sha256(keyword)[0:16]}
   * Value: JSON {model, version, computedAt}
   * TTL: Never expires
   */
  embeddingMeta: (keywordHash: string) => `kw:emb:meta:${keywordHash}`,

  // --------------------------------------------------------------------------
  // L2: CATEGORY CLASSIFICATION CACHE (Global, 7 days)
  // --------------------------------------------------------------------------

  /**
   * Category classification result.
   * Key: kw:cat:{sha256(keyword)[0:16]}:{vertical}
   * Value: JSON {category, subcategory, confidence, intent, reasoning}
   * TTL: 7 days (604800 seconds)
   * Example: kw:cat:a1b2c3d4e5f6g7h8:ecommerce
   */
  category: (keywordHash: string, vertical: string) =>
    `kw:cat:${keywordHash}:${vertical}`,

  /**
   * Category classification version (for invalidation).
   * Key: kw:cat:version:{vertical}
   * Value: Integer (increments on schema change)
   */
  categoryVersion: (vertical: string) => `kw:cat:version:${vertical}`,

  // --------------------------------------------------------------------------
  // L3: COMPETITOR CATALOG CACHE (Global, 24 hours)
  // --------------------------------------------------------------------------

  /**
   * Competitor catalog data.
   * Key: comp:catalog:{domain}
   * Value: JSON {categories, products, priceRanges, crawledAt}
   * TTL: 24 hours (86400 seconds)
   * Example: comp:catalog:varle.lt
   */
  competitorCatalog: (domain: string) => `comp:catalog:${domain}`,

  /**
   * Competitor catalog crawl lock (singleflight).
   * Key: comp:crawl:lock:{domain}
   * Value: "1"
   * TTL: 5 minutes (300 seconds) - crawl timeout
   */
  competitorCrawlLock: (domain: string) => `comp:crawl:lock:${domain}`,

  /**
   * Competitor list for a vertical.
   * Key: comp:list:{vertical}
   * Value: JSON array of domains
   * TTL: 7 days
   */
  competitorList: (vertical: string) => `comp:list:${vertical}`,

  // --------------------------------------------------------------------------
  // L4: LLM RESPONSE CACHE (Global, 7 days)
  // --------------------------------------------------------------------------

  /**
   * LLM response cache.
   * Key: llm:{model}:{sha256(prompt)[0:16]}
   * Value: JSON {response, tokens, cost, cachedAt}
   * TTL: 7 days (604800 seconds)
   * Example: llm:grok-fast:a1b2c3d4e5f6g7h8
   */
  llmResponse: (model: string, promptHash: string) =>
    `llm:${model}:${promptHash}`,

  /**
   * LLM prompt template version (for invalidation).
   * Key: llm:template:version:{templateId}
   * Value: Integer
   */
  llmTemplateVersion: (templateId: string) =>
    `llm:template:version:${templateId}`,

  // --------------------------------------------------------------------------
  // L5: CLIENT SESSION CACHE (Per-Client, 24 hours)
  // --------------------------------------------------------------------------

  /**
   * Client session data.
   * Key: client:{clientId}:session:{sessionId}
   * Value: JSON {focusSelection, mappedKeywords, refinements}
   * TTL: 24 hours (86400 seconds)
   */
  session: (clientId: string, sessionId: string) =>
    `client:${clientId}:session:${sessionId}`,

  /**
   * Client's active sessions list.
   * Key: client:{clientId}:sessions
   * Value: Set of sessionIds
   * TTL: 7 days
   */
  clientSessions: (clientId: string) => `client:${clientId}:sessions`,

  /**
   * Client's focus selection (current).
   * Key: client:{clientId}:focus
   * Value: JSON {categories, weights, description}
   * TTL: 7 days
   */
  clientFocus: (clientId: string) => `client:${clientId}:focus`,

  // --------------------------------------------------------------------------
  // BATCH PROCESSING
  // --------------------------------------------------------------------------

  /**
   * Pending batch requests (sorted set by timestamp).
   * Key: batch:pending:{groupKey}
   * Value: Sorted set of JSON requests (score = timestamp)
   */
  batchPending: (groupKey: string) => `batch:pending:${groupKey}`,

  /**
   * Batch metadata (for result distribution).
   * Key: batch:meta:{batchId}
   * Value: JSON {keywords, clientIds, requestIds}
   * TTL: 1 hour
   */
  batchMeta: (batchId: string) => `batch:meta:${batchId}`,

  /**
   * Individual request result.
   * Key: result:{requestId}
   * Value: JSON classification result
   * TTL: 1 hour
   */
  result: (requestId: string) => `result:${requestId}`,

  // --------------------------------------------------------------------------
  // SINGLEFLIGHT / LOCKING
  // --------------------------------------------------------------------------

  /**
   * Singleflight lock.
   * Key: singleflight:lock:{key}
   * Value: "1"
   * TTL: Variable (operation timeout)
   */
  singleflightLock: (key: string) => `singleflight:lock:${key}`,

  /**
   * Singleflight result (for followers).
   * Key: singleflight:result:{key}
   * Value: JSON result
   * TTL: Variable (same as lock)
   */
  singleflightResult: (key: string) => `singleflight:result:${key}`,

  /**
   * Singleflight completion channel.
   * Key: singleflight:done:{key}
   * Value: Pub/Sub channel
   */
  singleflightDone: (key: string) => `singleflight:done:${key}`,

  // --------------------------------------------------------------------------
  // COST TRACKING
  // --------------------------------------------------------------------------

  /**
   * Daily cost counters per client.
   * Key: cost:daily:{YYYYMMDD}:{clientId}
   * Value: Hash {total, embedding_compute, category_classify, ...}
   * TTL: 90 days
   */
  costDaily: (date: string, clientId: string) =>
    `cost:daily:${date}:${clientId}`,

  /**
   * Monthly cost summary per client.
   * Key: cost:monthly:{YYYYMM}:{clientId}
   * Value: Hash {total, ...}
   * TTL: 365 days
   */
  costMonthly: (month: string, clientId: string) =>
    `cost:monthly:${month}:${clientId}`,

  /**
   * Global cost counters.
   * Key: cost:global:{YYYYMMDD}
   * Value: Hash {total, by_type, ...}
   * TTL: 90 days
   */
  costGlobal: (date: string) => `cost:global:${date}`,

  /**
   * Cost persistence queue.
   * Key: cost:persistence:queue
   * Value: List of JSON cost events
   */
  costPersistenceQueue: () => `cost:persistence:queue`,

  // --------------------------------------------------------------------------
  // STATISTICS
  // --------------------------------------------------------------------------

  /**
   * Global cache statistics.
   * Key: stats:cache:global
   * Value: Hash {hits, misses, bytes_saved, ...}
   */
  statsCache: () => `stats:cache:global`,

  /**
   * Batch processing statistics.
   * Key: batch:stats:global
   * Value: Hash {batches, keywords, unique, wait_time}
   */
  statsBatch: () => `batch:stats:global`,
};

/**
 * TTL Constants (in seconds)
 */
export const REDIS_TTL = {
  EMBEDDING: -1, // Never expires
  CATEGORY: 7 * 24 * 60 * 60, // 7 days
  COMPETITOR: 24 * 60 * 60, // 24 hours
  LLM_RESPONSE: 7 * 24 * 60 * 60, // 7 days
  SESSION: 24 * 60 * 60, // 24 hours
  BATCH_RESULT: 60 * 60, // 1 hour
  COST_DAILY: 90 * 24 * 60 * 60, // 90 days
  COST_MONTHLY: 365 * 24 * 60 * 60, // 365 days
  SINGLEFLIGHT_LOCK: 5 * 60, // 5 minutes
};
```

---

## 5. Cache Invalidation Strategy

### Invalidation Triggers

```typescript
// src/server/features/keyword-intelligence/services/CacheInvalidation.ts

import { Redis } from "ioredis";
import { REDIS_KEYS, REDIS_TTL } from "./redis-keys";

interface InvalidationEvent {
  type:
    | "embedding_model_update"
    | "category_schema_change"
    | "competitor_update"
    | "llm_template_change"
    | "client_focus_change"
    | "manual";
  scope: "global" | "vertical" | "client";
  target?: string; // clientId, vertical, or domain
  reason: string;
  timestamp: Date;
}

export class CacheInvalidation {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // --------------------------------------------------------------------------
  // INVALIDATION RULES
  // --------------------------------------------------------------------------

  /**
   * When to invalidate each cache layer:
   * 
   * L1 EMBEDDINGS:
   * - NEVER invalidate (embeddings don't change for same model)
   * - On model upgrade: version key bump (old cache ignored)
   * 
   * L2 CATEGORIES:
   * - TTL-based: 7 days automatic expiry
   * - On schema change: version key bump for vertical
   * - Manual: admin can trigger for specific vertical
   * 
   * L3 COMPETITORS:
   * - TTL-based: 24 hours automatic expiry
   * - On significant change detection: immediate invalidation
   * - Manual: admin can trigger for specific domain
   * 
   * L4 LLM RESPONSES:
   * - TTL-based: 7 days automatic expiry
   * - On prompt template change: version key bump
   * - On model upgrade: invalidate all for that model
   * 
   * L5 SESSIONS:
   * - TTL-based: 24 hours automatic expiry
   * - On client focus change: invalidate affected sessions
   */

  // --------------------------------------------------------------------------
  // L1: EMBEDDING INVALIDATION (Version-based)
  // --------------------------------------------------------------------------

  /**
   * Handle embedding model upgrade.
   * Instead of deleting old embeddings, bump version so they're ignored.
   */
  async handleEmbeddingModelUpgrade(newModelVersion: string): Promise<void> {
    await this.redis.set("kw:emb:version", newModelVersion);
    await this.logInvalidation({
      type: "embedding_model_update",
      scope: "global",
      reason: `Embedding model upgraded to ${newModelVersion}`,
      timestamp: new Date(),
    });
  }

  async getCurrentEmbeddingVersion(): Promise<string> {
    return (await this.redis.get("kw:emb:version")) || "v1";
  }

  // --------------------------------------------------------------------------
  // L2: CATEGORY INVALIDATION
  // --------------------------------------------------------------------------

  /**
   * Invalidate category classifications for a vertical.
   * Used when classification schema or rules change.
   */
  async invalidateCategoryVertical(vertical: string): Promise<number> {
    // Increment version (causes cache misses without deletion)
    await this.redis.incr(REDIS_KEYS.categoryVersion(vertical));

    await this.logInvalidation({
      type: "category_schema_change",
      scope: "vertical",
      target: vertical,
      reason: "Classification schema updated",
      timestamp: new Date(),
    });

    // Optionally delete old keys (background job)
    const pattern = `kw:cat:*:${vertical}`;
    return await this.deleteByPattern(pattern);
  }

  /**
   * Invalidate specific keyword classification.
   */
  async invalidateCategoryKeyword(
    keywordHash: string,
    vertical: string
  ): Promise<void> {
    const key = REDIS_KEYS.category(keywordHash, vertical);
    await this.redis.del(key);
  }

  // --------------------------------------------------------------------------
  // L3: COMPETITOR INVALIDATION
  // --------------------------------------------------------------------------

  /**
   * Invalidate competitor catalog.
   * Called when significant changes detected or manually triggered.
   */
  async invalidateCompetitorCatalog(domain: string): Promise<void> {
    const key = REDIS_KEYS.competitorCatalog(domain);
    await this.redis.del(key);

    await this.logInvalidation({
      type: "competitor_update",
      scope: "global",
      target: domain,
      reason: "Competitor data refresh triggered",
      timestamp: new Date(),
    });
  }

  /**
   * Check if competitor data needs refresh.
   * Returns true if data is stale or significant changes detected.
   */
  async shouldRefreshCompetitor(domain: string): Promise<boolean> {
    const key = REDIS_KEYS.competitorCatalog(domain);
    const ttl = await this.redis.ttl(key);

    // Refresh if:
    // 1. Data expired (ttl = -2)
    // 2. Less than 1 hour remaining
    // 3. Last check detected changes
    if (ttl < 3600) return true;

    const changeFlag = await this.redis.get(`comp:changed:${domain}`);
    return changeFlag === "1";
  }

  // --------------------------------------------------------------------------
  // L4: LLM RESPONSE INVALIDATION
  // --------------------------------------------------------------------------

  /**
   * Invalidate LLM responses for a template change.
   * Templates are versioned to avoid mass deletion.
   */
  async handleTemplateChange(templateId: string): Promise<void> {
    await this.redis.incr(REDIS_KEYS.llmTemplateVersion(templateId));

    await this.logInvalidation({
      type: "llm_template_change",
      scope: "global",
      target: templateId,
      reason: "Prompt template updated",
      timestamp: new Date(),
    });
  }

  /**
   * Invalidate all LLM responses for a model.
   * Used when model behavior changes significantly.
   */
  async invalidateModelResponses(model: string): Promise<number> {
    const pattern = `llm:${model}:*`;
    return await this.deleteByPattern(pattern);
  }

  // --------------------------------------------------------------------------
  // L5: SESSION INVALIDATION
  // --------------------------------------------------------------------------

  /**
   * Invalidate client session when focus changes.
   */
  async invalidateClientSession(
    clientId: string,
    sessionId: string
  ): Promise<void> {
    const key = REDIS_KEYS.session(clientId, sessionId);
    await this.redis.del(key);
  }

  /**
   * Invalidate all sessions for a client.
   */
  async invalidateAllClientSessions(clientId: string): Promise<number> {
    const pattern = `client:${clientId}:session:*`;
    return await this.deleteByPattern(pattern);
  }

  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------

  /**
   * Delete keys matching pattern.
   * Uses SCAN to avoid blocking Redis.
   */
  private async deleteByPattern(pattern: string): Promise<number> {
    let cursor = "0";
    let deleted = 0;

    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = newCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");

    return deleted;
  }

  /**
   * Log invalidation event for audit trail.
   */
  private async logInvalidation(event: InvalidationEvent): Promise<void> {
    await this.redis.lpush(
      "cache:invalidation:log",
      JSON.stringify(event)
    );
    // Keep last 1000 events
    await this.redis.ltrim("cache:invalidation:log", 0, 999);
  }

  /**
   * Get recent invalidation events.
   */
  async getRecentInvalidations(limit: number = 50): Promise<InvalidationEvent[]> {
    const events = await this.redis.lrange(
      "cache:invalidation:log",
      0,
      limit - 1
    );
    return events.map((e) => JSON.parse(e));
  }
}
```

---

## 6. Business Model

### Cost Structure at Scale

```
                        COST STRUCTURE BY CLIENT COUNT                            
                                                                                  
  ASSUMPTIONS:                                                                   
  - 5000 tasks/day platform-wide                                                 
  - 5-10% are actual API calls (rest cached)                                     
  - Lithuanian e-commerce = high keyword overlap                                 
  - DataForSEO: $0.0006/SERP, $0.05/1000 keywords                               
                                                                                  
  -----------------------------------------------------------------------        
                                                                                  
  100 CLIENTS                                                                    
  -----------------------------------------------------------------------        
                                                                                  
  Infrastructure (fixed):                                                        
  - Redis 4GB                            $10/mo (included in VPS)               
  - PostgreSQL                           $0/mo (existing)                        
  - Crawl4AI                             $0/mo (self-hosted)                     
  - BullMQ workers                       $0/mo (existing)                        
  Subtotal Infrastructure:               $10/mo                                  
                                                                                  
  Variable (per-usage):                                                          
  - Embeddings                           $0/mo (local)                           
  - Category classification              $2/mo (70% cache hit)                   
  - LLM responses                        $8/mo (60% cache hit)                   
  - Competitor crawls                    $0/mo (shared, 90% hit)                 
  Subtotal Variable:                     $10/mo                                  
                                                                                  
  TOTAL:                                 $20/mo                                  
  PER CLIENT:                            $0.20/mo                                
  PER CLASSIFICATION:                    $0.004                                  
                                                                                  
  -----------------------------------------------------------------------        
                                                                                  
  500 CLIENTS                                                                    
  -----------------------------------------------------------------------        
                                                                                  
  Infrastructure (fixed):                                                        
  - Redis 8GB                            $20/mo                                  
  - PostgreSQL (larger)                  $10/mo                                  
  - Crawl4AI                             $0/mo                                   
  - BullMQ workers (2x)                  $5/mo                                   
  Subtotal Infrastructure:               $35/mo                                  
                                                                                  
  Variable (per-usage):                                                          
  - Embeddings                           $0/mo                                   
  - Category classification              $5/mo (80% cache hit)                   
  - LLM responses                        $15/mo (70% cache hit)                  
  - Competitor crawls                    $0/mo (95% cache hit)                   
  Subtotal Variable:                     $20/mo                                  
                                                                                  
  TOTAL:                                 $55/mo                                  
  PER CLIENT:                            $0.11/mo                                
  PER CLASSIFICATION:                    $0.002                                  
                                                                                  
  -----------------------------------------------------------------------        
                                                                                  
  1000 CLIENTS                                                                   
  -----------------------------------------------------------------------        
                                                                                  
  Infrastructure (fixed):                                                        
  - Redis 16GB (cluster)                 $40/mo                                  
  - PostgreSQL (dedicated)               $30/mo                                  
  - Crawl4AI (scaled)                    $10/mo                                  
  - BullMQ workers (4x)                  $15/mo                                   
  Subtotal Infrastructure:               $95/mo                                  
                                                                                  
  Variable (per-usage):                                                          
  - Embeddings                           $0/mo                                   
  - Category classification              $8/mo (85% cache hit)                   
  - LLM responses                        $20/mo (75% cache hit)                  
  - Competitor crawls                    $0/mo (98% cache hit)                   
  Subtotal Variable:                     $28/mo                                  
                                                                                  
  TOTAL:                                 $123/mo                                 
  PER CLIENT:                            $0.123/mo                               
  PER CLASSIFICATION:                    $0.0008                                 
```

### Pricing Model Options

```
                           PRICING MODEL OPTIONS                                  
                                                                                  
  OPTION A: FLAT FEE (Simplest)                                                  
  -----------------------------------------------------------------------        
  - Small clients: $29/mo (up to 1000 keywords/mo)                               
  - Medium clients: $79/mo (up to 5000 keywords/mo)                              
  - Large clients: $199/mo (unlimited)                                           
                                                                                  
  Pros: Predictable, easy to sell, encourages usage                              
  Cons: Heavy users subsidized by light users                                    
                                                                                  
  Break-even at 1000 clients: $29 x 500 small + $79 x 400 medium + $199 x 100    
                            = $14,500 + $31,600 + $19,900 = $65,000/mo revenue   
                            - $123/mo cost = $64,877/mo profit                   
                                                                                  
  -----------------------------------------------------------------------        
                                                                                  
  OPTION B: USAGE-BASED (Most Fair)                                              
  -----------------------------------------------------------------------        
  - Base fee: $19/mo (includes 500 classifications)                              
  - Overage: $0.01 per classification                                            
  - Volume discount: $0.005 per classification over 5000                         
                                                                                  
  Pros: Fair, scales with value delivered                                        
  Cons: Harder to predict costs, usage tracking overhead                         
                                                                                  
  At 1000 clients, avg 200 classifications/mo:                                   
  Revenue = $19 x 1000 = $19,000/mo                                              
  Cost = $123/mo                                                                 
  Profit = $18,877/mo (98.5% margin)                                             
                                                                                  
  -----------------------------------------------------------------------        
                                                                                  
  OPTION C: HYBRID (Recommended)                                                 
  -----------------------------------------------------------------------        
  - Free tier: 100 classifications/mo (lead generation)                          
  - Pro: $49/mo (2000 classifications, unlimited cached)                         
  - Business: $149/mo (10000 classifications, priority queue)                    
  - Enterprise: Custom (dedicated resources)                                     
                                                                                  
  Key insight: "Unlimited cached" costs us nothing but feels valuable            
                                                                                  
  At 1000 clients (100 free, 600 pro, 250 business, 50 enterprise $500):         
  Revenue = $0 + $29,400 + $37,250 + $25,000 = $91,650/mo                        
  Cost = $123/mo                                                                 
  Profit = $91,527/mo (99.9% margin)                                             
```

### Cache Flywheel Economics

```
                        THE CACHE FLYWHEEL EFFECT                                 
                                                                                  
  Lithuanian E-commerce Market:                                                  
  - ~50 significant e-commerce sites                                             
  - ~500,000 unique product keywords                                             
  - ~100 common competitor domains                                               
                                                                                  
  Flywheel Stages:                                                               
                                                                                  
  STAGE 1 (0-100 clients): Building Cache                                        
  - Cache hit rate: 30-50%                                                      
  - Cost per classification: $0.004                                             
  - Each new client adds to shared cache                                        
                                                                                  
  STAGE 2 (100-500 clients): Cache Acceleration                                  
  - Cache hit rate: 50-75%                                                      
  - Cost per classification: $0.002                                             
  - Most common keywords already cached                                         
                                                                                  
  STAGE 3 (500-1000 clients): Cache Saturation                                   
  - Cache hit rate: 75-90%                                                      
  - Cost per classification: $0.0008                                            
  - Only rare keywords require computation                                      
                                                                                  
  STAGE 4 (1000+ clients): Marginal Cost Near Zero                               
  - Cache hit rate: 90%+                                                        
  - Cost per classification: <$0.0005                                           
  - New clients essentially free to serve                                       
                                                                                  
  -----------------------------------------------------------------------        
                                                                                  
  KEY INSIGHT:                                                                   
                                                                                  
  The 50th client targeting "varle.lt kainos" gets it FREE because               
  the 1st client already paid for that classification.                           
                                                                                  
  In a small market like Lithuania, the keyword universe is finite.              
  After ~500 clients, we've likely seen 95%+ of all keywords.                    
                                                                                  
  This creates a MOAT: Competitors starting from scratch can't match             
  our cache hit rates, making our marginal cost permanently lower.               
```

---

## 7. Summary

| Component | Purpose | Key Metric |
|-----------|---------|------------|
| **CacheArchitecture** | 5-layer cache hierarchy | >70% hit rate |
| **CostTracker** | Per-client attribution | 99%+ accuracy |
| **BatchOptimizer** | Request grouping | 50-500 keywords/batch |
| **Redis Keys** | Consistent naming | <4GB memory |
| **Invalidation** | Freshness control | <24h staleness |
| **Business Model** | Pricing strategy | <$0.001/classification |

**The core insight:** In a small market like Lithuania, the keyword universe is finite. After serving 500 clients, we've likely cached 95%+ of all keywords, making our marginal cost approach zero while competitors starting fresh can never match our cache hit rates.

This creates a structural moat through shared infrastructure economics.

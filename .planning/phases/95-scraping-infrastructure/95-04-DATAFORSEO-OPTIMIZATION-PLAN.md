# Plan 95-04: DataForSEO Optimization

**Status:** Planning  
**Effort:** 0.5 weeks (3-4 days)  
**Priority:** P1 (Depends on 95-01 TieredFetcher)  
**Dependencies:** 95-01 (TieredFetcher provides T3-T5 escalation points)

---

## 1. Overview

### DataForSEO as Premium Fallback, Not Primary

DataForSEO serves as the **premium fallback tier** (T3-T5) when free/cheap tiers fail:

```
Escalation Chain:
T0: Direct fetch         ($0.00)           ─┐
T1: Webshare DC          ($0.00)            │ 65% of requests
T2: Geonode Residential  ($0.000015/page)  ─┘
                              │
                         FALLBACK TO DFS
                              ▼
T3: DataForSEO Basic     ($0.000125/page)  ─┐
T4: DataForSEO JS        ($0.00125/page)    │ 35% of requests
T5: DataForSEO Browser   ($0.00425/page)   ─┘
```

**Key Principle:** DataForSEO should only be used when:
1. All proxy tiers have failed (blocked, rate limited)
2. JavaScript rendering is required (SPA detection)
3. Heavy anti-bot protection requires browser simulation

### Current State

```typescript
// Currently in src/server/lib/dataforseo.ts
export async function fetchOnPageInstantPages(urls: string[]): Promise<OnPageInstantPageResult[]> {
  // Uses enable_javascript: false (Basic mode)
  // No tier selection, no pre-parsed data extraction
  // No Standard Queue support (always Live)
}
```

**Problems:**
- Always uses Live API ($0.02/page) instead of Standard Queue ($0.0005/page)
- No pre-parsed data extraction (parses HTML even when DFS provides structured data)
- No batch optimization (single requests instead of 100-task batches)
- No cost tracking or budget alerts
- No error handling specific to DFS response codes

---

## 2. API Tier Selection

### DataForSEO OnPage API Pricing Matrix

| Mode | Cost/Page | Multiplier | Use Case |
|------|-----------|------------|----------|
| **Standard Queue** | $0.0005 | 1x | Non-urgent bulk processing |
| **Basic (Live)** | $0.000125 | 0.25x | Simple HTML, no JS |
| **+ Load Resources** | $0.000375 | 3x | Images, CSS, scripts |
| **+ JS Rendering** | $0.00125 | 10x | SPA content |
| **+ Browser Mode** | $0.00425 | 34x | Heavy anti-bot |

### Decision Matrix

```typescript
// Tier selection logic for DataForSEOFetcher
function selectDfsTier(context: DfsTierContext): DfsTier {
  const { domain, requiresJs, hasAntiBot, urgency, batchSize } = context;
  
  // Non-urgent bulk: Always use Standard Queue
  if (urgency === 'bulk' && batchSize >= 10) {
    return {
      endpoint: 'task_post', // Standard Queue
      mode: requiresJs ? 'js' : 'basic',
      estimatedCost: requiresJs ? 0.00125 : 0.0005,
      deliveryTime: '1-15 minutes',
    };
  }
  
  // Urgent single requests: Use Live API
  if (urgency === 'immediate') {
    if (hasAntiBot) {
      return {
        endpoint: 'instant_pages',
        mode: 'browser',
        enableJavascript: true,
        browserScreen: true,
        estimatedCost: 0.00425,
        deliveryTime: '5-30 seconds',
      };
    }
    
    if (requiresJs) {
      return {
        endpoint: 'instant_pages',
        mode: 'js',
        enableJavascript: true,
        estimatedCost: 0.00125,
        deliveryTime: '3-15 seconds',
      };
    }
    
    return {
      endpoint: 'instant_pages',
      mode: 'basic',
      enableJavascript: false,
      estimatedCost: 0.000125,
      deliveryTime: '1-5 seconds',
    };
  }
}
```

### Urgency Levels

| Urgency | When Used | DFS Mode | Cost |
|---------|-----------|----------|------|
| `immediate` | User waiting (live audit) | Live API | Higher |
| `background` | Scheduled audits | Standard Queue | 70% cheaper |
| `bulk` | Mass crawl, backfill | Standard Queue + Batch | Lowest |

---

## 3. Pre-Parsed Data Strategy

### The 60/40 Split

DataForSEO OnPage API returns both **structured data** and **raw HTML**. We can leverage pre-parsed data for 60% of SEO checks, parsing raw HTML only for the remaining 40%.

### DFS Pre-Parsed Fields Available

```typescript
interface DataForSEOOnPageResult {
  // URL & Status
  url: string;
  status_code: number;
  
  // Meta Information (covers ~40% of checks)
  meta: {
    title: string;
    description: string;
    canonical: string;
    robots_txt: string;
    x_robots_tag: string | null;
    htags: {
      h1: string[];
      h2: string[];
      h3: string[];
      h4: string[];
      h5: string[];
      h6: string[];
    };
    content: {
      plain_text_size: number;
      plain_text_rate: number;
      plain_text_word_count: number;
    };
    language: string;
    charset: string;
    open_graph: {
      title?: string;
      description?: string;
      image?: string;
      type?: string;
    };
    twitter_card: {
      card?: string;
      title?: string;
      description?: string;
      image?: string;
    };
  };
  
  // Links (covers ~15% of checks)
  links: {
    internal: Array<{ url: string; anchor: string; nofollow: boolean }>;
    external: Array<{ url: string; anchor: string; nofollow: boolean }>;
  };
  
  // Resources (covers ~5% of checks, requires load_resources)
  resources?: {
    images: Array<{ src: string; alt: string; size: number }>;
    scripts: Array<{ src: string; size: number }>;
    stylesheets: Array<{ src: string; size: number }>;
  };
  
  // Performance
  page_timing: {
    time_to_interactive: number;
    dom_complete: number;
    largest_contentful_paint: number;
    connection_time: number;
    time_to_secure_connection: number;
  };
  
  // Raw HTML (for custom parsing)
  fetch_html?: string;
}
```

### Mapping DFS Fields to SEO Checks

#### Checks Using Pre-Parsed Data (60% = ~65 checks)

| Check Category | DFS Field | Checks Covered |
|----------------|-----------|----------------|
| **Title** | `meta.title` | Title exists, length, keyword presence |
| **Meta Description** | `meta.description` | Description exists, length, keyword presence |
| **Canonical** | `meta.canonical` | Canonical present, self-referencing |
| **Headings** | `meta.htags.h1-h6` | H1 count, heading hierarchy, keyword in H1 |
| **Word Count** | `meta.content.plain_text_word_count` | Content length, thin content detection |
| **Internal Links** | `links.internal` | Internal link count, orphan pages |
| **External Links** | `links.external` | External link count, nofollow ratio |
| **Images** | `resources.images` | Image count, missing alt (count only) |
| **Open Graph** | `meta.open_graph` | OG tags presence, completeness |
| **Twitter Card** | `meta.twitter_card` | Twitter card presence |
| **Robots** | `meta.robots_txt`, `meta.x_robots_tag` | Indexability, robots directives |
| **Performance** | `page_timing` | LCP, TTI, load time |
| **Status** | `status_code` | 200/4xx/5xx checks |

#### Checks Requiring Raw HTML Parsing (40% = ~44 checks)

| Check Category | Why Raw HTML Needed |
|----------------|---------------------|
| **Keyword in `<strong>`/`<b>`** | DFS doesn't expose text formatting tags |
| **Keyword position** | Need exact word position, not just presence |
| **E-E-A-T signals** | Author bio patterns, trust signals |
| **Schema validation** | Full JSON-LD structure validation |
| **Content quality** | Boilerplate detection, unique content ratio |
| **Above-the-fold** | DOM structure, CSS analysis |
| **Image alt quality** | Semantic analysis of alt text content |
| **Anchor text context** | Surrounding text analysis |
| **Duplicate content blocks** | Template vs unique detection |
| **CTA detection** | Form and button analysis |
| **Structured data completeness** | Full schema.org validation |
| **Internal linking patterns** | Silo detection, hub analysis |

### Hybrid Processing Implementation

```typescript
interface SeoCheckDependencies {
  usesPreparsed: boolean;
  usesRawHtml: boolean;
  preparsedFields: string[];
}

const CHECK_DEPENDENCIES: Record<string, SeoCheckDependencies> = {
  'title-length': {
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ['meta.title'],
  },
  'keyword-in-strong': {
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  'heading-hierarchy': {
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ['meta.htags'],
  },
  // ... 106 more checks
};

async function runSeoChecks(
  url: string,
  dfsResult: DataForSEOOnPageResult,
  checksToRun: string[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  
  // Determine if we need to parse HTML
  const needsHtmlParsing = checksToRun.some(
    check => CHECK_DEPENDENCIES[check]?.usesRawHtml
  );
  
  // Parse HTML only if needed (saves ~67% of parsing time)
  let $: CheerioAPI | null = null;
  if (needsHtmlParsing && dfsResult.fetch_html) {
    $ = cheerio.load(dfsResult.fetch_html, { xmlMode: true });
  }
  
  for (const checkId of checksToRun) {
    const deps = CHECK_DEPENDENCIES[checkId];
    
    if (deps.usesPreparsed) {
      // Fast path: use pre-parsed data
      results.push(runPreparsedCheck(checkId, dfsResult));
    } else if (deps.usesRawHtml && $) {
      // Slow path: parse raw HTML
      results.push(runHtmlCheck(checkId, $, dfsResult.fetch_html!));
    }
  }
  
  return results;
}
```

---

## 4. Batch Request Optimization

### DFS Batch Limits

- **Maximum tasks per POST:** 100
- **Maximum URLs per task:** 1000 (for task_post)
- **Recommended batch size:** 50-100 (balance between throughput and latency)

### Batch Processing Architecture

```typescript
interface BatchRequest {
  id: string;
  urls: string[];
  options: DfsFetchOptions;
  callbacks: Map<string, (result: FetchResult) => void>;
  createdAt: Date;
  status: 'pending' | 'submitted' | 'completed' | 'failed';
}

class DataForSEOBatcher {
  private pendingBatches: Map<string, BatchRequest> = new Map();
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT_MS = 5000; // Flush every 5 seconds
  
  async queueUrl(
    url: string,
    options: DfsFetchOptions
  ): Promise<FetchResult> {
    return new Promise((resolve) => {
      const batchKey = this.getBatchKey(options);
      
      let batch = this.pendingBatches.get(batchKey);
      if (!batch) {
        batch = this.createBatch(batchKey, options);
        this.scheduleBatchFlush(batchKey);
      }
      
      batch.urls.push(url);
      batch.callbacks.set(url, resolve);
      
      // Flush immediately if batch is full
      if (batch.urls.length >= this.BATCH_SIZE) {
        this.flushBatch(batchKey);
      }
    });
  }
  
  private async flushBatch(batchKey: string): Promise<void> {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch || batch.urls.length === 0) return;
    
    this.pendingBatches.delete(batchKey);
    batch.status = 'submitted';
    
    try {
      // Submit batch to Standard Queue
      const taskIds = await this.submitToStandardQueue(batch);
      
      // Poll for results (or use webhook)
      const results = await this.waitForResults(taskIds);
      
      // Resolve individual promises
      for (const result of results) {
        const callback = batch.callbacks.get(result.url);
        if (callback) callback(result);
      }
    } catch (error) {
      // Reject all promises in batch
      for (const callback of batch.callbacks.values()) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Batch failed',
        } as FetchResult);
      }
    }
  }
  
  private async submitToStandardQueue(batch: BatchRequest): Promise<string[]> {
    const tasks = batch.urls.map(url => ({
      url,
      enable_javascript: batch.options.enableJavascript ?? false,
      load_resources: batch.options.loadResources ?? false,
      pingback_url: `${WEBHOOK_BASE}/dataforseo/onpage/${batch.id}`,
    }));
    
    const response = await dataForSeoClient.post(
      '/v3/on_page/task_post',
      tasks,
      { headers: getDataForSEOHeaders() }
    );
    
    return response.tasks.map((t: any) => t.id);
  }
}
```

### Cost Savings from Batching

| Scenario | Without Batching | With Batching | Savings |
|----------|------------------|---------------|---------|
| 100 single requests | $12.50 (Live) | $0.05 (Queue) | 99.6% |
| 1,000 single requests | $125.00 (Live) | $0.50 (Queue) | 99.6% |
| 10,000 single requests | $1,250.00 (Live) | $5.00 (Queue) | 99.6% |

---

## 5. Error Handling and Retry Logic

### DFS-Specific Error Codes

```typescript
const DFS_ERROR_CODES = {
  // Rate limiting
  20002: 'Rate limit exceeded',
  20003: 'Insufficient balance',
  
  // Task errors
  40001: 'Invalid task ID',
  40002: 'Task not found',
  40003: 'Task expired',
  
  // Fetch errors
  50001: 'Target unreachable',
  50002: 'Target timeout',
  50003: 'Target returned error',
  50004: 'JavaScript execution failed',
  50005: 'Browser rendering failed',
  
  // System errors
  60001: 'Internal server error',
  60002: 'Service unavailable',
} as const;

type DfsErrorCode = keyof typeof DFS_ERROR_CODES;
```

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableCodes: DfsErrorCode[];
  escalateTierOn: DfsErrorCode[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableCodes: [20002, 60001, 60002], // Rate limit, server errors
  escalateTierOn: [50001, 50002, 50004, 50005], // Fetch/render failures
};

async function fetchWithRetry(
  url: string,
  tier: DfsTier,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<FetchResult> {
  let lastError: Error | null = null;
  let currentTier = tier;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fetchWithTier(url, currentTier);
      
      if (result.success) {
        return result;
      }
      
      const errorCode = result.dfsErrorCode as DfsErrorCode;
      
      // Check if we should escalate tier
      if (config.escalateTierOn.includes(errorCode)) {
        currentTier = escalateTier(currentTier);
        continue; // Don't count as retry, just escalate
      }
      
      // Check if retryable
      if (!config.retryableCodes.includes(errorCode)) {
        return result; // Non-retryable error
      }
      
      lastError = new Error(DFS_ERROR_CODES[errorCode] || 'Unknown error');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
    
    // Exponential backoff with jitter
    const delay = Math.min(
      config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
      config.maxDelayMs
    );
    await sleep(delay);
  }
  
  return {
    url,
    success: false,
    error: lastError?.message || 'Max retries exceeded',
    tierUsed: currentTier.mode,
    estimatedCost: 0,
  } as FetchResult;
}

function escalateTier(current: DfsTier): DfsTier {
  const escalation: Record<string, string> = {
    'basic': 'js',
    'js': 'browser',
    'browser': 'browser', // No further escalation
  };
  
  return {
    ...current,
    mode: escalation[current.mode] || current.mode,
    enableJavascript: escalation[current.mode] !== 'basic',
    estimatedCost: getCostForMode(escalation[current.mode]),
  };
}
```

### Circuit Breaker

```typescript
class DataForSEOCircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT_MS = 60000;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure!.getTime() > this.RECOVERY_TIMEOUT_MS) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
    
    if (this.failures >= this.FAILURE_THRESHOLD) {
      this.state = 'open';
      console.error('[DataForSEO] Circuit breaker opened after', this.failures, 'failures');
    }
  }
}
```

---

## 6. TypeScript Interfaces

### DataForSEOFetcher Interface

```typescript
// src/server/features/scraping/providers/DataForSEOFetcher.ts

export interface DfsFetchOptions {
  /** Force specific mode (basic, js, browser) */
  mode?: 'basic' | 'js' | 'browser';
  
  /** Use Standard Queue instead of Live API */
  useStandardQueue?: boolean;
  
  /** Include raw HTML in response */
  includeRawHtml?: boolean;
  
  /** Load resources (images, CSS, scripts) */
  loadResources?: boolean;
  
  /** Custom JavaScript to execute */
  customJs?: string;
  
  /** Timeout override (ms) */
  timeoutMs?: number;
  
  /** Webhook URL for Standard Queue results */
  webhookUrl?: string;
  
  /** Cost tracking: client ID for attribution */
  clientId?: string;
  
  /** Cost tracking: job ID for correlation */
  jobId?: string;
}

export interface DfsFetchResult extends FetchResult {
  /** DFS-specific error code */
  dfsErrorCode?: number;
  
  /** DFS task ID (for Standard Queue) */
  taskId?: string;
  
  /** Pre-parsed data from DFS */
  parsedData?: DataForSEOParsedData;
  
  /** Actual cost charged by DFS */
  actualCost: number;
  
  /** Mode used for this request */
  modeUsed: 'basic' | 'js' | 'browser';
  
  /** Whether Standard Queue was used */
  usedStandardQueue: boolean;
}

export interface DataForSEOParsedData {
  // Meta
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  canonical: string | null;
  
  // Headings
  h1: string[];
  h2: string[];
  h3: string[];
  
  // Content
  wordCount: number;
  plainTextSize: number;
  plainTextRate: number;
  
  // Links
  internalLinks: Array<{
    url: string;
    anchor: string;
    nofollow: boolean;
  }>;
  externalLinks: Array<{
    url: string;
    anchor: string;
    nofollow: boolean;
  }>;
  
  // Media (requires loadResources)
  images?: Array<{
    src: string;
    alt: string;
    size: number;
  }>;
  
  // Social
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
  };
  twitterCard: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
  };
  
  // Technical
  robotsDirectives: string[];
  language: string;
  charset: string;
  
  // Performance
  pageTiming: {
    timeToInteractive: number;
    domComplete: number;
    lcp: number;
  };
}

export interface DataForSEOFetcher {
  /** Fetch a single page immediately (Live API) */
  fetchLive(url: string, options?: DfsFetchOptions): Promise<DfsFetchResult>;
  
  /** Queue a page for batch processing (Standard Queue) */
  queueForBatch(url: string, options?: DfsFetchOptions): Promise<DfsFetchResult>;
  
  /** Fetch multiple pages in a single batch */
  fetchBatch(urls: string[], options?: DfsFetchOptions): Promise<DfsFetchResult[]>;
  
  /** Get cost estimate for a request */
  estimateCost(options: DfsFetchOptions): number;
  
  /** Get current usage statistics */
  getUsageStats(): Promise<DfsUsageStats>;
}

export interface DfsUsageStats {
  todaySpend: number;
  monthSpend: number;
  requestsToday: number;
  requestsMonth: number;
  averageCostPerRequest: number;
  tierDistribution: Record<string, number>;
}
```

### Full Service Implementation Skeleton

```typescript
// src/server/features/scraping/providers/DataForSEOFetcher.ts

export class DataForSEOFetcherImpl implements DataForSEOFetcher {
  private batcher: DataForSEOBatcher;
  private circuitBreaker: DataForSEOCircuitBreaker;
  private costTracker: CostTracker;
  
  constructor(
    private config: {
      apiKey: string;
      defaultMode: 'basic' | 'js' | 'browser';
      webhookBaseUrl?: string;
      budgetAlertThreshold?: number;
    }
  ) {
    this.batcher = new DataForSEOBatcher();
    this.circuitBreaker = new DataForSEOCircuitBreaker();
    this.costTracker = new CostTracker();
  }
  
  async fetchLive(url: string, options: DfsFetchOptions = {}): Promise<DfsFetchResult> {
    return this.circuitBreaker.execute(async () => {
      const startTime = Date.now();
      const mode = options.mode || this.config.defaultMode;
      
      await dataForSeoRateLimiter.acquire();
      
      const response = await dataForSeoClient.post(
        '/v3/on_page/instant_pages',
        [{
          url,
          enable_javascript: mode !== 'basic',
          browser_screen: mode === 'browser',
          load_resources: options.loadResources ?? false,
          custom_js: options.customJs,
        }],
        {
          headers: getDataForSEOHeaders(),
          timeout: options.timeoutMs || 60000,
        }
      );
      
      const result = this.parseResponse(response, url);
      
      // Track cost
      await this.costTracker.record({
        clientId: options.clientId,
        jobId: options.jobId,
        url,
        cost: result.actualCost,
        mode: result.modeUsed,
      });
      
      return {
        ...result,
        responseTimeMs: Date.now() - startTime,
        usedStandardQueue: false,
      };
    });
  }
  
  async queueForBatch(url: string, options: DfsFetchOptions = {}): Promise<DfsFetchResult> {
    return this.batcher.queueUrl(url, {
      ...options,
      useStandardQueue: true,
    });
  }
  
  async fetchBatch(urls: string[], options: DfsFetchOptions = {}): Promise<DfsFetchResult[]> {
    // Split into chunks of 100
    const chunks = chunk(urls, 100);
    const results: DfsFetchResult[] = [];
    
    for (const urlChunk of chunks) {
      const chunkResults = await this.submitBatch(urlChunk, options);
      results.push(...chunkResults);
    }
    
    return results;
  }
  
  estimateCost(options: DfsFetchOptions): number {
    const mode = options.mode || this.config.defaultMode;
    const baseCost = options.useStandardQueue ? 0.0005 : 0.000125;
    
    let multiplier = 1;
    if (options.loadResources) multiplier += 2;
    if (mode === 'js') multiplier *= 10;
    if (mode === 'browser') multiplier *= 34;
    
    return baseCost * multiplier;
  }
  
  private parseResponse(response: unknown, url: string): DfsFetchResult {
    // Implementation: extract pre-parsed data and raw HTML
    // ...
  }
}
```

---

## 7. Cost Tracking and Budget Alerts

### Cost Tracking Schema

```typescript
// src/db/dfs-cost-tracking-schema.ts

export const dfsCostRecords = pgTable('dfs_cost_records', {
  id: serial('id').primaryKey(),
  
  // Attribution
  clientId: text('client_id'),
  jobId: text('job_id'),
  
  // Request details
  url: text('url').notNull(),
  mode: text('mode').notNull().$type<'basic' | 'js' | 'browser'>(),
  usedStandardQueue: boolean('used_standard_queue').default(false),
  
  // Cost
  estimatedCost: real('estimated_cost').notNull(),
  actualCost: real('actual_cost'),
  
  // Timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('idx_dfs_cost_client').on(table.clientId),
  jobIdx: index('idx_dfs_cost_job').on(table.jobId),
  createdIdx: index('idx_dfs_cost_created').on(table.createdAt),
}));

// Daily aggregates for dashboard
export const dfsCostDailyAggregates = pgTable('dfs_cost_daily_aggregates', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  clientId: text('client_id'),
  
  // Totals
  totalCost: real('total_cost').notNull(),
  requestCount: integer('request_count').notNull(),
  
  // By mode
  basicCost: real('basic_cost').default(0),
  basicCount: integer('basic_count').default(0),
  jsCost: real('js_cost').default(0),
  jsCount: integer('js_count').default(0),
  browserCost: real('browser_cost').default(0),
  browserCount: integer('browser_count').default(0),
  
  // Queue usage
  standardQueueCost: real('standard_queue_cost').default(0),
  standardQueueCount: integer('standard_queue_count').default(0),
  liveCost: real('live_cost').default(0),
  liveCount: integer('live_count').default(0),
}, (table) => ({
  dateClientIdx: index('idx_dfs_daily_date_client').on(table.date, table.clientId),
}));
```

### Budget Alert System

```typescript
// src/server/features/scraping/DfsBudgetMonitor.ts

export interface BudgetConfig {
  dailyLimit: number;      // e.g., $10/day
  monthlyLimit: number;    // e.g., $100/month
  alertThresholds: number[]; // e.g., [0.5, 0.8, 0.95]
  alertWebhook?: string;
  alertEmail?: string;
}

export class DfsBudgetMonitor {
  constructor(
    private db: Database,
    private config: BudgetConfig
  ) {}
  
  async checkBudget(): Promise<BudgetStatus> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';
    
    // Get daily spend
    const dailySpend = await this.db
      .select({ total: sql<number>`sum(actual_cost)` })
      .from(dfsCostRecords)
      .where(sql`date(created_at) = ${today}`)
      .then(r => r[0]?.total || 0);
    
    // Get monthly spend
    const monthlySpend = await this.db
      .select({ total: sql<number>`sum(actual_cost)` })
      .from(dfsCostRecords)
      .where(sql`date(created_at) >= ${monthStart}`)
      .then(r => r[0]?.total || 0);
    
    const status: BudgetStatus = {
      dailySpend,
      dailyLimit: this.config.dailyLimit,
      dailyUsagePercent: dailySpend / this.config.dailyLimit,
      monthlySpend,
      monthlyLimit: this.config.monthlyLimit,
      monthlyUsagePercent: monthlySpend / this.config.monthlyLimit,
      isOverDailyBudget: dailySpend >= this.config.dailyLimit,
      isOverMonthlyBudget: monthlySpend >= this.config.monthlyLimit,
    };
    
    // Check thresholds and send alerts
    for (const threshold of this.config.alertThresholds) {
      if (status.dailyUsagePercent >= threshold) {
        await this.sendAlert('daily', threshold, status);
      }
      if (status.monthlyUsagePercent >= threshold) {
        await this.sendAlert('monthly', threshold, status);
      }
    }
    
    return status;
  }
  
  async shouldAllowRequest(): Promise<boolean> {
    const status = await this.checkBudget();
    return !status.isOverDailyBudget && !status.isOverMonthlyBudget;
  }
  
  private async sendAlert(
    type: 'daily' | 'monthly',
    threshold: number,
    status: BudgetStatus
  ): Promise<void> {
    const alertKey = `dfs_alert:${type}:${threshold}:${new Date().toISOString().split('T')[0]}`;
    
    // Check if already alerted today
    const alreadySent = await redis.get(alertKey);
    if (alreadySent) return;
    
    // Send alert
    if (this.config.alertWebhook) {
      await fetch(this.config.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'budget_alert',
          period: type,
          threshold: `${threshold * 100}%`,
          currentSpend: type === 'daily' ? status.dailySpend : status.monthlySpend,
          limit: type === 'daily' ? status.dailyLimit : status.monthlyLimit,
        }),
      });
    }
    
    // Mark as sent
    await redis.set(alertKey, '1', 'EX', 86400);
  }
}

interface BudgetStatus {
  dailySpend: number;
  dailyLimit: number;
  dailyUsagePercent: number;
  monthlySpend: number;
  monthlyLimit: number;
  monthlyUsagePercent: number;
  isOverDailyBudget: boolean;
  isOverMonthlyBudget: boolean;
}
```

### Dashboard Metrics

```typescript
// API endpoint for cost dashboard
// GET /api/scraping/dfs-costs?period=7d

interface DfsCostMetrics {
  period: string;
  totalCost: number;
  requestCount: number;
  averageCostPerRequest: number;
  costByMode: {
    basic: { cost: number; count: number };
    js: { cost: number; count: number };
    browser: { cost: number; count: number };
  };
  costByQueue: {
    standard: { cost: number; count: number };
    live: { cost: number; count: number };
  };
  dailyBreakdown: Array<{
    date: string;
    cost: number;
    requests: number;
  }>;
  topClients: Array<{
    clientId: string;
    cost: number;
    requests: number;
  }>;
  savingsVsLiveOnly: number; // Calculated savings from using Standard Queue
}
```

---

## 8. Implementation Tasks

### Task 1: Database Schema (0.25 days)
- [ ] Create `src/db/dfs-cost-tracking-schema.ts`
- [ ] Add migration for `dfs_cost_records` table
- [ ] Add migration for `dfs_cost_daily_aggregates` table
- [ ] Add indexes for efficient queries

### Task 2: Types & Interfaces (0.25 days)
- [ ] Create `src/server/features/scraping/providers/DataForSEOFetcher.types.ts`
- [ ] Define DfsFetchOptions, DfsFetchResult, DataForSEOParsedData
- [ ] Define DfsErrorCode constants
- [ ] Define BudgetConfig and BudgetStatus

### Task 3: Pre-Parsed Data Mapper (0.5 days)
- [ ] Create `src/server/features/scraping/providers/DfsDataMapper.ts`
- [ ] Implement mapping from DFS response to DataForSEOParsedData
- [ ] Create CHECK_DEPENDENCIES mapping for all 109 checks
- [ ] Unit tests for mapper

### Task 4: Batch Processing (0.5 days)
- [ ] Implement `DataForSEOBatcher` class
- [ ] Standard Queue submission (task_post endpoint)
- [ ] Result polling or webhook handling
- [ ] Batch timeout and flush logic

### Task 5: Error Handling (0.25 days)
- [ ] Implement DFS-specific error code handling
- [ ] Implement retry strategy with tier escalation
- [ ] Implement circuit breaker
- [ ] Add error logging with context

### Task 6: DataForSEOFetcher Implementation (0.5 days)
- [ ] Implement `DataForSEOFetcherImpl` class
- [ ] `fetchLive()` method
- [ ] `queueForBatch()` method
- [ ] `fetchBatch()` method
- [ ] Integration with rate limiter and circuit breaker

### Task 7: Cost Tracking (0.5 days)
- [ ] Implement `CostTracker` class
- [ ] Per-request cost recording
- [ ] Daily aggregate computation (cron job)
- [ ] Integration with DfsBudgetMonitor

### Task 8: Budget Alerts (0.25 days)
- [ ] Implement `DfsBudgetMonitor` class
- [ ] Threshold checking
- [ ] Alert sending (webhook/email)
- [ ] Redis-based deduplication

### Task 9: Tests (0.5 days)
- [ ] Unit tests for DataForSEOFetcher
- [ ] Unit tests for DfsDataMapper
- [ ] Unit tests for DataForSEOBatcher
- [ ] Integration tests with mocked DFS API
- [ ] Cost tracking tests

### Task 10: Migration & Documentation (0.25 days)
- [ ] Migrate existing `fetchOnPageInstantPages()` usages
- [ ] Update environment variables documentation
- [ ] Add cost monitoring dashboard API

---

## Environment Variables

```env
# DataForSEO (existing)
DATAFORSEO_API_KEY=xxx

# Budget Configuration
DFS_DAILY_BUDGET=10.00
DFS_MONTHLY_BUDGET=100.00
DFS_ALERT_THRESHOLDS=0.5,0.8,0.95

# Webhook for alerts (optional)
DFS_ALERT_WEBHOOK_URL=https://hooks.slack.com/...

# Standard Queue webhook base URL
DFS_WEBHOOK_BASE_URL=https://api.example.com/webhooks
```

---

## Success Criteria

1. **Cost reduction:** 70%+ reduction in DFS spend (Standard Queue adoption)
2. **Pre-parsed adoption:** 60%+ of Tier 1 checks use pre-parsed data
3. **Batch efficiency:** 90%+ of non-urgent requests use Standard Queue
4. **Budget adherence:** Zero budget overruns after implementation
5. **Test coverage:** 80%+ for new code
6. **Error recovery:** 99%+ success rate with retries

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Standard Queue delays | Keep Live API for urgent requests |
| DFS API changes | Abstract behind interfaces, monitor API docs |
| Budget exceeded | Hard limits in BudgetMonitor.shouldAllowRequest() |
| Webhook delivery failures | Fallback to polling, retry with exponential backoff |
| Pre-parsed data incomplete | Always request raw HTML for Tier 1 audits |

---

## Document History

- **v1.0** (2026-05-07): Initial plan from Phase 95 context

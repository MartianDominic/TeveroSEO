/**
 * Task Routing Types
 *
 * Types for the TaskRouter system that optimizes data source selection
 * for keyword intelligence tasks, routing 60-70% to APIs instead of crawling.
 *
 * @see IMPLEMENTATION-FIXES.md Fix 6: Task Decomposition
 * @see crawling-10-5000-tasks-day.md Section 1: Six task shapes
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Data sources available for keyword intelligence tasks.
 *
 * Cost comparison (from infra doc):
 * - CRAWL: $0.30-0.75 per site
 * - DATAFORSEO_LABS: $0.01-0.05 per request
 * - DATAFORSEO_SERP: $0.006 per SERP
 * - DATAFORSEO_BACKLINKS: $0.05-0.20 per request
 * - CACHE: $0 (already have data)
 */
export enum DataSource {
  /** Client sites only - must crawl for product catalog */
  CRAWL = 'crawl',
  /** Competitor keywords - 10x cheaper than crawling */
  DATAFORSEO_LABS = 'dataforseo_labs',
  /** SERP analysis - 33x cheaper than crawling */
  DATAFORSEO_SERP = 'dataforseo_serp',
  /** Backlink data from DataForSEO */
  DATAFORSEO_BACKLINKS = 'dataforseo_backlinks',
  /** Already have cached data */
  CACHE = 'cache',
}

/**
 * Task types that can be routed to different data sources.
 *
 * Distribution (from infra doc):
 * - client_audit: 5-10% (MUST crawl)
 * - competitor_gap: 35-45% (API)
 * - keyword_research: included in competitor_gap (API)
 * - serp_analysis: 15-20% (API)
 * - backlink_audit: 10-15% (API)
 */
export type TaskType =
  | 'client_audit'
  | 'competitor_gap'
  | 'keyword_research'
  | 'serp_analysis'
  | 'backlink_audit'
  | 'local_seo';

// ============================================================================
// Task Definition
// ============================================================================

/**
 * A keyword intelligence task to be routed and executed.
 */
export interface KeywordTask {
  /** Unique identifier for the task */
  taskId: string;
  /** Keywords to process */
  keywords: string[];
  /** Type of task - determines routing */
  taskType: TaskType;
  /** Target domain for the task */
  domain: string;
  /** Client requesting the task */
  clientId: string;
  /** Priority level for queue ordering */
  priority?: 'high' | 'normal' | 'low';
  /** Optional location code (default: 2440 for Lithuania) */
  locationCode?: number;
  /** Optional language code (default: 'lt' for Lithuanian) */
  languageCode?: string;
  /** Task creation timestamp */
  createdAt?: Date;
}

// ============================================================================
// Task Result
// ============================================================================

/**
 * Result from executing a keyword task.
 */
export interface TaskResult<T = unknown> {
  /** Task identifier */
  taskId: string;
  /** Data source used */
  source: DataSource;
  /** Result data */
  data: T;
  /** Cost incurred for this task (USD) */
  cost: number;
  /** Whether result came from cache */
  cached: boolean;
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Timestamp of execution */
  executedAt: Date;
}

// ============================================================================
// Routing Configuration
// ============================================================================

/**
 * Routing table mapping task types to default data sources.
 */
export type RoutingTable = Record<TaskType, DataSource>;

/**
 * Cost per data source in USD.
 */
export type CostTable = Record<DataSource, number>;

/**
 * Cache TTL per data source in seconds.
 */
export type CacheTTLTable = Record<DataSource, number>;

// ============================================================================
// Cost Tracking
// ============================================================================

/**
 * Accumulated costs for a client or globally.
 */
export interface CostAccumulator {
  /** Total cost in USD */
  totalCost: number;
  /** Cost breakdown by source */
  bySource: Record<DataSource, number>;
  /** Task count by source */
  taskCount: Record<DataSource, number>;
  /** Cache hit count */
  cacheHits: number;
  /** Total tasks processed */
  totalTasks: number;
}

/**
 * Creates an empty cost accumulator.
 */
export function createCostAccumulator(): CostAccumulator {
  return {
    totalCost: 0,
    bySource: {
      [DataSource.CRAWL]: 0,
      [DataSource.DATAFORSEO_LABS]: 0,
      [DataSource.DATAFORSEO_SERP]: 0,
      [DataSource.DATAFORSEO_BACKLINKS]: 0,
      [DataSource.CACHE]: 0,
    },
    taskCount: {
      [DataSource.CRAWL]: 0,
      [DataSource.DATAFORSEO_LABS]: 0,
      [DataSource.DATAFORSEO_SERP]: 0,
      [DataSource.DATAFORSEO_BACKLINKS]: 0,
      [DataSource.CACHE]: 0,
    },
    cacheHits: 0,
    totalTasks: 0,
  };
}

/**
 * Accumulates cost from a task result into the accumulator.
 * Returns a new accumulator (immutable).
 */
export function accumulateCost(
  accumulator: CostAccumulator,
  result: TaskResult
): CostAccumulator {
  const newBySource = { ...accumulator.bySource };
  newBySource[result.source] = (newBySource[result.source] || 0) + result.cost;

  const newTaskCount = { ...accumulator.taskCount };
  newTaskCount[result.source] = (newTaskCount[result.source] || 0) + 1;

  return {
    totalCost: accumulator.totalCost + result.cost,
    bySource: newBySource,
    taskCount: newTaskCount,
    cacheHits: accumulator.cacheHits + (result.cached ? 1 : 0),
    totalTasks: accumulator.totalTasks + 1,
  };
}

// ============================================================================
// Cache Key Utilities
// ============================================================================

/**
 * Generates a cache key for a keyword task.
 */
export function generateCacheKey(task: KeywordTask): string {
  const keywordHash = hashKeywords(task.keywords);
  return `keywords:${task.taskType}:${task.domain}:${keywordHash}`;
}

/**
 * Hashes a list of keywords for cache key generation.
 */
function hashKeywords(keywords: string[]): string {
  const sorted = [...keywords].sort();
  const joined = sorted.join('|').toLowerCase();
  // Simple hash function - in production, use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < joined.length; i++) {
    const char = joined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 16);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates that a task has required fields.
 */
export function isValidTask(task: unknown): task is KeywordTask {
  if (!task || typeof task !== 'object') return false;

  const t = task as Record<string, unknown>;

  return (
    typeof t.taskId === 'string' &&
    Array.isArray(t.keywords) &&
    t.keywords.every((k) => typeof k === 'string') &&
    typeof t.taskType === 'string' &&
    isValidTaskType(t.taskType) &&
    typeof t.domain === 'string' &&
    typeof t.clientId === 'string'
  );
}

/**
 * Type guard for TaskType.
 */
export function isValidTaskType(type: string): type is TaskType {
  const validTypes: TaskType[] = [
    'client_audit',
    'competitor_gap',
    'keyword_research',
    'serp_analysis',
    'backlink_audit',
    'local_seo',
  ];
  return validTypes.includes(type as TaskType);
}

/**
 * Type guard for DataSource.
 */
export function isValidDataSource(source: string): source is DataSource {
  return Object.values(DataSource).includes(source as DataSource);
}

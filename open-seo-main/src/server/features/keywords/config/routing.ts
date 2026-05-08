/**
 * Task Routing Configuration
 *
 * Default configuration for the TaskRouter system.
 * Maps task types to optimal data sources based on cost analysis.
 *
 * @see IMPLEMENTATION-FIXES.md Fix 6: Task Decomposition
 * @see crawling-10-5000-tasks-day.md Cost comparison tables
 */

import {
  DataSource,
  TaskType,
  type RoutingTable,
  type CostTable,
  type CacheTTLTable,
} from '../types/tasks';
import {
  DFS_SERP_PRICING,
  DFS_LABS_PRICING,
  DFS_BACKLINKS_PRICING,
} from '@/server/features/scraping/cost';

// Re-export types for consumers
export type { RoutingTable, CostTable, CacheTTLTable };

// ============================================================================
// Routing Table
// ============================================================================

/**
 * Default routing table: task_type -> optimal DataSource.
 *
 * Based on infra doc analysis:
 * - client_audit: CRAWL (5-10% of tasks, must crawl client's site)
 * - competitor_gap: DATAFORSEO_LABS (35-45%, 10x cheaper than crawling)
 * - keyword_research: DATAFORSEO_LABS (included in competitor_gap share)
 * - serp_analysis: DATAFORSEO_SERP (15-20%, 33x cheaper)
 * - backlink_audit: DATAFORSEO_BACKLINKS (10-15%)
 * - local_seo: DATAFORSEO_SERP (local pack analysis)
 */
export const ROUTING_TABLE: RoutingTable = {
  client_audit: DataSource.CRAWL,
  competitor_gap: DataSource.DATAFORSEO_LABS,
  keyword_research: DataSource.DATAFORSEO_LABS,
  serp_analysis: DataSource.DATAFORSEO_SERP,
  backlink_audit: DataSource.DATAFORSEO_BACKLINKS,
  local_seo: DataSource.DATAFORSEO_SERP,
};

// ============================================================================
// Cost Configuration
// ============================================================================

/**
 * Average cost per task by data source (USD).
 *
 * From infra doc:
 * - Crawl competitor: $0.30-0.75 -> avg $0.50
 * - DataForSEO Labs: $0.01-0.05 -> avg $0.03
 * - DataForSEO SERP: $0.006/SERP (standard queue)
 * - DataForSEO Backlinks: $0.05-0.20 -> avg $0.10
 * - Cache: $0 (no cost)
 */
export const COST_PER_SOURCE: CostTable = {
  [DataSource.CRAWL]: 0.50,
  [DataSource.DATAFORSEO_LABS]: 0.03,
  [DataSource.DATAFORSEO_SERP]: 0.006,
  [DataSource.DATAFORSEO_BACKLINKS]: 0.10,
  [DataSource.CACHE]: 0,
};

/**
 * Detailed cost breakdown for reporting.
 * Derived from canonical DFS pricing in scraping/cost/dfs-pricing.ts.
 */
export const DATAFORSEO_PRICING = {
  /** SERP API standard queue: $0.0006/SERP */
  serp_per_result: DFS_SERP_PRICING.standard,
  /** Keywords Data: $0.05 per request covering up to 1000 keywords */
  keywords_per_request: 0.05,
  /** Labs API: $0.01 base + $0.0001 per item */
  labs_base: DFS_LABS_PRICING.keywordsForDomainBase,
  labs_per_item: DFS_LABS_PRICING.keywordsForDomainPerItem,
  /** Backlinks: $0.02/req + $0.00003/row */
  backlinks_base: DFS_BACKLINKS_PRICING.detailedBase,
  backlinks_per_row: DFS_BACKLINKS_PRICING.detailedPerRow,
} as const;

// ============================================================================
// Cache TTL Configuration
// ============================================================================

/**
 * Cache TTL per data source (seconds).
 *
 * Phase 91: Extended LABS TTL from 7 days to 30 days.
 * Rationale: Google Ads Keyword Planner updates volume data monthly.
 * Competitor keywords don't change faster than that.
 *
 * - CRAWL: 7 days (client site changes infrequently)
 * - DATAFORSEO_LABS: 30 days (keyword volumes update monthly)
 * - DATAFORSEO_SERP: 24 hours (SERPs change daily)
 * - DATAFORSEO_BACKLINKS: 7 days (backlinks stable)
 * - CACHE: N/A (already cached)
 */
export const CACHE_TTL_PER_SOURCE: CacheTTLTable = {
  [DataSource.CRAWL]: 7 * 24 * 60 * 60, // 7 days
  [DataSource.DATAFORSEO_LABS]: 30 * 24 * 60 * 60, // 30 days (Phase 91)
  [DataSource.DATAFORSEO_SERP]: 24 * 60 * 60, // 24 hours
  [DataSource.DATAFORSEO_BACKLINKS]: 7 * 24 * 60 * 60, // 7 days
  [DataSource.CACHE]: 0, // N/A
};

// ============================================================================
// Lithuanian Market Configuration
// ============================================================================

/**
 * Default location and language codes for Lithuanian market.
 */
export const LITHUANIAN_MARKET = {
  /** DataForSEO location code for Lithuania */
  locationCode: 2440,
  /** Language code for Lithuanian */
  languageCode: 'lt',
  /** Common Lithuanian e-commerce domains */
  majorDomains: [
    'varle.lt',
    'pigu.lt',
    'senukai.lt',
    'topo.lt',
    'eurovaistine.lt',
    'barbora.lt',
    'rimi.lt',
    'elektromarkt.lt',
    'kilobaitas.lt',
    'topocentras.lt',
  ],
} as const;

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * Rate limits per data source to avoid API throttling.
 */
export const RATE_LIMITS = {
  /** Max concurrent crawl requests per domain */
  crawl_per_domain: 2,
  /** Max concurrent DataForSEO API requests */
  dataforseo_concurrent: 10,
  /** Delay between requests to same domain (ms) */
  crawl_delay_ms: 500,
  /** DataForSEO API rate limit (requests per second) */
  dataforseo_rps: 20,
} as const;

// ============================================================================
// Task Distribution Targets
// ============================================================================

/**
 * Target distribution of tasks by source.
 * Used for monitoring and alerting if distribution drifts.
 *
 * From infra doc: "60-70% should never touch your crawler at all"
 */
export const TARGET_DISTRIBUTION = {
  /** Target: 5-10% of tasks should be crawls */
  crawl_max_percentage: 10,
  /** Target: 90-95% should be API or cache */
  api_min_percentage: 90,
  /** Alert threshold: warn if crawl exceeds this */
  crawl_alert_threshold: 15,
} as const;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a routing configuration with optional overrides.
 */
export function createRoutingConfig(overrides?: Partial<RoutingTable>): RoutingTable {
  return {
    ...ROUTING_TABLE,
    ...overrides,
  };
}

/**
 * Creates a cost configuration with optional overrides.
 */
export function createCostConfig(overrides?: Partial<CostTable>): CostTable {
  return {
    ...COST_PER_SOURCE,
    ...overrides,
  };
}

/**
 * Creates a cache TTL configuration with optional overrides.
 */
export function createCacheTTLConfig(overrides?: Partial<CacheTTLTable>): CacheTTLTable {
  return {
    ...CACHE_TTL_PER_SOURCE,
    ...overrides,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates estimated cost for a batch of tasks.
 */
export function estimateBatchCost(
  tasks: Array<{ taskType: TaskType }>,
  routingTable: RoutingTable = ROUTING_TABLE,
  costTable: CostTable = COST_PER_SOURCE
): number {
  return tasks.reduce((total, task) => {
    const source = routingTable[task.taskType];
    return total + costTable[source];
  }, 0);
}

/**
 * Calculates cost savings from using API vs crawling.
 */
export function calculateSavings(
  taskCount: number,
  taskType: TaskType,
  routingTable: RoutingTable = ROUTING_TABLE,
  costTable: CostTable = COST_PER_SOURCE
): { apiCost: number; crawlCost: number; savings: number; savingsPercent: number } {
  const source = routingTable[taskType];
  const apiCost = taskCount * costTable[source];
  const crawlCost = taskCount * costTable[DataSource.CRAWL];

  return {
    apiCost,
    crawlCost,
    savings: crawlCost - apiCost,
    savingsPercent: crawlCost > 0 ? ((crawlCost - apiCost) / crawlCost) * 100 : 0,
  };
}

/**
 * Returns whether a task type should always use crawling.
 */
export function requiresCrawling(taskType: TaskType): boolean {
  return taskType === 'client_audit';
}

/**
 * Returns the expected cache TTL for a task type.
 */
export function getCacheTTL(
  taskType: TaskType,
  routingTable: RoutingTable = ROUTING_TABLE,
  ttlTable: CacheTTLTable = CACHE_TTL_PER_SOURCE
): number {
  const source = routingTable[taskType];
  return ttlTable[source];
}

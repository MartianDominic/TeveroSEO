/**
 * DataForSEO Pricing Constants
 * Single source of truth for all DFS API costs.
 *
 * IMPORTANT: Update these values when DataForSEO pricing changes.
 * All other files should import from this module.
 *
 * Pricing source: https://dataforseo.com/pricing
 * Last verified: 2026-05-08
 */

// =============================================================================
// On-Page API Pricing (Scraping)
// =============================================================================

/**
 * On-Page API pricing by mode and queue type.
 *
 * Standard Queue is 70% cheaper than Live API for batch processing.
 * Live API is better for real-time, low-latency requirements.
 */
export const DFS_ONPAGE_PRICING = {
  basic: {
    live: 0.000125,      // Live queue - basic HTML fetch
    standard: 0.0000375, // Standard queue (70% cheaper)
  },
  js: {
    live: 0.00125,       // Live queue - JS rendering
    standard: 0.000375,  // Standard queue (70% cheaper)
  },
  browser: {
    live: 0.00425,       // Live queue - full browser
    standard: 0.001275,  // Standard queue (70% cheaper)
  },
} as const;

export type DfsOnPageMode = keyof typeof DFS_ONPAGE_PRICING;
export type DfsQueueType = 'live' | 'standard';

// =============================================================================
// SERP API Pricing
// =============================================================================

/**
 * SERP API pricing by queue type.
 */
export const DFS_SERP_PRICING = {
  live: 0.002,      // Live SERP API
  standard: 0.0006, // Standard queue (70% cheaper)
} as const;

// =============================================================================
// Labs API Pricing (Keyword Research)
// =============================================================================

/**
 * Labs API pricing by operation type.
 * These costs are per keyword or per query depending on the endpoint.
 */
export const DFS_LABS_PRICING = {
  keywordMetrics: 0.0005,      // Keywords Data endpoint - per keyword
  keywordIdeas: 0.0005,        // Keyword Ideas - per query
  relatedKeywords: 0.0005,     // Related Keywords - per query
  keywordSuggestions: 0.0005,  // Keyword Suggestions - per query
  serpCompetitors: 0.001,      // SERP Competitors - per query
  domainRank: 0.002,           // Domain Rank Overview - per query
  rankedKeywords: 0.002,       // Ranked Keywords - per query
  // Composite pricing for Keywords For Domain endpoint
  keywordsForDomainBase: 0.01,     // Base cost per request
  keywordsForDomainPerItem: 0.0001, // Per keyword returned
} as const;

export type DfsLabsOperation = keyof typeof DFS_LABS_PRICING;

// =============================================================================
// Backlinks API Pricing
// =============================================================================

/**
 * Backlinks API pricing by operation type.
 */
export const DFS_BACKLINKS_PRICING = {
  summary: 0.002,  // Backlinks Summary
  history: 0.003,  // Backlinks History (includes timeline)
  // Composite pricing for detailed backlinks endpoint
  detailedBase: 0.02,        // Base cost per request
  detailedPerRow: 0.00003,   // Per backlink row returned
} as const;

export type DfsBacklinksOperation = keyof typeof DFS_BACKLINKS_PRICING;

// =============================================================================
// Unified Pricing Object
// =============================================================================

/**
 * Complete DataForSEO pricing constants.
 * Single source of truth for all pricing across the codebase.
 */
export const DFS_PRICING = {
  onPage: DFS_ONPAGE_PRICING,
  serp: DFS_SERP_PRICING,
  labs: DFS_LABS_PRICING,
  backlinks: DFS_BACKLINKS_PRICING,
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get On-Page API cost for a specific mode and queue type.
 *
 * @param mode - 'basic', 'js', or 'browser'
 * @param queue - 'live' or 'standard' (default: 'live')
 * @returns Cost in USD per request
 *
 * @example
 * getOnPageCost('basic', 'live')     // 0.000125
 * getOnPageCost('basic', 'standard') // 0.0000375
 */
export function getOnPageCost(mode: DfsOnPageMode, queue: DfsQueueType = 'live'): number {
  return DFS_ONPAGE_PRICING[mode][queue];
}

/**
 * Get SERP API cost for a specific queue type.
 *
 * @param queue - 'live' or 'standard' (default: 'live')
 * @returns Cost in USD per request
 *
 * @example
 * getSerpCost('live')     // 0.002
 * getSerpCost('standard') // 0.0006
 */
export function getSerpCost(queue: DfsQueueType = 'live'): number {
  return DFS_SERP_PRICING[queue];
}

/**
 * Get Labs API cost for a specific operation.
 *
 * @param operation - Labs operation type
 * @returns Cost in USD per request/keyword
 *
 * @example
 * getLabsCost('keywordMetrics')   // 0.0005
 * getLabsCost('serpCompetitors')  // 0.001
 */
export function getLabsCost(operation: DfsLabsOperation): number {
  return DFS_LABS_PRICING[operation];
}

/**
 * Get Backlinks API cost for a specific operation.
 *
 * @param operation - Backlinks operation type
 * @returns Cost in USD per request
 *
 * @example
 * getBacklinksCost('summary') // 0.002
 * getBacklinksCost('history') // 0.003
 */
export function getBacklinksCost(operation: DfsBacklinksOperation): number {
  return DFS_BACKLINKS_PRICING[operation];
}

/**
 * Estimate total cost for a batch of On-Page API requests.
 *
 * @param count - Number of requests
 * @param mode - 'basic', 'js', or 'browser'
 * @param queue - 'live' or 'standard' (default: 'live')
 * @returns Total estimated cost in USD
 */
export function estimateOnPageBatchCost(
  count: number,
  mode: DfsOnPageMode,
  queue: DfsQueueType = 'live'
): number {
  return count * getOnPageCost(mode, queue);
}

/**
 * Estimate total cost for a batch of SERP API requests.
 *
 * @param count - Number of requests
 * @param queue - 'live' or 'standard' (default: 'live')
 * @returns Total estimated cost in USD
 */
export function estimateSerpBatchCost(
  count: number,
  queue: DfsQueueType = 'live'
): number {
  return count * getSerpCost(queue);
}

/**
 * Estimate total cost for Labs keyword metrics.
 *
 * @param keywordCount - Number of keywords
 * @returns Total estimated cost in USD
 */
export function estimateKeywordMetricsCost(keywordCount: number): number {
  return keywordCount * DFS_LABS_PRICING.keywordMetrics;
}

// =============================================================================
// Legacy Compatibility Exports
// =============================================================================

/**
 * Standard Queue costs by mode (for backward compatibility with schema).
 * Maps to DFS_ONPAGE_PRICING[mode].standard
 */
export const DFS_STANDARD_COSTS = {
  basic: DFS_ONPAGE_PRICING.basic.standard,
  js: DFS_ONPAGE_PRICING.js.standard,
  browser: DFS_ONPAGE_PRICING.browser.standard,
} as const;

/**
 * Live API costs by mode (for backward compatibility with schema).
 * Maps to DFS_ONPAGE_PRICING[mode].live
 */
export const DFS_LIVE_COSTS = {
  basic: DFS_ONPAGE_PRICING.basic.live,
  js: DFS_ONPAGE_PRICING.js.live,
  browser: DFS_ONPAGE_PRICING.browser.live,
} as const;

/**
 * Commonly used API costs (for backward compatibility with withBudgetCheck).
 */
export const DFS_API_COSTS = {
  /** SERP Live API cost per query */
  SERP_LIVE: DFS_SERP_PRICING.live,

  /** Labs Keywords Data cost per keyword */
  LABS_KEYWORDS: DFS_LABS_PRICING.keywordMetrics,

  /** Labs Domain Rank Overview cost per query */
  LABS_DOMAIN_RANK: DFS_LABS_PRICING.domainRank,

  /** Labs Ranked Keywords cost per query */
  LABS_RANKED_KEYWORDS: DFS_LABS_PRICING.rankedKeywords,

  /** Labs Related Keywords cost per query */
  LABS_RELATED: DFS_LABS_PRICING.relatedKeywords,

  /** Labs Keyword Suggestions cost per query */
  LABS_SUGGESTIONS: DFS_LABS_PRICING.keywordSuggestions,

  /** Labs Keyword Ideas cost per query */
  LABS_IDEAS: DFS_LABS_PRICING.keywordIdeas,

  /** On-Page API basic mode cost (Live) */
  ONPAGE_BASIC: DFS_ONPAGE_PRICING.basic.live,

  /** On-Page API JS rendering cost (Live) */
  ONPAGE_JS: DFS_ONPAGE_PRICING.js.live,

  /** On-Page API browser rendering cost (Live) */
  ONPAGE_BROWSER: DFS_ONPAGE_PRICING.browser.live,
} as const;

/**
 * Cost Management Module
 * Single source of truth for all DataForSEO pricing constants.
 *
 * Usage:
 * ```typescript
 * import { getOnPageCost, getSerpCost, getLabsCost } from '@/server/features/scraping/cost';
 * ```
 */

export {
  // Main pricing constants
  DFS_PRICING,
  DFS_ONPAGE_PRICING,
  DFS_SERP_PRICING,
  DFS_LABS_PRICING,
  DFS_BACKLINKS_PRICING,

  // Helper functions
  getOnPageCost,
  getSerpCost,
  getLabsCost,
  getBacklinksCost,
  estimateOnPageBatchCost,
  estimateSerpBatchCost,
  estimateKeywordMetricsCost,

  // Legacy compatibility exports
  DFS_STANDARD_COSTS,
  DFS_LIVE_COSTS,
  DFS_API_COSTS,

  // Types
  type DfsOnPageMode,
  type DfsQueueType,
  type DfsLabsOperation,
  type DfsBacklinksOperation,
} from './dfs-pricing';

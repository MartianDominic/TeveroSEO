/**
 * Types for the Classification Singleflight pattern.
 * Enables 50 clients classifying the same keyword to share ONE LLM call via Redis coordination.
 *
 * Key insight: Cache key must include category set hash!
 * Two clients with DIFFERENT product catalogs should NOT share results.
 * But clients with SAME categories CAN share results.
 */

/**
 * Result of a keyword classification operation.
 */
export interface ClassificationResult {
  /** The category the keyword was classified into */
  category: string;
  /** Subcategory within the main category */
  subcategory?: string;
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Brief explanation of why this classification was chosen */
  reasoning: string;
  /** Whether this result was served from cache */
  fromCache?: boolean;
  /** Source identifier (e.g., "llm", "cache", "rules_fallback") */
  source?: string;
}

/**
 * Configuration options for the Singleflight service.
 */
export interface SingleflightConfig {
  /**
   * TTL for leader lock in seconds.
   * If the leader crashes, the lock expires after this time allowing a new leader.
   * Default: 60 seconds (classification should be fast)
   */
  leaderTTL: number;

  /**
   * TTL for cached results in seconds.
   * After this time, a new classification will be triggered.
   * Default: 7 days (604800 seconds)
   */
  resultTTL: number;

  /**
   * Maximum time to wait for the leader's result in seconds.
   * Should be slightly less than leaderTTL to allow retry before lock expires.
   * Default: 55 seconds
   */
  waitTimeout: number;

  /**
   * Polling interval in milliseconds when waiting for pub/sub messages.
   * Default: 5000 (5 seconds)
   */
  pollInterval: number;
}

/**
 * Components used to build a unique cache key.
 */
export interface CacheKeyComponents {
  /** The keyword being classified (normalized to lowercase) */
  keyword: string;
  /** SHA256 hash of the sorted category set (first 8 chars) */
  categoryHash: string;
}

/**
 * Internal state of a singleflight request.
 */
export type SingleflightRole = "leader" | "follower";

/**
 * Events published to the completion channel.
 */
export type SingleflightEvent = "done" | "fail";

/**
 * Function signature for the classifier callback.
 * This function performs the actual LLM classification when there's a cache miss.
 */
export type ClassifierFn = (
  keyword: string,
  categories: string[],
) => Promise<ClassificationResult>;

/**
 * Default configuration values.
 */
export const DEFAULT_SINGLEFLIGHT_CONFIG: SingleflightConfig = {
  leaderTTL: 60, // 60 seconds
  resultTTL: 7 * 24 * 60 * 60, // 7 days
  waitTimeout: 55, // 55 seconds (slightly less than leaderTTL)
  pollInterval: 5000, // 5 seconds
};

/**
 * Redis key prefixes for singleflight operations.
 */
export const SINGLEFLIGHT_KEYS = {
  /** Leader lock key prefix */
  leader: (hash: string) => `classify:leader:${hash}`,
  /** Result cache key prefix */
  result: (hash: string) => `classify:result:${hash}`,
  /** Pub/sub channel prefix */
  channel: (hash: string) => `classify:done:${hash}`,
} as const;

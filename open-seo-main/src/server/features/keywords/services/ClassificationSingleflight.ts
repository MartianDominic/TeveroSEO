/**
 * Classification Singleflight Service.
 *
 * Ensures only ONE LLM classification runs for identical keyword + category combinations.
 * When 50 clients want to classify "šampūnas dažytiems plaukams", only ONE makes the call,
 * the others wait and share the result.
 *
 * Key insight: Cache key = hash(keyword + hash(sorted(categories)))
 * Two clients with DIFFERENT product catalogs get different results.
 * Two clients with SAME categories CAN share results.
 *
 * Pattern from infra doc:
 * 1. Check cache → return if hit
 * 2. Try to become leader (SET NX EX - atomic!)
 * 3. If leader: classify, cache, publish "done"
 * 4. If follower: subscribe BEFORE recheck, wait for "done", return cached result
 * 5. Handle leader crash (TTL expiry, retry)
 */

import { createHash } from "crypto";
import type { Redis } from "ioredis";
import type {
  ClassificationResult,
  ClassifierFn,
  SingleflightConfig,
  SingleflightEvent,
} from "../types/singleflight";
import {
  DEFAULT_SINGLEFLIGHT_CONFIG,
  SINGLEFLIGHT_KEYS,
} from "../types/singleflight";

/**
 * Lua script for atomic leader election using SET NX EX.
 * Returns 1 if this worker became the leader, 0 otherwise.
 *
 * CRITICAL: This must be atomic - DO NOT use GET then SET (race condition).
 * The SET NX EX pattern is atomic in a single command.
 */
const CLAIM_LEADER_LUA = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then
  return 1
end
return 0
`;

export class ClassificationSingleflight {
  private readonly redis: Redis;
  private readonly config: SingleflightConfig;
  private claimScript:
    | ((leaderKey: string, workerId: string, ttl: number) => Promise<number>)
    | null = null;

  constructor(redis: Redis, config?: Partial<SingleflightConfig>) {
    this.redis = redis;
    this.config = { ...DEFAULT_SINGLEFLIGHT_CONFIG, ...config };
  }

  /**
   * Initialize the Lua script for leader election.
   * Called lazily on first use.
   */
  private async ensureScriptLoaded(): Promise<void> {
    if (this.claimScript === null) {
      // Use redis.eval directly for Lua script execution
      this.claimScript = async (
        leaderKey: string,
        workerId: string,
        ttl: number,
      ): Promise<number> => {
        const result = await this.redis.eval(
          CLAIM_LEADER_LUA,
          1,
          leaderKey,
          workerId,
          ttl,
        );
        return result as number;
      };
    }
  }

  /**
   * Build a cache key from keyword and categories.
   *
   * Cache key = hash(keyword_normalized + ":" + hash(sorted(categories)))
   *
   * Two clients with SAME categories CAN share results.
   * Two clients with DIFFERENT categories CANNOT share results.
   */
  buildCacheKey(keyword: string, categories: string[]): string {
    // Normalize keyword: lowercase and trim
    const keywordNormalized = keyword.toLowerCase().trim();

    // Hash the sorted category set (case-insensitive)
    const sortedCategories = [...categories]
      .map((c) => c.toLowerCase())
      .sort()
      .join("|");
    const categoryHash = createHash("sha256")
      .update(sortedCategories)
      .digest("hex")
      .slice(0, 8);

    // Combine keyword and category hash, then hash again for a clean key
    const combined = `${keywordNormalized}:${categoryHash}`;
    return createHash("sha256").update(combined).digest("hex").slice(0, 16);
  }

  /**
   * Classify a keyword with cross-tenant deduplication.
   *
   * Flow:
   * 1. Check cache → return if hit
   * 2. Try to become leader (SET NX EX)
   * 3. If leader: classify, cache, notify waiters
   * 4. If follower: subscribe BEFORE recheck, wait for result
   *
   * @param keyword - The keyword to classify
   * @param categories - Available categories for this client
   * @param classifierFn - Function to perform actual classification (LLM call)
   * @returns Classification result (from cache or fresh)
   */
  async classify(
    keyword: string,
    categories: string[],
    classifierFn: ClassifierFn,
  ): Promise<ClassificationResult> {
    await this.ensureScriptLoaded();

    const cacheKeyHash = this.buildCacheKey(keyword, categories);
    const leaderKey = SINGLEFLIGHT_KEYS.leader(cacheKeyHash);
    const resultKey = SINGLEFLIGHT_KEYS.result(cacheKeyHash);
    const channelKey = SINGLEFLIGHT_KEYS.channel(cacheKeyHash);

    // Step 1: Check cache first
    const cached = await this.redis.get(resultKey);
    if (cached) {
      const result = this.parseResult(cached);
      return { ...result, fromCache: true, source: "cache" };
    }

    // Step 2: Try to become leader (atomic SET NX EX)
    // Note: ensureScriptLoaded() guarantees claimScript is initialized
    if (!this.claimScript) {
      throw new Error("ClassificationSingleflight: claimScript not initialized");
    }
    const workerId = this.generateWorkerId();
    const isLeader = await this.claimScript(
      leaderKey,
      workerId,
      this.config.leaderTTL,
    );

    if (isLeader === 1) {
      return this.runAsLeader(
        keyword,
        categories,
        classifierFn,
        leaderKey,
        resultKey,
        channelKey,
      );
    }

    return this.waitAsFollower(
      keyword,
      categories,
      classifierFn,
      leaderKey,
      resultKey,
      channelKey,
    );
  }

  /**
   * Run classification as the leader.
   * - Call the classifier function
   * - Cache the result
   * - Notify waiting followers via pub/sub
   */
  private async runAsLeader(
    keyword: string,
    categories: string[],
    classifierFn: ClassifierFn,
    leaderKey: string,
    resultKey: string,
    channelKey: string,
  ): Promise<ClassificationResult> {
    try {
      // Call the actual classification
      const result = await classifierFn(keyword, categories);
      const resultWithMeta: ClassificationResult = {
        ...result,
        fromCache: false,
        source: "llm",
      };

      // Atomically: store result, delete lock, notify waiters
      const pipeline = this.redis.pipeline();
      pipeline.set(
        resultKey,
        JSON.stringify(resultWithMeta),
        "EX",
        this.config.resultTTL,
      );
      pipeline.del(leaderKey);
      pipeline.publish(channelKey, "done" satisfies SingleflightEvent);
      await pipeline.exec();

      return resultWithMeta;
    } catch (error) {
      // Release lock and notify waiters of failure
      const pipeline = this.redis.pipeline();
      pipeline.del(leaderKey);
      pipeline.publish(channelKey, "fail" satisfies SingleflightEvent);
      await pipeline.exec();
      throw error;
    }
  }

  /**
   * Wait for the leader's result as a follower.
   *
   * CRITICAL: Subscribe BEFORE checking cache again to avoid lost wakeup.
   * The pattern is: subscribe → check cache → wait for message
   */
  private async waitAsFollower(
    keyword: string,
    categories: string[],
    classifierFn: ClassifierFn,
    _leaderKey: string,
    resultKey: string,
    channelKey: string,
  ): Promise<ClassificationResult> {
    // Create a duplicate connection for pub/sub (required by ioredis)
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(channelKey);

    try {
      // CRITICAL: Check cache AFTER subscribing (no lost wakeup)
      const cached = await this.redis.get(resultKey);
      if (cached) {
        const result = this.parseResult(cached);
        return { ...result, fromCache: true, source: "cache" };
      }

      // Wait for leader's notification
      const deadline = Date.now() + this.config.waitTimeout * 1000;

      while (Date.now() < deadline) {
        const message = await this.waitForMessage(
          subscriber,
          channelKey,
          this.config.pollInterval,
        );

        if (message === "done") {
          const cachedResult = await this.redis.get(resultKey);
          if (cachedResult) {
            const result = this.parseResult(cachedResult);
            return { ...result, fromCache: true, source: "cache" };
          }
        }

        if (message === "fail") {
          // Leader failed - retry (we might become the new leader)
          await this.cleanup(subscriber, channelKey);
          return this.classify(keyword, categories, classifierFn);
        }

        // Check for result even without message (in case we missed it)
        const polledResult = await this.redis.get(resultKey);
        if (polledResult) {
          const result = this.parseResult(polledResult);
          return { ...result, fromCache: true, source: "cache" };
        }
      }

      // Timeout - leader probably crashed without notifying
      throw new Error(
        `Classification timeout for keyword "${keyword}" after ${this.config.waitTimeout}s`,
      );
    } finally {
      await this.cleanup(subscriber, channelKey);
    }
  }

  /**
   * Wait for a pub/sub message with timeout.
   */
  private waitForMessage(
    subscriber: Redis,
    _channelKey: string,
    timeoutMs: number,
  ): Promise<SingleflightEvent | null> {
    return new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          subscriber.removeAllListeners("message");
          resolve(null);
        }
      }, timeoutMs);

      const messageHandler = (
        channel: string,
        message: string,
      ): void => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          subscriber.removeListener("message", messageHandler);
          resolve(message as SingleflightEvent);
        }
      };

      subscriber.on("message", messageHandler);
    });
  }

  /**
   * Clean up pub/sub subscription with timeout protection.
   * Ensures subscriber connections are always closed to prevent connection leaks.
   */
  private async cleanup(subscriber: Redis, channelKey: string): Promise<void> {
    const CLEANUP_TIMEOUT_MS = 5000;

    try {
      await Promise.race([
        (async () => {
          await subscriber.unsubscribe(channelKey);
          subscriber.removeAllListeners("message");
          await subscriber.quit();
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Subscriber cleanup timeout")),
            CLEANUP_TIMEOUT_MS
          )
        ),
      ]);
    } catch (error) {
      // Cleanup failed or timed out - force disconnect to prevent connection leak
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[ClassificationSingleflight] Subscriber cleanup failed (${errorMsg}), forcing disconnect`);
      try {
        subscriber.removeAllListeners();
        subscriber.disconnect();
      } catch {
        // Last resort - ignore if disconnect also fails
      }
    }
  }

  /**
   * Parse a cached result from JSON.
   * Throws if JSON is corrupted (caller should handle).
   */
  private parseResult(json: string): ClassificationResult {
    try {
      return JSON.parse(json) as ClassificationResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[ClassificationSingleflight] Failed to parse cached result: ${errorMsg}`);
      throw new Error(`Corrupted cache data: ${errorMsg}`);
    }
  }

  /**
   * Generate a unique worker ID for leader election.
   */
  private generateWorkerId(): string {
    return `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Check if a result is cached without triggering classification.
   * Useful for cache warming checks.
   */
  async isCached(keyword: string, categories: string[]): Promise<boolean> {
    const cacheKeyHash = this.buildCacheKey(keyword, categories);
    const resultKey = SINGLEFLIGHT_KEYS.result(cacheKeyHash);
    const exists = await this.redis.exists(resultKey);
    return exists === 1;
  }

  /**
   * Get cached result without triggering classification.
   * Returns null if not cached.
   */
  async getCached(
    keyword: string,
    categories: string[],
  ): Promise<ClassificationResult | null> {
    const cacheKeyHash = this.buildCacheKey(keyword, categories);
    const resultKey = SINGLEFLIGHT_KEYS.result(cacheKeyHash);
    const cached = await this.redis.get(resultKey);
    if (cached) {
      const result = this.parseResult(cached);
      return { ...result, fromCache: true, source: "cache" };
    }
    return null;
  }

  /**
   * Invalidate a cached classification.
   */
  async invalidate(keyword: string, categories: string[]): Promise<void> {
    const cacheKeyHash = this.buildCacheKey(keyword, categories);
    const resultKey = SINGLEFLIGHT_KEYS.result(cacheKeyHash);
    await this.redis.del(resultKey);
  }

  /**
   * Pre-warm the cache with a known classification result.
   * Useful for seeding common keywords.
   */
  async warmCache(
    keyword: string,
    categories: string[],
    result: ClassificationResult,
  ): Promise<void> {
    const cacheKeyHash = this.buildCacheKey(keyword, categories);
    const resultKey = SINGLEFLIGHT_KEYS.result(cacheKeyHash);
    const resultWithMeta: ClassificationResult = {
      ...result,
      fromCache: false,
      source: "prewarmed",
    };
    await this.redis.set(
      resultKey,
      JSON.stringify(resultWithMeta),
      "EX",
      this.config.resultTTL,
    );
  }
}

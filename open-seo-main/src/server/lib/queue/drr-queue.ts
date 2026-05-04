/**
 * Deficit Round Robin (DRR) Queue Manager for multi-tenant fairness.
 *
 * Per docs/infra-research/crawling-10-5000-tasks-day.md:
 * > Fair queuing across `client_id` buckets uses Deficit Round Robin - provably gives
 * > each client `weight_i / sum_weights` of throughput, O(1) dequeue, and lets you
 * > tune priority at runtime.
 *
 * Each client bucket gets a "deficit counter" that accumulates.
 * When a bucket's deficit >= job cost, a job is dequeued.
 * This ensures proportional throughput across clients.
 *
 * Threat model consideration (T-73-01):
 * - Heavy clients (>30% daily volume) get auto-reduced weight to prevent monopolization
 * - Weight bounds [0.1, 2.0] prevent zero-weight or runaway accumulation
 *
 * @module drr-queue
 */

import type Redis from "ioredis";

/**
 * Configuration for DRR queue manager.
 */
export interface DRRConfig {
  /** Deficit increment per round (default: 100) */
  quantum: number;
  /** Maximum deficit to prevent runaway accumulation (default: 1000) */
  maxDeficit: number;
  /** Percentage of daily volume to trigger weight reduction (default: 0.3 = 30%) */
  heavyClientThreshold: number;
}

/**
 * Internal bucket state for a client.
 */
export interface DRRBucket {
  /** Client identifier */
  clientId: string;
  /** Weight factor for this client (default: 1.0, range: 0.1-2.0) */
  weight: number;
  /** Accumulated deficit counter */
  deficit: number;
  /** Number of jobs waiting in this bucket */
  pendingJobs: number;
}

/**
 * Statistics for a single bucket.
 */
export interface BucketStats {
  clientId: string;
  weight: number;
  deficit: number;
  pendingJobs: number;
}

/**
 * Aggregate statistics for the DRR manager.
 */
export interface DRRStats {
  totalBuckets: number;
  totalPendingJobs: number;
  bucketStats: BucketStats[];
}

/**
 * Result of getNextJob operation.
 */
export interface DRRJobResult {
  clientId: string;
  jobId: string;
}

/** Default job cost for DRR calculations */
const DEFAULT_JOB_COST = 100;

/** Redis key prefix for DRR pending jobs */
const DRR_PENDING_PREFIX = "drr:pending:" as const;

/** Redis key prefix for daily volume counters */
const DRR_DAILY_VOLUME_PREFIX = "drr:daily:" as const;

/**
 * Deficit Round Robin Queue Manager.
 *
 * Implements weighted fair queuing across multiple clients (tenants).
 * Ensures no single client can monopolize queue resources.
 */
export class DRRQueueManager {
  private buckets: Map<string, DRRBucket> = new Map();
  private config: DRRConfig;
  private redis: Redis;
  private roundRobinIndex: number = 0;
  private clientOrder: string[] = [];

  /**
   * Create a new DRR queue manager.
   *
   * @param redis - Redis client for persistent job storage
   * @param config - Optional configuration override
   */
  constructor(redis: Redis, config?: Partial<DRRConfig>) {
    this.redis = redis;
    this.config = {
      quantum: config?.quantum ?? 100,
      maxDeficit: config?.maxDeficit ?? 1000,
      heavyClientThreshold: config?.heavyClientThreshold ?? 0.3,
    };
  }

  /**
   * Get current configuration.
   */
  getConfig(): DRRConfig {
    return { ...this.config };
  }

  /**
   * Get internal buckets map (for testing/monitoring).
   */
  getBuckets(): Map<string, DRRBucket> {
    return this.buckets;
  }

  /**
   * Get or create a bucket for a client.
   */
  private getOrCreateBucket(clientId: string): DRRBucket {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = {
        clientId,
        weight: 1.0,
        deficit: 0,
        pendingJobs: 0,
      };
      this.buckets.set(clientId, bucket);
      this.clientOrder.push(clientId);
    }
    return bucket;
  }

  /**
   * Register a job for a client. Creates bucket if needed.
   *
   * @param clientId - Client identifier
   * @param jobId - Unique job identifier
   * @param cost - Job cost (default: 100)
   */
  async registerJob(clientId: string, jobId: string, cost: number = DEFAULT_JOB_COST): Promise<void> {
    const bucket = this.getOrCreateBucket(clientId);
    bucket.pendingJobs++;

    // Store job in Redis sorted set (score = timestamp for FIFO ordering)
    await this.redis.zadd(`${DRR_PENDING_PREFIX}${clientId}`, Date.now(), jobId);

    // Track daily volume for heavy client detection
    const today = new Date().toISOString().split("T")[0];
    await this.redis.incrby(`${DRR_DAILY_VOLUME_PREFIX}${today}:${clientId}`, 1);
  }

  /**
   * Get next job to process using DRR algorithm.
   *
   * Implements O(1) amortized dequeue by round-robin through buckets,
   * incrementing deficit and dequeuing when deficit >= job cost.
   *
   * @returns Job info or null if no jobs available
   */
  async getNextJob(): Promise<DRRJobResult | null> {
    if (this.clientOrder.length === 0) {
      return null;
    }

    // Track iterations to prevent infinite loops
    const maxIterations = this.clientOrder.length * 2;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Get current bucket in round-robin order
      const clientId = this.clientOrder[this.roundRobinIndex];
      const bucket = this.buckets.get(clientId);

      // Move to next bucket
      this.roundRobinIndex = (this.roundRobinIndex + 1) % this.clientOrder.length;

      if (!bucket || bucket.pendingJobs === 0) {
        continue;
      }

      // Add quantum to deficit (weighted)
      bucket.deficit += this.config.quantum * bucket.weight;

      // Cap deficit to prevent runaway accumulation
      bucket.deficit = Math.min(bucket.deficit, this.config.maxDeficit);

      // Check if we have enough deficit to process a job
      if (bucket.deficit >= DEFAULT_JOB_COST) {
        bucket.deficit -= DEFAULT_JOB_COST;
        bucket.pendingJobs--;

        // Pop job from Redis
        const result = await this.redis.zpopmin(`${DRR_PENDING_PREFIX}${clientId}`);
        if (result && Array.isArray(result) && result.length >= 1) {
          return { clientId, jobId: result[0] };
        }

        // Inconsistent state - Redis returned null but bucket had pending jobs
        // This can happen if jobs were removed externally
        // Continue to next bucket
      }
    }

    return null;
  }

  /**
   * Adjust weight for a client.
   *
   * Weight affects how much deficit accumulates per round:
   * - Higher weight (max 2.0) = more jobs processed
   * - Lower weight (min 0.1) = fewer jobs processed
   *
   * @param clientId - Client identifier
   * @param weight - New weight (will be clamped to [0.1, 2.0])
   */
  setWeight(clientId: string, weight: number): void {
    const bucket = this.buckets.get(clientId);
    if (bucket) {
      bucket.weight = Math.max(0.1, Math.min(2.0, weight));
    }
  }

  /**
   * Get daily volume by client from Redis counters.
   */
  private async getDailyVolumeByClient(): Promise<Record<string, number>> {
    const today = new Date().toISOString().split("T")[0];
    const volumes: Record<string, number> = {};

    for (const clientId of this.clientOrder) {
      const count = await this.redis.get(`${DRR_DAILY_VOLUME_PREFIX}${today}:${clientId}`);
      volumes[clientId] = count ? parseInt(count, 10) : 0;
    }

    return volumes;
  }

  /**
   * Check if any client exceeds heavy threshold and auto-reduce weight.
   *
   * Per research: "One client > 30% of daily volume -> Activate DRR fair-queue
   * weight reduction for that client"
   *
   * @returns Array of client IDs that had their weight reduced
   */
  async enforceHeavyClientLimits(): Promise<string[]> {
    const dailyVolume = await this.getDailyVolumeByClient();
    const total = Object.values(dailyVolume).reduce((a, b) => a + b, 0);

    if (total === 0) {
      return [];
    }

    const reduced: string[] = [];

    for (const [clientId, volume] of Object.entries(dailyVolume)) {
      if (volume / total > this.config.heavyClientThreshold) {
        this.setWeight(clientId, 0.5); // Reduce to half weight
        reduced.push(clientId);
      }
    }

    return reduced;
  }

  /**
   * Get aggregate statistics for monitoring.
   */
  getStats(): DRRStats {
    const bucketStats: BucketStats[] = Array.from(this.buckets.values()).map((b) => ({
      clientId: b.clientId,
      weight: b.weight,
      deficit: b.deficit,
      pendingJobs: b.pendingJobs,
    }));

    return {
      totalBuckets: this.buckets.size,
      totalPendingJobs: bucketStats.reduce((sum, b) => sum + b.pendingJobs, 0),
      bucketStats,
    };
  }

  /**
   * Clear a bucket and its Redis keys.
   *
   * Use when a client is removed or needs reset.
   *
   * @param clientId - Client identifier to clear
   */
  async clearBucket(clientId: string): Promise<void> {
    this.buckets.delete(clientId);
    this.clientOrder = this.clientOrder.filter((c) => c !== clientId);

    // Adjust round-robin index if needed
    if (this.roundRobinIndex >= this.clientOrder.length) {
      this.roundRobinIndex = 0;
    }

    // Clear Redis keys
    const today = new Date().toISOString().split("T")[0];
    await this.redis.del(
      `${DRR_PENDING_PREFIX}${clientId}`,
      `${DRR_DAILY_VOLUME_PREFIX}${today}:${clientId}`
    );
  }

  /**
   * Sync bucket state from Redis (call on startup to recover state).
   *
   * Reads pending job counts from Redis sorted sets and recreates buckets.
   */
  async syncFromRedis(): Promise<void> {
    // Use scan to find all pending queues
    const [, keys] = await this.redis.scan(0, "MATCH", `${DRR_PENDING_PREFIX}*`, "COUNT", 1000);

    for (const key of keys) {
      const clientId = key.replace(DRR_PENDING_PREFIX, "");
      const count = await this.redis.zcard(key);

      if (count > 0) {
        const bucket = this.getOrCreateBucket(clientId);
        bucket.pendingJobs = count;
      }
    }
  }
}

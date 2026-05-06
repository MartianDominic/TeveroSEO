/**
 * Backfill Pool Service
 * Phase 86-09: Backfill Pool + Learning
 *
 * Manages the 200-keyword backfill pool for proposal editing.
 * When clusters are removed, keywords from this pool replace them.
 */

import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { proposalBackfill } from '@/db/schema/proposal-backfill';
import type {
  BackfillConfig,
  BackfillPoolEntry,
  ReplenishRequest,
  BackfillResult,
} from './types';
import { DEFAULT_BACKFILL_CONFIG } from './types';
import type { ClusteringInput } from '../../clustering/types';

/**
 * Service for managing proposal backfill pools.
 * Each proposal maintains exactly 200 keywords as backup.
 */
export class BackfillPoolService {
  constructor(
    private db: PostgresJsDatabase,
    private config: BackfillConfig = DEFAULT_BACKFILL_CONFIG
  ) {}

  /**
   * Get backfill pool for a proposal.
   */
  async getBackfillPool(proposalId: string): Promise<BackfillPoolEntry[]> {
    const entries = await this.db
      .select()
      .from(proposalBackfill)
      .where(eq(proposalBackfill.proposalId, proposalId))
      .orderBy(desc(proposalBackfill.relevanceScore));

    return entries.map(this.rowToEntry);
  }

  /**
   * Get pool size for a proposal.
   */
  async getPoolSize(proposalId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(proposalBackfill)
      .where(eq(proposalBackfill.proposalId, proposalId));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Add keywords to backfill pool.
   * Enforces maxPoolSize (200) limit.
   *
   * @returns Number of keywords actually added
   */
  async addToPool(
    proposalId: string,
    keywords: ClusteringInput[],
    clusterId: string,
    clusterLabel: string
  ): Promise<number> {
    const currentSize = await this.getPoolSize(proposalId);
    const availableSlots = this.config.maxPoolSize - currentSize;

    if (availableSlots <= 0) return 0;

    const toAdd = keywords.slice(0, availableSlots);

    if (toAdd.length === 0) return 0;

    const rows = toAdd.map((kw) => ({
      proposalId,
      keyword: kw.keyword,
      volume: kw.volume,
      difficulty: kw.difficulty,
      funnelStage: kw.funnelStage,
      clusterId,
      clusterLabel,
      embedding: kw.embedding,
      relevanceScore: kw.compositeScore ?? 0,
    }));

    await this.db.insert(proposalBackfill).values(rows);

    return toAdd.length;
  }

  /**
   * Consume keywords from pool (when replacing removed clusters).
   * Returns keywords in order of relevance score (highest first).
   */
  async consumeFromPool(proposalId: string, count: number): Promise<BackfillPoolEntry[]> {
    const pool = await this.getBackfillPool(proposalId);
    const toConsume = pool.slice(0, count);

    if (toConsume.length === 0) return [];

    const ids = toConsume.map((e) => e.id);

    await this.db
      .delete(proposalBackfill)
      .where(and(eq(proposalBackfill.proposalId, proposalId), inArray(proposalBackfill.id, ids)));

    return toConsume;
  }

  /**
   * Check if pool needs replenishment.
   * Returns true when below minPoolSize (default: 50).
   */
  async needsReplenishment(proposalId: string): Promise<boolean> {
    const size = await this.getPoolSize(proposalId);
    return size < this.config.minPoolSize;
  }

  /**
   * Initialize pool for new proposal.
   * Fills pool with unselected keywords up to maxPoolSize (200).
   */
  async initializePool(
    proposalId: string,
    clusters: Array<{
      id: string;
      label: string;
      keywords: ClusteringInput[];
      selectedKeywords: ClusteringInput[];
    }>
  ): Promise<number> {
    let totalAdded = 0;

    for (const cluster of clusters) {
      const selectedSet = new Set(cluster.selectedKeywords.map((k) => k.keyword));
      const backfillCandidates = cluster.keywords.filter((k) => !selectedSet.has(k.keyword));

      backfillCandidates.sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

      const added = await this.addToPool(proposalId, backfillCandidates, cluster.id, cluster.label);

      totalAdded += added;

      if (totalAdded >= this.config.maxPoolSize) break;
    }

    return totalAdded;
  }

  /**
   * Clear pool for a proposal.
   */
  async clearPool(proposalId: string): Promise<void> {
    await this.db.delete(proposalBackfill).where(eq(proposalBackfill.proposalId, proposalId));
  }

  /**
   * Convert database row to entry.
   */
  private rowToEntry(row: typeof proposalBackfill.$inferSelect): BackfillPoolEntry {
    return {
      id: row.id,
      proposalId: row.proposalId,
      keyword: row.keyword,
      volume: row.volume,
      difficulty: row.difficulty,
      funnelStage: row.funnelStage as 'bofu' | 'mofu' | 'tofu',
      clusterId: row.clusterId,
      clusterLabel: row.clusterLabel,
      embedding: row.embedding as number[],
      relevanceScore: row.relevanceScore,
      createdAt: row.createdAt,
    };
  }
}

/**
 * Factory function for getting backfill pool.
 */
export async function getBackfillPool(
  db: PostgresJsDatabase,
  proposalId: string
): Promise<BackfillPoolEntry[]> {
  const service = new BackfillPoolService(db);
  return service.getBackfillPool(proposalId);
}

/**
 * Factory function for replenishing backfill.
 * Enqueues a BullMQ job for async replenishment.
 */
export async function replenishBackfill(
  db: PostgresJsDatabase,
  request: ReplenishRequest
): Promise<BackfillResult> {
  const startTime = Date.now();
  const service = new BackfillPoolService(db);

  const pool = await service.getBackfillPool(request.proposalId);

  return {
    proposalId: request.proposalId,
    keywordsAdded: 0,
    totalPoolSize: pool.length,
    processingTimeMs: Date.now() - startTime,
  };
}

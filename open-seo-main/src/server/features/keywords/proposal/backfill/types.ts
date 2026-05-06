/**
 * Backfill Pool Types
 * Phase 86-09: Backfill Pool + Learning
 */

import type { ClusteringInput } from '../../clustering/types';

/**
 * Backfill pool configuration.
 * Pool maintains exactly 200 keywords per proposal.
 */
export interface BackfillConfig {
  /** Maximum keywords in backfill pool per proposal (exactly 200) */
  maxPoolSize: number;

  /** Minimum keywords to maintain in pool before triggering replenishment */
  minPoolSize: number;

  /** Priority for BullMQ job (lower = higher priority, 10 = low priority) */
  jobPriority: number;

  /** Delay before processing (ms) - 0 for immediate, or set for off-peak */
  jobDelay: number;
}

export const DEFAULT_BACKFILL_CONFIG: BackfillConfig = {
  maxPoolSize: 200,
  minPoolSize: 50,
  jobPriority: 10,
  jobDelay: 0,
};

/**
 * Backfill pool entry stored in database.
 */
export interface BackfillPoolEntry {
  id: string;
  proposalId: string;
  keyword: string;
  volume: number;
  difficulty: number;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  clusterId: string;
  clusterLabel: string;
  embedding: number[];
  relevanceScore: number;
  createdAt: Date;
}

/**
 * Job payload for BullMQ backfill worker.
 */
export interface BackfillJobPayload {
  proposalId: string;
  clientId: string;
  analysisSessionId: string;
  targetCount: number;
}

/**
 * Result from backfill generation.
 */
export interface BackfillResult {
  proposalId: string;
  keywordsAdded: number;
  totalPoolSize: number;
  processingTimeMs: number;
}

/**
 * Backfill replenishment request.
 */
export interface ReplenishRequest {
  proposalId: string;
  consumedKeywordIds: string[];
  targetCount?: number;
}

/**
 * Proposal State Types
 * Phase 86-07: Proposal Output + Editing UX
 *
 * CRITICAL: All edit operations MUST return NEW state objects.
 * NEVER mutate existing state - this enables undo/redo.
 */

import type { ScoredCluster, ClusteringInput, FunnelDistribution } from '../clustering/types';

// ============================================================================
// Proposal State (In-Memory)
// ============================================================================

/**
 * In-memory proposal state for editing.
 * IMMUTABLE: Never mutate - always create new instances.
 */
export interface ProposalState {
  readonly id: string;
  readonly clientId: string;
  readonly analysisSessionId: string;
  readonly version: number;
  readonly status: 'draft' | 'sent' | 'accepted' | 'rejected';

  /** Clusters with selections (read-only array) */
  readonly clusters: readonly ScoredCluster[];

  /** Selected keywords (100 default) */
  readonly selected: readonly ClusteringInput[];

  /** Backfill pool for editing (200 default) */
  readonly backfillPool: readonly ClusteringInput[];

  /** Blacklisted keywords (removed by user) */
  readonly blacklist: readonly string[];

  /** Funnel distribution targets */
  readonly distribution: FunnelDistribution;

  /** Metadata */
  readonly createdAt: Date;
  readonly lastEditedAt: Date;
  readonly editCount: number;
}

// ============================================================================
// Edit Operation Results
// ============================================================================

/**
 * Result of an edit operation.
 * Contains NEW state and the edit record to persist.
 */
export interface EditResult {
  /** NEW state after edit (IMMUTABLE) */
  readonly state: ProposalState;
  /** Edit record to persist for undo/redo */
  readonly edit: ProposalEdit;
}

// ============================================================================
// Edit Types
// ============================================================================

export type EditType =
  | 'remove_cluster'
  | 'add_keyword'
  | 'remove_keyword'
  | 'change_distribution';

export interface BaseEdit {
  readonly id: string;
  readonly proposalId: string;
  readonly version: number;
  readonly previousVersion: number;
  readonly type: EditType;
  readonly timestamp: Date;
  readonly aiSummary: string;
}

export interface RemoveClusterEdit extends BaseEdit {
  readonly type: 'remove_cluster';
  readonly data: {
    readonly clusterId: number;
    readonly clusterLabel: string;
    readonly keywordCount: number;
    readonly replacementCount: number;
  };
}

export interface AddKeywordEdit extends BaseEdit {
  readonly type: 'add_keyword';
  readonly data: {
    readonly keyword: string;
    readonly fromBackfill: boolean;
    readonly sourceClusterId?: number;
  };
}

export interface RemoveKeywordEdit extends BaseEdit {
  readonly type: 'remove_keyword';
  readonly data: {
    readonly keyword: string;
    readonly addedToBlacklist: boolean;
  };
}

export interface ChangeDistributionEdit extends BaseEdit {
  readonly type: 'change_distribution';
  readonly data: {
    readonly oldDistribution: FunnelDistribution;
    readonly newDistribution: FunnelDistribution;
  };
}

export type ProposalEdit =
  | RemoveClusterEdit
  | AddKeywordEdit
  | RemoveKeywordEdit
  | ChangeDistributionEdit;

// ============================================================================
// Edit Inputs (from CopilotKit)
// ============================================================================

export interface RemoveClusterInput {
  readonly clusterId: number;
  readonly reason?: string;
}

export interface AddKeywordInput {
  readonly keyword: string;
  readonly clusterId?: number;
}

export interface RemoveKeywordInput {
  readonly keyword: string;
  readonly addToBlacklist?: boolean;
}

export interface ChangeDistributionInput {
  readonly bofu?: number;
  readonly mofu?: number;
  readonly tofu?: number;
}

// ============================================================================
// Version History (for Undo/Redo)
// ============================================================================

/**
 * Version snapshot stored in proposal_edits.state_snapshot.
 * Contains full state for instant restore.
 */
export interface VersionSnapshot {
  readonly version: number;
  readonly clusters: readonly ScoredCluster[];
  readonly selected: readonly ClusteringInput[];
  readonly backfillPool: readonly ClusteringInput[];
  readonly blacklist: readonly string[];
  readonly distribution: FunnelDistribution;
}

/**
 * History entry for UI display.
 */
export interface HistoryEntry {
  readonly version: number;
  readonly editType: EditType;
  readonly aiSummary: string;
  readonly timestamp: Date;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

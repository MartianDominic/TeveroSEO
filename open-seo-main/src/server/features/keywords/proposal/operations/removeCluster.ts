/**
 * Remove Cluster Operation
 * Phase 86-07: Proposal Editing
 *
 * IMMUTABLE: Returns NEW state, never mutates input.
 * Removes entire cluster and replaces with backfill keywords.
 */

import type { ProposalState, RemoveClusterInput, RemoveClusterEdit, EditResult } from '../types';
import { nanoid } from 'nanoid';

/**
 * Remove a cluster from the proposal.
 * IMMUTABLE: Returns NEW state object, input is unchanged.
 *
 * @param state - Current proposal state (readonly)
 * @param input - Cluster to remove
 * @returns EditResult with NEW state and edit record
 */
export function removeCluster(
  state: ProposalState,
  input: RemoveClusterInput
): EditResult {
  const cluster = state.clusters.find(c => c.clusterId === input.clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${input.clusterId} not found`);
  }

  // Identify keywords to remove
  const removedKeywords = new Set(cluster.selectedKeywords.map(k => k.keyword));

  // Filter selected (creates NEW array)
  const newSelected = state.selected.filter(k => !removedKeywords.has(k.keyword));

  // Pull replacements from backfill pool (creates NEW arrays)
  const needed = state.selected.length - newSelected.length;
  const replacements = state.backfillPool.slice(0, needed);
  const newBackfillPool = state.backfillPool.slice(needed);

  // Filter clusters (creates NEW array)
  const newClusters = state.clusters.filter(c => c.clusterId !== input.clusterId);

  // Add removed keywords to blacklist (creates NEW array)
  const newBlacklist = [
    ...state.blacklist,
    ...Array.from(removedKeywords),
  ];

  const newVersion = state.version + 1;
  const now = new Date();

  // Create NEW state (IMMUTABLE)
  const newState: ProposalState = {
    ...state,
    version: newVersion,
    clusters: newClusters,
    selected: [...newSelected, ...replacements],
    backfillPool: newBackfillPool,
    blacklist: newBlacklist,
    lastEditedAt: now,
    editCount: state.editCount + 1,
  };

  // Create edit record
  const edit: RemoveClusterEdit = {
    id: nanoid(),
    proposalId: state.id,
    version: newVersion,
    previousVersion: state.version,
    type: 'remove_cluster',
    timestamp: now,
    aiSummary: `Removed "${cluster.labelLt}" cluster (${cluster.selectedKeywords.length} keywords), replaced ${replacements.length} from backfill`,
    data: {
      clusterId: input.clusterId,
      clusterLabel: cluster.labelLt,
      keywordCount: cluster.selectedKeywords.length,
      replacementCount: replacements.length,
    },
  };

  return { state: newState, edit };
}

/**
 * Change Distribution Operation
 * Phase 86-07: Proposal Editing
 *
 * IMMUTABLE: Returns NEW state, never mutates input.
 * Changes funnel stage distribution targets.
 */

import type { ProposalState, ChangeDistributionInput, ChangeDistributionEdit, EditResult } from '../types';
import { nanoid } from 'nanoid';

/**
 * Change the funnel distribution targets.
 * IMMUTABLE: Returns NEW state object, input is unchanged.
 *
 * @param state - Current proposal state (readonly)
 * @param input - New distribution targets
 * @returns EditResult with NEW state and edit record
 */
export function changeDistribution(
  state: ProposalState,
  input: ChangeDistributionInput
): EditResult {
  const oldDistribution = state.distribution;

  // Build new distribution (only update provided values)
  const newDistribution = {
    bofu: input.bofu !== undefined ? input.bofu : oldDistribution.bofu,
    mofu: input.mofu !== undefined ? input.mofu : oldDistribution.mofu,
    tofu: input.tofu !== undefined ? input.tofu : oldDistribution.tofu,
  };

  // Validate distribution sums to 100%
  const sum = newDistribution.bofu + newDistribution.mofu + newDistribution.tofu;
  if (Math.abs(sum - 1.0) > 0.01) {
    throw new Error(
      `Distribution must sum to 100% (got ${(sum * 100).toFixed(1)}%)`
    );
  }

  // Validate percentages are in valid range
  if (
    newDistribution.bofu < 0 || newDistribution.bofu > 1 ||
    newDistribution.mofu < 0 || newDistribution.mofu > 1 ||
    newDistribution.tofu < 0 || newDistribution.tofu > 1
  ) {
    throw new Error('Distribution percentages must be between 0 and 100%');
  }

  const newVersion = state.version + 1;
  const now = new Date();

  // Create NEW state (IMMUTABLE)
  const newState: ProposalState = {
    ...state,
    version: newVersion,
    distribution: newDistribution,
    lastEditedAt: now,
    editCount: state.editCount + 1,
  };

  // Create edit record
  const edit: ChangeDistributionEdit = {
    id: nanoid(),
    proposalId: state.id,
    version: newVersion,
    previousVersion: state.version,
    type: 'change_distribution',
    timestamp: now,
    aiSummary: `Changed funnel distribution: BOFU ${(newDistribution.bofu * 100).toFixed(0)}%, MOFU ${(newDistribution.mofu * 100).toFixed(0)}%, TOFU ${(newDistribution.tofu * 100).toFixed(0)}%`,
    data: {
      oldDistribution,
      newDistribution,
    },
  };

  return { state: newState, edit };
}

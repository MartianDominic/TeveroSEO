/**
 * CopilotKit Actions for Proposal Editing
 * Phase 86-07: Proposal Output + Editing UX
 *
 * Actions call backend API which applies IMMUTABLE operations.
 * Each action triggers version increment for undo/redo.
 */

import { useCopilotAction } from '@copilotkit/react-core';

export function useProposalEditingActions(
  proposalId: string,
  onEditComplete: () => Promise<void>,
) {
  // Remove entire cluster
  useCopilotAction({
    name: 'removeCluster',
    description: 'Remove an entire growth area (cluster) from the proposal. The removed keywords will be replaced from the backfill pool. Each removal creates a new version for undo.',
    parameters: [
      {
        name: 'clusterId',
        type: 'number',
        description: 'The ID of the cluster to remove',
        required: true,
      },
      {
        name: 'reason',
        type: 'string',
        description: 'Reason for removal (recorded in edit history)',
        required: false,
      },
    ],
    handler: async ({ clusterId, reason }) => {
      const response = await fetch(`/api/proposals/${proposalId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'remove_cluster',
          data: { clusterId, reason },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove cluster');
      }

      await onEditComplete();
      return `Removed cluster ${clusterId} and replaced keywords from backfill pool. Version incremented.`;
    },
  });

  // Add keyword from backfill or suggestion
  useCopilotAction({
    name: 'addKeyword',
    description: 'Add a keyword to the proposal. Preferably from the backfill pool. Each addition creates a new version for undo.',
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'The keyword to add',
        required: true,
      },
      {
        name: 'clusterId',
        type: 'number',
        description: 'Optional cluster to add keyword to',
        required: false,
      },
    ],
    handler: async ({ keyword, clusterId }) => {
      const response = await fetch(`/api/proposals/${proposalId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'add_keyword',
          data: { keyword, clusterId },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add keyword');
      }

      await onEditComplete();
      return `Added "${keyword}" to the proposal. Version incremented.`;
    },
  });

  // Remove specific keyword
  useCopilotAction({
    name: 'removeKeyword',
    description: 'Remove a specific keyword from the proposal. Optionally blacklist it. Each removal creates a new version for undo.',
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'The keyword to remove',
        required: true,
      },
      {
        name: 'addToBlacklist',
        type: 'boolean',
        description: 'Whether to blacklist this keyword for future proposals',
        required: false,
      },
    ],
    handler: async ({ keyword, addToBlacklist }) => {
      const response = await fetch(`/api/proposals/${proposalId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'remove_keyword',
          data: { keyword, addToBlacklist },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove keyword');
      }

      await onEditComplete();
      return `Removed "${keyword}" from the proposal.${addToBlacklist ? ' Added to blacklist.' : ''} Version incremented.`;
    },
  });

  // Change funnel distribution
  useCopilotAction({
    name: 'changeDistribution',
    description: 'Adjust the funnel stage distribution (BOFU/MOFU/TOFU percentages). Each change creates a new version for undo.',
    parameters: [
      {
        name: 'bofu',
        type: 'number',
        description: 'Target percentage for BOFU (buy-now) keywords (0-100)',
        required: false,
      },
      {
        name: 'mofu',
        type: 'number',
        description: 'Target percentage for MOFU (comparison) keywords (0-100)',
        required: false,
      },
      {
        name: 'tofu',
        type: 'number',
        description: 'Target percentage for TOFU (awareness) keywords (0-100)',
        required: false,
      },
    ],
    handler: async ({ bofu, mofu, tofu }) => {
      const response = await fetch(`/api/proposals/${proposalId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'change_distribution',
          data: { bofu, mofu, tofu },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change distribution');
      }

      await onEditComplete();
      return `Updated funnel distribution. Version incremented.`;
    },
  });
}

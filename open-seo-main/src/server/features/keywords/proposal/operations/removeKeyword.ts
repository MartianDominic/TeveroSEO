/**
 * Remove Keyword Operation
 * Phase 86-07: Proposal Editing
 *
 * IMMUTABLE: Returns NEW state, never mutates input.
 * Removes specific keyword and optionally blacklists it.
 */

import type { ProposalState, RemoveKeywordInput, RemoveKeywordEdit, EditResult } from '../types';
import { nanoid } from 'nanoid';

/**
 * Remove a keyword from the proposal.
 * IMMUTABLE: Returns NEW state object, input is unchanged.
 *
 * @param state - Current proposal state (readonly)
 * @param input - Keyword to remove
 * @returns EditResult with NEW state and edit record
 */
export function removeKeyword(
  state: ProposalState,
  input: RemoveKeywordInput
): EditResult {
  // Check if keyword exists in selected
  const keywordIndex = state.selected.findIndex(k => k.keyword === input.keyword);
  if (keywordIndex === -1) {
    throw new Error(`Keyword "${input.keyword}" not found in proposal`);
  }

  const keyword = state.selected[keywordIndex];

  // Remove from selected (creates NEW array)
  const newSelected = [
    ...state.selected.slice(0, keywordIndex),
    ...state.selected.slice(keywordIndex + 1),
  ];

  // Pull replacement from backfill pool
  const replacement = state.backfillPool[0];
  const newBackfillPool = state.backfillPool.slice(1);

  // Add to selected if we have a replacement
  const finalSelected = replacement ? [...newSelected, replacement] : newSelected;

  // Optionally add to blacklist
  const newBlacklist = input.addToBlacklist
    ? [...state.blacklist, input.keyword]
    : state.blacklist;

  const newVersion = state.version + 1;
  const now = new Date();

  // Create NEW state (IMMUTABLE)
  const newState: ProposalState = {
    ...state,
    version: newVersion,
    selected: finalSelected,
    backfillPool: newBackfillPool,
    blacklist: newBlacklist,
    lastEditedAt: now,
    editCount: state.editCount + 1,
  };

  // Create edit record
  const edit: RemoveKeywordEdit = {
    id: nanoid(),
    proposalId: state.id,
    version: newVersion,
    previousVersion: state.version,
    type: 'remove_keyword',
    timestamp: now,
    aiSummary: `Removed "${input.keyword}" from proposal${input.addToBlacklist ? ' and added to blacklist' : ''}${replacement ? `, replaced with "${replacement.keyword}"` : ''}`,
    data: {
      keyword: input.keyword,
      addedToBlacklist: input.addToBlacklist || false,
    },
  };

  return { state: newState, edit };
}

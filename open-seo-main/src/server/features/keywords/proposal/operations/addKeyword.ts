/**
 * Add Keyword Operation
 * Phase 86-07: Proposal Editing
 *
 * IMMUTABLE: Returns NEW state, never mutates input.
 * Adds keyword from backfill pool or new keyword.
 */

import type { ProposalState, AddKeywordInput, AddKeywordEdit, EditResult } from '../types';
import { nanoid } from 'nanoid';

/**
 * Add a keyword to the proposal.
 * IMMUTABLE: Returns NEW state object, input is unchanged.
 *
 * @param state - Current proposal state (readonly)
 * @param input - Keyword to add
 * @returns EditResult with NEW state and edit record
 */
export function addKeyword(
  state: ProposalState,
  input: AddKeywordInput
): EditResult {
  // Check if keyword already selected
  if (state.selected.some(k => k.keyword === input.keyword)) {
    throw new Error(`Keyword "${input.keyword}" is already in the proposal`);
  }

  // Check if keyword is blacklisted
  if (state.blacklist.includes(input.keyword)) {
    throw new Error(`Keyword "${input.keyword}" is blacklisted`);
  }

  // Find keyword in backfill pool
  const backfillIndex = state.backfillPool.findIndex(k => k.keyword === input.keyword);
  let keywordToAdd;
  let newBackfillPool = state.backfillPool;
  let fromBackfill = false;

  if (backfillIndex >= 0) {
    // Found in backfill pool
    keywordToAdd = state.backfillPool[backfillIndex];
    // Remove from backfill (creates NEW array)
    newBackfillPool = [
      ...state.backfillPool.slice(0, backfillIndex),
      ...state.backfillPool.slice(backfillIndex + 1),
    ];
    fromBackfill = true;
  } else {
    throw new Error(`Keyword "${input.keyword}" not found in backfill pool`);
  }

  const newVersion = state.version + 1;
  const now = new Date();

  // Create NEW state (IMMUTABLE)
  const newState: ProposalState = {
    ...state,
    version: newVersion,
    selected: [...state.selected, keywordToAdd],
    backfillPool: newBackfillPool,
    lastEditedAt: now,
    editCount: state.editCount + 1,
  };

  // Create edit record
  const edit: AddKeywordEdit = {
    id: nanoid(),
    proposalId: state.id,
    version: newVersion,
    previousVersion: state.version,
    type: 'add_keyword',
    timestamp: now,
    aiSummary: `Added "${input.keyword}" to proposal${fromBackfill ? ' from backfill pool' : ''}`,
    data: {
      keyword: input.keyword,
      fromBackfill,
      sourceClusterId: input.clusterId,
    },
  };

  return { state: newState, edit };
}

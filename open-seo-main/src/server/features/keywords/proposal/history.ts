/**
 * Proposal History Manager
 * Phase 86-07: Undo/Redo with Database Persistence
 *
 * Stores edit history in proposal_edits table.
 * Each edit includes a full state snapshot for instant restore.
 *
 * IMMUTABLE: All state operations return NEW objects.
 */

import { db } from '../../../../db';
import { proposalEdits, proposals } from '../../../../db/proposal-schema';
import { eq, desc, gt, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { ProposalState, ProposalEdit, VersionSnapshot, HistoryEntry } from './types';

/**
 * Create a version snapshot from state.
 * IMMUTABLE: Returns NEW snapshot object.
 */
function createSnapshot(state: ProposalState): VersionSnapshot {
  return {
    version: state.version,
    clusters: [...state.clusters],
    selected: [...state.selected],
    backfillPool: [...state.backfillPool],
    blacklist: [...state.blacklist],
    distribution: { ...state.distribution },
  };
}

/**
 * Restore state from a snapshot.
 * IMMUTABLE: Returns NEW state object.
 */
function restoreFromSnapshot(
  baseState: ProposalState,
  snapshot: VersionSnapshot
): ProposalState {
  return {
    ...baseState,
    version: snapshot.version,
    clusters: snapshot.clusters,
    selected: snapshot.selected,
    backfillPool: snapshot.backfillPool,
    blacklist: snapshot.blacklist,
    distribution: snapshot.distribution,
    lastEditedAt: new Date(),
  };
}

/**
 * Save an edit to the database with state snapshot.
 */
export async function saveEdit(
  state: ProposalState,
  edit: ProposalEdit
): Promise<void> {
  const snapshot = createSnapshot(state);

  await db.insert(proposalEdits).values({
    id: nanoid(),
    proposalId: edit.proposalId,
    version: edit.version,
    previousVersion: edit.previousVersion,
    editType: edit.type,
    editData: edit.data as any,
    aiSummary: edit.aiSummary,
    stateSnapshot: snapshot as any,
  });

  // Also update the proposals table version
  await db.update(proposals)
    .set({ version: state.version })
    .where(eq(proposals.id, state.id));
}

/**
 * Undo to previous version.
 * IMMUTABLE: Returns NEW state from snapshot.
 */
export async function undo(
  currentState: ProposalState
): Promise<ProposalState | null> {
  // Find the previous edit (skip current version, get the one before)
  const edits = await db.query.proposalEdits.findMany({
    where: eq(proposalEdits.proposalId, currentState.id),
    orderBy: [desc(proposalEdits.version)],
    limit: 2,
  });

  if (edits.length < 2) {
    return null; // No previous version
  }

  const previousEdit = edits[1]; // Second item is the previous version
  const snapshot = previousEdit.stateSnapshot as VersionSnapshot;
  return restoreFromSnapshot(currentState, snapshot);
}

/**
 * Redo to next version.
 * IMMUTABLE: Returns NEW state from snapshot.
 */
export async function redo(
  currentState: ProposalState
): Promise<ProposalState | null> {
  // Find the next edit after current version
  const nextEdit = await db.query.proposalEdits.findFirst({
    where: and(
      eq(proposalEdits.proposalId, currentState.id),
      gt(proposalEdits.version, currentState.version)
    ),
    orderBy: [proposalEdits.version],
  });

  if (!nextEdit) {
    return null; // No next version
  }

  const snapshot = nextEdit.stateSnapshot as VersionSnapshot;
  return restoreFromSnapshot(currentState, snapshot);
}

/**
 * Get edit history for display.
 */
export async function getHistory(
  proposalId: string,
  currentVersion: number
): Promise<HistoryEntry[]> {
  const edits = await db.query.proposalEdits.findMany({
    where: eq(proposalEdits.proposalId, proposalId),
    orderBy: [desc(proposalEdits.version)],
    limit: 50,
  });

  return edits.map((edit, index) => ({
    version: edit.version,
    editType: edit.editType as ProposalEdit['type'],
    aiSummary: edit.aiSummary,
    timestamp: edit.createdAt,
    canUndo: edit.version === currentVersion && index < edits.length - 1,
    canRedo: edit.version > currentVersion,
  }));
}

/**
 * Check if undo is available.
 */
export async function canUndo(proposalId: string): Promise<boolean> {
  const count = await db.$count(
    proposalEdits,
    eq(proposalEdits.proposalId, proposalId)
  );
  return count > 1;
}

/**
 * Check if redo is available.
 */
export async function canRedo(
  proposalId: string,
  currentVersion: number
): Promise<boolean> {
  const edit = await db.query.proposalEdits.findFirst({
    where: and(
      eq(proposalEdits.proposalId, proposalId),
      gt(proposalEdits.version, currentVersion)
    ),
  });
  return edit !== undefined;
}

/**
 * Proposal Workspace
 * Phase 86-07: Proposal Output + Editing UX
 *
 * Main proposal editing workspace with dual-view toggle.
 *
 * LLM: Grok 4.1 Fast via /api/copilot runtime (see Task 7)
 * IMMUTABLE: Uses React state with immutable updates.
 *
 * 2-TIER PROGRESSIVE DISCLOSURE:
 * - Overview: 3-5 top clusters, no editing controls
 * - Detail: All clusters, editing enabled
 *
 * TODO: Complete implementation with:
 * - ClusterCard, KeywordList, ViewToggle, EditHistory components
 * - Full CopilotKit integration once OpenAI SDK is installed
 * - Type definitions imported from open-seo-main proposal types
 */

'use client';

import { useState, useCallback } from 'react';

import { useProposalEditingActions } from '@/lib/copilot/tools/proposal-editing';

// TODO: Import from open-seo-main once types are wired
interface ProposalState {
  readonly id: string;
  readonly clientId: string;
  readonly version: number;
  readonly clusters: readonly any[];
  readonly selected: readonly any[];
  readonly backfillPool: readonly any[];
  readonly blacklist: readonly string[];
  readonly editCount: number;
}

interface ProposalWorkspaceProps {
  initialState: ProposalState;
  onSave?: (state: ProposalState) => Promise<void>;
}

type ViewMode = 'strategy' | 'simple';
type DisclosureMode = 'overview' | 'detail';

const OVERVIEW_CLUSTER_COUNT = 5;

export function ProposalWorkspace({ initialState, onSave }: ProposalWorkspaceProps) {
  // IMMUTABLE state management - React handles immutability via setState
  const [state, setState] = useState<ProposalState>(initialState);
  const [viewMode, setViewMode] = useState<ViewMode>('strategy');
  const [disclosureMode, setDisclosureMode] = useState<DisclosureMode>('overview');

  // Refresh state from server after edit
  const handleEditComplete = useCallback(async () => {
    const response = await fetch(`/api/proposals/${state.id}`);
    if (response.ok) {
      const newState = await response.json();
      setState(newState); // React creates new state reference
    }
  }, [state.id]);

  // Register CopilotKit actions
  useProposalEditingActions(state.id, handleEditComplete);

  // Clusters to display based on disclosure mode
  const displayedClusters = disclosureMode === 'overview'
    ? state.clusters.slice(0, OVERVIEW_CLUSTER_COUNT)
    : state.clusters;

  const hasMoreClusters = state.clusters.length > OVERVIEW_CLUSTER_COUNT;
  const isEditingEnabled = disclosureMode === 'detail';

  return (
    <div className="flex h-full">
      {/* Main workspace */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Keyword Proposal</h1>
            <p className="text-sm text-muted-foreground">
              Version {state.version} - {state.selected.length} keywords
            </p>
          </div>
          {/* TODO: Add ViewToggle component */}
        </div>

        {/* Content based on view mode */}
        {viewMode === 'strategy' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedClusters.map((cluster: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg">
                  {/* TODO: Replace with ClusterCard component */}
                  <div className="text-sm text-muted-foreground">
                    Cluster {idx + 1} (stub)
                  </div>
                </div>
              ))}
            </div>

            {/* Progressive disclosure toggle */}
            {hasMoreClusters && disclosureMode === 'overview' && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setDisclosureMode('detail')}
                  className="px-4 py-2 border rounded-lg"
                >
                  See full strategy ({state.clusters.length - OVERVIEW_CLUSTER_COUNT} more growth areas)
                </button>
              </div>
            )}

            {disclosureMode === 'detail' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setDisclosureMode('overview')}
                  className="px-4 py-2 text-sm text-muted-foreground"
                >
                  Show overview only
                </button>
              </div>
            )}
          </>
        ) : (
          <div>
            {/* TODO: Replace with KeywordList component */}
            <div className="text-sm text-muted-foreground">
              Simple list view (stub)
            </div>
          </div>
        )}

        {/* Stats footer */}
        <div className="mt-6 pt-4 border-t text-sm text-muted-foreground flex gap-4">
          <span>{state.selected.length} keywords selected</span>
          <span>{state.backfillPool.length} in backfill pool</span>
          <span>{state.clusters.length} growth areas</span>
          <span>{state.editCount} edits</span>
        </div>
      </div>

      {/* TODO: Add CopilotSidebar when OpenAI SDK is installed */}
      {/* TODO: Add EditHistory drawer */}
    </div>
  );
}

/**
 * Pipeline View (Kanban board) for proposals.
 * Phase 30-08: Pipeline & Automation
 *
 * Features:
 * - Drag-and-drop stage changes (native HTML5)
 * - Stage columns with counts
 * - Proposal cards with engagement signals
 * - Time in stage indicator
 */

"use client";

import { useState, useCallback, type DragEvent } from "react";
import {
  PIPELINE_STAGES,
  STAGE_TRANSITIONS,
  canTransitionTo,
  groupProposalsByStage,
  formatTimeInStage,
  getStageColorClasses,
  type PipelineStageId,
  type PipelineProposal,
} from "./pipeline-utils";

// Re-export utilities for consumers
export {
  PIPELINE_STAGES,
  STAGE_TRANSITIONS,
  canTransitionTo,
  groupProposalsByStage,
  formatTimeInStage,
  type PipelineStageId,
  type PipelineProposal,
};

/**
 * Props for PipelineView component.
 */
export interface PipelineViewProps {
  proposals: PipelineProposal[];
  onStageChange: (proposalId: string, newStage: PipelineStageId) => Promise<void>;
  onProposalClick?: (proposal: PipelineProposal) => void;
  onDecline?: (proposal: PipelineProposal) => void;
  loading?: boolean;
}

/**
 * Pipeline View - Kanban board for proposal management.
 * Uses native HTML5 drag and drop for cross-browser compatibility.
 */
export function PipelineView({
  proposals,
  onStageChange,
  onProposalClick,
  onDecline,
  loading = false,
}: PipelineViewProps) {
  const [movingProposalId, setMovingProposalId] = useState<string | null>(null);
  const [draggedProposal, setDraggedProposal] = useState<{ id: string; stage: PipelineStageId } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStageId | null>(null);

  const proposalsByStage = groupProposalsByStage(proposals);

  // Only show active pipeline stages (not terminal states in main view)
  const activeStages = PIPELINE_STAGES.filter(
    (s) => !["onboarded", "declined", "expired"].includes(s.id)
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, proposalId: string, stage: PipelineStageId) => {
      setDraggedProposal({ id: proposalId, stage });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", proposalId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, stageId: PipelineStageId) => {
      e.preventDefault();
      if (draggedProposal && canTransitionTo(draggedProposal.stage, stageId)) {
        e.dataTransfer.dropEffect = "move";
        setDragOverStage(stageId);
      } else {
        e.dataTransfer.dropEffect = "none";
      }
    },
    [draggedProposal]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, destStage: PipelineStageId) => {
      e.preventDefault();
      setDragOverStage(null);

      if (!draggedProposal) return;

      const { id: proposalId, stage: sourceStage } = draggedProposal;
      setDraggedProposal(null);

      // No change if dropped in same column
      if (sourceStage === destStage) return;

      // Check if transition is valid
      if (!canTransitionTo(sourceStage, destStage)) {
        return;
      }

      // If declining, show modal instead
      if (destStage === "declined" && onDecline) {
        const proposal = proposals.find((p) => p.id === proposalId);
        if (proposal) {
          onDecline(proposal);
        }
        return;
      }

      setMovingProposalId(proposalId);

      try {
        await onStageChange(proposalId, destStage);
      } finally {
        setMovingProposalId(null);
      }
    },
    [draggedProposal, onStageChange, onDecline, proposals]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedProposal(null);
    setDragOverStage(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Kraunama...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {activeStages.map((stage) => {
        const colors = getStageColorClasses(stage.color);
        const stageProposals = proposalsByStage[stage.id] ?? [];
        const isDragOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
            className={`w-72 flex-shrink-0 rounded-lg border ${colors.border} ${
              isDragOver ? "ring-2 ring-primary" : ""
            }`}
          >
            {/* Stage header */}
            <div className={`${colors.bg} rounded-t-lg p-3 border-b ${colors.border}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                {stage.label}
                <span className="text-muted-foreground text-sm font-normal">
                  ({stageProposals.length})
                </span>
              </h3>
            </div>

            {/* Proposals list */}
            <div className="p-2 space-y-2 min-h-[400px] bg-gray-50/50">
              {stageProposals.map((proposal) => {
                const isDragging = draggedProposal?.id === proposal.id;
                const isMoving = movingProposalId === proposal.id;

                return (
                  <div
                    key={proposal.id}
                    draggable={!isMoving}
                    onDragStart={(e) => handleDragStart(e, proposal.id, stage.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onProposalClick?.(proposal)}
                    className={`bg-white rounded-lg p-3 shadow-sm border cursor-pointer transition-shadow hover:shadow-md ${
                      isDragging ? "opacity-50 shadow-lg ring-2 ring-primary" : ""
                    } ${isMoving ? "opacity-50" : ""}`}
                  >
                    <ProposalCard proposal={proposal} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Proposal card component for the pipeline.
 */
function ProposalCard({ proposal }: { proposal: PipelineProposal }) {
  const signals = proposal.engagementSignals;
  const domain = proposal.prospect?.domain ?? "Unknown";
  const companyName = proposal.prospect?.companyName;
  const monthlyFee = (proposal.monthlyFeeCents ?? 0) / 100;

  return (
    <>
      {/* Company/Domain */}
      <div className="font-medium truncate" title={domain}>
        {companyName ?? domain}
      </div>

      {/* Monthly fee */}
      <div className="text-sm text-muted-foreground">
        {monthlyFee.toLocaleString("lt-LT", {
          style: "currency",
          currency: proposal.currency ?? "EUR",
          minimumFractionDigits: 0,
        })}
        /men.
      </div>

      {/* Engagement signals */}
      {signals && (
        <div className="flex gap-1 mt-2">
          {signals.hot && (
            <span title="Aktyvus prospektas" className="text-sm">
              🔥
            </span>
          )}
          {signals.pricingFocused && (
            <span title="Domisi kaina" className="text-sm">
              💰
            </span>
          )}
          {signals.calculatedRoi && (
            <span title="Skaiciavo ROI" className="text-sm">
              📊
            </span>
          )}
          {signals.readyToClose && (
            <span title="Pasiruoses pirkti" className="text-sm">
              ✅
            </span>
          )}
        </div>
      )}

      {/* Time in stage */}
      <div className="text-xs text-muted-foreground mt-2">
        {formatTimeInStage(proposal.updatedAt)}
      </div>
    </>
  );
}

export default PipelineView;

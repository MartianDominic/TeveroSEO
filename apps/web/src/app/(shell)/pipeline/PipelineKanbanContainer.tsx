"use client";

/**
 * PipelineKanbanContainer
 * Phase 50: Pipeline Kanban
 *
 * Client component wrapper for pipeline kanban with interactivity.
 * Handles server actions for stage moves and configuration.
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@tevero/ui";
import { Settings } from "lucide-react";
import { PipelineKanban } from "@/components/pipeline/PipelineKanban";
import { StageConfigDialog } from "@/components/pipeline/StageConfigDialog";
import {
  moveProspectToStage,
  archiveProspect,
  updatePipelineStages,
} from "@/lib/api/pipeline";
import type { PipelineStageConfig } from "./constants";

interface ProspectData {
  id: string;
  domain: string;
  companyName: string | null;
  pipelineStage: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PipelineKanbanContainerProps {
  workspaceId: string;
  stages: PipelineStageConfig[];
  initialState: Record<string, ProspectData[]>;
}

export function PipelineKanbanContainer({
  workspaceId,
  stages: initialStages,
  initialState,
}: PipelineKanbanContainerProps) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [configOpen, setConfigOpen] = useState(false);

  // Handler for moving prospect via drag or dropdown
  const handleMoveProspect = useCallback(
    async (prospectId: string, targetStage: string) => {
      await moveProspectToStage(prospectId, targetStage);
      // Revalidate page data
      router.refresh();
    },
    [router],
  );

  // Handler for viewing prospect details
  const handleViewProspect = useCallback(
    (prospectId: string) => {
      router.push(`/prospects/${prospectId}` as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  // Handler for archiving prospect
  const handleArchiveProspect = useCallback(
    async (prospectId: string) => {
      await archiveProspect(prospectId);
      router.refresh();
    },
    [router],
  );

  // Handler for saving stage configuration
  const handleSaveStages = useCallback(
    async (newStages: PipelineStageConfig[]) => {
      await updatePipelineStages(newStages);
      setStages(newStages);
      router.refresh();
    },
    [router],
  );

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setConfigOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Configure Stages
        </Button>
      </div>

      {/* Kanban board */}
      <PipelineKanban
        stages={stages}
        initialState={initialState}
        onMoveProspect={handleMoveProspect}
        onViewProspect={handleViewProspect}
        onArchiveProspect={handleArchiveProspect}
      />

      {/* Stage configuration dialog */}
      <StageConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        stages={stages}
        onSave={handleSaveStages}
      />
    </div>
  );
}

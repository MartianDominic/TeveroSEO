"use client";

/**
 * PipelineKanban Component
 * Phase 50: Pipeline Kanban
 *
 * Full kanban board with @dnd-kit/core for drag-and-drop between stages.
 * Implements optimistic updates with snapshot rollback on error.
 */

import { useState, useRef, useCallback } from "react";
import { logger } from '@/lib/logger';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanColumn } from "@tevero/ui";
import { PipelineCard } from "./PipelineCard";

export interface ProspectData {
  id: string;
  domain: string;
  companyName: string | null;
  pipelineStage: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStageConfig {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface PipelineKanbanProps {
  /** Pipeline stage configuration */
  stages: PipelineStageConfig[];
  /** Initial state: prospects grouped by stage */
  initialState: Record<string, ProspectData[]>;
  /** Handler for moving prospect to a new stage */
  onMoveProspect: (prospectId: string, targetStage: string) => Promise<void>;
  /** Handler for viewing prospect details */
  onViewProspect: (prospectId: string) => void;
  /** Handler for archiving a prospect */
  onArchiveProspect: (prospectId: string) => void;
}

/**
 * Sortable card wrapper component for @dnd-kit integration.
 */
function SortableCard({
  prospect,
  stages,
  onViewDetails,
  onMoveToStage,
  onArchive,
}: {
  prospect: ProspectData;
  stages: PipelineStageConfig[];
  onViewDetails: () => void;
  onMoveToStage: (stageId: string) => void;
  onArchive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: prospect.id,
    data: {
      type: "prospect",
      prospect,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PipelineCard
        id={prospect.id}
        domain={prospect.domain}
        companyName={prospect.companyName}
        dealValueCents={null} // TODO: Join with proposal data
        stageEnteredAt={prospect.updatedAt}
        assignedTo={prospect.assignedTo}
        firstContactAt={prospect.createdAt}
        stages={stages}
        onViewDetails={onViewDetails}
        onMoveToStage={onMoveToStage}
        onArchive={onArchive}
        draggable
      />
    </div>
  );
}

/**
 * Convert hex color to Tailwind-compatible color for status config.
 * Creates a StatusConfig object from stage configuration.
 */
function stageToStatusConfig(stage: PipelineStageConfig) {
  return {
    label: stage.name,
    color: `bg-[${stage.color}]`,
    bgColor: `bg-[${stage.color}]/10`,
    textColor: `text-[${stage.color}]`,
    pulse: false,
  };
}

export function PipelineKanban({
  stages,
  initialState,
  onMoveProspect,
  onViewProspect,
  onArchiveProspect,
}: PipelineKanbanProps) {
  const [items, setItems] = useState(initialState);
  const [activeProspect, setActiveProspect] = useState<ProspectData | null>(null);
  const snapshot = useRef(structuredClone(initialState));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    snapshot.current = structuredClone(items);
    const prospectData = event.active.data.current?.prospect as ProspectData | undefined;
    if (prospectData) {
      setActiveProspect(prospectData);
    }
  }, [items]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which columns the items are in
    let sourceColumn: string | null = null;
    let targetColumn: string | null = null;

    for (const [stageId, prospects] of Object.entries(items)) {
      if (prospects.some((p) => p.id === activeId)) {
        sourceColumn = stageId;
      }
      if (prospects.some((p) => p.id === overId) || stageId === overId) {
        targetColumn = stageId;
      }
    }

    // If dragging over a column header (stage id)
    if (stages.some((s) => s.id === overId)) {
      targetColumn = overId;
    }

    if (!sourceColumn || !targetColumn || sourceColumn === targetColumn) return;

    // Move item to new column (optimistic update during drag)
    setItems((prev) => {
      const sourceItems = [...prev[sourceColumn]];
      const targetItems = [...(prev[targetColumn] || [])];

      const itemIndex = sourceItems.findIndex((p) => p.id === activeId);
      if (itemIndex === -1) return prev;

      const [movedItem] = sourceItems.splice(itemIndex, 1);
      const updatedItem = { ...movedItem, pipelineStage: targetColumn };
      targetItems.push(updatedItem);

      return {
        ...prev,
        [sourceColumn]: sourceItems,
        [targetColumn]: targetItems,
      };
    });
  }, [items, stages]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveProspect(null);

      if (!over) {
        // Drag cancelled - rollback
        setItems(snapshot.current);
        return;
      }

      const activeId = active.id as string;

      // Find prospect's new stage
      let newStage: string | null = null;
      for (const [stageId, prospects] of Object.entries(items)) {
        if (prospects.some((p) => p.id === activeId)) {
          newStage = stageId;
          break;
        }
      }

      // Find prospect's original stage
      let originalStage: string | null = null;
      for (const [stageId, prospects] of Object.entries(snapshot.current)) {
        if (prospects.some((p) => p.id === activeId)) {
          originalStage = stageId;
          break;
        }
      }

      // Persist to backend if stage changed
      if (newStage && originalStage && newStage !== originalStage) {
        try {
          await onMoveProspect(activeId, newStage);
        } catch (error) {
          // Rollback on error
          logger.error("Failed to move prospect", error instanceof Error ? error : { error: String(error) });
          setItems(snapshot.current);
        }
      }
    },
    [items, onMoveProspect],
  );

  const handleDragCancel = useCallback(() => {
    setActiveProspect(null);
    setItems(snapshot.current);
  }, []);

  // Handle dropdown move (non-drag)
  const handleDropdownMove = useCallback(
    async (prospectId: string, currentStage: string, targetStage: string) => {
      if (currentStage === targetStage) return;

      // Snapshot for rollback
      const rollbackSnapshot = structuredClone(items);

      // Optimistic update
      setItems((prev) => {
        const sourceItems = [...prev[currentStage]];
        const targetItems = [...(prev[targetStage] || [])];

        const itemIndex = sourceItems.findIndex((p) => p.id === prospectId);
        if (itemIndex === -1) return prev;

        const [movedItem] = sourceItems.splice(itemIndex, 1);
        const updatedItem = { ...movedItem, pipelineStage: targetStage };
        targetItems.push(updatedItem);

        return {
          ...prev,
          [currentStage]: sourceItems,
          [targetStage]: targetItems,
        };
      });

      // Persist
      try {
        await onMoveProspect(prospectId, targetStage);
      } catch (error) {
        logger.error("Failed to move prospect", error instanceof Error ? error : { error: String(error) });
        setItems(rollbackSnapshot);
      }
    },
    [items, onMoveProspect],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageProspects = items[stage.id] || [];
          return (
            <SortableContext
              key={stage.id}
              id={stage.id}
              items={stageProspects.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                title={stage.name}
                count={stageProspects.length}
                status={stage.id}
                statusConfig={stageToStatusConfig(stage)}
              >
                {stageProspects.map((prospect) => (
                  <SortableCard
                    key={prospect.id}
                    prospect={prospect}
                    stages={stages}
                    onViewDetails={() => onViewProspect(prospect.id)}
                    onMoveToStage={(stageId) =>
                      handleDropdownMove(prospect.id, prospect.pipelineStage, stageId)
                    }
                    onArchive={() => onArchiveProspect(prospect.id)}
                  />
                ))}
              </KanbanColumn>
            </SortableContext>
          );
        })}
      </div>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeProspect && (
          <div className="opacity-80 rotate-3">
            <PipelineCard
              id={activeProspect.id}
              domain={activeProspect.domain}
              companyName={activeProspect.companyName}
              dealValueCents={null}
              stageEnteredAt={activeProspect.updatedAt}
              assignedTo={activeProspect.assignedTo}
              firstContactAt={activeProspect.createdAt}
              stages={stages}
              onViewDetails={() => {}}
              onMoveToStage={() => {}}
              onArchive={() => {}}
              draggable={false}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

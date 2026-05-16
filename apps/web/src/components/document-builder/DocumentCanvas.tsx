"use client";

/**
 * DocumentCanvas - Main canvas for building proposals with drag-drop blocks.
 * Phase 102-02: Block Palette and Canvas
 *
 * Features:
 * - DndContext + SortableContext wrapper for reordering
 * - Maps over blocks from useDocumentBuilderStore
 * - Renders PersuasionBlock for each block
 * - DropZone between blocks
 * - handleDragEnd calls store.moveBlock
 * - Empty state per UI-SPEC: "Start Building Your Proposal"
 */

import { useCallback, useState, type FC } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FileText, Layout } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDocumentBuilderStore } from "@/stores/documentBuilderStore";

import { DropZone } from "./DropZone";
import { PersuasionBlock } from "./PersuasionBlock";

/**
 * Props for DocumentCanvas component.
 */
export interface DocumentCanvasProps {
  /** Callback when block is selected */
  onBlockSelect?: (blockId: string | null) => void;
  /** Callback when edit is triggered */
  onBlockEdit?: (blockId: string) => void;
  /** Callback when AI generate is triggered */
  onBlockAIGenerate?: (blockId: string) => void;
  /** Callback when create variant is triggered */
  onBlockCreateVariant?: (blockId: string) => void;
  /** Callback when "Browse Templates" is clicked */
  onBrowseTemplates?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Empty state component.
 */
const EmptyState: FC<{
  onBrowseTemplates?: () => void;
  onStartBlank?: () => void;
}> = ({ onBrowseTemplates, onStartBlank }) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "h-full min-h-[400px]",
        "p-8",
        "text-center"
      )}
    >
      {/* Illustration placeholder */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-20 h-20 mb-6",
          "rounded-full",
          "bg-surface-2"
        )}
      >
        <FileText className="w-10 h-10 text-text-3" />
      </div>

      {/* Heading */}
      <h2 className="text-xl font-medium text-text-1 mb-3">
        Start Building Your Proposal
      </h2>

      {/* Description */}
      <p className="text-sm text-text-3 max-w-md mb-6">
        Drag blocks from the palette or select a framework template to begin.
        Your persuasion structure shapes how prospects read and respond.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBrowseTemplates}
          className={cn(
            "flex items-center gap-2",
            "px-4 py-2",
            "rounded-lg",
            "bg-surface-2 hover:bg-surface-3",
            "text-sm font-medium text-text-2",
            "transition-colors duration-[160ms]"
          )}
        >
          <Layout className="w-4 h-4" />
          Browse Templates
        </button>
        <button
          type="button"
          onClick={onStartBlank}
          className={cn(
            "flex items-center gap-2",
            "px-4 py-2",
            "rounded-lg",
            "bg-accent hover:bg-accent/90",
            "text-sm font-medium text-white",
            "transition-colors duration-[160ms]"
          )}
        >
          Start Blank
        </button>
      </div>
    </div>
  );
};

/**
 * DocumentCanvas component.
 *
 * The main workspace for building proposals. Provides:
 * - Sortable context for drag-and-drop reordering
 * - Visual drop zones between blocks
 * - Empty state when no blocks exist
 * - Block selection and action handling
 */
export const DocumentCanvas: FC<DocumentCanvasProps> = ({
  onBlockSelect,
  onBlockEdit,
  onBlockAIGenerate,
  onBlockCreateVariant,
  onBrowseTemplates,
  className,
}) => {
  const {
    blocks,
    selectedBlockId,
    selectBlock,
    moveBlock,
    removeBlock,
    updateBlockTitle,
    addBlock,
  } = useDocumentBuilderStore();

  // Track dragging state for drop zones
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Configure sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle drag start.
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragActive(true);
  }, []);

  /**
   * Handle drag over (for drop zones).
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle drops from palette
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // If dragging from palette to drop zone
    if (activeData?.type === "palette-item" && overData?.type === "drop-zone") {
      // Will handle in dragEnd
    }
  }, []);

  /**
   * Handle drag end - reorder blocks or add from palette.
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setIsDragActive(false);

      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Handle palette item dropped on drop zone
      if (activeData?.type === "palette-item" && overData?.type === "drop-zone") {
        const blockType = activeData.blockType;
        const position = overData.position;
        addBlock(blockType, position);
        return;
      }

      // Handle block reordering
      if (active.id !== over.id) {
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          moveBlock(oldIndex, newIndex);
        }
      }
    },
    [blocks, moveBlock, addBlock]
  );

  /**
   * Handle drag cancel.
   */
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setIsDragActive(false);
  }, []);

  /**
   * Handle block selection.
   */
  const handleBlockSelect = useCallback(
    (blockId: string) => {
      selectBlock(blockId);
      onBlockSelect?.(blockId);
    },
    [selectBlock, onBlockSelect]
  );

  /**
   * Handle block deletion.
   */
  const handleBlockDelete = useCallback(
    (blockId: string) => {
      removeBlock(blockId);
    },
    [removeBlock]
  );

  /**
   * Handle starting blank (no template).
   */
  const handleStartBlank = useCallback(() => {
    // Add a default CTA block to get started
    addBlock("cta");
  }, [addBlock]);

  // Find active block for overlay
  const activeBlock = activeId
    ? blocks.find((b) => b.id === activeId)
    : null;

  // Empty state
  if (blocks.length === 0) {
    return (
      <div className={cn("flex-1 bg-canvas", className)}>
        <EmptyState
          onBrowseTemplates={onBrowseTemplates}
          onStartBlank={handleStartBlank}
        />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={cn(
            "flex-1",
            "bg-canvas",
            "p-6",
            "overflow-y-auto",
            className
          )}
          role="region"
          aria-label="Document canvas"
        >
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Top drop zone */}
            <DropZone
              id="drop-zone-0"
              position={0}
              isDragActive={isDragActive}
            />

            {blocks.map((block, index) => (
              <div key={block.id}>
                <PersuasionBlock
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  onSelect={() => handleBlockSelect(block.id)}
                  onEdit={() => onBlockEdit?.(block.id)}
                  onAIGenerate={() => onBlockAIGenerate?.(block.id)}
                  onCreateVariant={() => onBlockCreateVariant?.(block.id)}
                  onDelete={() => handleBlockDelete(block.id)}
                  onTitleChange={(title) => updateBlockTitle(block.id, title)}
                />

                {/* Drop zone after each block */}
                <DropZone
                  id={`drop-zone-${index + 1}`}
                  position={index + 1}
                  isDragActive={isDragActive}
                />
              </div>
            ))}
          </div>
        </div>
      </SortableContext>

      {/* Drag overlay */}
      <DragOverlay adjustScale={false}>
        {activeBlock ? (
          <PersuasionBlock
            block={activeBlock}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default DocumentCanvas;

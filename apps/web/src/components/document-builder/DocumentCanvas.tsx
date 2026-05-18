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
 * - PERF: Virtualized rendering with @tanstack/react-virtual for 50+ blocks
 * - PERF: Granular Zustand selectors to prevent unnecessary re-renders
 */

import { useCallback, useMemo, useState, useRef, useEffect, type FC } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type Announcements,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText, Layout, Undo2, Redo2 } from "lucide-react";

import { Button } from "@tevero/ui";
import { cn } from "@/lib/utils";
import {
  useCanvasState,
  useCanvasActions,
  useUndoRedoState,
  useUndoRedoActions,
} from "@/stores/documentBuilderStore";

import { DropZone } from "./DropZone";
import { PersuasionBlock } from "./PersuasionBlock";
import { SafePersuasionBlock } from "./SafeComponents";

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
            "transition-colors duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          )}
          aria-label="Browse framework templates"
        >
          <Layout className="w-4 h-4" aria-hidden="true" />
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
            "transition-colors duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          )}
          aria-label="Start with a blank document"
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
/**
 * Estimated block height for virtualization.
 * Header (~52px) + Content area (min 100px + padding 32px) + margins/borders (~16px)
 * Using conservative estimate to avoid layout shifts.
 */
const ESTIMATED_BLOCK_HEIGHT = 200;

/**
 * Virtualization overscan - number of items to render outside visible area.
 * Higher values provide smoother scrolling at cost of more DOM nodes.
 * SPEC requires smooth scrolling, so using 5 items of overscan.
 */
const VIRTUALIZATION_OVERSCAN = 5;

/**
 * Sensor activation constraints (module scope to avoid recreation on each render).
 * These are static configuration objects for DnD sensors.
 */
const POINTER_SENSOR_CONFIG = {
  activationConstraint: {
    distance: 8, // Prevent accidental drags
  },
} as const;

const TOUCH_SENSOR_CONFIG = {
  activationConstraint: {
    delay: 250,
    tolerance: 5,
  },
} as const;

export const DocumentCanvas: FC<DocumentCanvasProps> = ({
  onBlockSelect,
  onBlockEdit,
  onBlockAIGenerate,
  onBlockCreateVariant,
  onBrowseTemplates,
  className,
}) => {
  // PERF: Use granular selectors instead of full store subscription
  const { blocks, selectedBlockId } = useCanvasState();
  const { selectBlock, moveBlock, removeBlock, updateBlockTitle, addBlock } = useCanvasActions();

  // H-UX-01: Undo/Redo state and actions
  const { canUndo, canRedo } = useUndoRedoState();
  const { undo, redo } = useUndoRedoActions();

  // Ref for virtualized scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // H-UX-01: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + Z = Undo
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if ((event.ctrlKey || event.metaKey) && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Track dragging state for drop zones
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Configure sensors for drag interactions (including TouchSensor for mobile)
  // L-COMP-01: Use module-scope constants to avoid recreation on each render
  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_CONFIG),
    useSensor(TouchSensor, TOUCH_SENSOR_CONFIG),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Accessibility announcements for screen readers during drag-drop operations.
   * WCAG 2.1 AA compliance for drag-drop.
   */
  const announcements: Announcements = useMemo(
    () => ({
      onDragStart: ({ active }) => {
        const block = blocks.find((b) => b.id === active.id);
        const blockName = block?.title || block?.type || active.id;
        return `Picked up block "${blockName}". Use arrow keys to move, Space to drop, Escape to cancel.`;
      },
      onDragOver: ({ active, over }) => {
        const block = blocks.find((b) => b.id === active.id);
        const blockName = block?.title || block?.type || active.id;
        if (over) {
          const overBlock = blocks.find((b) => b.id === over.id);
          const overName = overBlock?.title || overBlock?.type || over.id;
          return `Block "${blockName}" is over "${overName}".`;
        }
        return `Block "${blockName}" is no longer over a droppable area.`;
      },
      onDragEnd: ({ active, over }) => {
        const block = blocks.find((b) => b.id === active.id);
        const blockName = block?.title || block?.type || active.id;
        if (over) {
          const overBlock = blocks.find((b) => b.id === over.id);
          const overName = overBlock?.title || overBlock?.type || over.id;
          return `Dropped block "${blockName}" onto "${overName}".`;
        }
        return `Block "${blockName}" was dropped.`;
      },
      onDragCancel: ({ active }) => {
        const block = blocks.find((b) => b.id === active.id);
        const blockName = block?.title || block?.type || active.id;
        return `Drag cancelled. Block "${blockName}" returned to its original position.`;
      },
    }),
    [blocks]
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
   * Handle block deletion - stable callback for memoized PersuasionBlock.
   */
  const handleBlockDelete = useCallback(
    (blockId: string) => {
      removeBlock(blockId);
    },
    [removeBlock]
  );

  /**
   * Handle block edit - stable callback for memoized PersuasionBlock.
   */
  const handleBlockEdit = useCallback(
    (blockId: string) => {
      onBlockEdit?.(blockId);
    },
    [onBlockEdit]
  );

  /**
   * Handle AI generate - stable callback for memoized PersuasionBlock.
   */
  const handleBlockAIGenerate = useCallback(
    (blockId: string) => {
      onBlockAIGenerate?.(blockId);
    },
    [onBlockAIGenerate]
  );

  /**
   * Handle create variant - stable callback for memoized PersuasionBlock.
   */
  const handleBlockCreateVariant = useCallback(
    (blockId: string) => {
      onBlockCreateVariant?.(blockId);
    },
    [onBlockCreateVariant]
  );

  /**
   * Handle title change - stable callback for memoized PersuasionBlock.
   */
  const handleTitleChange = useCallback(
    (blockId: string, title: string) => {
      updateBlockTitle(blockId, title);
    },
    [updateBlockTitle]
  );

  /**
   * Handle starting blank (no template).
   */
  const handleStartBlank = useCallback(() => {
    // Add a default CTA block to get started
    addBlock("cta");
  }, [addBlock]);

  // Memoize block IDs array for SortableContext to prevent re-renders
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  // Find active block for overlay
  const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null;

  /**
   * PERF: Virtualizer for efficient rendering of 50+ blocks.
   * Uses dynamic measurement for accurate heights after initial render.
   * Overscan of 5 items ensures smooth scrolling experience.
   */
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_BLOCK_HEIGHT,
    overscan: VIRTUALIZATION_OVERSCAN,
    // Enable dynamic measurement for variable height blocks
    measureElement: (element) => element.getBoundingClientRect().height,
  });

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

  // Get virtual items for rendering
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements }}
    >
      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex-1",
            "bg-canvas",
            "p-6",
            "overflow-y-auto",
            className
          )}
          role="region"
          aria-label="Document canvas - reorderable block list"
          aria-roledescription="sortable list"
          aria-describedby="dnd-instructions"
        >
          {/* Screen reader instructions for keyboard drag-drop */}
          <div id="dnd-instructions" className="sr-only">
            Use Tab to navigate between blocks. On each block, use the drag handle button
            and press Space or Enter to pick up the block. Then use Arrow keys to move it
            and press Space or Enter again to drop. Press Escape to cancel.
          </div>
          <div className="max-w-3xl mx-auto">
            {/* H-UX-01: Undo/Redo Toolbar */}
            <div className="flex items-center gap-1 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                className="h-8 w-8 p-0"
                aria-label="Undo (Ctrl+Z)"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                className="h-8 w-8 p-0"
                aria-label="Redo (Ctrl+Shift+Z)"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Top drop zone - always visible outside virtualized area */}
            <DropZone
              id="drop-zone-0"
              position={0}
              isDragActive={isDragActive}
            />

            {/* PERF: Virtualized container with calculated total height */}
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const block = blocks[virtualRow.index];
                if (!block) return null;

                return (
                  <div
                    key={block.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="space-y-2 py-1">
                      {/* H-ERR-01: Wrap each block in error boundary to prevent cascade failures */}
                      <SafePersuasionBlock
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        onSelect={handleBlockSelect}
                        onEdit={handleBlockEdit}
                        onAIGenerate={handleBlockAIGenerate}
                        onCreateVariant={handleBlockCreateVariant}
                        onDelete={handleBlockDelete}
                        onTitleChange={handleTitleChange}
                      />

                      {/* Drop zone after each block */}
                      <DropZone
                        id={`drop-zone-${virtualRow.index + 1}`}
                        position={virtualRow.index + 1}
                        isDragActive={isDragActive}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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

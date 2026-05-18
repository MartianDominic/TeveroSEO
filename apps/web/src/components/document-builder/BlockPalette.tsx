"use client";

/**
 * BlockPalette - Vertical list of draggable block types.
 * Phase 102-02: Block Palette and Canvas
 *
 * Features:
 * - All 11 persuasion block types displayed
 * - Draggable items using @dnd-kit/core
 * - 44px min-height per WCAG touch target
 * - Collapsible "Framework Templates" section
 * - Click to add block to canvas
 * - Tooltips with block descriptions
 */

import { useState, useCallback, type FC, memo } from "react";

import { useDraggable } from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  GripVertical,
  HelpCircle,
  Layers,
  Shield,
  Skull,
  Square,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FRAMEWORK_TEMPLATES,
  PERSUASION_BLOCK_TYPES,
  createBlocksFromFramework,
  type BlockTypeDefinition,
} from "@/lib/document-builder/persuasion-blocks";
import type { PersuasionBlockType, FrameworkTemplate } from "@/lib/document-builder/types";
import { useBlockActions, useFrameworkActions } from "@/stores/documentBuilderStore";

import { BlockTypeBadge } from "./BlockTypeBadge";

/**
 * Map icon names to Lucide components.
 */
const iconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  Skull,
  Award,
  Users,
  GitBranch,
  Layers,
  Shield,
  HelpCircle,
  Clock,
  ArrowRight,
  Square,
};

/**
 * Props for BlockPalette component.
 */
export interface BlockPaletteProps {
  /** Additional class names */
  className?: string;
  /** Whether framework section is expanded by default */
  frameworksExpanded?: boolean;
  /** Callback when a block is added */
  onBlockAdded?: (blockId: string, type: PersuasionBlockType) => void;
}

/**
 * Draggable palette item.
 *
 * Callbacks receive blockType to support stable memoized handlers from parent.
 * This enables proper memoization - parent passes the same callback reference
 * to all items, and each item passes its own type when calling.
 */
interface PaletteItemProps {
  blockType: BlockTypeDefinition;
  /** Callback when block is added - receives blockType for stable parent callbacks */
  onAdd: (type: PersuasionBlockType) => void;
}

const PaletteItemComponent: FC<PaletteItemProps> = ({ blockType, onAdd }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${blockType.type}`,
    data: {
      type: "palette-item",
      blockType: blockType.type,
    },
  });

  const Icon = iconMap[blockType.icon] ?? Square;

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Base styles
        "group relative flex items-center gap-3",
        "min-h-[44px] px-3 py-2",
        "rounded-lg",
        "bg-surface hover:bg-surface-2",
        "border border-transparent hover:border-hairline",
        "transition-all duration-[160ms]",
        // Shadow on hover
        "hover:shadow-card",
        // Dragging state
        isDragging && "opacity-50 shadow-lift scale-[1.02]"
      )}
      // H-A11Y-04: Click handler for mouse users, but keyboard focus goes to internal buttons
      onClick={() => onAdd(blockType.type)}
    >
      {/* Hidden drag instructions for screen readers */}
      <span id={`palette-drag-hint-${blockType.type}`} className="sr-only">
        Use Tab to navigate to the add button or drag handle.
      </span>

      {/* Drag handle - keyboard accessible */}
      <button
        type="button"
        className={cn(
          "flex items-center justify-center",
          "w-6 h-6 rounded-sm",
          "text-text-3",
          "opacity-0 group-hover:opacity-50 group-focus-within:opacity-50 focus:opacity-100",
          "cursor-grab active:cursor-grabbing",
          "transition-opacity duration-[160ms]",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        )}
        {...attributes}
        {...listeners}
        aria-label={`Drag ${blockType.label} block to canvas`}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Add block button - keyboard accessible, single tab stop */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(blockType.type);
        }}
        className={cn(
          "flex items-center gap-3 flex-1 min-w-0 text-left",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-md",
          "cursor-pointer"
        )}
        aria-label={`Add ${blockType.label} block`}
        aria-describedby={`palette-drag-hint-${blockType.type}`}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex items-center justify-center",
            "w-8 h-8 shrink-0",
            "rounded-md",
            "bg-surface-2 group-hover:bg-surface-3",
            "text-text-2",
            "transition-colors duration-[160ms]"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>

        {/* Label and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-1 truncate">
              {blockType.label}
            </span>
            <BlockTypeBadge type={blockType.type} className="hidden sm:inline-flex" />
          </div>
          <p className="text-xs text-text-3 truncate mt-0.5">
            {blockType.description}
          </p>
        </div>
      </button>
    </div>
  );
};

/**
 * Memoized PaletteItem - only re-renders when blockType changes.
 */
const PaletteItem = memo(PaletteItemComponent, (prev, next) => {
  return prev.blockType.type === next.blockType.type;
});

PaletteItem.displayName = "PaletteItem";

/**
 * Framework template item.
 *
 * Callbacks receive framework to support stable memoized handlers from parent.
 * This enables proper memoization - parent passes the same callback reference
 * to all items, and each item passes its own framework when calling.
 */
interface FrameworkItemProps {
  framework: FrameworkTemplate;
  /** Callback when framework is selected - receives framework for stable parent callbacks */
  onSelect: (framework: FrameworkTemplate) => void;
}

const FrameworkItemComponent: FC<FrameworkItemProps> = ({ framework, onSelect }) => (
    <button
      type="button"
      onClick={() => onSelect(framework)}
      role="listitem"
      aria-label={`Select ${framework.name} framework with ${framework.requiredBlocks.length} required blocks`}
      className={cn(
        // Base styles
        "w-full flex items-start gap-3",
        "min-h-[44px] px-3 py-2",
        "rounded-lg",
        "bg-accent-soft/50 hover:bg-accent-soft",
        "border border-transparent hover:border-accent/20",
        "text-left",
        "transition-all duration-[160ms]",
        "hover:shadow-card",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center",
          "w-8 h-8 shrink-0",
          "rounded-md",
          "bg-accent/10",
          "text-accent"
        )}
      >
        <Layers className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-accent-ink">
          {framework.name}
        </span>
        <p className="text-xs text-text-3 mt-0.5">
          {framework.description}
        </p>
        <p className="text-xs text-text-4 mt-1">
          {framework.requiredBlocks.length} required blocks
        </p>
      </div>
    </button>
);

/**
 * Memoized FrameworkItem - only re-renders when framework id changes.
 */
const FrameworkItem = memo(FrameworkItemComponent, (prev, next) => {
  return prev.framework.id === next.framework.id;
});

FrameworkItem.displayName = "FrameworkItem";

/**
 * BlockPalette component.
 *
 * A vertical sidebar palette containing:
 * 1. Collapsible "Framework Templates" section with pre-built structures
 * 2. "Persuasion Blocks" section with all 11 block types
 *
 * Each block type is draggable and can also be clicked to add.
 */
const BlockPaletteComponent: FC<BlockPaletteProps> = ({
  className,
  frameworksExpanded = false,
  onBlockAdded,
}) => {
  const [isFrameworksOpen, setIsFrameworksOpen] = useState(frameworksExpanded);
  // Use shallow selectors to prevent unnecessary re-renders
  const { addBlock } = useBlockActions();
  const { setFramework, initialize } = useFrameworkActions();

  const handleAddBlock = useCallback((type: PersuasionBlockType) => {
    const blockId = addBlock(type);
    onBlockAdded?.(blockId, type);
  }, [addBlock, onBlockAdded]);

  const handleSelectFramework = useCallback((framework: FrameworkTemplate) => {
    // Set the framework
    setFramework(framework.id, framework.name);

    // M-STATE-02: Use shared utility for block creation to eliminate duplication
    const blocks = createBlocksFromFramework(framework);

    initialize(blocks, framework.id, framework.name);
  }, [setFramework, initialize]);

  return (
    <div
      className={cn(
        "flex flex-col",
        "w-[280px]",
        "bg-surface",
        "border-r border-hairline",
        "overflow-y-auto",
        className
      )}
    >
      {/* Framework Templates Section */}
      <div className="px-4 py-3 border-b border-hairline">
        <button
          type="button"
          onClick={() => setIsFrameworksOpen(!isFrameworksOpen)}
          className={cn(
            "w-full flex items-center justify-between",
            "text-sm font-medium text-text-2",
            "hover:text-text-1",
            "transition-colors duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-md"
          )}
          aria-expanded={isFrameworksOpen}
          aria-controls="framework-templates-list"
          aria-label={`Framework Templates section, ${isFrameworksOpen ? 'expanded' : 'collapsed'}`}
        >
          <span>Framework Templates</span>
          {isFrameworksOpen ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {isFrameworksOpen && (
          <div id="framework-templates-list" className="mt-3 space-y-2" role="list" aria-label="Available framework templates">
            {FRAMEWORK_TEMPLATES.map((framework) => (
              <FrameworkItem
                key={framework.id}
                framework={framework}
                onSelect={handleSelectFramework}
              />
            ))}
          </div>
        )}
      </div>

      {/* Persuasion Blocks Section */}
      <div className="flex-1 px-4 py-3">
        <h3 className="text-sm font-medium text-text-2 mb-3">
          Persuasion Blocks
        </h3>

        <div className="space-y-1">
          {PERSUASION_BLOCK_TYPES.map((blockType) => (
            <PaletteItem
              key={blockType.type}
              blockType={blockType}
              onAdd={handleAddBlock}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Memoized BlockPalette - static palette rarely needs re-rendering.
 */
export const BlockPalette = memo(BlockPaletteComponent);

BlockPalette.displayName = "BlockPalette";

export default BlockPalette;

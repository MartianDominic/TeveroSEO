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

import { useState, type FC } from "react";

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
  type BlockTypeDefinition,
  type FrameworkTemplate,
} from "@/lib/document-builder/persuasion-blocks";
import type { PersuasionBlockType } from "@/lib/document-builder/types";
import { useDocumentBuilderStore } from "@/stores/documentBuilderStore";

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
 */
interface PaletteItemProps {
  blockType: BlockTypeDefinition;
  onAdd: () => void;
}

const PaletteItem: FC<PaletteItemProps> = ({ blockType, onAdd }) => {
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
        // Cursor
        "cursor-pointer",
        // Dragging state
        isDragging && "opacity-50 shadow-lift scale-[1.02]"
      )}
      onClick={onAdd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd();
        }
      }}
      aria-label={`Add ${blockType.label} block`}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-6 h-6",
          "text-text-3",
          "opacity-0 group-hover:opacity-50 group-focus:opacity-50",
          "cursor-grab active:cursor-grabbing",
          "transition-opacity duration-[160ms]"
        )}
        {...attributes}
        {...listeners}
        aria-label={`Drag ${blockType.label}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-8 h-8",
          "rounded-md",
          "bg-surface-2 group-hover:bg-surface-3",
          "text-text-2",
          "transition-colors duration-[160ms]"
        )}
      >
        <Icon className="h-4 w-4" />
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
    </div>
  );
};

/**
 * Framework template item.
 */
interface FrameworkItemProps {
  framework: FrameworkTemplate;
  onSelect: () => void;
}

const FrameworkItem: FC<FrameworkItemProps> = ({ framework, onSelect }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        // Base styles
        "w-full flex items-start gap-3",
        "min-h-[44px] px-3 py-2",
        "rounded-lg",
        "bg-accent-soft/50 hover:bg-accent-soft",
        "border border-transparent hover:border-accent/20",
        "text-left",
        "transition-all duration-[160ms]",
        "hover:shadow-card"
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
};

/**
 * BlockPalette component.
 *
 * A vertical sidebar palette containing:
 * 1. Collapsible "Framework Templates" section with pre-built structures
 * 2. "Persuasion Blocks" section with all 11 block types
 *
 * Each block type is draggable and can also be clicked to add.
 */
export const BlockPalette: FC<BlockPaletteProps> = ({
  className,
  frameworksExpanded = false,
  onBlockAdded,
}) => {
  const [isFrameworksOpen, setIsFrameworksOpen] = useState(frameworksExpanded);
  const { addBlock, setFramework, initialize } = useDocumentBuilderStore();

  const handleAddBlock = (type: PersuasionBlockType) => {
    const blockId = addBlock(type);
    onBlockAdded?.(blockId, type);
  };

  const handleSelectFramework = (framework: FrameworkTemplate) => {
    // Set the framework
    setFramework(framework.id, framework.name);

    // Add recommended blocks in sequence
    const blocks = framework.recommendedSequence.map((type, index) => ({
      id: `${type}-${Date.now()}-${index}`,
      type,
      position: index,
      content: null,
      title: PERSUASION_BLOCK_TYPES.find((b) => b.type === type)?.label ?? type,
      persuasionMeta: {
        frameworkId: framework.id,
        isRequired: framework.requiredBlocks.includes(type),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    initialize(blocks, framework.id, framework.name);
  };

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
            "transition-colors duration-[160ms]"
          )}
        >
          <span>Framework Templates</span>
          {isFrameworksOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {isFrameworksOpen && (
          <div className="mt-3 space-y-2">
            {FRAMEWORK_TEMPLATES.map((framework) => (
              <FrameworkItem
                key={framework.id}
                framework={framework}
                onSelect={() => handleSelectFramework(framework)}
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
              onAdd={() => handleAddBlock(blockType.type)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlockPalette;

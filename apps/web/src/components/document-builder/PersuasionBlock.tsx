"use client";

/**
 * PersuasionBlock - Draggable block with type badge, content, and actions.
 * Phase 102-02: Block Palette and Canvas
 *
 * Features:
 * - useSortable from @dnd-kit/sortable for reordering
 * - Header: drag handle + BlockTypeBadge + title + actions menu
 * - Content area: placeholder for TipTap editor (Plan 03)
 * - Footer: variant tabs area (hidden if no variants)
 * - Hover-to-reveal actions: Edit, AI Generate, Create Variant, Delete
 *
 * States per UI-SPEC:
 * - Unselected: --shadow-card
 * - Hover: --shadow-lift, translateY(-1px)
 * - Selected: 2px solid var(--accent) border
 * - Dragging: scale(1.02), opacity: 0.9
 */

import { type FC, type ReactNode } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MoreVertical,
  Pencil,
  Sparkles,
  Copy,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PersuasionBlock as PersuasionBlockType } from "@/lib/document-builder/types";

import { BlockTypeBadge } from "./BlockTypeBadge";

/**
 * Props for PersuasionBlock component.
 */
export interface PersuasionBlockProps {
  /** Block data */
  block: PersuasionBlockType;
  /** Whether this block is selected */
  isSelected?: boolean;
  /** Whether this is a drag overlay preview */
  isDragOverlay?: boolean;
  /** Callback when block is selected */
  onSelect?: () => void;
  /** Callback when edit is triggered */
  onEdit?: () => void;
  /** Callback when AI generate is triggered */
  onAIGenerate?: () => void;
  /** Callback when create variant is triggered */
  onCreateVariant?: () => void;
  /** Callback when delete is triggered */
  onDelete?: () => void;
  /** Callback when title is changed */
  onTitleChange?: (title: string) => void;
  /** Optional custom content renderer */
  children?: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * PersuasionBlock component.
 *
 * A draggable block card that represents a persuasion element in the document.
 * Supports drag-and-drop reordering, selection, and hover-to-reveal actions.
 */
export const PersuasionBlock: FC<PersuasionBlockProps> = ({
  block,
  isSelected = false,
  isDragOverlay = false,
  onSelect,
  onEdit,
  onAIGenerate,
  onCreateVariant,
  onDelete,
  onTitleChange,
  children,
  className,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    disabled: isDragOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Base styles
        "group relative",
        "rounded-lg",
        "bg-surface",
        "transition-all duration-[280ms] ease-[var(--ease-smooth)]",
        // Border based on selection state
        isSelected
          ? "border-2 border-accent"
          : "border border-hairline",
        // Shadow based on state
        !isDragging && !isSelected && "shadow-card",
        !isDragging && !isSelected && "hover:shadow-lift hover:-translate-y-[1px]",
        // Dragging state
        isDragging && "shadow-lift scale-[1.02] opacity-90 z-50",
        // Drag overlay specific
        isDragOverlay && "shadow-lift scale-[1.02] opacity-90",
        className
      )}
      onClick={onSelect}
      role="article"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2",
          "px-4 py-3",
          "border-b border-hairline"
        )}
      >
        {/* Drag handle */}
        <button
          type="button"
          className={cn(
            "flex items-center justify-center",
            "w-6 h-6 rounded-sm",
            "text-text-3",
            "opacity-50 group-hover:opacity-100",
            "cursor-grab active:cursor-grabbing",
            "hover:bg-surface-2",
            "transition-all duration-[160ms]",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          )}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Block type badge */}
        <BlockTypeBadge type={block.type} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={block.title ?? ""}
            onChange={(e) => onTitleChange?.(e.target.value)}
            className={cn(
              "w-full",
              "bg-transparent",
              "text-sm font-medium text-text-1",
              "outline-none",
              "focus:border-b focus:border-accent/50"
            )}
            placeholder="Block title..."
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Actions menu (hover-to-reveal) */}
        <div
          className={cn(
            "flex items-center gap-1",
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
            "transition-opacity duration-[240ms]"
          )}
        >
          {/* Edit button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]"
            )}
            aria-label="Edit block"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* AI Generate button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAIGenerate?.();
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-accent",
              "hover:bg-accent-soft",
              "transition-colors duration-[160ms]"
            )}
            aria-label="Generate with AI"
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Create Variant button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateVariant?.();
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]"
            )}
            aria-label="Create variant"
          >
            <Copy className="h-4 w-4" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-error",
              "hover:bg-error-soft",
              "transition-colors duration-[160ms]"
            )}
            aria-label="Delete block"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* More options */}
          <button
            type="button"
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]"
            )}
            aria-label="More options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="px-4 py-4 min-h-[100px]">
        {children ?? (
          <p className="text-sm text-text-3 italic">
            Click to edit content or use AI to generate...
          </p>
        )}
      </div>

      {/* Footer (variant tabs - placeholder for Plan 03) */}
      {/* TODO: Add variant tabs when A/B testing is implemented */}
    </div>
  );
};

export default PersuasionBlock;

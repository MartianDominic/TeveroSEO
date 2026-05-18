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
 * - H-UX-02: Delete confirmation dialog for destructive actions
 *
 * States per UI-SPEC:
 * - Unselected: --shadow-card
 * - Hover: --shadow-lift, translateY(-1px)
 * - Selected: 2px solid var(--accent) border
 * - Dragging: scale(1.02), opacity: 0.9
 */

import { type FC, type ReactNode, memo, useState, useCallback } from "react";

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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@tevero/ui";
import { cn } from "@/lib/utils";
import type { PersuasionBlock as PersuasionBlockType } from "@/lib/document-builder/types";

import { BlockTypeBadge } from "./BlockTypeBadge";

/**
 * Props for PersuasionBlock component.
 *
 * Callbacks receive blockId to support stable memoized handlers from parent.
 * This enables proper memoization - parent can pass the same callback reference
 * to all blocks, and each block passes its own ID when calling.
 */
export interface PersuasionBlockProps {
  /** Block data */
  block: PersuasionBlockType;
  /** Whether this block is selected */
  isSelected?: boolean;
  /** Whether this is a drag overlay preview */
  isDragOverlay?: boolean;
  /** Callback when block is selected - receives blockId for stable parent callbacks */
  onSelect?: (blockId: string) => void;
  /** Callback when edit is triggered - receives blockId for stable parent callbacks */
  onEdit?: (blockId: string) => void;
  /** Callback when AI generate is triggered - receives blockId for stable parent callbacks */
  onAIGenerate?: (blockId: string) => void;
  /** Callback when create variant is triggered - receives blockId for stable parent callbacks */
  onCreateVariant?: (blockId: string) => void;
  /** Callback when delete is triggered - receives blockId for stable parent callbacks */
  onDelete?: (blockId: string) => void;
  /** Callback when title is changed - receives blockId and title for stable parent callbacks */
  onTitleChange?: (blockId: string, title: string) => void;
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
 *
 * Memoized with custom comparison to prevent unnecessary re-renders.
 */
const PersuasionBlockComponent: FC<PersuasionBlockProps> = ({
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
  // H-UX-02: Delete confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // H-UX-02: Handle delete button click - show confirmation
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  }, []);

  // H-UX-02: Confirm delete action
  const handleConfirmDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    onDelete?.(block.id);
  }, [onDelete, block.id]);

  // H-UX-02: Cancel delete action
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <>
      {/* H-UX-02: Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>&ldquo;{block.title || block.type}&rdquo;</strong>?
              <br />
              <span className="text-muted-foreground text-xs mt-1 block">
                You can undo this action with Ctrl+Z
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      onClick={() => onSelect?.(block.id)}
      role="article"
      aria-selected={isSelected}
      aria-describedby={`drag-instructions-${block.id}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(block.id);
        }
      }}
    >
      {/* Hidden drag instructions for screen readers */}
      <span id={`drag-instructions-${block.id}`} className="sr-only">
        Press Space or Enter to select this block. Use the drag handle to reorder blocks with mouse or touch. With keyboard, focus the drag handle and press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.
      </span>

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
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Block type badge */}
        <BlockTypeBadge type={block.type} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <label htmlFor={`block-title-${block.id}`} className="sr-only">
            Block title
          </label>
          <input
            id={`block-title-${block.id}`}
            type="text"
            value={block.title ?? ""}
            onChange={(e) => onTitleChange?.(block.id, e.target.value)}
            className={cn(
              "w-full",
              "bg-transparent",
              "text-sm font-medium text-text-1",
              "outline-none",
              "focus:border-b focus:border-accent/50"
            )}
            placeholder="Block title..."
            aria-label="Block title"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Actions menu - visible on hover/focus/selection, always in tab order for keyboard accessibility */}
        <div
          className={cn(
            "flex items-center gap-1",
            // Use opacity for visual hiding but buttons remain in tab order (WCAG 2.1 AA)
            // Actions become visible on: hover, focus-within, or when block is selected
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
            isSelected && "opacity-100",
            "transition-opacity duration-[240ms]"
          )}
          role="toolbar"
          aria-label="Block actions"
        >
          {/* Edit button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(block.id);
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
            aria-label="Edit block"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* AI Generate button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAIGenerate?.(block.id);
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-accent",
              "hover:bg-accent-soft",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
            aria-label="Generate with AI"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Create Variant button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateVariant?.(block.id);
            }}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
            aria-label="Create variant"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Delete button - H-UX-02: Shows confirmation dialog */}
          <button
            type="button"
            onClick={handleDeleteClick}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-error",
              "hover:bg-error-soft",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
            aria-label="Delete block"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* More options */}
          <button
            type="button"
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            )}
            aria-label="More options"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
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
    </>
  );
};

/**
 * Memoized PersuasionBlock with custom comparison.
 * Only re-renders when block data or selection state changes.
 */
export const PersuasionBlock = memo(PersuasionBlockComponent, (prevProps, nextProps) => {
  // Re-render if block identity or content changed
  if (prevProps.block.id !== nextProps.block.id) return false;
  if (prevProps.block.title !== nextProps.block.title) return false;
  if (prevProps.block.type !== nextProps.block.type) return false;
  if (prevProps.block.position !== nextProps.block.position) return false;
  // Compare content by reference (assumes immutable updates)
  if (prevProps.block.content !== nextProps.block.content) return false;

  // Re-render if selection or drag state changed
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isDragOverlay !== nextProps.isDragOverlay) return false;

  // Callbacks are compared by reference - parent should memoize them
  // We don't compare callbacks to avoid breaking memoization when parent re-renders

  return true; // Props are equal, skip re-render
});

PersuasionBlock.displayName = "PersuasionBlock";

export default PersuasionBlock;

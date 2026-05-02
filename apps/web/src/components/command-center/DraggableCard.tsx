"use client";

/**
 * DraggableCard Component
 * Phase 62-05: Command Center Dashboard Core
 *
 * Wrapper for dashboard cards with @dnd-kit drag-and-drop support.
 * Per D-21 design spec for reorderable dashboard widgets.
 */

import { type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@tevero/ui";

interface DraggableCardProps {
  /** Unique identifier for the card */
  id: string;
  /** Card content */
  children: ReactNode;
  /** Whether drag is disabled */
  disabled?: boolean;
}

/**
 * DraggableCard wraps a card component with sortable drag-and-drop.
 *
 * Note: Requires a DndContext provider in a parent component to enable
 * actual drag-and-drop. Without it, the card renders normally.
 *
 * @example
 * ```tsx
 * <DraggableCard id="prospects">
 *   <Card>...</Card>
 * </DraggableCard>
 * ```
 */
export function DraggableCard({
  id,
  children,
  disabled = false,
}: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        "transition-opacity duration-200",
        isDragging && "opacity-50 z-50",
        disabled && "cursor-default"
      )}
    >
      {children}
    </div>
  );
}

"use client";

/**
 * DropZone - Visual indicator between blocks during drag.
 * Phase 102-02: Block Palette and Canvas
 *
 * Per UI-SPEC:
 * - 8px min-height (--space-2), expands to 48px on hover
 * - 4px border-dashed var(--accent) when active
 * - useDroppable from @dnd-kit/core
 */

import { type FC, memo } from "react";

import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";

/**
 * Props for DropZone component.
 */
export interface DropZoneProps {
  /** Unique ID for this drop zone */
  id: string;
  /** Position index where dropped block will be inserted */
  position: number;
  /** Additional class names */
  className?: string;
  /** Whether drag is currently active */
  isDragActive?: boolean;
}

/**
 * DropZone component.
 *
 * A visual drop target between blocks that:
 * - Shows when a drag operation is in progress
 * - Expands on hover to make dropping easier
 * - Provides visual feedback when a draggable is over it
 */
const DropZoneComponent: FC<DropZoneProps> = ({
  id,
  position,
  className,
  isDragActive = false,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      type: "drop-zone",
      position,
    },
  });

  // Only render when drag is active
  if (!isDragActive) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // Base styles
        "relative w-full",
        "rounded-md",
        "transition-all duration-[160ms] ease-[var(--ease-smooth)]",
        // Default height
        "min-h-[8px]",
        // Expand on hover
        "hover:min-h-[48px]",
        // Border styles
        "border-2 border-dashed",
        // Colors based on state
        isOver
          ? "border-accent bg-accent-soft/50"
          : "border-hairline bg-transparent hover:border-accent/50 hover:bg-accent-soft/20",
        className
      )}
      aria-label={`Drop zone at position ${position + 1}`}
      aria-live="polite"
      aria-atomic="true"
      role="region"
    >
      {/* Drop indicator */}
      {isOver && (
        <div
          className={cn(
            "absolute inset-0",
            "flex items-center justify-center",
            "text-xs font-medium text-accent",
            "opacity-80"
          )}
        >
          Drop here
        </div>
      )}
    </div>
  );
};

/**
 * Memoized DropZone - only re-renders when drag state or position changes.
 */
export const DropZone = memo(DropZoneComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.position === next.position &&
    prev.isDragActive === next.isDragActive &&
    prev.className === next.className
  );
});

DropZone.displayName = "DropZone";

export default DropZone;

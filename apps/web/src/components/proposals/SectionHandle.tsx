"use client";

/**
 * SectionHandle - Drag handle for sortable sections.
 * Phase 57-04: Drag-and-Drop Sections (@dnd-kit)
 *
 * Features:
 * - Grip dots icon for visual affordance
 * - Visible on section hover
 * - Cursor states (grab/grabbing)
 * - Accessible with ARIA labels
 * - Keyboard focusable
 */

import { type FC } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for SectionHandle component.
 */
export interface SectionHandleProps {
  /** Draggable attributes from useSortable */
  attributes: DraggableAttributes;
  /** Event listeners from useSortable */
  listeners: SyntheticListenerMap | undefined;
  /** Whether the handle is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Label for accessibility */
  label?: string;
}

/**
 * SectionHandle component.
 *
 * A drag handle for sortable sections that provides visual and accessibility cues.
 * Uses a grip dots icon and changes cursor state on hover/drag.
 */
export const SectionHandle: FC<SectionHandleProps> = ({
  attributes,
  listeners,
  disabled = false,
  className,
  label = "Drag to reorder",
}) => {
  return (
    <button
      type="button"
      className={cn(
        // Base styles
        "flex items-center justify-center",
        "w-6 h-6 rounded-sm",
        // Colors
        "text-muted-foreground",
        "hover:text-foreground hover:bg-muted",
        // Cursor states
        "cursor-grab active:cursor-grabbing",
        // Focus styles for keyboard accessibility
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        // Transition
        "transition-colors duration-150",
        // Disabled state
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        // Visibility on hover (handled by parent group)
        "opacity-50 group-hover:opacity-100",
        className
      )}
      disabled={disabled}
      {...attributes}
      {...listeners}
      aria-label={label}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
};

/**
 * Standalone grip icon for use outside of sortable context.
 * Useful for visual indication without drag functionality.
 */
export const GripIcon: FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      "flex items-center justify-center",
      "w-6 h-6",
      "text-muted-foreground",
      className
    )}
    aria-hidden="true"
  >
    <GripVertical className="h-4 w-4" />
  </div>
);

export default SectionHandle;

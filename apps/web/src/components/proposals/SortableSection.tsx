"use client";

/**
 * SortableSection - Individual sortable section wrapper.
 * Phase 57-04: Drag-and-Drop Sections (@dnd-kit)
 *
 * Features:
 * - useSortable hook for drag-and-drop
 * - CSS transform for smooth drag preview
 * - Visual feedback during drag (shadow, opacity)
 * - Contains ProposalInlineEditor for content editing
 * - Drag handle for precise control
 */

import { type FC, type ReactNode } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ProposalInlineEditor } from "./ProposalInlineEditor";
import { SectionHandle } from "./SectionHandle";

import type { EditorSection } from "./types";

/**
 * Props for SortableSection component.
 */
export interface SortableSectionProps {
  /** Section data */
  section: EditorSection;
  /** Callback when content changes */
  onUpdate: (content: string) => void;
  /** Callback to delete section */
  onDelete?: () => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
  /** Whether this section is currently active/focused */
  isActive?: boolean;
  /** Callback when section is focused */
  onFocus?: () => void;
  /** Callback when section is blurred */
  onBlur?: () => void;
  /** Whether this is rendered in the drag overlay */
  isDragOverlay?: boolean;
  /** Custom content renderer (overrides ProposalInlineEditor) */
  children?: ReactNode;
}

/**
 * SortableSection component.
 *
 * Wraps a proposal section with drag-and-drop functionality using @dnd-kit.
 * Provides visual feedback during drag operations.
 */
export const SortableSection: FC<SortableSectionProps> = ({
  section,
  onUpdate,
  onDelete,
  locale = "en",
  editable = true,
  isActive = false,
  onFocus,
  onBlur,
  isDragOverlay = false,
  children,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  // Apply transform and transition styles
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  // Section type to title mapping (fallback)
  const sectionTypeLabels: Record<string, { en: string; lt: string }> = {
    hero: { en: "Hero", lt: "Pagrindinis" },
    introduction: { en: "Introduction", lt: "Ivadas" },
    current_state: { en: "Current State", lt: "Dabartine bukle" },
    opportunities: { en: "Opportunities", lt: "Galimybes" },
    methodology: { en: "Methodology", lt: "Metodologija" },
    timeline: { en: "Timeline", lt: "Laikotarpis" },
    pricing: { en: "Pricing", lt: "Kainodara" },
    case_studies: { en: "Case Studies", lt: "Atveju studijos" },
    team: { en: "Team", lt: "Komanda" },
    next_steps: { en: "Next Steps", lt: "Kiti zingsniai" },
    terms: { en: "Terms", lt: "Salygos" },
    custom: { en: "Custom Section", lt: "Pasirinkta sekcija" },
  };

  const getSectionTitle = () => {
    if (section.title) return section.title;
    const labels = sectionTypeLabels[section.sectionType];
    return labels ? labels[locale] : section.key;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-background",
        "transition-all duration-200",
        // Normal state
        "border-border hover:border-border/80",
        // Active/focused state
        isActive && "ring-2 ring-ring ring-offset-2",
        // Dragging state
        isDragging && "opacity-50 shadow-lg z-50",
        // Drag overlay state (the preview that follows cursor)
        isDragOverlay && "shadow-2xl opacity-95 rotate-1 scale-[1.02]",
        // Required section indicator
        section.isRequired && "border-l-4 border-l-amber-500",
        // Non-editable state
        !section.isEditable && "opacity-75"
      )}
      role="listitem"
      aria-label={`Section: ${getSectionTitle()}`}
    >
      {/* Section header with drag handle and actions */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 border-b border-border/50",
          "bg-muted/30"
        )}
      >
        {/* Drag handle - only interactive when editable */}
        {editable && (
          <SectionHandle
            attributes={attributes}
            listeners={listeners}
            disabled={!editable}
          />
        )}

        {/* Section title */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">
            {getSectionTitle()}
          </h3>
          {section.isRequired && (
            <span className="text-xs text-muted-foreground">
              {locale === "lt" ? "Privaloma" : "Required"}
            </span>
          )}
        </div>

        {/* Section actions */}
        <div
          className={cn(
            "flex items-center gap-1",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isDragOverlay && "opacity-0"
          )}
        >
          {onDelete && !section.isRequired && editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              aria-label={locale === "lt" ? "Istrinti sekcija" : "Delete section"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Section content */}
      <div className="p-4">
        {children ?? (
          <ProposalInlineEditor
            content={section.content}
            onUpdate={onUpdate}
            locale={locale}
            editable={editable && section.isEditable !== false}
            sectionId={section.id}
            onFocus={onFocus}
            onBlur={onBlur}
            minHeight="80px"
          />
        )}
      </div>
    </div>
  );
};

export default SortableSection;

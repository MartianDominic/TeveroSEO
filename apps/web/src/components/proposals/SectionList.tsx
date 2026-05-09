"use client";

/**
 * SectionList - Sortable section container for proposal editor.
 * Phase 57-04: Drag-and-Drop Sections (@dnd-kit)
 *
 * Features:
 * - Drag-and-drop section reordering with @dnd-kit
 * - Keyboard accessible (Tab + Space/Enter + Arrow keys)
 * - Visual feedback during drag operations
 * - Persists order to parent via callback
 */

import { useCallback, type FC, type ReactNode } from "react";
import { useState } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverlay,
  DragOverlay as DndDragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { SortableSection } from "./SortableSection";

import type { EditorSection } from "./types";

/**
 * Props for SectionList component.
 */
export interface SectionListProps {
  /** Array of sections to render */
  sections: EditorSection[];
  /** Callback when sections are reordered */
  onReorder: (sections: EditorSection[]) => void;
  /** Callback when section content changes */
  onUpdateSection: (sectionId: string, content: string) => void;
  /** Callback to delete a section */
  onDeleteSection?: (sectionId: string) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether sections are editable */
  editable?: boolean;
  /** Active section ID for visual highlighting */
  activeSectionId?: string | null;
  /** Callback when a section is focused */
  onSectionFocus?: (sectionId: string) => void;
  /** Callback when a section is blurred */
  onSectionBlur?: (sectionId: string) => void;
  /** Custom section renderer (overrides default) */
  renderSection?: (section: EditorSection, index: number) => ReactNode;
}

/**
 * SectionList component.
 *
 * Provides drag-and-drop reordering of proposal sections using @dnd-kit.
 * Supports keyboard navigation for accessibility (Tab, Space, Arrow keys).
 */
export const SectionList: FC<SectionListProps> = ({
  sections,
  onReorder,
  onUpdateSection,
  onDeleteSection,
  locale = "en",
  editable = true,
  activeSectionId,
  onSectionFocus,
  onSectionBlur,
  renderSection,
}) => {
  // Track currently dragging section for overlay
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for mouse/touch and keyboard interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement before starting drag (prevents accidental drags)
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle drag start - track the active item for overlay rendering.
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  /**
   * Handle drag end - reorder sections if position changed.
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = sections.findIndex((s) => s.id === active.id);
        const newIndex = sections.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newSections = arrayMove(sections, oldIndex, newIndex);
          onReorder(newSections);
        }
      }
    },
    [sections, onReorder]
  );

  /**
   * Handle drag cancel - reset active state.
   */
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Find the section being dragged for the overlay
  const activeSection = activeId
    ? sections.find((s) => s.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={sections.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="space-y-4"
          role="list"
          aria-label="Proposal sections"
        >
          {sections.map((section, index) => (
            renderSection ? (
              <div key={section.id}>
                {renderSection(section, index)}
              </div>
            ) : (
              <SortableSection
                key={section.id}
                section={section}
                onUpdate={(content) => onUpdateSection(section.id, content)}
                onDelete={
                  onDeleteSection && !section.isRequired
                    ? () => onDeleteSection(section.id)
                    : undefined
                }
                locale={locale}
                editable={editable}
                isActive={activeSectionId === section.id}
                onFocus={() => onSectionFocus?.(section.id)}
                onBlur={() => onSectionBlur?.(section.id)}
              />
            )
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay - shows preview of dragged section */}
      <DndDragOverlay adjustScale={false}>
        {activeSection ? (
          <SortableSection
            section={activeSection}
            onUpdate={() => {}}
            locale={locale}
            editable={false}
            isDragOverlay
          />
        ) : null}
      </DndDragOverlay>
    </DndContext>
  );
};

export default SectionList;

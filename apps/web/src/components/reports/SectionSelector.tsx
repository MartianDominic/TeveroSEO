"use client";

/**
 * SectionSelector component for drag-and-drop report section ordering.
 *
 * Uses @dnd-kit for accessible drag-and-drop functionality.
 * Displays all available sections with enabled state and allows reordering.
 */

import { useMemo, type FC } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  FileText,
  BarChart3,
  TrendingUp,
  LineChart,
  Table,
  FileSignature,
  type LucideIcon,
} from "lucide-react";

import { REPORT_SECTIONS, getSectionMeta } from "@/lib/reports/sections";

import type { ReportSection, ReportSectionType } from "@tevero/types";
import { Checkbox, cn } from "@tevero/ui";

/** Map icon names to Lucide components */
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  BarChart3,
  TrendingUp,
  LineChart,
  Table,
  FileSignature,
};

interface SectionSelectorProps {
  /** Currently selected sections with order */
  sections: ReportSection[];
  /** Callback when sections are reordered */
  onSectionsChange: (sections: ReportSection[]) => void;
  /** Callback when a section is toggled */
  onToggle: (type: ReportSectionType) => void;
  /** Set of currently enabled section types */
  enabledSections: Set<ReportSectionType>;
}

interface SortableSectionItemProps {
  section: ReportSection;
  isEnabled: boolean;
  onToggle: () => void;
}

/**
 * Individual sortable section item.
 */
const SortableSectionItem: FC<SortableSectionItemProps> = ({
  section,
  isEnabled,
  onToggle,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.type });

  const meta = getSectionMeta(section.type);
  const Icon = meta?.icon ? ICON_MAP[meta.icon] ?? FileText : FileText;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "bg-surface border border-hairline",
        "hover:bg-surface-2 hover:shadow-[var(--shadow-card)] transition-all",
        isDragging && "shadow-[var(--shadow-elevated)] opacity-80 z-10",
        !isEnabled && "opacity-60"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-text-3 hover:text-text-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <Checkbox
        checked={isEnabled}
        onCheckedChange={onToggle}
        disabled={meta?.required}
        aria-label={`Include ${meta?.label ?? section.type} section`}
      />

      <Icon className="h-5 w-5 text-accent" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-1">
          {meta?.label ?? section.type}
        </p>
        <p className="text-xs-safe text-text-3 truncate">
          {meta?.description ?? ""}
        </p>
      </div>

      {meta?.required && (
        <span className="text-xs-safe text-text-3 bg-surface-2 px-2 py-0.5 rounded-sm shrink-0">
          Required
        </span>
      )}
    </div>
  );
};

/**
 * Selector component for choosing and ordering report sections.
 *
 * Supports:
 * - Drag-and-drop reordering
 * - Keyboard navigation (Tab, Space, Arrow keys)
 * - Checkbox toggle for optional sections
 * - Visual distinction for required sections
 */
export const SectionSelector: FC<SectionSelectorProps> = ({
  sections,
  onSectionsChange,
  onToggle,
  enabledSections,
}) => {
  // Set up drag sensors with keyboard support for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build list of all sections with enabled state
  const allSections = useMemo(() => {
    // Start with enabled sections in their current order
    const result: ReportSection[] = [];
    const enabledSet = new Set(sections.map((s) => s.type));

    // Add all sections - enabled first (preserving order), then disabled
    for (const s of sections) {
      result.push(s);
    }

    // Add disabled sections at the end
    for (const meta of REPORT_SECTIONS) {
      if (!enabledSet.has(meta.type)) {
        result.push({ type: meta.type, order: result.length });
      }
    }

    return result;
  }, [sections]);

  // Handle drag end - reorder sections
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = allSections.findIndex((s) => s.type === active.id);
      const newIndex = allSections.findIndex((s) => s.type === over.id);

      const newOrder = arrayMove(allSections, oldIndex, newIndex);

      // Only include enabled sections in the output
      const enabledInOrder = newOrder
        .filter((s) => enabledSections.has(s.type))
        .map((s, i) => ({ ...s, order: i }));

      onSectionsChange(enabledInOrder);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={allSections.map((s) => s.type)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2" role="list" aria-label="Report sections">
          {allSections.map((section) => (
            <SortableSectionItem
              key={section.type}
              section={section}
              isEnabled={enabledSections.has(section.type)}
              onToggle={() => onToggle(section.type)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

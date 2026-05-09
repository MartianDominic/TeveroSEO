"use client";

/**
 * Clause List Component
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Renders sortable list of template clauses with drag handles.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import type { TemplateClause } from "@/app/[locale]/(shell)/templates/[templateId]/edit/actions";

import { ClauseEditor } from "./ClauseEditor";

interface ClauseListProps {
  clauses: TemplateClause[];
  order: string[];
  onUpdate: (clauseId: string, content: string) => void;
  onTitleUpdate: (clauseId: string, title: string) => void;
}

export function ClauseList({ clauses, order, onUpdate, onTitleUpdate }: ClauseListProps) {
  // Order clauses according to clauseOrder array
  const orderedClauses = order
    .map((id) => clauses.find((c) => c.id === id))
    .filter((c): c is TemplateClause => c !== undefined);

  if (orderedClauses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No clauses in this template.</p>
        <p className="text-sm mt-2">Add clauses to build your agreement template.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orderedClauses.map((clause, index) => (
        <SortableClauseItem
          key={clause.id}
          clause={clause}
          index={index + 1}
          onUpdate={(content) => onUpdate(clause.id, content)}
          onTitleUpdate={(title) => onTitleUpdate(clause.id, title)}
        />
      ))}
    </div>
  );
}

interface SortableClauseItemProps {
  clause: TemplateClause;
  index: number;
  onUpdate: (content: string) => void;
  onTitleUpdate: (title: string) => void;
}

function SortableClauseItem({
  clause,
  index,
  onUpdate,
  onTitleUpdate,
}: SortableClauseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clause.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 ${isDragging ? "relative" : ""}`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Clause Editor */}
      <div className="flex-1">
        <ClauseEditor
          clause={clause}
          index={index}
          onUpdate={onUpdate}
          onTitleUpdate={onTitleUpdate}
        />
      </div>
    </div>
  );
}

export default ClauseList;

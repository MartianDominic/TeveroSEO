"use client";

import { useState, useCallback } from "react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Checkbox,
  Label,
} from "@tevero/ui";
import { Settings2, GripVertical, RotateCcw } from "lucide-react";
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
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ALL_COLUMNS,
  DEFAULT_COLUMNS,
  type ColumnDefinition,
} from "@/types/saved-views";

interface ColumnCustomizerProps {
  /** Currently visible column IDs in display order */
  visibleColumns: string[];
  /** Callback when column visibility or order changes */
  onColumnsChange: (columns: string[]) => void;
}

interface SortableColumnProps {
  column: ColumnDefinition;
  isVisible: boolean;
  onToggle: () => void;
}

function SortableColumn({ column, isVisible, onToggle }: SortableColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: column.locked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted"
    >
      {!column.locked ? (
        <GripVertical
          className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        />
      ) : (
        <div className="w-4" /> // Spacer for locked columns
      )}
      <Checkbox
        id={`col-${column.id}`}
        checked={isVisible}
        onCheckedChange={onToggle}
        disabled={column.locked}
      />
      <Label
        htmlFor={`col-${column.id}`}
        className={`flex-1 cursor-pointer text-sm ${
          column.locked ? "text-muted-foreground" : ""
        }`}
      >
        {column.label}
        {column.locked && (
          <span className="ml-1 text-xs text-muted-foreground">(locked)</span>
        )}
      </Label>
    </div>
  );
}

export function ColumnCustomizer({
  visibleColumns,
  onColumnsChange,
}: ColumnCustomizerProps) {
  const [open, setOpen] = useState(false);

  // Local state for immediate UI feedback
  const [localColumns, setLocalColumns] = useState<string[]>(visibleColumns);

  // Update local state when prop changes
  if (JSON.stringify(localColumns) !== JSON.stringify(visibleColumns)) {
    setLocalColumns(visibleColumns);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = localColumns.indexOf(active.id as string);
      const newIndex = localColumns.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      const newColumns = arrayMove(localColumns, oldIndex, newIndex);
      setLocalColumns(newColumns);
      onColumnsChange(newColumns);
    },
    [localColumns, onColumnsChange]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      const isLocked = ALL_COLUMNS.find((c) => c.id === columnId)?.locked;
      if (isLocked) return;

      const newColumns = localColumns.includes(columnId)
        ? localColumns.filter((c) => c !== columnId)
        : [...localColumns, columnId];

      setLocalColumns(newColumns);
      onColumnsChange(newColumns);
    },
    [localColumns, onColumnsChange]
  );

  const resetToDefaults = useCallback(() => {
    setLocalColumns(DEFAULT_COLUMNS);
    onColumnsChange(DEFAULT_COLUMNS);
  }, [onColumnsChange]);

  // Build ordered column list: visible columns first (in order), then hidden ones
  const orderedColumns = [
    ...localColumns.map((id) => ALL_COLUMNS.find((c) => c.id === id)).filter(Boolean),
    ...ALL_COLUMNS.filter((c) => !localColumns.includes(c.id)),
  ] as ColumnDefinition[];

  const hiddenCount = ALL_COLUMNS.length - localColumns.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Columns
          {hiddenCount > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {hiddenCount} hidden
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Table Columns</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Drag to reorder, check to show
          </p>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedColumns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedColumns.map((column) => (
                <SortableColumn
                  key={column.id}
                  column={column}
                  isVisible={localColumns.includes(column.id)}
                  onToggle={() => toggleColumn(column.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

/**
 * Signer List Component
 * Phase 59: Agreement & Signing Excellence - Pre-Signing Flow (59-06)
 *
 * Displays signers with drag-and-drop reordering (sequential mode only).
 * Shows signer status with appropriate icons and badges.
 */

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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Mail, Eye, CheckCircle, Clock } from "lucide-react";

import type { SignerData } from "@/app/(shell)/clients/[clientId]/agreements/[agreementId]/pre-sign/actions";

import { Button, Badge } from "@tevero/ui";

interface SignerListProps {
  signers: SignerData[];
  mode: "sequential" | "parallel";
  onRemove: (signerId: string) => void;
  onReorder: (newOrder: string[]) => void;
}

export function SignerList({ signers, mode, onRemove, onReorder }: SignerListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = signers.findIndex((s) => s.id === active.id);
      const newIndex = signers.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(signers, oldIndex, newIndex);
      onReorder(reordered.map((s) => s.id));
    }
  };

  const sortedSigners = [...signers].sort((a, b) => a.signingOrder - b.signingOrder);
  const isSequential = mode === "sequential";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedSigners.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
        disabled={!isSequential}
      >
        <div className="space-y-2">
          {sortedSigners.map((signer) => (
            <SortableSignerItem
              key={signer.id}
              signer={signer}
              mode={mode}
              onRemove={() => onRemove(signer.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableSignerItemProps {
  signer: SignerData;
  mode: "sequential" | "parallel";
  onRemove: () => void;
}

function SortableSignerItem({ signer, mode, onRemove }: SortableSignerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: signer.id,
    disabled: mode === "parallel",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSequential = mode === "sequential";

  // Status display
  const statusConfig: Record<string, { icon: React.ReactNode; badge: React.ReactNode }> = {
    pending: {
      icon: <Clock className="w-4 h-4 text-gray-400" />,
      badge: <Badge variant="secondary">Pending</Badge>,
    },
    invited: {
      icon: <Mail className="w-4 h-4 text-blue-500" />,
      badge: (
        <Badge variant="outline" className="border-blue-500 text-blue-600">
          Invited
        </Badge>
      ),
    },
    viewed: {
      icon: <Eye className="w-4 h-4 text-amber-500" />,
      badge: (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          Viewed
        </Badge>
      ),
    },
    signed: {
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      badge: <Badge className="bg-green-500 hover:bg-green-600">Signed</Badge>,
    },
    declined: {
      icon: null,
      badge: <Badge variant="destructive">Declined</Badge>,
    },
  };

  const statusDisplay = statusConfig[signer.status] || statusConfig.pending;
  const canRemove = signer.status !== "signed";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
    >
      {/* Drag Handle (sequential only) */}
      {isSequential && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-5 h-5" />
        </button>
      )}

      {/* Order Number (sequential only) */}
      {isSequential && (
        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-700">
          {signer.signingOrder}
        </span>
      )}

      {/* Signer Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{signer.name}</p>
        <p className="text-sm text-gray-500 truncate">{signer.email}</p>
        {signer.title && (
          <p className="text-xs-safe text-gray-400 truncate">{signer.title}</p>
        )}
      </div>

      {/* Role Badge */}
      <Badge variant="outline" className="capitalize">
        {signer.role}
      </Badge>

      {/* Status */}
      <div className="flex items-center gap-2">
        {statusDisplay.icon}
        {statusDisplay.badge}
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-gray-400 hover:text-red-500"
        disabled={!canRemove}
        aria-label={`Remove ${signer.name}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

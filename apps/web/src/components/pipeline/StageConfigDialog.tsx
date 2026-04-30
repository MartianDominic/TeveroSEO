"use client";

/**
 * StageConfigDialog Component
 * Phase 50: Pipeline Kanban
 *
 * Dialog for configuring pipeline stages per D-06.
 * Allows adding, removing, reordering, and coloring stages.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@tevero/ui";
import { Button } from "@tevero/ui";
import { Input } from "@tevero/ui";
import { Plus, Trash2, GripVertical } from "lucide-react";

export interface PipelineStageConfig {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface StageConfigDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current stages configuration */
  stages: PipelineStageConfig[];
  /** Handler for saving updated stages */
  onSave: (stages: PipelineStageConfig[]) => Promise<void>;
}

/**
 * Generate a slug-friendly ID from a stage name.
 */
function generateStageId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) || `stage_${Date.now()}`;
}

export function StageConfigDialog({
  open,
  onOpenChange,
  stages: initialStages,
  onSave,
}: StageConfigDialogProps) {
  const [stages, setStages] = useState(initialStages);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset stages when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setStages(initialStages);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // D-06: Add new stage
  const handleAddStage = () => {
    const newId = `stage_${Date.now()}`;
    setStages([
      ...stages,
      {
        id: newId,
        name: "New Stage",
        order: stages.length,
        color: "#6b7280",
      },
    ]);
  };

  // D-06: Remove stage (minimum 2 stages required)
  const handleRemoveStage = (id: string) => {
    if (stages.length <= 2) {
      setError("Pipeline must have at least 2 stages");
      return;
    }
    setStages(
      stages
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i })),
    );
    setError(null);
  };

  // Update stage properties
  const handleUpdateStage = (
    id: string,
    updates: Partial<PipelineStageConfig>,
  ) => {
    setStages(
      stages.map((s) => {
        if (s.id !== id) return s;
        // If name changed, update ID to match (only for new stages)
        if (updates.name && s.id.startsWith("stage_")) {
          return {
            ...s,
            ...updates,
            id: generateStageId(updates.name),
          };
        }
        return { ...s, ...updates };
      }),
    );
    setError(null);
  };

  // D-06: Reorder stages (move up)
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newStages = [...stages];
    [newStages[index - 1], newStages[index]] = [
      newStages[index],
      newStages[index - 1],
    ];
    setStages(newStages.map((s, i) => ({ ...s, order: i })));
  };

  // D-06: Reorder stages (move down)
  const handleMoveDown = (index: number) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [
      newStages[index + 1],
      newStages[index],
    ];
    setStages(newStages.map((s, i) => ({ ...s, order: i })));
  };

  // Validate and save
  const handleSave = async () => {
    // Validate
    if (stages.length < 2) {
      setError("Pipeline must have at least 2 stages");
      return;
    }

    const names = stages.map((s) => s.name.trim());
    if (names.some((n) => !n)) {
      setError("Stage names cannot be empty");
      return;
    }

    const ids = stages.map((s) => s.id);
    if (new Set(ids).size !== ids.length) {
      setError("Duplicate stage IDs detected");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Normalize order before saving
      const normalizedStages = stages.map((s, i) => ({ ...s, order: i }));
      await onSave(normalizedStages);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stages");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Pipeline Stages</DialogTitle>
          <DialogDescription>
            Customize your sales pipeline stages. Drag to reorder, or use the
            color picker to change stage colors.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-center gap-2 p-2 bg-surface-2 rounded"
            >
              {/* Reorder handle */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="text-text-4 hover:text-text-2 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === stages.length - 1}
                  className="text-text-4 hover:text-text-2 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>

              <GripVertical className="h-4 w-4 text-text-4 cursor-grab" />

              {/* Stage name input */}
              <Input
                value={stage.name}
                onChange={(e) =>
                  handleUpdateStage(stage.id, { name: e.target.value })
                }
                className="flex-1"
                placeholder="Stage name"
              />

              {/* D-06: Color picker */}
              <input
                type="color"
                value={stage.color}
                onChange={(e) =>
                  handleUpdateStage(stage.id, { color: e.target.value })
                }
                className="h-8 w-8 rounded border-0 cursor-pointer bg-transparent"
                title="Stage color"
              />

              {/* D-06: Remove stage button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveStage(stage.id)}
                disabled={stages.length <= 2}
                aria-label="Remove stage"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        {/* D-06: Add stage button */}
        <Button variant="outline" onClick={handleAddStage} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Stage
        </Button>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

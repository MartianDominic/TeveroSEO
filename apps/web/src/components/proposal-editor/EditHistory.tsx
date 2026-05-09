"use client";

/**
 * EditHistory Component
 * Phase 86-07: Proposal Editing UX
 *
 * Displays undo/redo history for proposal edits.
 * Integrates with zundo temporal middleware for state management.
 *
 * Requirements:
 * - Display list of recent edits (remove_cluster, add_keyword, etc.)
 * - Undo/Redo buttons with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * - Timestamp for each edit
 * - Collapsible panel
 */

import { useCallback, useEffect, useState } from "react";

import { useCopilotAction } from "@copilotkit/react-core";
import { formatDistanceToNow } from "date-fns";
import { History, Undo2, Redo2, ChevronDown, ChevronUp } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditType =
  | "remove_cluster"
  | "add_keyword"
  | "remove_keyword"
  | "change_distribution";

export interface EditEntry {
  id: string;
  type: EditType;
  data: Record<string, unknown>;
  timestamp: Date;
  aiSummary?: string;
}

export interface EditHistoryProps {
  edits: EditEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

// ---------------------------------------------------------------------------
// Edit Type Labels
// ---------------------------------------------------------------------------

const EDIT_TYPE_LABELS: Record<EditType, string> = {
  remove_cluster: "Removed cluster",
  add_keyword: "Added keyword",
  remove_keyword: "Removed keyword",
  change_distribution: "Changed distribution",
};

// ---------------------------------------------------------------------------
// EditHistoryItem Component
// ---------------------------------------------------------------------------

interface EditHistoryItemProps {
  edit: EditEntry;
  isLatest: boolean;
}

function EditHistoryItem({ edit, isLatest }: EditHistoryItemProps) {
  const typeLabel = EDIT_TYPE_LABELS[edit.type] || edit.type;
  const summary = edit.aiSummary || getEditSummary(edit);

  return (
    <div
      className={`py-2 px-3 border-b border-border/50 last:border-b-0 ${
        isLatest ? "bg-muted/30" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {typeLabel}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(edit.timestamp), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function getEditSummary(edit: EditEntry): string {
  switch (edit.type) {
    case "remove_cluster": {
      const label = edit.data.clusterLabel || `Cluster ${edit.data.clusterId}`;
      return `Removed "${label}"`;
    }
    case "add_keyword": {
      return `Added "${edit.data.keyword}"`;
    }
    case "remove_keyword": {
      const blacklisted = edit.data.addedToBlacklist ? " (blacklisted)" : "";
      return `Removed "${edit.data.keyword}"${blacklisted}`;
    }
    case "change_distribution": {
      const dist = edit.data.newDistribution as
        | { bofu?: number; mofu?: number; tofu?: number }
        | undefined;
      if (dist) {
        return `Set BOFU: ${dist.bofu ?? "-"}%, MOFU: ${dist.mofu ?? "-"}%, TOFU: ${dist.tofu ?? "-"}%`;
      }
      return "Updated funnel distribution";
    }
    default:
      return "Edit applied";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EditHistory({
  edits,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: EditHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd key
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modifierKey) return;

      // Undo: Ctrl/Cmd + Z
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) onUndo();
      }

      // Redo: Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        if (canRedo) onRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  // Register CopilotKit actions for undo/redo
  useCopilotAction({
    name: "undoEdit",
    description:
      "Undo the last edit to the proposal. Returns to the previous version.",
    parameters: [],
    handler: async () => {
      if (!canUndo) {
        return "Cannot undo - no previous edits to restore.";
      }
      onUndo();
      return "Undone! Restored previous version of the proposal.";
    },
  });

  useCopilotAction({
    name: "redoEdit",
    description:
      "Redo a previously undone edit. Restores the next version of the proposal.",
    parameters: [],
    handler: async () => {
      if (!canRedo) {
        return "Cannot redo - no future edits available.";
      }
      onRedo();
      return "Redone! Restored the edit.";
    },
  });

  const hasEdits = edits.length > 0;

  return (
    <div className="border-l border-border bg-background w-72 shrink-0 flex flex-col">
      {/* Header */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Edit History</span>
              {hasEdits && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {edits.length}
                </span>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Undo/Redo Buttons */}
        <div className="flex items-center gap-1 px-4 pb-3">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border bg-background hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
            Redo
          </button>
        </div>

        {/* Edit List */}
        <CollapsibleContent>
          <div className="border-t border-border overflow-y-auto max-h-[400px]">
            {!hasEdits ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No edits yet. Use the assistant to modify your proposal.
              </div>
            ) : (
              <div>
                {edits.map((edit, index) => (
                  <EditHistoryItem
                    key={edit.id}
                    edit={edit}
                    isLatest={index === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default EditHistory;

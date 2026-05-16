/**
 * Verification UI Component
 * Phase 102-11: Task 4 - Side-by-side block verification
 *
 * Shows original document text on left, detected blocks on right.
 * Users can accept, reject, or edit each block detection.
 * Supports bulk actions and undo/redo via keyboard shortcuts.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Check,
  X,
  Pencil,
  CheckCheck,
  XCircle,
  ChevronDown,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { PERSUASION_BLOCK_TYPES, getBlockDisplayInfo } from "@/lib/document-builder/persuasion-blocks";
import type { PersuasionBlockType } from "@/lib/document-builder/types";
import type { DetectedStructure } from "@/db/schema/document-builder";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = "pending" | "accepted" | "rejected" | "modified";

interface VerifiableBlock {
  id: string;
  blockType: PersuasionBlockType | "heading" | "paragraph" | "table" | "list" | "image" | "unknown";
  position: number;
  confidence: number;
  originalText: string;
  suggestedContent: string | null;
  verified: VerificationStatus;
  modifiedText?: string;
}

interface VerificationUIProps {
  /** Original document text */
  originalText: string;
  /** Detected blocks from structure detector */
  detectedBlocks: DetectedStructure[];
  /** Callback when verification is complete */
  onComplete: (blocks: VerifiableBlock[]) => void;
  /** Optional class name */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK_TYPE_OPTIONS: Array<{ value: PersuasionBlockType | "heading" | "paragraph" | "table" | "list" | "image" | "unknown"; label: string }> = [
  ...PERSUASION_BLOCK_TYPES.map((b) => ({ value: b.type, label: b.label })),
  { value: "heading", label: "Heading" },
  { value: "paragraph", label: "Paragraph" },
  { value: "table", label: "Table" },
  { value: "list", label: "List" },
  { value: "image", label: "Image" },
  { value: "unknown", label: "Unknown" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VerificationUI({
  originalText,
  detectedBlocks,
  onComplete,
  className,
}: VerificationUIProps) {
  // Convert detected blocks to verifiable format
  const initialBlocks: VerifiableBlock[] = useMemo(
    () =>
      detectedBlocks.map((block) => ({
        id: block.id,
        blockType: block.blockType,
        position: block.position,
        confidence: block.confidence,
        originalText: block.originalText,
        suggestedContent: block.suggestedContent,
        verified: block.verified as VerificationStatus,
      })),
    [detectedBlocks]
  );

  // Undo/redo state management
  const {
    state: blocks,
    set: setBlocks,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<VerifiableBlock[]>(initialBlocks);

  // Track which block is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const total = blocks.length;
    const accepted = blocks.filter((b) => b.verified === "accepted").length;
    const rejected = blocks.filter((b) => b.verified === "rejected").length;
    const modified = blocks.filter((b) => b.verified === "modified").length;
    const pending = blocks.filter((b) => b.verified === "pending").length;
    const verified = accepted + rejected + modified;

    return { total, accepted, rejected, modified, pending, verified };
  }, [blocks]);

  const progressPercent = stats.total > 0 ? (stats.verified / stats.total) * 100 : 0;
  const lowConfidenceCount = blocks.filter((b) => b.confidence < 70 && b.verified === "pending").length;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const updateBlock = useCallback(
    (id: string, updates: Partial<VerifiableBlock>) => {
      setBlocks((prev) =>
        prev.map((block) =>
          block.id === id ? { ...block, ...updates } : block
        )
      );
    },
    [setBlocks]
  );

  const acceptBlock = useCallback(
    (id: string) => {
      updateBlock(id, { verified: "accepted" });
    },
    [updateBlock]
  );

  const rejectBlock = useCallback(
    (id: string) => {
      updateBlock(id, { verified: "rejected" });
    },
    [updateBlock]
  );

  const startEditing = useCallback((block: VerifiableBlock) => {
    setEditingId(block.id);
    setEditText(block.modifiedText || block.originalText);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;

    updateBlock(editingId, {
      verified: "modified",
      modifiedText: editText,
    });
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, updateBlock]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  const changeBlockType = useCallback(
    (id: string, newType: VerifiableBlock["blockType"]) => {
      updateBlock(id, { blockType: newType, verified: "modified" });
    },
    [updateBlock]
  );

  // Bulk actions
  const acceptAll = useCallback(() => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.verified === "pending" ? { ...block, verified: "accepted" } : block
      )
    );
  }, [setBlocks]);

  const rejectLowConfidence = useCallback(() => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.confidence < 70 && block.verified === "pending"
          ? { ...block, verified: "rejected" }
          : block
      )
    );
  }, [setBlocks]);

  const handleComplete = useCallback(() => {
    onComplete(blocks);
  }, [blocks, onComplete]);

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-success text-success-foreground";
    if (confidence >= 60) return "bg-warning text-warning-foreground";
    return "bg-error text-error-foreground";
  };

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case "accepted":
        return <Badge variant="default" className="bg-success">Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "modified":
        return <Badge variant="secondary">Modified</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Header with progress and actions */}
        <div className="flex items-center justify-between p-4 border-b bg-surface-1">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {stats.verified} / {stats.total} blocks verified
              </span>
              <Progress value={progressPercent} className="w-48 h-2 mt-1" />
            </div>

            <div className="flex gap-2 text-xs text-text-3">
              <span className="text-success">{stats.accepted} accepted</span>
              <span className="text-error">{stats.rejected} rejected</span>
              <span className="text-text-2">{stats.modified} modified</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undo}
                  disabled={!canUndo}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={redo}
                  disabled={!canRedo}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-border mx-2" />

            {/* Bulk actions */}
            <Button variant="outline" size="sm" onClick={acceptAll}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Accept All
            </Button>

            {lowConfidenceCount > 0 && (
              <Button variant="outline" size="sm" onClick={rejectLowConfidence}>
                <XCircle className="w-4 h-4 mr-2" />
                Reject Low Confidence ({lowConfidenceCount})
              </Button>
            )}

            <Button
              onClick={handleComplete}
              disabled={stats.pending > 0}
              className="ml-4"
            >
              Complete Verification
            </Button>
          </div>
        </div>

        {/* Split view: Original | Detected */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: Original document */}
          <div className="w-1/2 border-r overflow-auto p-4">
            <h3 className="text-sm font-medium text-text-2 mb-3">Original Document</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-text-1">
              {originalText}
            </div>
          </div>

          {/* Right panel: Detected blocks */}
          <div className="w-1/2 overflow-auto p-4">
            <h3 className="text-sm font-medium text-text-2 mb-3">
              Detected Blocks ({blocks.length})
            </h3>

            <div className="space-y-3">
              {blocks.map((block) => {
                const isEditing = editingId === block.id;
                const displayInfo = getBlockDisplayInfo(block.blockType as PersuasionBlockType);

                return (
                  <div
                    key={block.id}
                    className={cn(
                      "border rounded-lg p-3 transition-colors",
                      block.verified === "accepted" && "border-success bg-success/5",
                      block.verified === "rejected" && "border-error bg-error/5 opacity-60",
                      block.verified === "modified" && "border-accent bg-accent/5",
                      block.verified === "pending" && "border-border"
                    )}
                  >
                    {/* Block header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {/* Block type selector */}
                        <Select
                          value={block.blockType}
                          onValueChange={(value) =>
                            changeBlockType(block.id, value as VerifiableBlock["blockType"])
                          }
                        >
                          <SelectTrigger className="w-40 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOCK_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Confidence badge */}
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", getConfidenceColor(block.confidence))}
                        >
                          {block.confidence}%
                        </Badge>

                        {/* Status badge */}
                        {getStatusBadge(block.verified)}
                      </div>

                      {/* Action buttons */}
                      {!isEditing && block.verified !== "rejected" && (
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => acceptBlock(block.id)}
                              >
                                <Check className="w-4 h-4 text-success" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Accept</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => rejectBlock(block.id)}
                              >
                                <X className="w-4 h-4 text-error" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reject</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startEditing(block)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>

                    {/* Block content */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-24 text-sm"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveEdit}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-text-2 line-clamp-4">
                        {block.modifiedText || block.originalText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default VerificationUI;

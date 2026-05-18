/**
 * Manual Block Creator Component
 * Phase 102-11: Task 5 - Escape hatch for manual block creation
 *
 * Allows users to manually create blocks when AI detection fails.
 * Integrates with verification flow to add new blocks at specific positions.
 */

"use client";

import { useState, useCallback } from "react";
import { Plus, X, Info } from "lucide-react";
import {
  cn,
  Button,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@tevero/ui";
// RadioGroup not yet in @tevero/ui - keeping local import
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PERSUASION_BLOCK_TYPES,
} from "@/lib/document-builder/persuasion-blocks";
import type { PersuasionBlockType } from "@/lib/document-builder/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManualBlock {
  id: string;
  blockType: PersuasionBlockType;
  content: string;
  position: "before" | "after";
  referenceBlockId: string;
}

interface ManualBlockCreatorProps {
  /** Available block positions (existing block IDs) */
  existingBlockIds: string[];
  /** Block ID labels for position selector */
  blockLabels: Record<string, string>;
  /** Callback when block is created */
  onCreate: (block: ManualBlock) => void;
  /** Optional trigger element */
  trigger?: React.ReactNode;
  /** Optional class name */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualBlockCreator({
  existingBlockIds,
  blockLabels,
  onCreate,
  trigger,
  className,
}: ManualBlockCreatorProps) {
  const [open, setOpen] = useState(false);
  const [blockType, setBlockType] = useState<PersuasionBlockType>("custom");
  const [content, setContent] = useState("");
  const [position, setPosition] = useState<"before" | "after">("after");
  const [referenceBlockId, setReferenceBlockId] = useState<string>(
    existingBlockIds[0] || ""
  );
  const [showBlockInfo, setShowBlockInfo] = useState(false);

  // Get selected block type info
  const selectedBlockInfo = PERSUASION_BLOCK_TYPES.find((b) => b.type === blockType);

  // Reset form
  const resetForm = useCallback(() => {
    setBlockType("custom");
    setContent("");
    setPosition("after");
    setReferenceBlockId(existingBlockIds[0] || "");
    setShowBlockInfo(false);
  }, [existingBlockIds]);

  // Handle create
  const handleCreate = useCallback(() => {
    if (!content.trim()) return;

    const newBlock: ManualBlock = {
      id: `manual-${Date.now()}`,
      blockType,
      content: content.trim(),
      position,
      referenceBlockId,
    };

    onCreate(newBlock);
    resetForm();
    setOpen(false);
  }, [blockType, content, position, referenceBlockId, onCreate, resetForm]);

  // Handle open change
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
      }
    },
    [resetForm]
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className={className}>
            <Plus className="w-4 h-4 mr-2" />
            Add Block Manually
          </Button>
        )}
      </SheetTrigger>

      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create Manual Block</SheetTitle>
          <SheetDescription>
            Add a block when AI detection missed content or got it wrong.
            This is your escape hatch for complete control.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Block Type Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Block Type</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBlockInfo(!showBlockInfo)}
              >
                <Info className="w-4 h-4 mr-1" />
                {showBlockInfo ? "Hide" : "Show"} descriptions
              </Button>
            </div>

            <Select
              value={blockType}
              onValueChange={(value) => setBlockType(value as PersuasionBlockType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSUASION_BLOCK_TYPES.map((block) => (
                  <SelectItem key={block.type} value={block.type}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          `bg-${block.color.bg}`
                        )}
                      />
                      {block.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Block type description */}
            {showBlockInfo && selectedBlockInfo && (
              <div className="p-3 rounded-lg bg-surface-2 text-sm">
                <p className="font-medium text-text-1">{selectedBlockInfo.label}</p>
                <p className="text-text-3 mt-1">{selectedBlockInfo.description}</p>
                <p className="text-text-3 mt-2 italic">
                  AI hint: {selectedBlockInfo.aiPromptHint.slice(0, 100)}...
                </p>
              </div>
            )}
          </div>

          {/* Content Input */}
          <div className="space-y-2">
            <Label htmlFor="block-content">Content</Label>
            <Textarea
              id="block-content"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 10000))}
              placeholder={selectedBlockInfo?.placeholder || "Enter block content..."}
              className="min-h-32"
              maxLength={10000}
              aria-describedby="content-char-count"
            />
            <p id="content-char-count" className="text-xs text-text-3">
              {content.length} / 10,000 characters
            </p>
          </div>

          {/* Position Selector */}
          {existingBlockIds.length > 0 && (
            <div className="space-y-3">
              <Label>Position</Label>

              <RadioGroup
                value={position}
                onValueChange={(value) => setPosition(value as "before" | "after")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="before" id="before" />
                  <Label htmlFor="before" className="font-normal">
                    Before
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="after" id="after" />
                  <Label htmlFor="after" className="font-normal">
                    After
                  </Label>
                </div>
              </RadioGroup>

              <Select
                value={referenceBlockId}
                onValueChange={setReferenceBlockId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reference block" />
                </SelectTrigger>
                <SelectContent>
                  {existingBlockIds.map((id) => (
                    <SelectItem key={id} value={id}>
                      {blockLabels[id] || id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button onClick={handleCreate} disabled={!content.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Block
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Inline Creator (for use within verification flow)
// ---------------------------------------------------------------------------

interface InlineBlockCreatorProps {
  /** Block type to create */
  defaultType?: PersuasionBlockType;
  /** Callback when block is created */
  onCreate: (type: PersuasionBlockType, content: string) => void;
  /** Callback to cancel */
  onCancel: () => void;
  /** Optional class name */
  className?: string;
}

export function InlineBlockCreator({
  defaultType = "custom",
  onCreate,
  onCancel,
  className,
}: InlineBlockCreatorProps) {
  const [blockType, setBlockType] = useState<PersuasionBlockType>(defaultType);
  const [content, setContent] = useState("");

  const selectedBlockInfo = PERSUASION_BLOCK_TYPES.find((b) => b.type === blockType);

  const handleCreate = useCallback(() => {
    if (!content.trim()) return;
    onCreate(blockType, content.trim());
  }, [blockType, content, onCreate]);

  return (
    <div className={cn("border rounded-lg p-4 bg-surface-1", className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Add New Block</h4>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCancel}
          aria-label="Close block creator"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-3">
        <Select
          value={blockType}
          onValueChange={(value) => setBlockType(value as PersuasionBlockType)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSUASION_BLOCK_TYPES.map((block) => (
              <SelectItem key={block.type} value={block.type}>
                {block.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 10000))}
          placeholder={selectedBlockInfo?.placeholder || "Enter content..."}
          className="min-h-20 text-sm"
          maxLength={10000}
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!content.trim()}>
            Add Block
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ManualBlockCreator;

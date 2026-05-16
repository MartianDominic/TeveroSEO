"use client";

/**
 * VariantCreator - Modal for creating A/B test variants.
 * Phase 102-05: A/B testing UI and version diff
 *
 * Features:
 * - Form with variant name input
 * - Clone from control or start blank option
 * - Traffic weight slider (0-100)
 * - Uses Dialog pattern from @tevero/ui
 *
 * Triggers from block actions "Create Variant" button.
 */

import { type FC, useState, useCallback } from "react";
import { Copy, Plus, FlaskConical } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@tevero/ui";
import { Button } from "@tevero/ui";
import { cn } from "@/lib/utils";
import type { TipTapContent } from "@/lib/document-builder/types";

/**
 * Props for VariantCreator component.
 */
export interface VariantCreatorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The parent block ID to create variant for */
  blockId: string;
  /** Existing variant count to suggest next name */
  existingVariantCount: number;
  /** Control variant content for cloning */
  controlContent?: TipTapContent;
  /** Callback when variant is created */
  onCreateVariant: (params: {
    variantName: string;
    content: TipTapContent;
    weight: number;
    clonedFromControl: boolean;
  }) => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Generate default variant name based on count.
 * Control is always first, then Variant A, B, C...
 */
function getDefaultVariantName(existingCount: number): string {
  if (existingCount === 0) return "Control";
  const letter = String.fromCharCode(64 + existingCount); // A=1, B=2, etc.
  return `Variant ${letter}`;
}

/**
 * Empty TipTap document content.
 */
const EMPTY_CONTENT: TipTapContent = {
  type: "doc",
  content: [],
};

/**
 * VariantCreator component.
 *
 * Modal dialog for creating new A/B test variants on a persuasion block.
 * Supports cloning content from control or starting with blank content.
 */
export const VariantCreator: FC<VariantCreatorProps> = ({
  open,
  onOpenChange,
  blockId,
  existingVariantCount,
  controlContent,
  onCreateVariant,
  isLoading = false,
}) => {
  // Form state
  const [variantName, setVariantName] = useState(
    getDefaultVariantName(existingVariantCount)
  );
  const [cloneFromControl, setCloneFromControl] = useState(true);
  const [weight, setWeight] = useState(50);

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setVariantName(getDefaultVariantName(existingVariantCount));
        setCloneFromControl(true);
        setWeight(50);
      }
      onOpenChange(newOpen);
    },
    [existingVariantCount, onOpenChange]
  );

  // Submit handler
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const content = cloneFromControl && controlContent
        ? { ...controlContent }
        : EMPTY_CONTENT;

      onCreateVariant({
        variantName: variantName.trim() || getDefaultVariantName(existingVariantCount),
        content,
        weight,
        clonedFromControl: cloneFromControl,
      });

      onOpenChange(false);
    },
    [
      variantName,
      cloneFromControl,
      controlContent,
      weight,
      existingVariantCount,
      onCreateVariant,
      onOpenChange,
    ]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md",
          "bg-surface",
          "shadow-modal",
          "rounded-lg",
          "p-6"
        )}
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-text-1">
            <FlaskConical className="h-5 w-5 text-accent" />
            Create Variant
          </DialogTitle>
          <DialogDescription className="text-sm text-text-3">
            Create a new A/B test variant to compare different content versions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Variant Name */}
          <div className="space-y-2">
            <label
              htmlFor="variant-name"
              className="text-sm font-medium text-text-2"
            >
              Variant Name
            </label>
            <input
              id="variant-name"
              type="text"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="e.g., Variant A"
              className={cn(
                "w-full",
                "px-3 py-2",
                "bg-surface-2",
                "border border-hairline",
                "rounded-md",
                "text-sm text-text-1",
                "placeholder:text-text-4",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              )}
              autoFocus
            />
          </div>

          {/* Content Source */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-2">
              Starting Content
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Clone from control */}
              <button
                type="button"
                onClick={() => setCloneFromControl(true)}
                className={cn(
                  "flex flex-col items-center gap-2",
                  "p-4",
                  "rounded-lg",
                  "border-2",
                  "transition-all duration-[160ms]",
                  cloneFromControl
                    ? "border-accent bg-accent-soft"
                    : "border-hairline bg-surface-2 hover:border-accent/50"
                )}
                disabled={!controlContent}
              >
                <Copy
                  className={cn(
                    "h-5 w-5",
                    cloneFromControl ? "text-accent-ink" : "text-text-3"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    cloneFromControl ? "text-accent-ink" : "text-text-2"
                  )}
                >
                  Clone Control
                </span>
                <span className="text-xs text-text-4 text-center">
                  Copy existing content
                </span>
              </button>

              {/* Start blank */}
              <button
                type="button"
                onClick={() => setCloneFromControl(false)}
                className={cn(
                  "flex flex-col items-center gap-2",
                  "p-4",
                  "rounded-lg",
                  "border-2",
                  "transition-all duration-[160ms]",
                  !cloneFromControl
                    ? "border-accent bg-accent-soft"
                    : "border-hairline bg-surface-2 hover:border-accent/50"
                )}
              >
                <Plus
                  className={cn(
                    "h-5 w-5",
                    !cloneFromControl ? "text-accent-ink" : "text-text-3"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    !cloneFromControl ? "text-accent-ink" : "text-text-2"
                  )}
                >
                  Start Blank
                </span>
                <span className="text-xs text-text-4 text-center">
                  Write from scratch
                </span>
              </button>
            </div>
          </div>

          {/* Traffic Weight Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="traffic-weight"
                className="text-sm font-medium text-text-2"
              >
                Traffic Allocation
              </label>
              <span className="text-sm font-mono text-text-3">{weight}%</span>
            </div>
            <input
              id="traffic-weight"
              type="range"
              min={0}
              max={100}
              step={5}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className={cn(
                "w-full h-2",
                "rounded-full",
                "appearance-none",
                "bg-surface-3",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-4",
                "[&::-webkit-slider-thumb]:h-4",
                "[&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-accent",
                "[&::-webkit-slider-thumb]:cursor-pointer",
                "[&::-moz-range-thumb]:w-4",
                "[&::-moz-range-thumb]:h-4",
                "[&::-moz-range-thumb]:rounded-full",
                "[&::-moz-range-thumb]:bg-accent",
                "[&::-moz-range-thumb]:border-none",
                "[&::-moz-range-thumb]:cursor-pointer"
              )}
            />
            <p className="text-xs text-text-4">
              Weights will be automatically balanced across all variants.
            </p>
          </div>

          {/* Footer */}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isLoading || !variantName.trim()}
              className="bg-accent text-accent-ink hover:bg-accent/90"
            >
              {isLoading ? "Creating..." : "Create Variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VariantCreator;

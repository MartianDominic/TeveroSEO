"use client";

/**
 * FrameworkSelector - Modal for selecting framework templates.
 * Phase 102-03: Framework templates
 *
 * Displays 3 framework options plus a "freestyle" option.
 * Per UI-SPEC: uses Dialog component with --shadow-modal.
 */

import { type FC } from "react";

import { Layers, X, Zap, BookOpen, ArrowRight, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Button,
} from "@tevero/ui";
import {
  getAllFrameworkTemplates,
  type FrameworkTemplate,
} from "@/lib/document-builder/template-service";
import { useFrameworkActions } from "@/stores/documentBuilderStore";
import { createBlocksFromFramework } from "@/lib/document-builder/persuasion-blocks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FrameworkSelectorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Callback when a framework is selected */
  onSelect?: (frameworkId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Framework Icons
// ---------------------------------------------------------------------------

const frameworkIcons: Record<string, typeof Layers> = {
  russell_brunson: Zap,
  storybrand: BookOpen,
  pas: ArrowRight,
};

// ---------------------------------------------------------------------------
// Framework Card
// ---------------------------------------------------------------------------

interface FrameworkCardProps {
  framework: FrameworkTemplate;
  onSelect: () => void;
}

const FrameworkCard: FC<FrameworkCardProps> = ({ framework, onSelect }) => {
  const Icon = frameworkIcons[framework.id] ?? Layers;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Select ${framework.name} framework: ${framework.description}`}
      className={cn(
        // Base styles
        "w-full flex flex-col",
        "p-4 rounded-lg",
        "bg-surface hover:bg-surface-2",
        "border border-hairline hover:border-accent/20",
        "text-left",
        "transition-all duration-[240ms]",
        "hover:shadow-card hover:-translate-y-0.5",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className={cn(
            "flex items-center justify-center",
            "w-10 h-10 shrink-0",
            "rounded-lg",
            "bg-accent-soft",
            "text-accent"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-1">
            {framework.name}
          </h3>
          <p className="text-xs text-text-3 mt-0.5 line-clamp-2">
            {framework.description}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-hairline">
        <span className="text-xs text-text-3">
          <span className="font-medium text-text-2">
            {framework.recommendedSequence.length}
          </span>{" "}
          blocks
        </span>
        <span className="text-xs text-text-3">
          <span className="font-medium text-text-2">
            {framework.requiredBlocks.length}
          </span>{" "}
          required
        </span>
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Freestyle Card
// ---------------------------------------------------------------------------

interface FreestyleCardProps {
  onSelect: () => void;
}

const FreestyleCard: FC<FreestyleCardProps> = ({ onSelect }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label="Start without a framework - build your proposal from scratch"
      className={cn(
        // Base styles
        "w-full flex items-center gap-3",
        "p-4 rounded-lg",
        "bg-surface-2 hover:bg-surface-3",
        "border border-dashed border-hairline hover:border-text-4",
        "text-left",
        "transition-all duration-[240ms]",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center",
          "w-10 h-10 shrink-0",
          "rounded-lg",
          "bg-surface-3",
          "text-text-3"
        )}
      >
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-text-2">
          No Framework (Freestyle)
        </h3>
        <p className="text-xs text-text-3 mt-0.5">
          Build your proposal from scratch with any blocks you want.
        </p>
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * FrameworkSelector component.
 *
 * A modal dialog for selecting a persuasion framework template.
 * Shows 3 framework options (Russell Brunson, StoryBrand, PAS)
 * plus a "freestyle" option for custom builds.
 */
export const FrameworkSelector: FC<FrameworkSelectorProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  // Use shallow selectors to prevent unnecessary re-renders
  const { setFramework, initialize, reset } = useFrameworkActions();
  const frameworks = getAllFrameworkTemplates();

  const handleSelectFramework = (framework: FrameworkTemplate) => {
    // Set the framework
    setFramework(framework.id, framework.name);

    // M-STATE-02: Use shared utility for block creation to eliminate duplication
    const blocks = createBlocksFromFramework(framework);

    initialize(blocks, framework.id, framework.name);

    // Notify parent
    onSelect?.(framework.id);
    onOpenChange(false);
  };

  const handleSelectFreestyle = () => {
    // Reset to empty canvas
    reset();
    setFramework(null, null);

    // Notify parent
    onSelect?.(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg w-full",
          "bg-surface",
          "rounded-xl",
          "shadow-modal",
          "p-6"
        )}
      >
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-text-1">
              Choose a Framework
            </DialogTitle>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="text-sm text-text-3 mt-1">
            Start with a proven persuasion framework or build freestyle.
          </DialogDescription>
        </DialogHeader>

        {/* Framework Grid */}
        <div className="grid gap-3">
          {frameworks.map((framework) => (
            <FrameworkCard
              key={framework.id}
              framework={framework}
              onSelect={() => handleSelectFramework(framework)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-hairline" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-2 text-xs text-text-4 bg-surface">or</span>
          </div>
        </div>

        {/* Freestyle Option */}
        <FreestyleCard onSelect={handleSelectFreestyle} />
      </DialogContent>
    </Dialog>
  );
};

export default FrameworkSelector;

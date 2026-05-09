"use client";

/**
 * UndoRedoButtons Component - Toolbar buttons for undo/redo with keyboard shortcuts.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * Features:
 * - Cmd+Z / Ctrl+Z for undo
 * - Cmd+Shift+Z / Ctrl+Shift+Z for redo
 * - Visual buttons with disabled state
 * - History count tooltips
 */

import { useEffect, useCallback, useState, useMemo } from "react";

import { Undo2, Redo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProposalStore } from "@/stores/proposalStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UndoRedoButtonsProps {
  /** Additional class names */
  className?: string;
  /** Show button labels */
  showLabels?: boolean;
  /** Button size variant */
  size?: "sm" | "default" | "lg";
  /** Callback when undo is triggered */
  onUndo?: () => void;
  /** Callback when redo is triggered */
  onRedo?: () => void;
}

// ---------------------------------------------------------------------------
// Keyboard shortcut hook
// ---------------------------------------------------------------------------

/**
 * Hook to handle undo/redo keyboard shortcuts.
 */
function useUndoRedoKeyboard(
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      if (!modKey) return;

      // Cmd/Ctrl + Z = Undo
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }

      // Cmd/Ctrl + Shift + Z = Redo
      if (event.key === "z" && event.shiftKey) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }

      // Cmd/Ctrl + Y = Redo (alternative, common on Windows)
      if (event.key === "y" && !event.shiftKey) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }
    },
    [undo, redo, canUndo, canRedo]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Undo/Redo toolbar buttons with keyboard shortcuts.
 *
 * @example
 * ```tsx
 * <UndoRedoButtons />
 * ```
 */
export function UndoRedoButtons({
  className,
  showLabels = false,
  size = "sm",
  onUndo,
  onRedo,
}: UndoRedoButtonsProps) {
  const t = useTranslations("proposals.undoRedo");

  // Local state for reactive updates (temporal state doesn't trigger re-renders)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Subscribe to temporal state changes
  useEffect(() => {
    const updateState = () => {
      const state = useProposalStore.temporal.getState();
      setCanUndo(state.pastStates.length > 0);
      setCanRedo(state.futureStates.length > 0);
      setUndoCount(state.pastStates.length);
      setRedoCount(state.futureStates.length);
    };

    // Initial update
    updateState();

    // Subscribe to changes
    const unsubscribe = useProposalStore.temporal.subscribe(updateState);

    return () => {
      unsubscribe();
    };
  }, []);

  // MEDIUM-06 FIX: Get fresh temporal state inside callbacks to avoid stale closure
  // Instead of capturing temporalState at render time, we get fresh state when called
  const handleUndo = useCallback(() => {
    if (canUndo) {
      useProposalStore.temporal.getState().undo();
      onUndo?.();
    }
  }, [canUndo, onUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      useProposalStore.temporal.getState().redo();
      onRedo?.();
    }
  }, [canRedo, onRedo]);

  // Keyboard shortcuts
  useUndoRedoKeyboard(handleUndo, handleRedo, canUndo, canRedo);

  // MEDIUM-04 FIX: Memoize platform detection to avoid re-computing on every render
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  }, []);

  const undoShortcut = isMac ? "Cmd+Z" : "Ctrl+Z";
  const redoShortcut = isMac ? "Cmd+Shift+Z" : "Ctrl+Shift+Z";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        {/* Undo Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={size}
              onClick={handleUndo}
              disabled={!canUndo}
              className={cn(
                "gap-1.5",
                !canUndo && "opacity-50 cursor-not-allowed"
              )}
              aria-label={t("undo")}
            >
              <Undo2 className="h-4 w-4" />
              {showLabels && <span>{t("undo")}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex flex-col items-center gap-0.5">
              <span>{t("undo")}</span>
              <span className="text-xs-safe text-text-3">{undoShortcut}</span>
              {undoCount > 0 && (
                <span className="text-xs-safe text-text-3">
                  {t("historyCount", { count: undoCount })}
                </span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Redo Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={size}
              onClick={handleRedo}
              disabled={!canRedo}
              className={cn(
                "gap-1.5",
                !canRedo && "opacity-50 cursor-not-allowed"
              )}
              aria-label={t("redo")}
            >
              <Redo2 className="h-4 w-4" />
              {showLabels && <span>{t("redo")}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex flex-col items-center gap-0.5">
              <span>{t("redo")}</span>
              <span className="text-xs-safe text-text-3">{redoShortcut}</span>
              {redoCount > 0 && (
                <span className="text-xs-safe text-text-3">
                  {t("historyCount", { count: redoCount })}
                </span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default UndoRedoButtons;

"use client";

/**
 * AIGenerationProgress - Progress indicator for AI content generation.
 * Phase 57-07: AI Content Generation
 *
 * Features:
 * - Section-by-section progress display
 * - Status indicators (pending, generating, complete, error)
 * - Cancel button to abort generation
 * - Error handling per section
 * - Localized labels (EN/LT)
 */

import { type FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  ProgressBar,
} from "@tevero/ui";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeneratableSectionType } from "./AIGenerationModal";

/**
 * Status for each section being generated.
 */
export type SectionGenerationStatus =
  | "pending"
  | "generating"
  | "complete"
  | "error";

/**
 * Progress item for a single section.
 */
export interface SectionProgress {
  type: GeneratableSectionType;
  status: SectionGenerationStatus;
  errorMessage?: string;
}

/**
 * Section labels by type.
 */
const SECTION_LABELS: Record<
  GeneratableSectionType,
  { en: string; lt: string }
> = {
  hero: { en: "Hero / Introduction", lt: "Ivadas" },
  current_state: { en: "Current State Analysis", lt: "Dabartines bukles analize" },
  opportunities: { en: "Opportunities", lt: "Galimybes" },
  roi: { en: "ROI Projections", lt: "ROI prognozes" },
};

export interface AIGenerationProgressProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Progress for each section */
  sections: SectionProgress[];
  /** Overall progress (0-100) */
  progress: number;
  /** Whether generation can be cancelled */
  canCancel?: boolean;
  /** Callback to cancel generation */
  onCancel?: () => void;
  /** Whether generation is complete */
  isComplete?: boolean;
  /** Whether there were any errors */
  hasErrors?: boolean;
  /** Callback when done is clicked (after completion) */
  onDone?: () => void;
}

/**
 * Status icon component.
 */
const StatusIcon: FC<{ status: SectionGenerationStatus }> = ({ status }) => {
  switch (status) {
    case "pending":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case "generating":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

/**
 * AIGenerationProgress component.
 *
 * Shows generation progress for each section with status indicators.
 */
export const AIGenerationProgress: FC<AIGenerationProgressProps> = ({
  open,
  onOpenChange,
  locale = "en",
  sections,
  progress,
  canCancel = true,
  onCancel,
  isComplete = false,
  hasErrors = false,
  onDone,
}) => {
  // Get section label
  const getSectionLabel = (type: GeneratableSectionType) =>
    SECTION_LABELS[type]?.[locale] || type;

  // UI labels
  const labels = {
    title: locale === "lt" ? "Generuojamas turinys" : "Generating Content",
    titleComplete:
      locale === "lt" ? "Generavimas baigtas" : "Generation Complete",
    titleError:
      locale === "lt" ? "Generavimas baigtas su klaidomis" : "Generation Complete with Errors",
    cancelButton: locale === "lt" ? "Atsaukti" : "Cancel",
    doneButton: locale === "lt" ? "Gerai" : "Done",
    generatingText:
      locale === "lt"
        ? "Generuojamas turinys su AI..."
        : "Generating content with AI...",
    completeText:
      locale === "lt"
        ? "Visos sekcijos sugeneruotos sekmingai."
        : "All sections generated successfully.",
    partialText:
      locale === "lt"
        ? "Kai kurios sekcijos negali buti sugeneruotos."
        : "Some sections could not be generated.",
  };

  // Determine title based on state
  const title = isComplete
    ? hasErrors
      ? labels.titleError
      : labels.titleComplete
    : labels.title;

  // Calculate completed count
  const completedCount = sections.filter((s) => s.status === "complete").length;
  const errorCount = sections.filter((s) => s.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={isComplete ? onOpenChange : undefined}>
      <DialogContent className="max-w-md rounded-lg border bg-background p-6 shadow-[var(--shadow-modal)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              hasErrors ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <ProgressBar value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {isComplete
                ? hasErrors
                  ? labels.partialText
                  : labels.completeText
                : labels.generatingText}
            </p>
          </div>

          {/* Section Progress List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sections.map((section) => (
              <div
                key={section.type}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  section.status === "generating" && "border-primary bg-accent",
                  section.status === "complete" &&
                    "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
                  section.status === "error" &&
                    "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                )}
              >
                <StatusIcon status={section.status} />
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      section.status === "pending" && "text-muted-foreground",
                      section.status === "generating" && "text-foreground",
                      section.status === "complete" && "text-green-700 dark:text-green-300",
                      section.status === "error" && "text-red-700 dark:text-red-300"
                    )}
                  >
                    {getSectionLabel(section.type)}
                  </span>
                  {section.status === "error" && section.errorMessage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 line-clamp-1">
                      {section.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="text-sm text-center text-muted-foreground">
            {completedCount}/{sections.length}{" "}
            {locale === "lt" ? "sekciju baigta" : "sections complete"}
            {errorCount > 0 && (
              <span className="text-red-600 ml-2">
                ({errorCount} {locale === "lt" ? "klaidos" : "errors"})
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="mt-6">
          {isComplete ? (
            <Button onClick={onDone || (() => onOpenChange(false))}>
              {labels.doneButton}
            </Button>
          ) : (
            canCancel && (
              <Button variant="outline" onClick={onCancel}>
                {labels.cancelButton}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIGenerationProgress;

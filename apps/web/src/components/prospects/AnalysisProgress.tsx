"use client";

import {
  Check,
  Loader2,
  AlertCircle,
  Globe,
  Search,
  Brain,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  useAnalysisProgress,
  type ProgressStage,
} from "@/hooks/useAnalysisProgress";
import { cn } from "@/lib/utils";

const STAGE_ICONS: Record<ProgressStage, React.ElementType> = {
  connecting: Globe,
  crawling: Search,
  extracting: Brain,
  analyzing: Sparkles,
  complete: Check,
  error: AlertCircle,
};

const STAGE_ORDER: ProgressStage[] = [
  "connecting",
  "crawling",
  "extracting",
  "analyzing",
  "complete",
];

interface AnalysisProgressProps {
  prospectId?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function AnalysisProgress({
  prospectId,
  onComplete,
  onError,
  className,
}: AnalysisProgressProps) {
  const t = useTranslations("prospects.wizard.progress");

  const { stage, progress, message, error, isConnected } = useAnalysisProgress({
    prospectId,
    enabled: !!prospectId,
    onComplete,
    onError,
  });

  const currentIndex = STAGE_ORDER.indexOf(
    stage === "error" ? "connecting" : stage
  );

  return (
    <div className={cn("space-y-[var(--space-6)]", className)}>
      {/* Progress bar */}
      <div className="space-y-[var(--space-2)]">
        <div className="flex justify-between text-[length:var(--type-small)] text-text-3">
          <span>{message || t(`stages.${stage}`)}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              stage === "error" ? "bg-error" : "bg-accent"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex justify-between">
        {STAGE_ORDER.filter((s) => s !== "complete").map((stageId, index) => {
          const Icon = STAGE_ICONS[stageId];
          const isActive = stageId === stage;
          const isCompleted = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <div
              key={stageId}
              className="flex flex-col items-center gap-[var(--space-2)]"
            >
              <div
                className={cn(
                  "flex items-center justify-center",
                  "w-10 h-10 rounded-full",
                  "transition-all duration-300",
                  isCompleted && "bg-success text-white",
                  isActive && "bg-accent text-white",
                  isPending && "bg-surface-2 text-text-4",
                  stage === "error" && isActive && "bg-error text-white"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-[length:var(--type-tiny)]",
                  "tracking-[0.06em] [font-variant-caps:all-small-caps]",
                  isActive && "text-text-1 font-medium",
                  !isActive && "text-text-3"
                )}
              >
                {t(`stages.${stageId}`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {stage === "error" && error && (
        <div className="p-[var(--space-3)] rounded-[var(--radius-input)] bg-error/10 border border-error/20">
          <div className="flex items-center gap-[var(--space-2)]">
            <AlertCircle className="h-4 w-4 text-error flex-shrink-0" />
            <p className="text-[length:var(--type-small)] text-error">{error}</p>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      <div className="flex items-center justify-center gap-[var(--space-2)] text-[length:var(--type-tiny)] text-text-4">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-success animate-pulse" : "bg-text-4"
          )}
        />
        <span>{isConnected ? t("connected") : t("disconnected")}</span>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@tevero/ui";
import { ChevronDown, Check, Circle, Loader2 } from "lucide-react";

export type StepStatus = "complete" | "active" | "pending";

export interface StepDetail {
  /** Detail text (e.g., "42,318 words extracted") */
  text: string;
  /** Optional highlight value within text */
  highlight?: string;
}

export interface PipelineStepProps {
  /** Step status */
  status: StepStatus;
  /** Step label (e.g., "Searched Google") */
  label: string;
  /** Main metric (e.g., "24 sources") */
  metric?: string;
  /** Duration (revealed on hover) */
  duration?: string;
  /** Expandable detail lines */
  details?: StepDetail[];
  /** Icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Step is expanded */
  isExpanded?: boolean;
  /** Toggle expand callback */
  onToggle?: () => void;
}

const statusConfig: Record<StepStatus, {
  iconBg: string;
  iconColor: string;
  textColor: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  complete: {
    iconBg: "bg-success-soft",
    iconColor: "text-success",
    textColor: "text-text-1",
    Icon: Check,
  },
  active: {
    iconBg: "bg-accent-soft",
    iconColor: "text-accent",
    textColor: "text-text-1",
    Icon: Loader2,
  },
  pending: {
    iconBg: "bg-surface-3",
    iconColor: "text-text-4",
    textColor: "text-text-3",
    Icon: Circle,
  },
};

export function PipelineStep({
  status,
  label,
  metric,
  duration,
  details,
  icon: CustomIcon,
  isExpanded = false,
  onToggle,
}: PipelineStepProps) {
  const config = statusConfig[status];
  const IconComponent = CustomIcon || config.Icon;
  const hasDetails = details && details.length > 0;

  return (
    <div className="group">
      {/* Step row */}
      <button
        onClick={hasDetails ? onToggle : undefined}
        disabled={!hasDetails}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-3.5",
          "transition-colors duration-[160ms]",
          hasDetails && "cursor-pointer hover:bg-surface-2",
          !hasDetails && "cursor-default"
        )}
      >
        {/* Icon with semantic background */}
        <div
          className={cn(
            "w-[26px] h-[26px] rounded-md flex items-center justify-center flex-shrink-0",
            config.iconBg, config.iconColor,
            status === "active" && "shadow-[0_0_0_3px_rgba(15,79,61,0.12)]"
          )}
        >
          <IconComponent
            className={cn(
              "w-4 h-4",
              status === "active" && "animate-spin"
            )}
          />
        </div>

        {/* Label and metric */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={cn("text-[14px] font-sans", config.textColor)}>
            {label}
          </span>
          {metric && (
            <>
              <span className="text-text-4">for</span>
              <span className="font-display text-[16px] text-text-1 tabular-nums">
                {metric}
              </span>
            </>
          )}
        </div>

        {/* Duration (hover-reveal) */}
        {duration && (
          <span
            className={cn(
              "text-[13px] text-text-3 font-mono tabular-nums",
              "opacity-0 -translate-x-1",
              "group-hover:opacity-100 group-hover:translate-x-0",
              "transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            )}
          >
            {duration}
          </span>
        )}

        {/* Expand chevron */}
        {hasDetails && (
          <ChevronDown
            className={cn(
              "w-4 h-4 text-text-3 flex-shrink-0",
              "transition-transform duration-[280ms]",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expandable details with tree structure */}
      {hasDetails && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isExpanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="pl-[54px] pr-5 pb-3 space-y-1">
            {details.map((detail, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-[13px] text-text-3"
              >
                {/* Tree connector */}
                <span className="font-mono text-text-4 flex-shrink-0">
                  {idx === details.length - 1 ? "└─" : "├─"}
                </span>
                {/* Detail text */}
                <span>
                  {detail.highlight ? (
                    <>
                      {detail.text.split(detail.highlight)[0]}
                      <span className="text-text-2 font-medium tabular-nums">
                        {detail.highlight}
                      </span>
                      {detail.text.split(detail.highlight)[1]}
                    </>
                  ) : (
                    detail.text
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

PipelineStep.displayName = "PipelineStep";

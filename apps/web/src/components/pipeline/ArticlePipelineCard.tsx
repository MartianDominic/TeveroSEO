"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, Badge, ProgressBlock } from "@tevero/ui";
import { PipelineStep, type StepStatus, type StepDetail } from "./PipelineStep";
import { Search, FileText, PenTool, Image, Link, Upload } from "lucide-react";

export interface PipelineStepData {
  id: string;
  status: StepStatus;
  label: string;
  metric?: string;
  duration?: string;
  details?: StepDetail[];
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ArticlePipelineCardProps {
  /** Overall status */
  status: "generating" | "complete" | "error";
  /** Steps data */
  steps: PipelineStepData[];
  /** Total words (secondary metric) */
  totalWords?: number;
  /** Additional CSS classes */
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "error" }> = {
  generating: { label: "Generating", variant: "default" },
  complete: { label: "Complete", variant: "success" },
  error: { label: "Error", variant: "error" },
};

/**
 * ArticlePipelineCard - Shows article generation progress with expandable steps
 *
 * Features:
 * - Progress block header (steps completed / total)
 * - Status pill with current state
 * - Expandable steps with "under the hood" details
 * - Hover-reveal durations
 */
export function ArticlePipelineCard({
  status,
  steps,
  totalWords,
  className,
}: ArticlePipelineCardProps) {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());

  const completedCount = steps.filter(s => s.status === "complete").length;
  const totalCount = steps.length;
  const config = statusConfig[status];

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-4 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-3">
            <CardTitle>Article Pipeline</CardTitle>
            <Badge variant={config.variant} dot>
              {config.label}
            </Badge>
          </div>

          {/* Progress block */}
          <ProgressBlock
            current={completedCount}
            target={totalCount}
            unit="steps"
            size="card"
            showBar
            secondaryMetric={totalWords ? {
              value: totalWords.toLocaleString(),
              label: "words"
            } : undefined}
          />
        </div>
      </CardHeader>

      {/* Steps list */}
      <div className="divide-y divide-hairline-3">
        {steps.map((step) => (
          <PipelineStep
            key={step.id}
            status={step.status}
            label={step.label}
            metric={step.metric}
            duration={step.duration}
            details={step.details}
            icon={step.icon}
            isExpanded={expandedSteps.has(step.id)}
            onToggle={() => toggleStep(step.id)}
          />
        ))}
      </div>
    </Card>
  );
}

// Default step icons mapping
export const PIPELINE_ICONS = {
  research: Search,
  scrape: FileText,
  write: PenTool,
  images: Image,
  links: Link,
  publish: Upload,
} as const;

ArticlePipelineCard.displayName = "ArticlePipelineCard";

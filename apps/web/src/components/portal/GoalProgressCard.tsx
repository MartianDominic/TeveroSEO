"use client";

/**
 * GoalProgressCard
 * Phase 94: Design System v6 Migration
 *
 * Displays contract goal with achievement percentage using v6 editorial numerals.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, Badge, ProgressBlock } from "@tevero/ui";
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";

export interface GoalProgressCardProps {
  /** Goal ID for tracking */
  id?: string;
  /** Metric type (e.g., "keywords_in_top_10") */
  metric: string;
  /** Target value to achieve */
  targetValue: number;
  /** Current value achieved */
  currentValue: number;
  /** Achievement percentage (0-100+) */
  achievementPercent: string | number;
  /** Target deadline */
  targetDeadline: string | Date;
  /** Goal status */
  status: "in_progress" | "achieved" | "missed";
}

const METRIC_LABELS: Record<string, string> = {
  keywords_in_top_10: "Keywords in Top 10",
  traffic_increase: "Traffic Increase",
  ranking_improvement: "Ranking Improvement",
};

const STATUS_CONFIG: Record<string, {
  icon: typeof CheckCircle2;
  variant: "success" | "default" | "error";
  label: string;
}> = {
  in_progress: { icon: Clock, variant: "default", label: "In Progress" },
  achieved: { icon: CheckCircle2, variant: "success", label: "Achieved" },
  missed: { icon: AlertCircle, variant: "error", label: "Missed" },
};

export function GoalProgressCard({
  metric,
  targetValue,
  currentValue,
  achievementPercent,
  targetDeadline,
  status,
}: GoalProgressCardProps) {
  const percent = typeof achievementPercent === "string"
    ? parseFloat(achievementPercent)
    : achievementPercent;

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.in_progress;
  const StatusIcon = config.icon;
  const deadline = new Date(targetDeadline);
  const isOverdue = isPast(deadline) && status === "in_progress";

  // Format deadline
  const formattedDeadline = deadline.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Calculate ETA text
  const etaText = isPast(deadline)
    ? `${formatDistanceToNow(deadline)} ago`
    : `in ${formatDistanceToNow(deadline)}`;

  return (
    <Card>
      {/* Header with title and status */}
      <div className="px-7 py-5 flex items-center justify-between border-b border-hairline-2">
        <div className="flex items-center gap-3">
          {/* Semantic icon */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              status === "achieved" && "bg-success-soft text-success",
              status === "in_progress" && "bg-accent-soft text-accent",
              status === "missed" && "bg-error-soft text-error"
            )}
          >
            <StatusIcon className="w-4 h-4" />
          </div>

          {/* Title */}
          <h3 className="font-sans text-[15px] font-medium text-text-1">
            {METRIC_LABELS[metric] ?? metric}
          </h3>
        </div>

        {/* Status badge */}
        <Badge variant={config.variant} dot>
          {config.label}
        </Badge>
      </div>

      <CardContent className="space-y-6">
        {/* Progress block - the editorial moment */}
        <ProgressBlock
          current={currentValue}
          target={targetValue}
          unit="keywords"
          size="card"
          showBar
          secondaryMetric={{
            value: `${percent.toFixed(0)}%`,
            label: "complete",
          }}
        />

        {/* ETA and deadline row */}
        <div className="flex items-center justify-between pt-2 border-t border-hairline-3">
          <div className="flex items-center gap-2">
            <TrendingUp className={cn(
              "w-4 h-4",
              isOverdue ? "text-error" : "text-accent"
            )} />
            <span className={cn(
              "text-[13px]",
              isOverdue ? "text-error" : "text-text-2"
            )}>
              {isOverdue ? "Overdue" : "On track"} - {etaText}
            </span>
          </div>

          <span className="text-[13px] text-text-3">
            Target: <span className="text-text-2 font-medium">{formattedDeadline}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

GoalProgressCard.displayName = "GoalProgressCard";

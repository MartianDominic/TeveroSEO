/**
 * Goal Progress Card
 * Phase 89-06: Progress Tracking UI
 *
 * Displays contract goal with achievement percentage.
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

export interface GoalProgressCardProps {
  id?: string;
  metric: string;
  targetValue: number;
  currentValue: number;
  achievementPercent: string | number;
  targetDeadline: string | Date;
  status: "in_progress" | "achieved" | "missed";
}

const METRIC_LABELS: Record<string, string> = {
  keywords_in_top_10: "Keywords in Top 10",
  traffic_increase: "Traffic Increase",
  ranking_improvement: "Ranking Improvement",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; variant: "default" | "secondary" | "destructive"; label: string }> = {
  in_progress: { icon: Clock, variant: "secondary", label: "In Progress" },
  achieved: { icon: CheckCircle2, variant: "default", label: "Achieved" },
  missed: { icon: AlertCircle, variant: "destructive", label: "Missed" },
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

  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.in_progress;
  const StatusIcon = statusConfig.icon;

  const deadline = new Date(targetDeadline);
  const formattedDeadline = deadline.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Cap progress bar at 100% visually, but show actual percent in text
  const progressValue = Math.min(percent, 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">
            {METRIC_LABELS[metric] ?? metric}
          </CardTitle>
          <Badge variant={statusConfig.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">
                {percent >= 100 ? (
                  <span className="text-green-600">{percent.toFixed(0)}%</span>
                ) : (
                  `${percent.toFixed(0)}%`
                )}
              </span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Current</p>
              <p className="text-2xl font-bold">{currentValue}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Target</p>
              <p className="text-2xl font-bold">{targetValue}</p>
            </div>
          </div>

          {/* Deadline */}
          <div className="text-sm text-muted-foreground">
            Target deadline: {formattedDeadline}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

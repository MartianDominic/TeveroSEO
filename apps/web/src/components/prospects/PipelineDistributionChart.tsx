"use client";

import { useMemo } from "react";
import { Badge } from "@tevero/ui";

interface PipelineDistributionChartProps {
  prospects: Array<{ status: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500" },
  analyzing: { label: "Analyzing", color: "bg-yellow-500" },
  analyzed: { label: "Analyzed", color: "bg-emerald-500" },
  converted: { label: "Converted", color: "bg-purple-500" },
  archived: { label: "Archived", color: "bg-gray-400" },
};

export function PipelineDistributionChart({
  prospects,
}: PipelineDistributionChartProps) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of prospects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [prospects]);

  const total = prospects.length;

  if (total === 0) {
    return null;
  }

  const statuses = ["new", "analyzing", "analyzed", "converted", "archived"];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm">
        {statuses.map((status) => {
          const count = distribution[status] || 0;
          if (count === 0) return null;
          const config = STATUS_CONFIG[status];
          return (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
              <span className="text-muted-foreground">{config.label}:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {count}
              </Badge>
            </div>
          );
        })}
      </div>

      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
        {statuses.map((status) => {
          const count = distribution[status] || 0;
          if (count === 0) return null;
          const percent = (count / total) * 100;
          const config = STATUS_CONFIG[status];
          return (
            <div
              key={status}
              className={`h-full ${config.color} transition-all`}
              style={{ width: `${percent}%` }}
              title={`${config.label}: ${count} (${percent.toFixed(1)}%)`}
            />
          );
        })}
      </div>
    </div>
  );
}

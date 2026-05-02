"use client";

/**
 * PipelineFunnel Component
 * Phase 62-05: Command Center Dashboard Core
 *
 * Recharts funnel visualization of pipeline conversion stages.
 * Implemented in Task 3.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FunnelChart,
  Funnel,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useDashboardMetrics } from "@/hooks/command-center/useDashboardMetrics";
import type { DashboardMetricsResponse } from "@/types/dashboard-metrics";

interface PipelineFunnelProps {
  initialData: DashboardMetricsResponse;
  workspaceId: string;
}

export function PipelineFunnel({
  initialData,
  workspaceId,
}: PipelineFunnelProps) {
  const { data } = useDashboardMetrics(workspaceId, { initialData });
  const pipeline = data?.metrics?.pipeline;
  const conversions = data?.metrics?.conversions;

  const funnelData = [
    {
      name: "New Prospects",
      value: pipeline?.prospects?.new ?? 0,
      fill: "#3b82f6",
    },
    {
      name: "Qualified",
      value: pipeline?.prospects?.qualified ?? 0,
      fill: "#6366f1",
    },
    {
      name: "Proposals Sent",
      value: pipeline?.proposals?.sent ?? 0,
      fill: "#8b5cf6",
    },
    {
      name: "Agreements Signed",
      value: pipeline?.agreements?.signed ?? 0,
      fill: "#a855f7",
    },
    {
      name: "Invoices Paid",
      value: pipeline?.payments?.paid30d ?? 0,
      fill: "#22c55e",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <FunnelChart>
            <Tooltip
              formatter={(value: number) => value.toLocaleString()}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Funnel data={funnelData} dataKey="value" isAnimationActive>
              <LabelList
                dataKey="name"
                position="right"
                fill="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <LabelList
                dataKey="value"
                position="center"
                fill="#fff"
                fontWeight="bold"
                fontSize={14}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>

        {/* Conversion stats footer */}
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-muted-foreground">
            Win Rate: {((conversions?.winRate ?? 0) * 100).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">
            Avg Cycle: {conversions?.avgCycleDays ?? 0} days
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

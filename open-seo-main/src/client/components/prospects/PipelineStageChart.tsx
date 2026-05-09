/**
 * Pipeline stage distribution chart.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Horizontal bar chart showing prospect counts by pipeline stage.
 * UI-04/05/06: Uses chart theme CSS variables, error boundary, loading states.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PipelineStage } from "@/db/prospect-schema";
import { ChartErrorBoundary } from "@/components/charts/ChartErrorBoundary";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface StageData {
  stage: PipelineStage;
  count: number;
}

interface PipelineStageChartProps {
  data: StageData[];
  height?: number;
  className?: string;
  isLoading?: boolean;
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  new: "#94a3b8",      // slate-400
  analyzing: "#60a5fa", // blue-400
  scored: "#a78bfa",    // violet-400
  qualified: "#34d399", // emerald-400
  contacted: "#fbbf24", // amber-400
  negotiating: "#f97316", // orange-500
  converted: "#22c55e", // green-500
  archived: "#6b7280",  // gray-500
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  new: "Naujas",
  analyzing: "Analizuojama",
  scored: "Ivertintas",
  qualified: "Kvalifikuotas",
  contacted: "Susisiekta",
  negotiating: "Derybos",
  converted: "Konvertuotas",
  archived: "Archyvuotas",
};

interface TooltipPayload {
  payload: StageData & { label: string };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-background/95 px-3 py-2 shadow-[var(--shadow-overlay)] backdrop-blur-sm">
      <p className="text-sm font-medium">{STAGE_LABELS[data.stage]}</p>
      <p className="text-xs-safe text-muted-foreground">{data.count} prospects</p>
    </div>
  );
}

export function PipelineStageChart({
  data,
  height = 300,
  className = "",
  isLoading = false,
}: PipelineStageChartProps) {
  // Show skeleton while loading
  if (isLoading) {
    return <ChartSkeleton variant="bar" height={height} className={className} />;
  }

  // Map data with labels for display
  const chartData = data.map((d) => ({
    ...d,
    label: STAGE_LABELS[d.stage],
  }));

  const totalProspects = data.reduce((sum, d) => sum + d.count, 0);

  if (totalProspects === 0) {
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${className}`}
        style={{ height }}
      >
        No prospects yet
      </div>
    );
  }

  return (
    <ChartErrorBoundary fallbackHeight={height}>
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              width={90}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={30}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={STAGE_COLORS[entry.stage]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartErrorBoundary>
  );
}

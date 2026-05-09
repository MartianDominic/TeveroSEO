/**
 * CTR Benchmark Chart Component
 * Phase 96-05: Client Portal
 *
 * Line chart showing CTR comparison:
 * - Benchmark CTR curve (gray dashed line)
 * - Client's actual CTR by position (solid line)
 * - Above/below indicators (green/red dots)
 *
 * Design System v6: Recharts with consistent styling.
 * UI-04/05/06: Uses chart theme CSS variables, error boundary, loading states.
 */
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_MARGINS,
} from '@/components/charts/chart-theme';
import { ChartWrapper } from '@/components/charts/ChartWrapper';

interface CtrDataPoint {
  position: number;
  benchmarkCtr: number;
  actualCtr?: number;
  status?: 'above' | 'at' | 'below';
}

interface CtrBenchmarkChartProps {
  data: CtrDataPoint[];
  maxPosition?: number;
  showActual?: boolean;
  title?: string;
  isLoading?: boolean;
}

export function CtrBenchmarkChart({
  data,
  maxPosition = 20,
  showActual = true,
  title = 'CTR vs Position Benchmark',
  isLoading = false,
}: CtrBenchmarkChartProps) {
  // Filter to max position
  const chartData = data.filter((d) => d.position <= maxPosition);

  // Calculate domains
  const maxCtr = Math.max(...chartData.map((d) => Math.max(d.benchmarkCtr, d.actualCtr || 0)));
  const yDomain = [0, Math.ceil(maxCtr * 100) / 100 + 0.05];

  return (
    <Card className="bg-card shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-medium text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartWrapper
          isLoading={isLoading}
          isEmpty={chartData.length === 0}
          emptyMessage="No CTR data available"
          variant="composed"
          height={300}
          showLegend
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={CHART_MARGINS}>
                <CartesianGrid
                  strokeDasharray={CHART_GRID.strokeDasharray}
                  stroke={CHART_GRID.stroke}
                  strokeOpacity={CHART_GRID.strokeOpacity}
                />
                <XAxis
                  dataKey="position"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  label={{
                    value: 'Position',
                    position: 'bottom',
                    offset: 5,
                    style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
                  }}
                />
                <YAxis
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  domain={yDomain}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  label={{
                    value: 'CTR',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload as CtrDataPoint;
                      return (
                        <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-[var(--shadow-elevated)]">
                          <p className="text-[13px] font-medium text-popover-foreground">
                            Position {dataPoint.position}
                          </p>
                          <p className="text-[12px] text-muted-foreground mt-1">
                            Benchmark: {(dataPoint.benchmarkCtr * 100).toFixed(1)}%
                          </p>
                          {dataPoint.actualCtr !== undefined && (
                            <>
                              <p className="text-[12px] text-popover-foreground mt-0.5">
                                Actual: {(dataPoint.actualCtr * 100).toFixed(1)}%
                              </p>
                              <p
                                className={`text-[12px] font-medium mt-1 ${
                                  dataPoint.status === 'above'
                                    ? 'text-success'
                                    : dataPoint.status === 'below'
                                      ? 'text-destructive'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {dataPoint.status === 'above'
                                  ? 'Above benchmark'
                                  : dataPoint.status === 'below'
                                    ? 'Below benchmark'
                                    : 'At benchmark'}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => (
                    <span className="text-[12px] text-muted-foreground">{value}</span>
                  )}
                />

                {/* Benchmark line (dashed) */}
                <Line
                  type="monotone"
                  dataKey="benchmarkCtr"
                  name="Industry Benchmark"
                  stroke={CHART_COLORS.muted}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive={false}
                />

                {/* Actual CTR line (solid) */}
                {showActual && (
                  <Line
                    type="monotone"
                    dataKey="actualCtr"
                    name="Your CTR"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (!payload.actualCtr) return <></>;

                      const color =
                        payload.status === 'above'
                          ? CHART_COLORS.success
                          : payload.status === 'below'
                            ? CHART_COLORS.destructive
                            : CHART_COLORS.muted;

                      return (
                        <circle
                          key={`dot-${payload.position}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={color}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartWrapper>

        {/* Legend explanation */}
        <div className="mt-4 flex items-center gap-6 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span>Above benchmark</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span>Below benchmark</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span>At benchmark</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mini version for dashboard cards
 */
export function CtrBenchmarkMini({
  position,
  benchmarkCtr,
  actualCtr,
  status,
}: {
  position: number;
  benchmarkCtr: number;
  actualCtr: number;
  status: 'above' | 'at' | 'below';
}) {
  const statusColor =
    status === 'above' ? 'text-success' : status === 'below' ? 'text-error' : 'text-text-3';

  const statusLabel =
    status === 'above'
      ? 'Above benchmark'
      : status === 'below'
        ? 'Below benchmark'
        : 'At benchmark';

  return (
    <div className="flex items-center justify-between py-2 border-b border-hairline last:border-0">
      <div>
        <span className="text-[13px] text-text-2">Position {position}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[13px] font-medium tabular-nums text-text-1">
            {(actualCtr * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-text-3">
            vs {(benchmarkCtr * 100).toFixed(1)}% benchmark
          </div>
        </div>
        <span className={`text-[12px] font-medium ${statusColor}`}>{statusLabel}</span>
      </div>
    </div>
  );
}
